import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { EMBEDDING_MODEL, MAX_EMBED_CHARS } from "@/lib/embeddings";

/**
 * Turns posts into vectors so the notebook can find them by meaning.
 *
 * Runs as a backlog drain rather than per-post: every analyzed post is left at
 * `ai_embedding_status = 'not_processed'`, and this picks up whatever is
 * outstanding. That means a post written offline, or one whose embed call
 * failed, gets picked up on the next pass instead of being lost, and the
 * original backlog from before embeddings existed drains on its own.
 */

/** Kept small so a cold notebook doesn't spend a minute in one request. */
const BATCH_SIZE = 96;

/**
 * Statuses that mean "nothing further to do". `skipped_empty` has to be in
 * here as well as `processed`: a photo-only post never gets a vector, so
 * matching only on `<> 'processed'` left those rows in the backlog forever,
 * re-fetched and re-written on every drain, with `remaining` never reaching 0.
 */
const SETTLED_STATUSES = "(processed,skipped_empty)";

export async function POST() {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ skipped: "no api key" });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // RLS scopes this to the caller's own posts.
  const { data: pending, error: fetchError } = await supabase
    .from("posts")
    .select("id, content, ai_summary, ai_topics")
    .not("ai_embedding_status", "in", SETTLED_STATUSES)
    .order("created_at", { ascending: false })
    .limit(BATCH_SIZE);
  if (fetchError) {
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }
  if (!pending || pending.length === 0) {
    return NextResponse.json({ embedded: 0, remaining: 0 });
  }

  // A photo-only post has no text to embed. Mark it done rather than letting
  // it sit in the queue forever getting re-fetched on every pass.
  const embeddable = pending.filter((p) => p.content?.trim());
  const empty = pending.filter((p) => !p.content?.trim());
  if (empty.length > 0) {
    await supabase
      .from("posts")
      .update({ ai_embedding_status: "skipped_empty" })
      .in(
        "id",
        empty.map((p) => p.id)
      );
  }
  if (embeddable.length === 0) {
    return NextResponse.json({ embedded: 0, skipped: empty.length });
  }

  // Embed the summary and topics alongside the text: the analysis names
  // things the post only implies, which is often what someone searches for
  // later ("that time I was anxious about work" over the literal words used).
  const inputs = embeddable.map((p) => {
    const topics = Array.isArray(p.ai_topics) ? p.ai_topics.join(", ") : "";
    return [p.content, p.ai_summary, topics]
      .filter(Boolean)
      .join("\n")
      .slice(0, MAX_EMBED_CHARS);
  });

  const openai = new OpenAI();

  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: inputs,
    });

    let embedded = 0;
    for (const [i, post] of embeddable.entries()) {
      const vector = response.data[i]?.embedding;
      if (!vector) continue;
      const { error } = await supabase
        .from("posts")
        .update({
          ai_embedding: vector,
          ai_embedding_status: "processed",
        })
        .eq("id", post.id);
      if (!error) embedded += 1;
    }

    const { count } = await supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .not("ai_embedding_status", "in", SETTLED_STATUSES);

    return NextResponse.json({ embedded, remaining: count ?? 0 });
  } catch (err) {
    if (err instanceof OpenAI.RateLimitError) {
      return NextResponse.json({ error: "rate limited" }, { status: 429 });
    }
    if (err instanceof OpenAI.APIError) {
      return NextResponse.json({ error: `api error ${err.status}` }, { status: 502 });
    }
    return NextResponse.json({ error: "embedding failed" }, { status: 500 });
  }
}
