"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const BELIEF_OPTIONS = [
  "Horoscope",
  "Crystals / energy",
  "Science-based thinking",
];

type StepKey =
  | "name"
  | "religion"
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
    key: "religion",
    question: "What is your religion or belief system?",
    hint: "Optional. Skip if you'd rather not say.",
    optional: true,
    kind: "text",
  },
  {
    key: "beliefs",
    question: "Do you believe in things like…",
    hint: "Pick any that feel true. Add your own below.",
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
  const [beliefOther, setBeliefOther] = useState("");
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
      religion: answers.religion?.trim() || null,
      believes_in: beliefPicks,
      other: beliefOther.trim() || null,
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
          <div className="mt-8 flex flex-col gap-3">
            {BELIEF_OPTIONS.map((opt) => {
              const on = beliefPicks.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() =>
                    setBeliefPicks((p) =>
                      on ? p.filter((x) => x !== opt) : [...p, opt]
                    )
                  }
                  className={`pressable rounded-2xl border px-5 py-3.5 text-left transition-colors ${
                    on
                      ? "border-foreground bg-foreground text-ink"
                      : "border-border text-muted"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
            <div className="write-line mt-3 pb-2">
              <input
                value={beliefOther}
                onChange={(e) => setBeliefOther(e.target.value)}
                placeholder="Something else…"
                className="ink-input w-full"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-end justify-between pt-4">
        <p className="font-script text-2xl text-faint">{progress}%</p>
        <div className="flex items-center gap-5">
          {step.optional && !value.trim() && step.kind === "text" && (
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
