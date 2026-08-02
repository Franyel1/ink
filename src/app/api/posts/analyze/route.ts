import { NextResponse } from "next/server";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const AnalysisSchema = z.object({
  comment: z
    .string()
    .describe(
      "The main thing shown to the user: a genuine reaction to this specific " +
        "post, written the way someone who knows this person well would actually " +
        "comment on it — not a summary of what it says. React, riff, ask a small " +
        "question, notice a detail, push back gently, or just be warm — whatever a " +
        "real comment would do. One short sentence, under ~15 words, second " +
        "person, conversational, no preamble like 'I noticed' or 'It sounds " +
        "like'. Never clinical, never therapy-speak, never generically flattering."
    ),
  notice: z
    .string()
    .describe(
      "A short, quiet side note (under ~12 words) naming a pattern this connects " +
        "to in their background or recent posts, only if there's a real, " +
        "non-obvious link — otherwise leave it empty."
    ),
  sentiment: z
    .enum(["positive", "negative", "mixed", "neutral"])
    .describe("Overall emotional tone of the post"),
  topics: z
    .array(z.string())
    .describe("1-5 short lowercase topic tags, e.g. 'family', 'cooking'"),
  people: z
    .array(
      z.object({
        name: z
          .string()
          .describe(
            "The person's name or how they're referred to (e.g. 'Mom', 'Jess', " +
              "'my manager'). Use the same name consistently across posts so " +
              "mentions of the same person merge — prefer a first name over a " +
              "role once you know it."
          ),
        relationship: z
          .string()
          .describe(
            "Short relationship label if inferable (e.g. 'sister', 'coworker', " +
              "'friend'), otherwise empty."
          ),
        note: z
          .string()
          .describe(
            "The full, rewritten set of notes about this person: fold in what's " +
              "already known about them (given below) with anything new from this " +
              "post. Plain sentences, under ~60 words, third person, no headers. " +
              "Don't invent detail that isn't supported."
          ),
      })
    )
    .describe(
      "Real people (not organizations, pets, or public figures) mentioned or " +
        "clearly referenced in this post. Empty array if none."
    ),
});

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ skipped: "no api key" }, { status: 200 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { postId } = await request.json().catch(() => ({}));
  if (!postId || typeof postId !== "string") {
    return NextResponse.json({ error: "postId required" }, { status: 400 });
  }

  // RLS scopes everything below to the caller's own data
  const [{ data: post }, { data: profile }, { data: recentPosts }, { data: people }] =
    await Promise.all([
      supabase
        .from("posts")
        .select("id, content, post_type, ai_processed")
        .eq("id", postId)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select(
          "personality, beliefs, handling_good, handling_bad, improvement_goal, notebook_memory"
        )
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("posts")
        .select("ai_summary, ai_topics")
        .eq("ai_processed", true)
        .neq("id", postId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("people")
        .select("id, name, relationship, notes, mention_count")
        .order("last_mentioned_at", { ascending: false }),
    ]);
  if (!post || !post.content) {
    return NextResponse.json({ error: "post not found" }, { status: 404 });
  }
  if (post.ai_processed) {
    return NextResponse.json({ skipped: "already processed" });
  }

  const backgroundLines = profile
    ? [
        profile.personality && `Personality: ${profile.personality}`,
        profile.beliefs && `Beliefs: ${JSON.stringify(profile.beliefs)}`,
        profile.handling_bad && `Handles bad situations: ${profile.handling_bad}`,
        profile.handling_good && `Handles good situations: ${profile.handling_good}`,
        profile.improvement_goal && `Wants to improve: ${profile.improvement_goal}`,
        profile.notebook_memory && `Notebook memory: ${profile.notebook_memory}`,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const recentLines = (recentPosts ?? [])
    .map((p) => {
      const topics = Array.isArray(p.ai_topics) ? ` [${p.ai_topics.join(", ")}]` : "";
      return p.ai_summary ? `- ${p.ai_summary}${topics}` : null;
    })
    .filter(Boolean)
    .join("\n");

  const peopleLines = (people ?? [])
    .map(
      (p) =>
        `- ${p.name}${p.relationship ? ` (${p.relationship})` : ""}: ${
          p.notes || "(nothing noted yet)"
        }`
    )
    .join("\n");

  const openai = new OpenAI();

  try {
    const response = await openai.chat.completions.parse({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "You read short personal journal posts for a private, ink-and-paper " +
            "journal app and leave a comment on them — the way a close friend who " +
            "actually knows this person's history would, not a stranger summarizing " +
            "text. You're given background on who they are; use it to shape your " +
            "tone and what you pick up on, but don't force a connection to their " +
            "background if there isn't a real one — most comments should just be a " +
            "genuine reaction to this post on its own.\n\n" +
            "You also keep a small record of people who come up in their posts. " +
            "Reuse a person's existing entry (matching by name) and rewrite their " +
            "notes to fold in anything new, rather than starting over. Don't list " +
            "someone who isn't a real, specific person actually mentioned.",
        },
        {
          role: "user",
          content:
            `About this person:\n${backgroundLines || "(nothing yet)"}\n\n` +
            `Their recent posts, for context on patterns (newest first):\n${
              recentLines || "(none yet)"
            }\n\n` +
            `People already on record:\n${peopleLines || "(none yet)"}\n\n` +
            `Analyze this new journal post (type: ${post.post_type}):\n\n${post.content}`,
        },
      ],
      response_format: zodResponseFormat(AnalysisSchema, "post_analysis"),
    });

    const analysis = response.choices[0]?.message?.parsed;
    if (!analysis) {
      return NextResponse.json({ skipped: "no analysis" });
    }

    const { error } = await supabase
      .from("posts")
      .update({
        ai_processed: true,
        ai_comment: analysis.comment,
        ai_summary: analysis.notice.trim() || null,
        ai_sentiment: analysis.sentiment,
        ai_topics: analysis.topics,
        ai_embedding_status: "not_processed",
      })
      .eq("id", post.id);
    if (error) throw error;

    const existingByName = new Map(
      (people ?? []).map((p) => [p.name.toLowerCase(), p])
    );
    for (const mention of analysis.people) {
      const name = mention.name.trim();
      if (!name) continue;
      const existing = existingByName.get(name.toLowerCase());

      const { data: personRow, error: personError } = await supabase
        .from("people")
        .upsert(
          {
            user_id: user.id,
            name,
            relationship: mention.relationship.trim() || existing?.relationship || null,
            notes: mention.note.trim() || null,
            mention_count: (existing?.mention_count ?? 0) + 1,
            last_mentioned_at: new Date().toISOString(),
          },
          { onConflict: "user_id,name" }
        )
        .select("id")
        .single();
      if (personError || !personRow) continue;

      await supabase
        .from("post_people")
        .upsert(
          { post_id: post.id, person_id: personRow.id, user_id: user.id },
          { onConflict: "post_id,person_id" }
        );
    }

    return NextResponse.json({ ok: true, people: analysis.people.length });
  } catch (err) {
    if (err instanceof OpenAI.RateLimitError) {
      return NextResponse.json({ error: "rate limited" }, { status: 429 });
    }
    if (err instanceof OpenAI.APIError) {
      return NextResponse.json(
        { error: `api error ${err.status}` },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: "analysis failed" }, { status: 500 });
  }
}
