import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { createClient } from "@/lib/supabase/server";

const SuggestionsSchema = z.object({
  pairs: z
    .array(
      z.object({
        a: z.number().describe("Index of the first entry in the pair"),
        b: z.number().describe("Index of the second entry in the pair"),
        reason: z
          .string()
          .describe(
            "Short reason they're likely the same person (under ~12 words), " +
              "e.g. 'same activity and relationship, different names'"
          ),
      })
    )
    .describe(
      "Pairs of entries that likely refer to the same real person under " +
        "different names/labels (e.g. 'SO' and a first name, a nickname and a " +
        "full name). Only include pairs you're genuinely confident about — " +
        "empty array if none stand out."
    ),
});

export async function POST() {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ suggestions: [] });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: people } = await supabase
    .from("people")
    .select("id, name, relationship, notes")
    .order("last_mentioned_at", { ascending: false });

  if (!people || people.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const listing = people
    .map(
      (p, i) =>
        `${i}. ${p.name}${p.relationship ? ` (${p.relationship})` : ""}: ${
          p.notes || "(no notes)"
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
            "You review a list of people extracted from someone's private " +
            "journal and flag entries that are likely duplicates — the same " +
            "real person recorded under different names or labels (e.g. 'SO' " +
            "in one entry and a first name in another, both tied to the same " +
            "kind of moment or relationship). Be conservative: two different " +
            "friends, or a sibling and a coworker, are not the same person " +
            "just because their notes are both short. Only flag pairs with a " +
            "real, specific signal in common.",
        },
        {
          role: "user",
          content: `People on record:\n${listing}\n\nFind likely duplicate pairs.`,
        },
      ],
      response_format: zodResponseFormat(SuggestionsSchema, "merge_suggestions"),
    });

    const parsed = response.choices[0]?.message?.parsed;
    if (!parsed) {
      return NextResponse.json({ suggestions: [] });
    }

    const suggestions = parsed.pairs
      .filter(
        (p) =>
          Number.isInteger(p.a) &&
          Number.isInteger(p.b) &&
          p.a !== p.b &&
          people[p.a] &&
          people[p.b]
      )
      .map((p) => ({
        keepId: people[p.a].id,
        mergeId: people[p.b].id,
        reason: p.reason,
      }));

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
