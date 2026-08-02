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
