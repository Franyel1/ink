"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { REFLECT_QUESTIONS } from "@/lib/reflectQuestions";
import type { Reflection } from "@/lib/types";

export default function ReflectFlow() {
  const [saved, setSaved] = useState<Record<string, Reflection> | null>(null);
  const [draft, setDraft] = useState("");
  const [absorbing, setAbsorbing] = useState(false);
  const [error, setError] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const supabase = createClient();
    Promise.resolve(supabase.from("reflections").select("*"))
      .then(({ data }) => {
        const map: Record<string, Reflection> = {};
        ((data ?? []) as Reflection[]).forEach((r) => {
          map[r.question_key] = r;
        });
        setSaved(map);
      })
      .catch(() => setSaved({}));
  }, []);

  const answeredCount = useMemo(
    () =>
      saved
        ? REFLECT_QUESTIONS.filter((q) => saved[q.key]).length
        : 0,
    [saved]
  );

  const current = useMemo(
    () => (saved ? REFLECT_QUESTIONS.find((q) => !saved[q.key]) ?? null : null),
    [saved]
  );

  // Colors invert with every answered page: even = ink on black, odd = ink on paper
  const inverted = answeredCount % 2 === 1;
  const done = saved !== null && current === null;
  const progress = Math.round((answeredCount / REFLECT_QUESTIONS.length) * 100);

  // Ghosted previous answers become part of the background
  const ghosts = useMemo(
    () =>
      REFLECT_QUESTIONS.filter((q) => saved?.[q.key]).slice(-4).map((q) => ({
        key: q.key,
        question: q.question,
        answer: saved![q.key].answer,
      })),
    [saved]
  );

  async function absorb() {
    const answer = draft.trim();
    if (!answer || !current || absorbing) return;
    setAbsorbing(true);
    setError(false);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error: err } = await supabase
      .from("reflections")
      .upsert(
        {
          user_id: user.id,
          question_key: current.key,
          question: current.question,
          answer,
        },
        { onConflict: "user_id,question_key" }
      )
      .select()
      .single();

    if (err || !data) {
      setError(true);
      setAbsorbing(false);
      return;
    }

    // Let the page absorb the answer, then flip
    setTimeout(() => {
      setSaved((s) => ({ ...(s ?? {}), [current.key]: data as Reflection }));
      setDraft("");
      setAbsorbing(false);
    }, 650);
  }

  const bg = inverted ? "var(--paper)" : "var(--background)";
  const fg = inverted ? "var(--ink)" : "var(--foreground)";
  const faint = inverted ? "rgba(9,9,9,0.35)" : "var(--faint)";
  const lineColor = inverted ? "rgba(9,9,9,0.14)" : "var(--line)";

  return (
    <div
      className="invert-surface grain relative flex min-h-0 flex-1 flex-col overflow-hidden"
      style={{ backgroundColor: bg, color: fg }}
    >
      {/* Ghosted ink from previous answers, absorbed into the page */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden px-8 pt-[calc(var(--safe-top)+4rem)]"
        style={{ opacity: 0.1, filter: "blur(0.6px)" }}
      >
        {ghosts.map((g, i) => (
          <div key={g.key} className="mb-8" style={{ transform: `rotate(${(i % 2 ? 1 : -1) * 0.8}deg)` }}>
            <p className="text-xs uppercase tracking-widest">{g.question}</p>
            <p className="font-script mt-1 text-2xl leading-snug">{g.answer}</p>
          </div>
        ))}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col px-8 pb-4 pt-[calc(var(--safe-top)+3rem)]">
        {saved === null ? (
          <div className="flex flex-1 items-center justify-center">
            <span className="font-script text-2xl" style={{ color: faint }}>
              …
            </span>
          </div>
        ) : done ? (
          <div className="rise-in flex flex-1 flex-col items-center justify-center text-center">
            <p className="font-script text-6xl">100%</p>
            <p className="mt-4 max-w-xs text-sm" style={{ color: faint }}>
              Every page has been absorbed. Your answers live in the ink now —
              more questions will find you here later.
            </p>
          </div>
        ) : (
          <div
            key={current!.key}
            className={`flex min-h-0 flex-1 flex-col transition-all duration-500 ${
              absorbing ? "scale-[0.98] opacity-0" : "rise-in"
            }`}
          >
            <p
              className="text-xs uppercase tracking-[0.25em]"
              style={{ color: faint }}
            >
              Reflection {answeredCount + 1} of {REFLECT_QUESTIONS.length}
            </p>
            <h1 className="ink-reveal mt-6 text-[26px] font-medium leading-snug">
              {current!.question}
            </h1>

            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write it in ink…"
              className="ink-input mt-10 w-full flex-1 resize-none"
              style={{
                backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent calc(2em - 1px), ${lineColor} calc(2em - 1px), ${lineColor} 2em)`,
                lineHeight: "2em",
                color: fg,
                caretColor: fg,
              }}
            />
            {error && (
              <p className="mt-2 text-sm text-red-400/80">
                The ink didn&apos;t take. Try again.
              </p>
            )}
          </div>
        )}

        {/* Progress + action */}
        {!done && saved !== null && (
          <div className="flex shrink-0 items-end justify-between pb-2 pt-4">
            <div>
              <p className="font-script text-3xl" style={{ color: faint }}>
                {progress}%
              </p>
              <div
                className="mt-1 h-px w-24 overflow-hidden"
                style={{ backgroundColor: lineColor }}
              >
                <div
                  className="h-full transition-all duration-700"
                  style={{ width: `${progress}%`, backgroundColor: fg }}
                />
              </div>
            </div>
            <button
              type="button"
              disabled={!draft.trim() || absorbing}
              onClick={absorb}
              className="pressable rounded-full px-7 py-3 font-medium transition-opacity disabled:opacity-30"
              style={{ backgroundColor: fg, color: bg }}
            >
              {absorbing ? "Absorbing…" : "Absorb"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
