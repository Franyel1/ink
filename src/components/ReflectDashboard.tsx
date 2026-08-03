"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { REFLECT_QUESTIONS } from "@/lib/reflectQuestions";
import { fetchDailyLine } from "@/lib/dailyLine";
import { formatPostTime } from "@/lib/dates";

interface TimelineCard {
  href: string;
  title: string;
  subtitle: string;
  preview: string;
  icon: React.ReactNode;
}

interface RecentReflection {
  question: string;
  answer: string;
  created_at: string;
}

function daysUntil(dateStr: string): number {
  const target = new Date(`${dateStr}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

export default function ReflectDashboard() {
  const [dailyLine, setDailyLine] = useState<string | null>(null);
  const [openLetters, setOpenLetters] = useState(0);
  const [nextLetterWait, setNextLetterWait] = useState<number | null>(null);
  const [pendingQuestions, setPendingQuestions] = useState(0);
  const [nextQuestion, setNextQuestion] = useState<string | null>(null);
  const [goalsCount, setGoalsCount] = useState(0);
  const [wantsCount, setWantsCount] = useState(0);
  const [letGoCount, setLetGoCount] = useState(0);
  const [recent, setRecent] = useState<RecentReflection[]>([]);

  useEffect(() => {
    fetchDailyLine().then(setDailyLine).catch(() => {});

    const supabase = createClient();
    Promise.all([
      supabase.from("reflections").select("question_key, question, answer, created_at"),
      supabase.from("reflect_questions").select("question_key, question, created_at").order("created_at", { ascending: true }),
      supabase.from("letters").select("opened_at, target_open_date").order("target_open_date", { ascending: true }),
      supabase.from("goals").select("done"),
      supabase.from("wants").select("done"),
      supabase.from("let_gos").select("released"),
    ]).then(([reflections, generated, letters, goals, wants, letGos]) => {
      const reflectionRows = (reflections.data ?? []) as {
        question_key: string;
        question: string;
        answer: string;
        created_at: string;
      }[];
      const answered = new Set(reflectionRows.map((r) => r.question_key));

      const pendingGenerated = (generated.data ?? []).filter(
        (q) => !answered.has(q.question_key as string)
      );
      const pendingPredetermined = REFLECT_QUESTIONS.filter((q) => !answered.has(q.key));
      setPendingQuestions(pendingGenerated.length + pendingPredetermined.length);
      setNextQuestion(
        pendingPredetermined[0]?.question ?? (pendingGenerated[0]?.question as string) ?? null
      );

      const unopened = (letters.data ?? []).filter((l) => !l.opened_at);
      setOpenLetters(unopened.length);
      setNextLetterWait(
        unopened.length > 0 ? daysUntil(unopened[0].target_open_date as string) : null
      );

      setGoalsCount((goals.data ?? []).filter((g) => !g.done).length);
      setWantsCount((wants.data ?? []).filter((w) => !w.done).length);
      setLetGoCount((letGos.data ?? []).filter((l) => !l.released).length);

      setRecent(
        [...reflectionRows]
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, 3)
      );
    });
  }, []);

  const timeline: TimelineCard[] = [
    {
      href: "/reflect/present",
      title: "Present",
      subtitle: "Right now",
      preview: "Ask about what's on your mind",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
          <circle cx="12" cy="12" r="4.5" />
          <path strokeLinecap="round" d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1M18.4 18.4l-2.1-2.1M7.7 7.7L5.6 5.6" />
        </svg>
      ),
    },
    {
      href: "/reflect/past",
      title: "Past",
      subtitle: "What you've put down",
      preview:
        nextQuestion ?? (pendingQuestions === 0 ? "The page is full — for now" : "Loading…"),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 5.5c2-1 5-1.2 8 0v13c-3-1.2-6-1-8 0v-13z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 5.5c-2-1-5-1.2-8 0v13c3-1.2 6-1 8 0v-13z" />
        </svg>
      ),
    },
    {
      href: "/reflect/future",
      title: "Future",
      subtitle: "Sealed until you're ready",
      preview:
        openLetters === 0
          ? "Nothing sealed yet"
          : nextLetterWait !== null && nextLetterWait <= 0
            ? "A letter is ready to open"
            : `Next opens in ${nextLetterWait} day${nextLetterWait === 1 ? "" : "s"}`,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
          <rect x="3" y="6" width="18" height="13" rx="2.5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 7l8.5 6.5L20.5 7" />
        </svg>
      ),
    },
  ];

  return (
    <div className="grain scroll-area flex-1 px-5 pb-16 pt-[calc(var(--safe-top)+1rem)]">
      <p className="font-script text-4xl leading-none">Reflect</p>

      {/* Hero: today's line, thick and folded */}
      <div className="relative mt-4 overflow-hidden rounded-3xl border border-border/60 bg-surface px-5 pb-5 pt-5 shadow-lg shadow-black/20">
        <p className="text-xs uppercase tracking-[0.2em] text-faint">Today</p>
        <p className="ink-reveal mt-2 min-h-[2rem] font-script text-3xl leading-snug text-foreground/90">
          {dailyLine || "Nothing written yet today."}
        </p>
        <div
          className="mt-4 h-px w-full"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, var(--border) 0 6px, transparent 6px 12px)",
          }}
        />
        <p className="mt-3 text-[11px] uppercase tracking-[0.15em] text-faint">
          {pendingQuestions} waiting · {goalsCount + wantsCount + letGoCount} of yours · {openLetters} sealed
        </p>
      </div>

      {/* Present / Past / Future — a connected timeline */}
      <p className="mt-7 px-1 text-xs uppercase tracking-[0.2em] text-faint">
        Present, past, future
      </p>
      <div className="relative mt-3">
        {/* the thread connecting them */}
        <div
          className="pointer-events-none absolute left-[1.6rem] right-[1.6rem] top-[1.6rem] h-px"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, var(--border) 0 5px, transparent 5px 10px)",
          }}
        />
        <div className="flex flex-col gap-3">
          {timeline.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="pressable relative flex items-center gap-4 rounded-3xl border border-border/60 bg-surface p-4"
            >
              <span className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground/80">
                {card.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-script text-2xl leading-none text-foreground/95">
                    {card.title}
                  </p>
                  <span className="shrink-0 text-[10px] uppercase tracking-[0.1em] text-faint">
                    {card.subtitle}
                  </span>
                </div>
                <p className="mt-1.5 truncate text-[13px] text-muted">{card.preview}</p>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 text-faint">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
              </svg>
            </Link>
          ))}
        </div>
      </div>

      {/* Yours — goals, wants, let go */}
      <p className="mt-7 px-1 text-xs uppercase tracking-[0.2em] text-faint">Yours</p>
      <Link
        href="/reflect/goals"
        className="pressable mt-3 flex items-center justify-between rounded-3xl border border-border/60 bg-surface p-4"
      >
        <div className="flex items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground/80">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12.5V6a1.4 1.4 0 012.8 0v5.2M8.8 11V4.6a1.4 1.4 0 012.8 0V11M11.6 11.2V5.4a1.4 1.4 0 012.8 0v6.4M14.4 12v-3a1.4 1.4 0 012.8 0v6c0 3.3-2.3 6.1-6 6.1-2.4 0-3.7-.8-5-2.2L3.6 15.4a1.3 1.3 0 011.9-1.8L6 14.6" />
            </svg>
          </span>
          <div className="flex gap-4 text-center">
            <div>
              <p className="font-script text-xl leading-none">{goalsCount}</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-faint">Goals</p>
            </div>
            <div>
              <p className="font-script text-xl leading-none">{wantsCount}</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-faint">Wants</p>
            </div>
            <div>
              <p className="font-script text-xl leading-none">{letGoCount}</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-faint">Let go</p>
            </div>
          </div>
        </div>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 text-faint">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
        </svg>
      </Link>

      {/* Recently — a taste of the Past, to fill the page with something alive */}
      {recent.length > 0 && (
        <>
          <div className="mt-8 flex items-baseline justify-between px-1">
            <p className="text-xs uppercase tracking-[0.2em] text-faint">Recently</p>
            <Link href="/reflect/past" className="text-[11px] text-faint underline">
              See all
            </Link>
          </div>
          <div className="mt-3 space-y-3">
            {recent.map((r, i) => (
              <div
                key={i}
                className="rounded-2xl border border-border/40 bg-surface/60 p-4"
              >
                <p className="text-[11px] text-faint">{formatPostTime(r.created_at)}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.1em] text-faint">
                  {r.question}
                </p>
                <p
                  data-selectable
                  className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/80"
                >
                  {r.answer}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
