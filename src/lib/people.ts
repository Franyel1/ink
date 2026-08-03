import { createClient } from "@/lib/supabase/client";

export interface Person {
  id: string;
  user_id: string;
  name: string;
  relationship: string | null;
  notes: string | null;
  mention_count: number;
  first_mentioned_at: string;
  last_mentioned_at: string;
}

export async function fetchPeople(): Promise<Person[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("people")
    .select("*")
    .order("last_mentioned_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Person[];
}

export interface PersonPost {
  id: string;
  content: string;
  post_type: string;
  created_at: string;
}

export async function fetchPostsForPerson(personId: string): Promise<PersonPost[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("post_people")
    .select("posts(id, content, post_type, created_at)")
    .eq("person_id", personId)
    .order("created_at", { ascending: false, referencedTable: "posts" });
  if (error) throw error;
  return ((data ?? []) as unknown as { posts: PersonPost | null }[])
    .map((row) => row.posts)
    .filter((p): p is PersonPost => p !== null);
}

export interface MergeSuggestion {
  keepId: string;
  mergeId: string;
  reason: string;
}

export async function fetchMergeSuggestions(): Promise<MergeSuggestion[]> {
  const res = await fetch("/api/people/merge-suggestions", { method: "POST" });
  if (!res.ok) return [];
  const body = await res.json().catch(() => ({}));
  return (body?.suggestions ?? []) as MergeSuggestion[];
}

/**
 * Folds `mergeId` into `keepId`: repoints post links, sums mentions, keeps
 * the earliest first-mention and latest last-mention, and concatenates
 * notes (deduplicated free text merge is left to a future analysis pass —
 * for now the two note sets are just kept side by side).
 */
export async function mergePeople(keepId: string, mergeId: string): Promise<void> {
  const supabase = createClient();
  const { data: rows, error: fetchError } = await supabase
    .from("people")
    .select("*")
    .in("id", [keepId, mergeId]);
  if (fetchError) throw fetchError;
  const keep = (rows as Person[] | null)?.find((p) => p.id === keepId);
  const merge = (rows as Person[] | null)?.find((p) => p.id === mergeId);
  if (!keep || !merge) throw new Error("Person not found");

  // Repoint post links, skipping any that would collide with an existing
  // (post, keep-person) pair already covered by the unique constraint.
  const { data: mergeLinks } = await supabase
    .from("post_people")
    .select("post_id")
    .eq("person_id", mergeId);
  const { data: keepLinks } = await supabase
    .from("post_people")
    .select("post_id")
    .eq("person_id", keepId);
  const keepPostIds = new Set((keepLinks ?? []).map((l) => l.post_id));
  const toRelink = (mergeLinks ?? [])
    .map((l) => l.post_id)
    .filter((postId) => !keepPostIds.has(postId));

  if (toRelink.length > 0) {
    const { error } = await supabase
      .from("post_people")
      .update({ person_id: keepId })
      .eq("person_id", mergeId)
      .in("post_id", toRelink);
    if (error) throw error;
  }
  await supabase.from("post_people").delete().eq("person_id", mergeId);

  const notes = [keep.notes, merge.notes].filter(Boolean).join(" ");
  const { error: updateError } = await supabase
    .from("people")
    .update({
      relationship: keep.relationship || merge.relationship || null,
      notes: notes || null,
      mention_count: keep.mention_count + merge.mention_count,
      first_mentioned_at:
        keep.first_mentioned_at < merge.first_mentioned_at
          ? keep.first_mentioned_at
          : merge.first_mentioned_at,
      last_mentioned_at:
        keep.last_mentioned_at > merge.last_mentioned_at
          ? keep.last_mentioned_at
          : merge.last_mentioned_at,
      updated_at: new Date().toISOString(),
    })
    .eq("id", keepId);
  if (updateError) throw updateError;

  const { error: deleteError } = await supabase.from("people").delete().eq("id", mergeId);
  if (deleteError) throw deleteError;
}
