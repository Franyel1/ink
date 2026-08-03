"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Stage = "idle" | "asking" | "answering" | "saving" | "saved";

/** Ask about whatever's on your mind right now, get one question, answer it or don't. */
export default function PresentSection() {
  const [topic, setTopic] = useState("");
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState(false);

  async function ask() {
    const t = topic.trim();
    if (!t || stage === "asking") return;
    setStage("asking");
    setError(false);
    try {
      const res = await fetch("/api/present/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: t }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.question) throw new Error();
      setQuestion(body.question);
      setStage("answering");
    } catch {
      setError(true);
      setStage("idle");
    }
  }

  async function save() {
    if (!question || !answer.trim() || stage === "saving") return;
    setStage("saving");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error: err } = await supabase.from("reflections").insert({
      user_id: user.id,
      question_key: `ondemand-${crypto.randomUUID()}`,
      question,
      answer: answer.trim(),
    });
    if (err) {
      setError(true);
      setStage("answering");
      return;
    }
    setStage("saved");
  }

  function reset() {
    setTopic("");
    setQuestion(null);
    setAnswer("");
    setStage("idle");
    setError(false);
  }

  return (
    <div className="scroll-area flex-1 pb-10">
      <header className="flex items-center gap-3 px-6 pb-2 pt-[calc(var(--safe-top)+2rem)]">
        <Link href="/reflect" aria-label="Back to reflect" className="pressable p-1 text-muted">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="font-script text-4xl">Present</h1>
      </header>
      <p className="px-6 text-sm text-faint">
        What&apos;s on your mind right now? Ask about it, answer it, or don&apos;t.
      </p>

      <div className="px-6 pb-16 pt-2">
      {stage === "saved" ? (
        <div className="rise-in mt-5 rounded-2xl border border-border/60 bg-surface p-4">
          <p className="text-sm text-foreground/85">Absorbed.</p>
          <button type="button" onClick={reset} className="pressable mt-3 text-xs text-faint underline">
            Ask about something else
          </button>
        </div>
      ) : question === null ? (
        <div className="mt-5">
          <div className="write-line flex items-center gap-2 pb-2">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask()}
              placeholder="a topic — work, mom, this weekend…"
              className="ink-input w-full"
            />
          </div>
          <button
            type="button"
            disabled={!topic.trim() || stage === "asking"}
            onClick={ask}
            className="pressable mt-4 rounded-full bg-foreground px-5 py-2 text-sm font-medium text-ink disabled:opacity-30"
          >
            {stage === "asking" ? "…" : "Ask"}
          </button>
          {error && (
            <p className="mt-2 text-xs text-red-400/80">Couldn&apos;t think of one. Try again.</p>
          )}
        </div>
      ) : (
        <div className="rise-in mt-5 rounded-2xl border border-dashed border-border/90 p-4 focus-within:border-muted">
          <h3 className="ink-reveal text-[17px] font-medium leading-snug">{question}</h3>
          <textarea
            autoFocus
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Write it in ink…"
            rows={3}
            className="ink-input paper-lines mt-3 w-full resize-none"
          />
          <div className="mt-2 flex items-center justify-between">
            <button type="button" onClick={reset} className="text-xs text-faint">
              Never mind
            </button>
            <button
              type="button"
              disabled={!answer.trim() || stage === "saving"}
              onClick={save}
              className="pressable rounded-full bg-foreground px-5 py-2 text-sm font-medium text-ink disabled:opacity-30"
            >
              {stage === "saving" ? "…" : "Absorb"}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-xs text-red-400/80">The ink didn&apos;t take. Try again.</p>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
