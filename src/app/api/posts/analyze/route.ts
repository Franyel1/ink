import { NextResponse } from "next/server";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";

/** Keep the vision call cheap: shrink and re-encode before sending. */
const MAX_IMAGE_DIMENSION = 768;
const JPEG_QUALITY = 65;
const MAX_IMAGES_PER_POST = 4;

async function compressImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    const jpeg = await sharp(bytes)
      .rotate()
      .resize({
        width: MAX_IMAGE_DIMENSION,
        height: MAX_IMAGE_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

const AnalysisSchema = z.object({
  comment: z
    .string()
    .describe(
      "The main thing shown to the user: a genuine reaction to this specific " +
        "post, written the way someone who knows this person well would actually " +
        "comment on it — not a summary of what it says. React, riff, ask a small " +
        "question, notice a detail, push back gently, joke, or just be plainly " +
        "observational — whatever a real comment would do. One short sentence, " +
        "under ~15 words, second person, conversational, no preamble like 'I " +
        "noticed' or 'It sounds like'.\n" +
        "Don't hype up or affirm the person for existing — no 'only you could', " +
        "no remarks on how they look/are as a person, no 'iconic', 'main " +
        "character', 'love this for you', or similar. But real praise for a real " +
        "accomplishment is fine and good — if they finished something hard, hit " +
        "a goal, or did something that actually took effort, a plain 'good job' " +
        "or 'that's a big one' is a genuine reaction, not flattery. The " +
        "difference: praise the specific thing they did, never their character, " +
        "vibe, or looks. If there's nothing earned to react to, say something " +
        "small and specific about the post instead of complimenting them."
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
        .select("id, content, post_type, ai_processed, post_images(image_url)")
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
  const images = (post?.post_images ?? []) as { image_url: string }[];
  if (!post || (!post.content && images.length === 0)) {
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

  const compressedImages = (
    await Promise.all(
      images.slice(0, MAX_IMAGES_PER_POST).map((img) => compressImage(img.image_url))
    )
  ).filter((uri): uri is string => uri !== null);

  const openai = new OpenAI();

  try {
    const response = await openai.chat.completions.parse({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "You read short personal journal posts — sometimes with photos — for " +
            "a private, ink-and-paper journal app, and leave a comment on them — " +
            "the way a close friend who actually knows this person's history " +
            "would, not a stranger summarizing text or describing a picture. " +
            "You're given background on who they are; use it to shape your tone " +
            "and what you pick up on, but don't force a connection to their " +
            "background if there isn't a real one — most comments should just be a " +
            "genuine reaction to this post on its own.\n\n" +
            "Do not act like a typical AI assistant trying to make the user feel " +
            "good by default — no hype, no affirming how they look or who they " +
            "are as a person, even subtly ('only you could...', 'that's so you', " +
            "'love that for you'). React to the actual content — the food, the " +
            "activity, the object, the situation — like a friend would, not to " +
            "the person's character or appearance. It's fine to be dry, neutral, " +
            "amused, or a little skeptical; it's not fine to be a cheerleader. " +
            "The exception: if they genuinely accomplished something (finished " +
            "something hard, hit a goal, pulled something off), a plain 'good " +
            "job' is a real reaction, not flattery — earn it, don't default to " +
            "it.\n\n" +
            "Read casual and internet slang the way a fluent user of it would, " +
            "not literally — e.g. 'this ate' / 'I ate with this' means the thing " +
            "was excellent, not that they ate alongside someone; 'no cap' means " +
            "for real; 'lowkey'/'highkey' softens or intensifies a claim; 'bet' " +
            "means agreed. If a phrase reads oddly as literal grammar but makes " +
            "sense as slang, assume slang. When genuinely unsure what something " +
            "means, react to what's clear in the post rather than asking them to " +
            "clarify — a comment should never make the user feel like they wrote " +
            "something confusing.\n\n" +
            "You also keep a small record of people who come up in their posts or " +
            "photos. Reuse a person's existing entry (matching by name) and " +
            "rewrite their notes to fold in anything new, rather than starting " +
            "over. Don't list someone who isn't a real, specific person actually " +
            "mentioned or clearly identifiable.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `About this person:\n${backgroundLines || "(nothing yet)"}\n\n` +
                `Their recent posts, for context on patterns (newest first):\n${
                  recentLines || "(none yet)"
                }\n\n` +
                `People already on record:\n${peopleLines || "(none yet)"}\n\n` +
                `Analyze this new journal post (type: ${post.post_type})${
                  compressedImages.length > 0 ? ", including the attached photo(s)" : ""
                }:\n\n${post.content || "(no text — just the photo(s))"}`,
            },
            ...compressedImages.map((url) => ({
              type: "image_url" as const,
              image_url: { url },
            })),
          ],
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
