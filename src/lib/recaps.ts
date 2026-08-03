import { createClient } from "@/lib/supabase/client";

export interface Recap {
  id: string;
  period_start: string;
  period_end: string;
  content: string;
  created_at: string;
}

export async function fetchLatestRecap(): Promise<Recap | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("recaps")
    .select("*")
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as Recap) ?? null;
}
