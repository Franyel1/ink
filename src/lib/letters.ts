import { createClient } from "@/lib/supabase/client";

export interface Letter {
  id: string;
  content: string;
  chosen_prompts: string[] | null;
  target_open_date: string;
  opened_at: string | null;
  created_at: string;
}

export async function fetchLetters(): Promise<Letter[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("letters")
    .select("*")
    .order("target_open_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Letter[];
}

export async function fetchLetterPrompts(): Promise<string[]> {
  const res = await fetch("/api/letters/prompts", { method: "POST" });
  if (!res.ok) return [];
  const body = await res.json().catch(() => ({}));
  return (body?.prompts ?? []) as string[];
}

export async function createLetter(
  content: string,
  chosenPrompts: string[],
  targetOpenDate: string
): Promise<Letter> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("letters")
    .insert({
      user_id: user.id,
      content,
      chosen_prompts: chosenPrompts,
      target_open_date: targetOpenDate,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Letter;
}

export function isLetterUnlocked(letter: Letter): boolean {
  return letter.target_open_date <= new Date().toISOString().slice(0, 10);
}

export async function markLetterOpened(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("letters")
    .update({ opened_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
