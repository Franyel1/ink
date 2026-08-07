import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { createClient } from "@/lib/supabase/server";
import { NO_EM_DASHES, sanitizeVoice } from "@/lib/aiStyle";

const LineSchema = z.object({
  line: z
    .string()
    .describe(
      "One short line reading today's shape from their posts, plain, human, " +
        "a little poetic but never flowery. Under 10 words. Not a summary, not " +
        "advice, not a compliment. E.g. 'quiet, and a little work-shaped.' or " +
        "'restless, but nothing's actually wrong.'"
    ),
});

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const iso = start.toISOString().slice(0, 10);
  return { dayIso: iso, startIso: start.toISOString() };
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { dayIso, startIso } = todayRange();

  const { data: existing } = await supabase
    .from("daily_lines")
    .select("line")
    .eq("day", dayIso)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ line: existing.line });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ line: null });
  }

  const { data: posts } = await supabase
    .from("posts")
    .select("content, ai_summary, ai_sentiment, ai_topics")
    .gte("created_at", startIso)
    .order("created_at", { ascending: true });

  if (!posts || posts.length === 0) {
    return NextResponse.json({ line: null });
  }

  const postLines = posts
    .map((p) => {
      const topics = Array.isArray(p.ai_topics) ? ` [${p.ai_topics.join(", ")}]` : "";
      return `- ${p.content.slice(0, 200)}${p.ai_sentiment ? ` (${p.ai_sentiment})` : ""}${topics}`;
    })
    .join("\n");

  const openai = new OpenAI();
  try {
    const response = await openai.chat.completions.parse({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "You read someone's posts from today and write one short line " +
            "capturing the day's shape, like a weather report for how the day " +
            "reads, not what happened in it. Plain, human, never clinical, " +
            "never a compliment, never advice.\n\n" +
            "Write a sentence, not a log entry. 'Mixed play and code with " +
            "small surprises spotted' is a list of the day's contents with the " +
            "subject removed, which is the failure to avoid. Closer to the " +
            "mark: 'A day that kept getting interrupted by better ideas.' " +
            "'Quiet, and busier than it looked.' 'Everything took one more " +
            "step than it should have.' Start with a capital, end with a full " +
            "stop, and let it read like something a person would say out " +
            "loud." + NO_EM_DASHES,
        },
        { role: "user", content: `Today's posts:\n${postLines}` },
      ],
      response_format: zodResponseFormat(LineSchema, "daily_line"),
    });

    const parsed = response.choices[0]?.message?.parsed;
    if (!parsed) {
      return NextResponse.json({ line: null });
    }

    const line = sanitizeVoice(parsed.line);
    const { error } = await supabase
      .from("daily_lines")
      .insert({ user_id: user.id, day: dayIso, line });
    if (error) throw error;

    return NextResponse.json({ line });
  } catch {
    return NextResponse.json({ line: null });
  }
}
