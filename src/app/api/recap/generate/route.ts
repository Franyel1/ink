import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { createClient } from "@/lib/supabase/server";
import { NO_EM_DASHES } from "@/lib/aiStyle";
import { PEOPLE_RULE } from "@/lib/peopleContext";

const RecapSchema = z.object({
  recap: z
    .string()
    .describe(
      "A short recap of the person's last month, written in the same quiet, " +
        "observational voice as a comment on a single post, like flipping back " +
        "through the notebook and noticing what was actually there, not a " +
        "performance review. 100-180 words, second person, plain paragraphs, " +
        "no headers or bullet points. Name real patterns (recurring topics, " +
        "moods, people, a shift over the month) only if they're actually " +
        "supported by what's below, don't invent detail. No hype, no praise " +
        "unless something genuinely was accomplished, no therapy-speak."
    ),
});

function monthRange(monthsAgo: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

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

  // Only recap the most recently completed calendar month.
  const { start, end } = monthRange(1);

  const { data: existing } = await supabase
    .from("recaps")
    .select("id")
    .eq("period_start", start)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ skipped: "already generated" });
  }

  const [{ data: posts }, { data: reflections }, { data: profile }, { data: mentions }] =
    await Promise.all([
      supabase
        .from("posts")
        .select("content, post_type, ai_summary, ai_topics, ai_sentiment, created_at")
        .gte("created_at", start)
        .lt("created_at", `${end}T23:59:59`)
        .order("created_at", { ascending: true }),
      supabase
        .from("reflections")
        .select("question, answer, created_at")
        .gte("created_at", start)
        .lt("created_at", `${end}T23:59:59`)
        .order("created_at", { ascending: true }),
      supabase
        .from("profiles")
        .select("notebook_memory")
        .eq("id", user.id)
        .maybeSingle(),
      // Who actually came up that month, counted from the post links rather
      // than from people.mention_count, which is lifetime and would let
      // someone who was central a year ago outrank this month's real presence.
      supabase
        .from("post_people")
        .select("people(name, relationship, notes), posts!inner(created_at)")
        .gte("posts.created_at", start)
        .lt("posts.created_at", `${end}T23:59:59`),
    ]);

  if (!posts || posts.length < 3) {
    return NextResponse.json({ skipped: "not enough posts" });
  }

  const postLines = posts
    .map((p) => {
      const topics = Array.isArray(p.ai_topics) ? ` [${p.ai_topics.join(", ")}]` : "";
      return `- (${p.post_type}, ${String(p.created_at).slice(0, 10)}) ${
        p.content.slice(0, 200)
      }${p.ai_summary ? ` | ${p.ai_summary}` : ""}${topics}`;
    })
    .join("\n");

  const reflectionLines = (reflections ?? [])
    .map((r) => `- Q: ${r.question}\n  A: ${r.answer.slice(0, 200)}`)
    .join("\n");

  const monthPeople = new Map<
    string,
    { relationship: string | null; notes: string | null; count: number }
  >();
  for (const row of (mentions ?? []) as unknown as {
    people: { name: string; relationship: string | null; notes: string | null } | null;
  }[]) {
    if (!row.people) continue;
    const seen = monthPeople.get(row.people.name);
    if (seen) {
      seen.count += 1;
    } else {
      monthPeople.set(row.people.name, {
        relationship: row.people.relationship,
        notes: row.people.notes,
        count: 1,
      });
    }
  }
  const peopleLines = [...monthPeople.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(
      ([name, p]) =>
        `- ${name}${p.relationship ? ` (${p.relationship})` : ""}: came up in ${
          p.count
        } post${p.count === 1 ? "" : "s"} this month. ${
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
            "You write a monthly recap for a private, ink-and-paper journal " +
            "app, reading back through everything the person wrote that month. " +
            "Same voice as commenting on a single post: a friend who actually " +
            "read this, not a stranger summarizing. Do not hype up the person " +
            "or affirm who they are, react to what actually happened. Read " +
            "casual/internet slang contextually, not literally." +
            PEOPLE_RULE +
            NO_EM_DASHES,
        },
        {
          role: "user",
          content:
            `Notebook memory going into this month:\n${
              profile?.notebook_memory || "(nothing yet)"
            }\n\n` +
            `Posts from ${start} to ${end}:\n${postLines}\n\n` +
            `People who came up that month, most present first:\n${
              peopleLines || "(no one on record)"
            }\n\n` +
            `Reflections answered that month:\n${reflectionLines || "(none)"}\n\n` +
            "Write the recap for this month.",
        },
      ],
      response_format: zodResponseFormat(RecapSchema, "monthly_recap"),
    });

    const parsed = response.choices[0]?.message?.parsed;
    if (!parsed) {
      return NextResponse.json({ skipped: "no output" });
    }

    const { error } = await supabase.from("recaps").insert({
      user_id: user.id,
      period_start: start,
      period_end: end,
      content: parsed.recap.trim(),
    });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof OpenAI.RateLimitError) {
      return NextResponse.json({ error: "rate limited" }, { status: 429 });
    }
    if (err instanceof OpenAI.APIError) {
      return NextResponse.json({ error: `api error ${err.status}` }, { status: 502 });
    }
    return NextResponse.json({ error: "generation failed" }, { status: 500 });
  }
}
