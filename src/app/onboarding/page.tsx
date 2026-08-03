"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addGoal } from "@/lib/goals";
import { addWant } from "@/lib/wants";
import { createLetter } from "@/lib/letters";

const BELIEF_TAGS = [
  "Christianity",
  "Islam",
  "Judaism",
  "Buddhism",
  "Hinduism",
  "Spirituality",
  "Agnostic",
  "Atheist",
  "Science",
  "Astrology",
  "Crystals & energy",
  "Karma",
  "Manifestation",
  "Meditation",
];

type StepKey =
  | "intro"
  | "name"
  | "beliefs"
  | "personality"
  | "handling_bad"
  | "handling_good"
  | "improvement"
  | "want"
  | "letter";

interface Step {
  key: StepKey;
  question: string;
  hint?: string;
  optional?: boolean;
  kind: "intro" | "text" | "beliefs";
}

const STEPS: Step[] = [
  {
    // Ink reads what you write and keeps a note about you. Saying so before the
    // first question is what makes the reflect questions feel intuited later
    // rather than like the notebook was reading over your shoulder.
    key: "intro",
    question: "How this works.",
    hint: "Three things. Tap to read them.",
    kind: "intro",
  },
  {
    key: "name",
    question: "What should we call you?",
    hint: "Just a name. This stays between you and the page.",
    kind: "text",
  },
  {
    key: "beliefs",
    question: "What do you believe in?",
    hint: "Faith, science, energy. Tap everything that resonates, or add your own.",
    optional: true,
    kind: "beliefs",
  },
  {
    key: "personality",
    question: "How would you describe your personality?",
    hint: "Free words. A type, a vibe, a sentence.",
    optional: true,
    kind: "text",
  },
  {
    key: "handling_bad",
    question: "In one sentence, how do you handle bad situations?",
    kind: "text",
  },
  {
    key: "handling_good",
    question: "And how do you handle the good ones?",
    kind: "text",
  },
  {
    key: "improvement",
    question: "One thing you want to improve about yourself?",
    hint: "This becomes your first goal. You can reword it later.",
    kind: "text",
  },
  {
    key: "want",
    question: "And one thing you just want?",
    hint: "Not a goal. A place, a thing, an afternoon. No effort implied.",
    optional: true,
    kind: "text",
  },
  {
    key: "letter",
    question: "Anything you'd say to yourself a year from now?",
    hint: "Sealed until then. You won't be able to read it before.",
    optional: true,
    kind: "text",
  },
];

/**
 * The disclosure, as three things you open rather than a page you're expected to
 * read. The titles alone carry the gist for anyone who taps straight past; the
 * detail is there for anyone who wants it.
 */
const DISCLOSURES = [
  {
    key: "reads",
    title: "Ink reads what you write",
    detail:
      "A model goes over each post: it leaves a short remark on it, notices the people who come up, writes reflection questions from what keeps repeating, and sums up your month. Your posts are sent to OpenAI for that.",
  },
  {
    key: "remembers",
    title: "Ink keeps a note about you",
    detail:
      "A running description of you, rewritten as it learns more, so the questions sharpen instead of circling. You can read that note, and erase it, from your profile.",
  },
  {
    key: "yours",
    title: "Ink stays yours",
    detail:
      "Nothing is posted anywhere, and there's no feed but your own. Photos you attach get an unguessable link: private in practice, not locked.",
  },
];

const QUESTION_COUNT = STEPS.filter((s) => s.kind !== "intro").length;

