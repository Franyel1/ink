import { createClient } from "@/lib/supabase/client";

export interface LetGo {
  id: string;
  text: string;
  released: boolean;
  created_at: string;
}

export async function fetchLetGos(): Promise<LetGo[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("let_gos")
    .select("*")
    .order("released", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LetGo[];
}

export async function addLetGo(text: string): Promise<LetGo> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("let_gos")
    .insert({ user_id: user.id, text })
    .select()
    .single();
  if (error) throw error;
  return data as LetGo;
}

export async function toggleReleased(id: string, released: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("let_gos").update({ released }).eq("id", id);
  if (error) throw error;
}

export async function deleteLetGo(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("let_gos").delete().eq("id", id);
  if (error) throw error;
}
