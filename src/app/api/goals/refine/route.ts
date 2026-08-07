import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { createClient } from "@/lib/supabase/server";
import { NO_EM_DASHES, VALUES_RULE, sanitizeVoice } from "@/lib/aiStyle";

const RefineSchema = z.object({
  refined: z
    .string()
    .describe(
      "The user's own goal, tightened into one clear sentence, same intent, " +
        "clearer words. Never add ambition, specifics, or a plan they didn't " +
        "state. If it's already clear and short, return it close to unchanged. " +
        "Under 20 words."
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

  const { goalId } = await request.json().catch(() => ({}));
  if (!goalId || typeof goalId !== "string") {
    return NextResponse.json({ error: "goalId required" }, { status: 400 });
  }

  const { data: goal } = await supabase
    .from("goals")
    .select("id, raw_text")
    .eq("id", goalId)
    .maybeSingle();
  if (!goal) {
    return NextResponse.json({ error: "goal not found" }, { status: 404 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ skipped: "no api key" });
  }

  const openai = new OpenAI();
  try {
    const response = await openai.chat.completions.parse({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "You lightly tighten a goal someone wrote for themselves. You do " +
            "not choose their goals, add ambition they didn't express, or " +
            "invent a plan, you only clarify their own wording." +
            VALUES_RULE +
            NO_EM_DASHES,
        },
        { role: "user", content: `Their goal, as written: ${goal.raw_text}` },
      ],
      response_format: zodResponseFormat(RefineSchema, "goal_refine"),
    });

    const parsed = response.choices[0]?.message?.parsed;
    if (!parsed) {
      return NextResponse.json({ skipped: "no output" });
    }

    const { error } = await supabase
      .from("goals")
      .update({ refined_text: sanitizeVoice(parsed.refined), updated_at: new Date().toISOString() })
      .eq("id", goal.id);
    if (error) throw error;

    return NextResponse.json({ refined: sanitizeVoice(parsed.refined) });
  } catch {
    return NextResponse.json({ skipped: "refine failed" });
  }
}
