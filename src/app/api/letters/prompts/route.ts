import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { createClient } from "@/lib/supabase/server";

const PromptsSchema = z.object({
  prompts: z
    .array(z.string())
    .describe(
      "3-5 short things worth addressing in a letter to their future self — " +
        "questions or angles, not sentences for them to sign their name to. " +
        "Each under 15 words, second person. Draw only from what's actually " +
        "in their record below; don't invent goals or events."
    ),
});

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ prompts: [] });
  }

  const [{ data: profile }, { data: goals }, { data: wants }, { data: letGos }] =
    await Promise.all([
      supabase.from("profiles").select("notebook_memory").eq("id", user.id).maybeSingle(),
      supabase.from("goals").select("raw_text, refined_text, done").eq("done", false),
      supabase.from("wants").select("text").eq("done", false),
      supabase.from("let_gos").select("text").eq("released", false),
    ]);

  const context = [
    profile?.notebook_memory && `Notebook memory: ${profile.notebook_memory}`,
    goals && goals.length > 0 &&
      `Open goals: ${goals.map((g) => g.refined_text || g.raw_text).join("; ")}`,
    wants && wants.length > 0 && `Wants: ${wants.map((w) => w.text).join("; ")}`,
    letGos && letGos.length > 0 &&
      `Trying to let go of: ${letGos.map((l) => l.text).join("; ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  if (!context) {
    return NextResponse.json({ prompts: [] });
  }

  const openai = new OpenAI();
  try {
    const response = await openai.chat.completions.parse({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "You suggest things worth addressing in someone's letter to their " +
            "future self, based on what's actually on record about them. You " +
            "never write the letter itself — only angles or questions for them " +
            "to write about in their own words.",
        },
        { role: "user", content: `About this person:\n${context}` },
      ],
      response_format: zodResponseFormat(PromptsSchema, "letter_prompts"),
    });

    const parsed = response.choices[0]?.message?.parsed;
    return NextResponse.json({ prompts: parsed?.prompts.slice(0, 5) ?? [] });
  } catch {
    return NextResponse.json({ prompts: [] });
  }
}
