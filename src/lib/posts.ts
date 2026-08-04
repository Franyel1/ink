import { createClient } from "@/lib/supabase/client";
import type { Post, PostType, Tag } from "@/lib/types";

export const POST_SELECT =
  "*, post_images(*), post_tags(tag_id, tags(*)), post_people(person_id, people(id, name))";

export async function fetchPosts(): Promise<Post[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Post[];
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
  void fetch("/api/posts/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postId: post.id }),
  }).catch(() => {});

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
  return data as Post;
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
