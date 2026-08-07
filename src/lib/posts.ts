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
  "id, user_id, content, post_type, is_pinned, created_at, updated_at, ai_processed, ai_comment, ai_summary, ai_sentiment, ai_topics, quoted_post_id, post_images(*), post_tags(tag_id, tags(*)), post_people(person_id, people(id, name)), quoted_post:quoted_post_id(id, content, post_type, created_at, post_images(image_url))";

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

export async function fetchPosts(): Promise<Post[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .order("created_at", { ascending: false });
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

async function uploadImages(userId: string, files: File[]): Promise<string[]> {
  const supabase = createClient();
  const urls: string[] = [];
  for (const file of files) {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("post-images")
      .upload(path, file, { contentType: file.type || "image/jpeg" });
    if (error) throw error;
    const { data } = supabase.storage.from("post-images").getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

export interface PostInput {
  content: string;
  postType: PostType;
  tagIds: string[];
  newFiles: File[];
  /** Set only when writing a new post that quotes an older one. */
  quotedPostId?: string | null;
}

export async function createPost(input: PostInput): Promise<Post> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      user_id: user.id,
      content: input.content,
      post_type: input.postType,
      quoted_post_id: input.quotedPostId ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  if (input.newFiles.length > 0) {
    const urls = await uploadImages(user.id, input.newFiles);
    const { error: imgError } = await supabase
      .from("post_images")
      .insert(urls.map((url) => ({ post_id: post.id, image_url: url })));
    if (imgError) throw imgError;
  }

  if (input.tagIds.length > 0) {
    const { error: tagError } = await supabase
      .from("post_tags")
      .insert(input.tagIds.map((tagId) => ({ post_id: post.id, tag_id: tagId })));
    if (tagError) throw tagError;
  }

  // Hand the post to the AI layer in the background; posting never waits on it.
  // Embedding is chained after analysis rather than fired alongside it, so the
  // vector covers the summary and topics the analysis produces, not just the
  // raw text. If analysis fails the post stays queued and the next drain
  // embeds whatever text it does have.
  void fetch("/api/posts/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postId: post.id }),
  })
    .catch(() => {})
    .finally(() => embedPending());

  return refetchPost(post.id);
}

export async function updatePost(
  postId: string,
  input: PostInput
): Promise<Post> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { error } = await supabase
    .from("posts")
    .update({
      content: input.content,
      post_type: input.postType,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);
  if (error) throw error;

  if (input.newFiles.length > 0) {
    const urls = await uploadImages(user.id, input.newFiles);
    const { error: imgError } = await supabase
      .from("post_images")
      .insert(urls.map((url) => ({ post_id: postId, image_url: url })));
    if (imgError) throw imgError;
  }

  // Reset tags to the current selection
  await supabase.from("post_tags").delete().eq("post_id", postId);
  if (input.tagIds.length > 0) {
    const { error: tagError } = await supabase
      .from("post_tags")
      .insert(input.tagIds.map((tagId) => ({ post_id: postId, tag_id: tagId })));
    if (tagError) throw tagError;
  }

  return refetchPost(postId);
}

async function refetchPost(postId: string): Promise<Post> {
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