/** A year out, to the day — when the closing letter unseals. */
function oneYearOut(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export default function OnboardingPage() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [beliefPicks, setBeliefPicks] = useState<string[]>([]);
  const [customBeliefs, setCustomBeliefs] = useState<string[]>([]);
  const [beliefInput, setBeliefInput] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<string | null>(null);

  const step = STEPS[index];
  // Counts the step you're on as underway, and the intro not at all — so the
  // last question reads 100% instead of stopping short at 83%.
  const progress = Math.round((index / QUESTION_COUNT) * 100);
  const value = answers[step.key] ?? "";
  const canContinue = useMemo(() => {
    if (step.kind === "intro" || step.kind === "beliefs") return true;
    if (step.optional) return true;
    return value.trim().length > 0;
  }, [step, value]);

  function addCustomBelief() {
    const name = beliefInput.trim();
    if (!name) return;
    if (!customBeliefs.includes(name)) setCustomBeliefs((c) => [...c, name]);
    setBeliefInput("");
  }

  function advance() {
    if (index < STEPS.length - 1) {
      setLeaving(true);
      setTimeout(() => {
        setIndex((i) => i + 1);
        setLeaving(false);
      }, 220);
    } else {
      finish();
    }
  }

  async function finish() {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      return;
    }

    const beliefs = {
      selected: beliefPicks,
      custom: customBeliefs,
    };

    const improvement = answers.improvement?.trim() || null;
    const want = answers.want?.trim() || null;
    const letter = answers.letter?.trim() || null;

    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      display_name: answers.name?.trim() || null,
      beliefs,
      personality: answers.personality?.trim() || null,
      handling_bad: answers.handling_bad?.trim() || null,
      handling_good: answers.handling_good?.trim() || null,
      improvement_goal: improvement,
      onboarded: true,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      // This used to fail silently — the button stopped saying "Saving…" and
      // nothing else ever happened. It's the one write in the app that can't be
      // queued for later, so it has to say when it didn't work.
      setSaveError("That didn't save. Check your connection and try again.");
      setSaving(false);
      return;
    }

    // Seed the Reflect dashboard so it isn't three empty rooms on arrival. None
    // of these are worth failing onboarding over — the profile is already saved,
    // and anything that doesn't land can be written again by hand.
    await Promise.allSettled([
      improvement ? addGoal(improvement) : null,
      want ? addWant(want) : null,
      letter ? createLetter(letter, [], oneYearOut()) : null,
    ]);

    router.replace("/feed");
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col px-8 pb-[calc(var(--safe-bottom)+1.5rem)] pt-[calc(var(--safe-top)+3rem)]">
      <p className="font-script text-3xl text-muted">Ink.</p>

      <div
        key={step.key}
        className={`mt-10 flex min-h-0 flex-1 flex-col transition-all duration-200 ${
          leaving ? "-translate-y-4 opacity-0" : "rise-in"
        }`}
      >
        <h1 className="ink-reveal text-2xl font-medium leading-snug">
          {step.question}
        </h1>
        {step.hint && <p className="mt-2 text-sm text-faint">{step.hint}</p>}

        {step.kind === "intro" ? (
          <div className="scroll-area mt-6 min-h-0 flex-1">
            {DISCLOSURES.map((d) => {
              const open = openCard === d.key;
              return (
                <button
                  key={d.key}
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenCard(open ? null : d.key)}
                  className="write-line pressable block w-full pb-4 pt-5 text-left first:pt-1"
                >
                  {/* Unwritten until you ask for it: the title sits faint and
                      inks in when opened, and the detail writes itself across
                      the line the way reflect questions do. */}
                  <span
                    className={`font-script block text-3xl leading-tight transition-colors duration-500 ${
                      open ? "text-foreground" : "text-faint"
                    }`}
                  >
                    {d.title}
                  </span>
                  {open && (
                    <p className="ink-reveal mt-2.5 text-sm leading-relaxed text-muted">
                      {d.detail}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        ) : step.kind === "text" ? (
          <textarea
            autoFocus
            value={value}
            onChange={(e) =>
              setAnswers((a) => ({ ...a, [step.key]: e.target.value }))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && canContinue) {
                e.preventDefault();
                advance();
              }
            }}
            placeholder="Write here…"
            rows={4}
            className="ink-input paper-lines mt-8 w-full resize-none"
          />
        ) : (
          <div className="scroll-area mt-8 min-h-0 flex-1">
            <div className="flex flex-wrap gap-2">
              {BELIEF_TAGS.map((tag) => {
                const on = beliefPicks.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      setBeliefPicks((p) =>
                        on ? p.filter((x) => x !== tag) : [...p, tag]
                      )
                    }
                    className={`pressable rounded-full border px-4 py-2 text-sm transition-colors ${
                      on
                        ? "border-foreground bg-foreground text-ink"
                        : "border-border text-muted"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
              {customBeliefs.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    setCustomBeliefs((c) => c.filter((x) => x !== tag))
                  }
                  className="pressable rounded-full border border-foreground bg-foreground px-4 py-2 text-sm text-ink"
                >
                  {tag} ×
                </button>
              ))}
            </div>
            <div className="write-line mt-6 flex items-center gap-2 pb-2">
              <input
                value={beliefInput}
                onChange={(e) => setBeliefInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomBelief();
                  }
                }}
                placeholder="Something else…"
                className="ink-input w-full"
              />
              {beliefInput.trim() && (
                <button
                  type="button"
                  onClick={addCustomBelief}
                  className="shrink-0 text-sm text-muted"
                >
                  Add
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {saveError && (
        <p className="fade-in pt-4 text-sm text-red-300/80">{saveError}</p>
      )}

      <div className="flex items-end justify-between pt-4">
        <p className="font-script text-2xl text-faint">
          {step.kind === "intro" ? "" : `${progress}%`}
        </p>
        <div className="flex items-center gap-5">
          {step.optional && step.kind === "text" && !value.trim() && (
            <button
              type="button"
              onClick={advance}
              className="text-sm text-faint"
            >
              Skip
            </button>
          )}
          <button
            type="button"
            disabled={!canContinue || saving}
            onClick={advance}
            className="pressable rounded-full bg-foreground px-8 py-3 font-medium text-ink disabled:opacity-30"
          >
            {saving
              ? "Saving…"
              : saveError
                ? "Try again"
                : step.kind === "intro"
                  ? "Go on"
                  : index === STEPS.length - 1
                    ? "Begin"
                    : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
