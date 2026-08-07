import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { EMBEDDING_MODEL } from "@/lib/embeddings";

/**
 * Matches a phrase against the meaning of the user's posts rather than their
 * wording. Returns ids and scores only: the client already holds the posts, so
 * shipping them back would just be a second copy to keep in sync.
 */
export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ matches: [], skipped: "no api key" });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { query } = await request.json().catch(() => ({}));
  if (typeof query !== "string" || query.trim().length < 2) {
    return NextResponse.json({ matches: [] });
  }

  const openai = new OpenAI();

  try {
    const embedding = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: query.trim().slice(0, 2000),
    });
    const vector = embedding.data[0]?.embedding;
    if (!vector) return NextResponse.json({ matches: [] });

    // match_posts runs SECURITY INVOKER, so RLS confines this to own posts.
    const { data, error } = await supabase.rpc("match_posts", {
      query_embedding: vector,
      match_count: 30,
      min_similarity: 0.15,
    });
    if (error) {
      return NextResponse.json({ error: "search failed" }, { status: 500 });
    }

    return NextResponse.json({ matches: data ?? [] });
  } catch (err) {
    if (err instanceof OpenAI.RateLimitError) {
      return NextResponse.json({ error: "rate limited" }, { status: 429 });
    }
    return NextResponse.json({ error: "search failed" }, { status: 500 });
  }
}
