import { createClient } from "@/lib/supabase/client";

/**
 * The notebook's running note about you, handled a line at a time.
 *
 * It's stored as one paragraph because that's how the model writes and rewrites
 * it, but a paragraph is the wrong thing to hand someone who wants to remove
 * one wrong claim about themselves. So it's split for reading and editing, and
 * rejoined for storage: the model keeps its paragraph, you get sentences.
 */

/**
 * Split on sentence-ending punctuation followed by a capital. Requiring the
 * capital keeps "e.g." and similar from breaking a line in half; the memory
 * prompt asks for plain sentences, so this holds in practice.
 */
export function splitMemory(memory: string | null): string[] {
  if (!memory) return [];
  return memory
    .split(/(?<=[.!?])\s+(?=[A-Z"'(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function joinMemory(lines: string[]): string {
  return lines.join(" ").trim();
}

export interface NotebookMemory {
  lines: string[];
  forgotten: string[];
}

export async function fetchMemory(): Promise<NotebookMemory> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("profiles")
    .select("notebook_memory, notebook_forgotten")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;

  return {
    lines: splitMemory(data?.notebook_memory ?? null),
    forgotten: Array.isArray(data?.notebook_forgotten)
      ? (data.notebook_forgotten as string[])
      : [],
  };
}

/**
 * Drops one line and records it, so the next rewrite is told not to write it
 * back. Returns the lines that remain.
 */
export async function forgetLine(line: string): Promise<string[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const current = await fetchMemory();
  const remaining = current.lines.filter((l) => l !== line);
  // Cap the list: it exists to steer one prompt, not to become a second,
  // permanent record of everything someone ever wanted gone.
  const forgotten = [...current.forgotten.filter((l) => l !== line), line].slice(-40);

  const { error } = await supabase
    .from("profiles")
    .update({
      notebook_memory: remaining.length > 0 ? joinMemory(remaining) : null,
      notebook_forgotten: forgotten,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (error) throw error;
  return remaining;
}

/**
 * Wipes the note and the forget-list together. Keeping a record of what to
 * forget after being asked to forget everything would be the one thing this
 * screen promises not to do.
 */
export async function forgetAllMemory(): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { error } = await supabase
    .from("profiles")
    .update({
      notebook_memory: null,
      notebook_forgotten: [],
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (error) throw error;
}
