import { NextResponse } from "next/server";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { BELIEFS_RULE, NO_EM_DASHES, VALUES_RULE, sanitizeVoice } from "@/lib/aiStyle";
import { REFLECT_QUESTIONS } from "@/lib/reflectQuestions";
import {
  PEOPLE_RULE,
  PERSON_CONTEXT_SELECT,
  formatPeopleLines,
} from "@/lib/peopleContext";

const GenerationSchema = z.object({
  notebook_memory: z
    .string()
    .describe(
      "The full, rewritten notebook memory: a short, plain-language set of notes " +
        "about who this person is, capturing everything worth remembering from their " +
        "prior answers plus what's new. Not a log, a coherent, deduplicated picture. " +
        "Keep it under ~200 words. Third person, plain sentences, no headers."
    ),
  questions: z
    .array(
      z.object({
        question: z
          .string()
          .describe(
            "A single reflective question, 8-20 words, second person, no preamble"
          ),
      })
    )
    .describe("Exactly 3 new reflection questions"),
});

/** Keep at most this many unanswered generated questions queued up. */
const MAX_PENDING = 3;

export async function POST() {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ generated: 0, skipped: "no api key" });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Everything below is RLS-scoped to this user.
  const [
    { data: posts },
    { data: reflections },
    { data: generated },
    { data: profile },
    { data: people },
  ] = await Promise.all([
    supabase
      .from("posts")
      .select("content, post_type, ai_comment, ai_summary, ai_topics, created_at")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("reflections").select("question_key, question, answer"),
    supabase
      .from("reflect_questions")
      .select("question_key, question")
      .order("created_at", { ascending: true }),
    supabase
      .from("profiles")
      .select(
        "personality, beliefs, handling_good, handling_bad, improvement_goal, notebook_memory, notebook_forgotten"
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("people")
      .select(PERSON_CONTEXT_SELECT)
      .order("mention_count", { ascending: false }),
  ]);

  if (!posts || posts.length === 0) {
    return NextResponse.json({ generated: 0, skipped: "no posts yet" });
  }

  const answeredKeys = new Set((reflections ?? []).map((r) => r.question_key));
  const pending = (generated ?? []).filter(
    (q) => !answeredKeys.has(q.question_key)
  );
  const predeterminedPending = REFLECT_QUESTIONS.filter(
    (q) => !answeredKeys.has(q.key)
  );
  if (pending.length + predeterminedPending.length >= MAX_PENDING) {
    return NextResponse.json({ generated: 0, skipped: "enough pending" });
  }

  const postLines = posts
    .map((p) => {
      const topics = Array.isArray(p.ai_topics) ? ` [${p.ai_topics.join(", ")}]` : "";
      return `- (${p.post_type}, ${String(p.created_at).slice(0, 10)}) ${
        p.content.slice(0, 200)
      }${p.ai_summary ? ` | ${p.ai_summary}` : ""}${topics}`;
    })
    .join("\n");

  const answeredLines = (reflections ?? [])
    .map((r) => `- Q: ${r.question}\n  A: ${r.answer.slice(0, 200)}`)
    .join("\n");

  const peopleLines = formatPeopleLines(people ?? [], { withRecency: true });

  // Lines the user pulled out of the notebook's memory by hand. Without this
  // the rewrite below just puts them back, and removing them was pointless.
  const forgotten = Array.isArray(profile?.notebook_forgotten)
    ? (profile.notebook_forgotten as string[])
    : [];
  const forgottenLines = forgotten.map((f) => `- ${f}`).join("\n");

  const askedBefore = [
    ...REFLECT_QUESTIONS.map((q) => q.question),
    ...(generated ?? []).map((q) => q.question),
  ].join("\n- ");

  const profileLines = profile
    ? [
        profile.personality && `Personality: ${profile.personality}`,
        profile.beliefs && `Beliefs: ${JSON.stringify(profile.beliefs)}`,
        profile.handling_bad && `Handles bad situations: ${profile.handling_bad}`,
        profile.handling_good && `Handles good situations: ${profile.handling_good}`,
        profile.improvement_goal && `Wants to improve: ${profile.improvement_goal}`,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const openai = new OpenAI();

  try {
    const response = await openai.chat.completions.parse({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "You write reflection questions for a private ink-and-paper journal app, " +
            "and you keep a running notebook of notes about the person writing in it. " +
            "The questions appear on the user's reflection page as if the notebook " +
            "itself had been quietly paying attention to what they write.\n\n" +
            "Rules for the notebook memory:\n" +
            "- Rewrite it from scratch each time, folding in anything new from their " +
            "latest answers with what you already knew. It should read as one coherent " +
            "picture of the person, not a diary of turns.\n" +
            "- Note things like: recurring fears or tensions, values, how they cope, " +
            "relationships or people who come up, what they're working toward, " +
            "whatever is actually there. Don't invent detail that isn't supported.\n" +
            "- Never record their religion, faith, or metaphysical beliefs as a " +
            "fact about them, not even neutrally ('trusts science over religion', " +
            "'not religious', 'raised Catholic'). This memory is handed to every " +
            "other part of the app as plain context, so anything written here " +
            "escapes the rules that were protecting it. If a belief matters, it " +
            "will be in their own writing where it belongs.\n" +
            "- Describe what they do and what they've said, not what they are. " +
            "'Ignores social problems' is a verdict that will follow them around " +
            "for months; 'said they tend to leave social friction alone' is what " +
            "was actually on record.\n" +
            "- Where something is still vague or only partly answered, say so plainly " +
            "(e.g. 'unclear what specifically...') so future questions know to dig there.\n" +
            "- You may be given lines the person deleted from this memory " +
            "themselves. Do not write them back, in these words or any others: " +
            "they read something you'd recorded about them and decided it was " +
            "wrong, or private, or not something they wanted kept. Restating it " +
            "in fresh wording is the same as ignoring them. Only if their own " +
            "later writing plainly raises it again does it become fair to note, " +
            "and then from what they wrote, not from what was deleted.\n\n" +
            "Rules for the questions:\n" +
            "- Prefer deepening a thread that's vague, unresolved, or only lightly " +
            "touched in the notebook memory over introducing a brand new topic, " +
            "but don't force it if nothing calls for it.\n" +
            "- Draw on recurring themes, tensions, or small moments from their posts, " +
            "but never quote a post verbatim or name a specific entry, the connection " +
            "should feel intuited, not surveilled.\n" +
            "- One question per theme; each question stands alone.\n" +
            "- Calm, warm, curious tone. Never clinical, never therapy-speak, never flattering.\n" +
            "- Second person, 8-20 words, ends with a question mark.\n" +
            "- Do not repeat or lightly rephrase any previously asked question.\n" +
            "- A question never asks them to reflect through a belief frame " +
            "unless their own posts already put it there. 'What is God teaching " +
            "you here?' is an overstep even for someone who listed a faith.\n" +
            "- A question may reach for a relationship that's clearly present in " +
            "the notebook, including one that's gone quiet, but it asks about " +
            "their own experience of it, never for a status update on the other " +
            "person, and it never names the person outright.\n" +
            "- Never ask the same question twice in different clothes. Two " +
            "questions that both probe what they 'really' want are one " +
            "question asked twice, and the second reads as not having " +
            "listened to the first answer." +
            PEOPLE_RULE +
            BELIEFS_RULE +
            VALUES_RULE +
            NO_EM_DASHES,
        },
        {
          role: "user",
          content:
            `Notebook memory so far:\n${profile?.notebook_memory || "(nothing yet)"}\n\n` +
            (forgottenLines
              ? `They deleted these lines from that memory. Do not write them back:\n${forgottenLines}\n\n`
              : "") +
            `Onboarding answers:\n${profileLines || "(nothing yet)"}\n\n` +
            `Their recent posts (newest first):\n${postLines}\n\n` +
            `People on record in their notebook:\n${
              peopleLines || "(no one yet)"
            }\n\n` +
            `Reflection questions they already answered:\n${answeredLines || "(none yet)"}\n\n` +
            `Questions already asked (do not repeat):\n- ${askedBefore}\n\n` +
            "Rewrite the notebook memory and write 3 new reflection questions for them.",
        },
      ],
      response_format: zodResponseFormat(GenerationSchema, "reflect_generation"),
    });

    const parsed = response.choices[0]?.message?.parsed;
    if (!parsed) {
      return NextResponse.json({ generated: 0, skipped: "no output" });
    }

    const rows = parsed.questions.slice(0, 3).map((q) => ({
      user_id: user.id,
      question_key: `ai-${crypto.randomUUID()}`,
      question: sanitizeVoice(q.question),
    }));

    const [{ error: insertError }, { error: memoryError }] = await Promise.all([
      supabase.from("reflect_questions").insert(rows),
      supabase
        .from("profiles")
        .update({
          notebook_memory: sanitizeVoice(parsed.notebook_memory),
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id),
    ]);
    if (insertError) throw insertError;
    if (memoryError) throw memoryError;

    return NextResponse.json({ generated: rows.length });
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
    return NextResponse.json({ error: "generation failed" }, { status: 500 });
  }
}
