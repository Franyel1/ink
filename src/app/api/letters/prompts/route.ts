import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { createClient } from "@/lib/supabase/server";
import { BELIEFS_RULE, NO_EM_DASHES, VALUES_RULE, sanitizeVoice } from "@/lib/aiStyle";
import {
  PEOPLE_RULE,
  PERSON_CONTEXT_SELECT,
  formatPeopleLines,
} from "@/lib/peopleContext";

const PromptsSchema = z.object({
  prompts: z
    .array(z.string())
    .describe(
      "3-5 short things worth addressing in a letter to their future self, " +
        "questions or angles, not sentences for them to sign their name to. " +
        "Each under 15 words, second person. Draw only from what's actually " +
        "in their record below; don't invent goals or events. A person in " +
        "their life is a fair subject when the record actually supports it, " +
        "and one who has gone quiet is often the most worth asking about."
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

  const [
    { data: profile },
    { data: goals },
    { data: wants },
    { data: letGos },
    { data: people },
  ] = await Promise.all([
    supabase.from("profiles").select("notebook_memory").eq("id", user.id).maybeSingle(),
    supabase.from("goals").select("raw_text, refined_text, done").eq("done", false),
    supabase.from("wants").select("text").eq("done", false),
    supabase.from("let_gos").select("text").eq("released", false),
    // The goals and let-gos are usually about someone; a year-out letter that
    // knows who is in their life beats one written to a cast of nobody.
    supabase
      .from("people")
      .select(PERSON_CONTEXT_SELECT)
      .order("mention_count", { ascending: false })
      .limit(15),
  ]);

  const peopleLines = formatPeopleLines(people ?? [], { withRecency: true });

  const context = [
    profile?.notebook_memory && `Notebook memory: ${profile.notebook_memory}`,
    goals && goals.length > 0 &&
      `Open goals: ${goals.map((g) => g.refined_text || g.raw_text).join("; ")}`,
    wants && wants.length > 0 && `Wants: ${wants.map((w) => w.text).join("; ")}`,
    letGos && letGos.length > 0 &&
      `Trying to let go of: ${letGos.map((l) => l.text).join("; ")}`,
    peopleLines && `People in their life:\n${peopleLines}`,
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
            "never write the letter itself, only angles or questions for them " +
            "to write about in their own words." +
            PEOPLE_RULE +
            BELIEFS_RULE +
            VALUES_RULE +
            NO_EM_DASHES,
        },
        { role: "user", content: `About this person:\n${context}` },
      ],
      response_format: zodResponseFormat(PromptsSchema, "letter_prompts"),
    });

    const parsed = response.choices[0]?.message?.parsed;
    return NextResponse.json({
      prompts: (parsed?.prompts ?? []).slice(0, 5).map(sanitizeVoice),
    });
  } catch {
    return NextResponse.json({ prompts: [] });
  }
}
