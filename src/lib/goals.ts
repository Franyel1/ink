import { createClient } from "@/lib/supabase/client";

export interface Goal {
  id: string;
  raw_text: string;
  refined_text: string | null;
  done: boolean;
  created_at: string;
}

export async function fetchGoals(): Promise<Goal[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .order("done", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Goal[];
}

export async function addGoal(rawText: string): Promise<Goal> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("goals")
    .insert({ user_id: user.id, raw_text: rawText })
    .select()
    .single();
  if (error) throw error;

  // Ask the server to tighten the wording; failures leave raw_text as-is.
  void fetch("/api/goals/refine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goalId: data.id }),
  }).catch(() => {});

  return data as Goal;
}

export async function toggleGoalDone(id: string, done: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("goals")
    .update({ done, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteGoal(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) throw error;
}
