import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { createClient } from "@/lib/supabase/server";
import { NO_EM_DASHES } from "@/lib/aiStyle";

const AskSchema = z.object({
  question: z
    .string()
    .describe(
      "A single reflective question about the given topic, 8-20 words, second " +
        "person, ends with a question mark, no preamble."
    ),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { topic } = await request.json().catch(() => ({}));
  if (!topic || typeof topic !== "string" || !topic.trim()) {
    return NextResponse.json({ error: "topic required" }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "no api key" }, { status: 200 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("notebook_memory")
    .eq("id", user.id)
    .maybeSingle();

  const openai = new OpenAI();
  try {
    const response = await openai.chat.completions.parse({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "You write one reflective question, on demand, about a topic the " +
            "person just asked to think about. Calm, warm, curious, never " +
            "clinical or therapy-speak." + NO_EM_DASHES,
        },
        {
          role: "user",
          content:
            `What's known about them:\n${profile?.notebook_memory || "(nothing yet)"}\n\n` +
            `Topic they want to reflect on right now: ${topic.trim()}`,
        },
      ],
      response_format: zodResponseFormat(AskSchema, "ask_on_demand"),
    });

    const parsed = response.choices[0]?.message?.parsed;
    if (!parsed) {
      return NextResponse.json({ error: "no output" }, { status: 502 });
    }
    return NextResponse.json({ question: parsed.question.trim() });
  } catch {
    return NextResponse.json({ error: "generation failed" }, { status: 500 });
  }
}
