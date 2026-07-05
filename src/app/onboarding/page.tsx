"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
  | "name"
  | "beliefs"
  | "personality"
  | "handling_bad"
  | "handling_good"
  | "improvement";

interface Step {
  key: StepKey;
  question: string;
  hint?: string;
  optional?: boolean;
  kind: "text" | "beliefs";
}

const STEPS: Step[] = [
  {
    key: "name",
    question: "What should we call you?",
    hint: "Just a name. This stays between you and the page.",
    kind: "text",
  },
  {
    key: "beliefs",
    question: "What do you believe in?",
    hint: "Faith, science, energy — tap everything that resonates, or add your own.",
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
    question: "In one sentence — how do you handle bad situations?",
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
    kind: "text",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [beliefPicks, setBeliefPicks] = useState<string[]>([]);
  const [customBeliefs, setCustomBeliefs] = useState<string[]>([]);
  const [beliefInput, setBeliefInput] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [saving, setSaving] = useState(false);

  const step = STEPS[index];
  const progress = Math.round((index / STEPS.length) * 100);
  const value = answers[step.key] ?? "";
  const canContinue = useMemo(() => {
    if (step.kind === "beliefs") return true;
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

    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      display_name: answers.name?.trim() || null,
      beliefs,
      personality: answers.personality?.trim() || null,
      handling_bad: answers.handling_bad?.trim() || null,
      handling_good: answers.handling_good?.trim() || null,
      improvement_goal: answers.improvement?.trim() || null,
      onboarded: true,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      setSaving(false);
      return;
    }
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

        {step.kind === "text" ? (
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

      <div className="flex items-end justify-between pt-4">
        <p className="font-script text-2xl text-faint">{progress}%</p>
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
              : index === STEPS.length - 1
                ? "Begin"
                : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
