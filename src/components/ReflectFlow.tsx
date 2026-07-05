"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { REFLECT_QUESTIONS } from "@/lib/reflectQuestions";
import type { Reflection } from "@/lib/types";
import { useKeyboardInset } from "@/lib/useKeyboardInset";

/**
 * One continuous journal page: answered questions stack above and stay
 * visible; each entry gets its own layout so the page grows into a
 * collage of ink rather than a form.
 */
export default function ReflectFlow() {
  const [saved, setSaved] = useState<Record<string, Reflection> | null>(null);
  const [draft, setDraft] = useState("");
  const [absorbing, setAbsorbing] = useState(false);
  const [error, setError] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const keyboardInset = useKeyboardInset();

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

  const answered = useMemo(
    () => (saved ? REFLECT_QUESTIONS.filter((q) => saved[q.key]) : []),
    [saved]
  );
  const current = useMemo(
    () => (saved ? REFLECT_QUESTIONS.find((q) => !saved[q.key]) ?? null : null),
    [saved]
  );
  const done = saved !== null && current === null;
  const progress = Math.round(
    (answered.length / REFLECT_QUESTIONS.length) * 100
  );

  // Bring each new question to the top of the page as it appears
  const answeredCount = answered.length;
  const loaded = saved !== null;
  useEffect(() => {
    const t = setTimeout(
      () =>
        endRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      120
    );
    return () => clearTimeout(t);
  }, [answeredCount, loaded]);

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

    setTimeout(() => {
      setSaved((s) => ({ ...(s ?? {}), [current.key]: data as Reflection }));
      setDraft("");
      setAbsorbing(false);
    }, 450);
  }

  return (
    <div className="grain relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Slim progress, always visible */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-background via-background/95 to-transparent px-6 pb-8 pt-[calc(var(--safe-top)+0.9rem)]">
        <div className="flex items-baseline justify-between">
          <span className="font-script text-2xl text-muted">Reflect</span>
          <span className="font-script text-xl text-faint">{progress}%</span>
        </div>
        <div className="mt-1.5 h-px w-full bg-border/60">
          <div
            className="h-full bg-foreground transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div
        className="scroll-area flex-1 px-6 pt-[calc(var(--safe-top)+6.75rem)]"
        style={{ paddingBottom: keyboardInset ? keyboardInset + 16 : 32 }}
      >
        {saved === null ? (
          <div className="flex h-40 items-center justify-center">
            <span className="font-script text-2xl text-faint">…</span>
          </div>
        ) : (
          <>
            {/* The page so far */}
            {answered.map((q, i) => (
              <AnsweredEntry
                key={q.key}
                index={i}
                question={q.question}
                answer={saved[q.key].answer}
              />
            ))}

            {/* The active question */}
            {current && (
              <div
                key={current.key}
                className={`pb-6 transition-all duration-500 ${
                  absorbing ? "opacity-40" : "rise-in"
                } ${answered.length > 0 ? "mt-10" : "mt-2"}`}
              >
                <p className="text-xs uppercase tracking-[0.25em] text-faint">
                  {answered.length + 1} · {REFLECT_QUESTIONS.length}
                </p>
                <h2 className="ink-reveal mt-3 text-[22px] font-medium leading-snug">
                  {current.question}
                </h2>

                {/* The box where the answer belongs */}
                <div className="rise-in mt-5 rounded-2xl border border-dashed border-border/90 p-4 focus-within:border-muted">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onFocus={(e) =>
                      e.target.scrollIntoView({ block: "nearest" })
                    }
                    placeholder="Write it in ink…"
                    rows={4}
                    className="ink-input paper-lines w-full resize-none"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    {error ? (
                      <p className="text-xs text-red-400/80">
                        The ink didn&apos;t take. Try again.
                      </p>
                    ) : (
                      <span />
                    )}
                    <button
                      type="button"
                      disabled={!draft.trim() || absorbing}
                      onClick={absorb}
                      className="pressable rounded-full bg-foreground px-5 py-2 text-sm font-medium text-ink transition-opacity disabled:opacity-25"
                    >
                      {absorbing ? "…" : "Absorb"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {done && (
              <div className="rise-in border-t border-border/50 py-14 text-center">
                <p className="font-script text-6xl">100%</p>
                <p className="mx-auto mt-4 max-w-xs text-sm text-faint">
                  The page is full — for now. Everything you wrote lives here,
                  and new questions will find you later.
                </p>
              </div>
            )}

            <div ref={endRef} />
          </>
        )}
      </div>
    </div>
  );
}

/** Layout variants so every answered entry settles differently on the page. */
function AnsweredEntry({
  index,
  question,
  answer,
}: {
  index: number;
  question: string;
  answer: string;
}) {
  const variant = index % 4;
  const rotate = [(index % 3) - 1, 1 - (index % 3)][index % 2] * 0.6;

  if (variant === 1) {
    // pushed to the right, quiet and light
    return (
      <div
        className="mb-10 ml-auto w-[88%] text-right"
        style={{ transform: `rotate(${rotate}deg)` }}
      >
        <p className="text-sm italic text-muted">{question}</p>
        <p data-selectable className="mt-2 whitespace-pre-wrap text-lg font-light leading-relaxed text-foreground/85">
          {answer}
        </p>
      </div>
    );
  }

  if (variant === 2) {
    // inverted paper card — a page absorbed in white
    return (
      <div
        className="mb-10 rounded-2xl bg-paper p-5 text-ink shadow-lg shadow-black/40"
        style={{ transform: `rotate(${rotate}deg)` }}
      >
        <p className="font-script text-lg text-ink/60">{question}</p>
        <p data-selectable className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">
          {answer}
        </p>
      </div>
    );
  }

  if (variant === 3) {
    // centered, answer as large script between hairlines
    return (
      <div className="mb-10 border-y border-border/40 py-6 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-faint">
          {question}
        </p>
        <p data-selectable className="font-script mt-3 whitespace-pre-wrap text-2xl leading-snug text-foreground/90">
          {answer}
        </p>
      </div>
    );
  }

  // default: left, script answer under a small label
  return (
    <div className="mb-10 w-[92%]" style={{ transform: `rotate(${rotate}deg)` }}>
      <p className="text-xs uppercase tracking-[0.2em] text-faint">{question}</p>
      <p data-selectable className="font-script mt-2 whitespace-pre-wrap text-[26px] leading-snug text-foreground/90">
        {answer}
      </p>
    </div>
  );
}
