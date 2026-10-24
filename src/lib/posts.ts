import { createClient } from "@/lib/supabase/client";
import type { Post, PostType, Tag } from "@/lib/types";
import type { PostMatch } from "@/lib/embeddings";

// `quoted_post` is a self-join, disambiguated by naming the foreign key column
// (`quoted_post_id`) rather than the table: posts relates to posts in both
// directions otherwise. Deliberately shallow, with no nested quoted_post of
// its own, so a chain of quotes renders exactly one level deep.
/**
 * Columns are listed rather than `*` on purpose: `*` would drag `ai_embedding`
 * along, and a 1536-float vector per post is several KB of JSON the client has
 * no use for, on every feed load and into the offline cache. Add new columns
 * here when they need to reach the UI.
 *
 * Must stay one string literal: supabase-js parses the select at the type
 * level, and `"a" + "b"` widens to `string`, which silently degrades every
 * result to GenericStringError.
 */
export const POST_SELECT =
  "id, revision, user_id, content, post_type, is_pinned, created_at, updated_at, ai_processed, ai_comment, ai_summary, ai_sentiment, ai_topics, quoted_post_id, post_images(*), post_tags(tag_id, tags(*)), post_people(person_id, people(id, name)), quoted_post:quoted_post_id(id, content, post_type, created_at, post_images(image_url))";

/**
 * PostgREST returns the `quoted_post` embed as a single object, since it's a
 * many-to-one, but supabase-js has no generated database types here and widens
 * it to an array. Rather than bet on either shape, flatten both at the one
 * place rows enter the app.
 */
export function normalizePost(row: unknown): Post {
  const r = row as Record<string, unknown>;
  const quoted = Array.isArray(r.quoted_post)
    ? (r.quoted_post[0] ?? null)
    : (r.quoted_post ?? null);
  return { ...r, quoted_post: quoted } as unknown as Post;
}

export async function fetchPosts(
  limit = 12,
  before?: string
): Promise<Post[]> {
  const supabase = createClient();
  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .order("created_at", { ascending: false });
  if (before) query = query.lt("created_at", before);
  const { data, error } = await query.limit(limit);
  if (error) throw error;
  return (data ?? []).map(normalizePost);
}

/**
 * Post ids whose meaning matches `query`, best first. Returns null when the
 * search couldn't run at all (offline, no API key, rate limited) so the caller
 * can fall back to plain text matching instead of showing an empty result.
 */
export async function searchByMeaning(query: string): Promise<PostMatch[] | null> {
  try {
    const res = await fetch("/api/search/semantic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return null;
    const body = await res.json().catch(() => ({}));
    if (!Array.isArray(body?.matches)) return null;
    return body.matches as PostMatch[];
  } catch {
    return null;
  }
}

/**
 * Drains the embedding backlog. Fire and forget: nothing in the UI waits on
 * it, and whatever doesn't finish is picked up on the next call.
 */
export function embedPending(): void {
  void fetch("/api/posts/embed", { method: "POST" }).catch(() => {});
}

export async function fetchTags(): Promise<Tag[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tags")
    .select("*")
    .order("name");
  if (error) throw error;
  return (data ?? []) as Tag[];
}

export interface PostInput {
  content: string;
  postType: PostType;
  tagIds: string[];
  newFiles: File[];
  quotedPostId?: string | null;
}

export class WriteConflict extends Error {
  constructor(public readonly missing = false) {
    super(missing ? "This entry was deleted. Save your writing as a new entry." : "This entry changed on another device.");
  }
}

/** The operation ID and entry ID must survive every network retry. */
export async function savePostOperation(input: PostInput, operation: {
  id: string; postId: string; userId: string; baseRevision: number | null; createdAt: string;
}): Promise<Post> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== operation.userId) throw new Error("Sign in to the account that wrote this entry.");
  // A lost response must not repeat image uploads or resurrect a deleted post.
  const { data: receipt, error: receiptError } = await supabase.from("post_operations")
    .select("post_id").eq("user_id", user.id).eq("operation_id", operation.id).maybeSingle();
  if (receiptError) throw receiptError;
  if (receipt) {
    if (!receipt.post_id) throw new WriteConflict(true);
    return refetchPost(receipt.post_id);
  }
  const urls: string[] = [];
  for (const [index, file] of input.newFiles.entries()) {
    // Immutable per-operation paths also make storage retries idempotent.
    const path = `${user.id}/${operation.id}/${index}`;
    const { error } = await supabase.storage.from("post-images")
      .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
    if (error && !("statusCode" in error && String(error.statusCode) === "409")) throw error;
    urls.push(supabase.storage.from("post-images").getPublicUrl(path).data.publicUrl);
  }
  const { data, error } = await supabase.rpc("save_entry", {
    operation_id: operation.id, entry_id: operation.postId,
    expected_revision: operation.baseRevision, body: input.content, kind: input.postType,
    tags: input.tagIds, images: urls, quoted_id: input.quotedPostId ?? null,
    written_at: operation.createdAt, expected_user: operation.userId,
  });
  if (error) throw error;
  if (data.status !== "saved") throw new WriteConflict(data.status === "missing");
  // Preserve the existing optional analysis pipeline. New features do not need it.
  void fetch("/api/posts/analyze", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postId: data.id }),
  }).catch(() => {}).finally(() => embedPending());
  return refetchPost(data.id);
}

export async function refetchPost(postId: string): Promise<Post> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("id", postId)
    .single();
  if (error) throw error;
  return normalizePost(data);
}

export async function deletePost(postId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) throw error;
}

export async function setPinned(postId: string, pinned: boolean) {
  const supabase = createClient();
  const { error } = await supabase
    .from("posts")
    .update({ is_pinned: pinned })
    .eq("id", postId);
  if (error) throw error;
}

export async function createTag(name: string): Promise<Tag> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("tags")
    .upsert(
      { user_id: user.id, name: name.trim() },
      { onConflict: "user_id,name" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as Tag;
}
