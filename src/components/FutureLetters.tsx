"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchLetters,
  fetchLetterPrompts,
  createLetter,
  isLetterUnlocked,
  markLetterOpened,
  type Letter,
} from "@/lib/letters";

function daysUntil(dateStr: string): number {
  const target = new Date(`${dateStr}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

function formatWait(days: number): string {
  if (days <= 0) return "today";
  if (days < 30) return `${days} day${days === 1 ? "" : "s"}`;
  if (days < 365) return `${Math.round(days / 30)} month${Math.round(days / 30) === 1 ? "" : "s"}`;
  return `${(days / 365).toFixed(1)} years`;
}

const QUICK_DATES = [
  { label: "1 month", days: 30 },
  { label: "6 months", days: 182 },
  { label: "1 year", days: 365 },
];

function futureDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function EnvelopeCard({ letter, onOpened }: { letter: Letter; onOpened: (l: Letter) => void }) {
  const unlocked = isLetterUnlocked(letter);
  const [revealed, setRevealed] = useState(Boolean(letter.opened_at));

  async function reveal() {
    if (!unlocked) return;
    setRevealed(true);
    if (!letter.opened_at) {
      try {
        await markLetterOpened(letter.id);
        onOpened({ ...letter, opened_at: new Date().toISOString() });
      } catch {
        // still shown revealed locally even if the write failed
      }
    }
  }

  if (revealed) {
    return (
      <div className="pop-in mb-4 rounded-2xl bg-paper p-5 text-ink shadow-lg shadow-black/40">
        <p className="text-xs uppercase tracking-[0.15em] text-ink/50">
          Sealed {new Date(letter.created_at).toLocaleDateString()}
        </p>
        <p
          data-selectable
          className="mt-3 whitespace-pre-wrap font-script text-2xl leading-snug"
        >
          {letter.content}
        </p>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={!unlocked}
      onClick={reveal}
      className={`pressable mb-4 flex w-full items-center justify-between rounded-2xl border p-4 text-left ${
        unlocked ? "border-foreground/60 bg-surface-raised" : "border-border/60 bg-surface"
      }`}
    >
      <div>
        <p className="text-sm font-semibold">
          {unlocked ? "A letter is ready" : "Sealed letter"}
        </p>
        <p className="mt-0.5 text-xs text-faint">
          {unlocked
            ? "Tap to open"
            : `Opens in ${formatWait(daysUntil(letter.target_open_date))}`}
        </p>
      </div>
      <span className="text-xl">{unlocked ? "📬" : "✉️"}</span>
    </button>
  );
}

export default function FutureLetters() {
  const [letters, setLetters] = useState<Letter[] | null>(null);
  const [composing, setComposing] = useState(false);
  const [prompts, setPrompts] = useState<string[]>([]);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [content, setContent] = useState("");
  const [targetDate, setTargetDate] = useState(futureDate(30));
  const [usedPrompts, setUsedPrompts] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchLetters().then(setLetters).catch(() => setLetters([]));
  }, []);

  function openComposer() {
    setComposing(true);
    setPromptsLoading(true);
    fetchLetterPrompts()
      .then(setPrompts)
      .catch(() => setPrompts([]))
      .finally(() => setPromptsLoading(false));
  }

  function insertPrompt(p: string) {
    setContent((c) => (c ? `${c}\n\n${p}\n` : `${p}\n`));
    setUsedPrompts((all) => (all.includes(p) ? all : [...all, p]));
  }

  async function save() {
    if (!content.trim() || saving) return;
    setSaving(true);
    try {
      const letter = await createLetter(content.trim(), usedPrompts, targetDate);
      setLetters((all) => [...(all ?? []), letter].sort((a, b) => a.target_open_date.localeCompare(b.target_open_date)));
      setComposing(false);
      setContent("");
      setUsedPrompts([]);
      setPrompts([]);
    } catch {
      // stay open so they can retry
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="scroll-area flex-1 pb-10">
      <header className="flex items-center gap-3 px-6 pb-2 pt-[calc(var(--safe-top)+2rem)]">
        <Link href="/reflect" aria-label="Back to reflect" className="pressable p-1 text-muted">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="font-script text-4xl">Future</h1>
      </header>
      <p className="px-6 text-sm text-faint">
        Letters to whoever you are when they unseal.
      </p>

      <div className="px-6 pb-16">
      <div className="mt-5">
        {letters === null && (
          <p className="text-sm text-faint">…</p>
        )}
        {letters !== null && letters.length === 0 && !composing && (
          <p className="text-sm text-faint">Nothing sealed yet.</p>
        )}
        {letters?.map((l) => (
          <EnvelopeCard
            key={l.id}
            letter={l}
            onOpened={(updated) =>
              setLetters((all) => (all ?? []).map((x) => (x.id === updated.id ? updated : x)))
            }
          />
        ))}
      </div>

      {!composing ? (
        <button
          type="button"
          onClick={openComposer}
          className="pressable mt-2 rounded-full border border-border px-5 py-2 text-sm text-muted"
        >
          Write a letter
        </button>
      ) : (
        <div className="rise-in mt-3 rounded-2xl border border-dashed border-border/90 p-4">
          <p className="text-xs uppercase tracking-[0.15em] text-faint">
            Things you might address
          </p>
          {promptsLoading ? (
            <p className="mt-2 text-xs text-faint">…</p>
          ) : prompts.length === 0 ? (
            <p className="mt-2 text-xs text-faint">
              Nothing suggested — write about whatever's on your mind.
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {prompts.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => insertPrompt(p)}
                  className="pressable rounded-full border border-border px-3 py-1 text-xs text-muted"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          <textarea
            autoFocus
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Dear future me…"
            rows={6}
            className="ink-input paper-lines mt-4 w-full resize-none"
          />

          <div className="mt-4">
            <p className="text-xs uppercase tracking-[0.15em] text-faint">Opens in</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {QUICK_DATES.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => setTargetDate(futureDate(q.days))}
                  className={`pressable rounded-full border px-3 py-1 text-xs ${
                    targetDate === futureDate(q.days)
                      ? "border-foreground bg-foreground text-ink"
                      : "border-border text-muted"
                  }`}
                >
                  {q.label}
                </button>
              ))}
              <input
                type="date"
                value={targetDate}
                min={futureDate(1)}
                onChange={(e) => setTargetDate(e.target.value)}
                className="ink-input rounded-full border border-border px-3 py-1 text-xs"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setComposing(false);
                setContent("");
                setUsedPrompts([]);
              }}
              className="text-sm text-faint"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!content.trim() || saving}
              onClick={save}
              className="pressable rounded-full bg-foreground px-5 py-2 text-sm font-medium text-ink disabled:opacity-30"
            >
              {saving ? "…" : "Seal it"}
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
