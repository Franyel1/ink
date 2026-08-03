import { createClient } from "@/lib/supabase/client";

export interface Want {
  id: string;
  text: string;
  done: boolean;
  created_at: string;
}

export async function fetchWants(): Promise<Want[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("wants")
    .select("*")
    .order("done", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Want[];
}

export async function addWant(text: string): Promise<Want> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("wants")
    .insert({ user_id: user.id, text })
    .select()
    .single();
  if (error) throw error;
  return data as Want;
}

export async function toggleWantDone(id: string, done: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("wants").update({ done }).eq("id", id);
  if (error) throw error;
}

export async function deleteWant(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("wants").delete().eq("id", id);
  if (error) throw error;
}
