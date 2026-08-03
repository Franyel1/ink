"use client";

import type { Recap } from "@/lib/recaps";

function monthLabel(periodStart: string): string {
  return new Date(`${periodStart}T00:00:00`).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export default function RecapCard({
  recap,
  onDismiss,
}: {
  recap: Recap;
  onDismiss: () => void;
}) {
  return (
    <div className="rise-in mb-10 rounded-2xl border border-border/60 bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-faint">
          {monthLabel(recap.period_start)}, looked back on
        </p>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="pressable shrink-0 text-faint"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <p
        data-selectable
        className="ink-reveal mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90"
      >
        {recap.content}
      </p>
    </div>
  );
}
