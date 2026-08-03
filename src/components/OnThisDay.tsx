"use client";

import { useState } from "react";
import type { Post } from "@/lib/types";
import { findOnThisDay } from "@/lib/dates";
import { useClientFlag } from "@/lib/useClientFlag";

function dismissKey(postId: string) {
  const today = new Date().toISOString().slice(0, 10);
  return `ink-otd-dismissed-${today}-${postId}`;
}

/** A quiet callback to a post from a year (or more) ago the same day, if one exists. */
export default function OnThisDay({ posts }: { posts: Post[] }) {
  const memory = findOnThisDay(posts);
  // Dismissal lives in two places on purpose: localStorage remembers it across
  // reloads (read client-side only, to keep hydration matching), and state
  // covers the dismissal that just happened this render.
  const dismissedEarlier = useClientFlag(() =>
    memory ? localStorage.getItem(dismissKey(memory.id)) !== null : false
  );
  const [dismissedNow, setDismissedNow] = useState(false);

  if (!memory || dismissedEarlier || dismissedNow) return null;

  const yearsAgo =
    new Date().getFullYear() - new Date(memory.created_at).getFullYear();

  return (
    <div className="rise-in mx-4 mb-4 mt-2 rounded-2xl border border-border/60 bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-faint">
          On this day, {yearsAgo} year{yearsAgo === 1 ? "" : "s"} ago
        </p>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            localStorage.setItem(dismissKey(memory.id), "1");
            setDismissedNow(true);
          }}
          className="pressable shrink-0 text-faint"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <p
        data-selectable
        className="font-script mt-2 whitespace-pre-wrap text-xl leading-snug text-foreground/90"
      >
        {memory.content}
      </p>
    </div>
  );
}
