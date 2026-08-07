"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchMemory, forgetAllMemory, forgetLine } from "@/lib/memory";

export default function MemoryScreen() {
  const [lines, setLines] = useState<string[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirmingAll, setConfirmingAll] = useState(false);

  useEffect(() => {
    fetchMemory()
      .then((m) => setLines(m.lines))
      .catch(() => setLoadError(true));
  }, []);

  async function remove(line: string) {
    if (confirming !== line) {
      setConfirming(line);
      return;
    }
    setRemoving(line);
    try {
      const remaining = await forgetLine(line);
      setLines(remaining);
      setConfirming(null);
    } catch {
      // Leave it in place; tapping again retries.
    } finally {
      setRemoving(null);
    }
  }

  async function removeAll() {
    if (!confirmingAll) {
      setConfirmingAll(true);
      return;
    }
    try {
      await forgetAllMemory();
      setLines([]);
    } finally {
      setConfirmingAll(false);
    }
  }

  return (
    <div className="scroll-area flex-1 pb-28">
      <header className="flex items-center gap-3 px-6 pb-1 pt-[calc(var(--safe-top)+2rem)]">
        <Link href="/profile" aria-label="Back to profile" className="pressable p-1 text-muted">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="font-script text-4xl">Gathered</h1>
      </header>
      <p className="px-6 text-sm text-faint">
        Everything the notebook currently believes about you, a line at a time.
        Remove any of it and it won&apos;t be written back.
      </p>

      <div className="mt-5 px-6">
        {loadError && (
          <p className="mt-10 text-center text-sm text-faint">
            Couldn&apos;t load this page. Try again in a bit.
          </p>
        )}
        {lines === null && !loadError && (
          <div className="mt-10 flex justify-center">
            <span className="font-script text-2xl text-faint">…</span>
          </div>
        )}
        {lines !== null && lines.length === 0 && (
          <div className="rise-in mt-14 text-center">
            <p className="font-script text-3xl text-muted">Nothing yet.</p>
            <p className="mt-3 text-sm text-faint">
              It fills in as you write and answer.
            </p>
          </div>
        )}

        {lines?.map((line) => {
          const isConfirming = confirming === line;
          return (
            <div
              key={line}
              className={`rise-in mb-3 flex items-start gap-3 rounded-2xl border p-4 transition-colors ${
                isConfirming ? "border-foreground bg-surface-raised" : "border-border/60 bg-surface"
              }`}
            >
              <p data-selectable className="min-w-0 flex-1 text-sm leading-relaxed text-foreground/85">
                {line}
              </p>
              <button
                type="button"
                aria-label={isConfirming ? "Tap again to forget this" : "Forget this"}
                disabled={removing === line}
                onClick={() => remove(line)}
                onBlur={() => setConfirming(null)}
                className={`pressable shrink-0 rounded-full px-2 py-1 text-[11px] ${
                  isConfirming ? "bg-foreground text-ink" : "text-faint"
                }`}
              >
                {removing === line ? "…" : isConfirming ? "Sure?" : "✕"}
              </button>
            </div>
          );
        })}

        {lines !== null && lines.length > 0 && (
          <button
            type="button"
            onClick={removeAll}
            onBlur={() => setConfirmingAll(false)}
            className="pressable mt-4 w-full rounded-full border border-border py-3 text-sm text-muted"
          >
            {confirmingAll ? "Tap again to forget everything" : "Forget all of it"}
          </button>
        )}

        {lines !== null && lines.length > 0 && (
          <p className="mt-5 text-[11px] leading-relaxed text-faint">
            The notebook keeps writing as you post and answer, so this fills back
            in over time. What you remove here stays gone.
          </p>
        )}
      </div>
    </div>
  );
}
