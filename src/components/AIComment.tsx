"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Post } from "@/lib/types";

const SENTIMENT_LABEL: Record<
  NonNullable<Post["ai_sentiment"]>,
  string
> = {
  positive: "Reads warm",
  negative: "Reads heavy",
  mixed: "Reads mixed",
  neutral: "Reads even",
};

/** The small pulsing sparkle that sits on a post once the AI has looked at it. */
export function AISparkleButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="See what the notebook noticed"
      onClick={onClick}
      className="pressable sparkle-pulse shrink-0 text-muted"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M12 2.5l1.7 5.3a3 3 0 001.9 1.9l5.3 1.7-5.3 1.7a3 3 0 00-1.9 1.9L12 20.3l-1.7-5.3a3 3 0 00-1.9-1.9L3.1 11.4l5.3-1.7a3 3 0 001.9-1.9L12 2.5z" />
      </svg>
    </button>
  );
}

/** Pop-up card showing the AI's read on a single post. */
export function AICommentPopup({
  post,
  onClose,
}: {
  post: Post;
  onClose: () => void;
}) {
  const [view, setView] = useState<"comment" | "notice">("comment");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  // Rendered via portal so this stays fixed to the viewport even when an
  // ancestor (e.g. the feed's pull-to-refresh wrapper) has a CSS transform,
  // which would otherwise become the containing block for `fixed` children.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fade-in absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div className="pop-in relative w-full max-w-sm rounded-3xl border border-border bg-surface-raised p-6 shadow-2xl shadow-black/50">
        {/* Reads like a comment: a small avatar-ish sparkle, a name, then the reaction.
            The sparkle itself is the toggle between the comment and what it noticed. */}
        <div className="flex items-start gap-3">
          <button
            type="button"
            aria-label={
              view === "comment" ? "See what it noticed" : "Back to comment"
            }
            onClick={() =>
              setView((v) => (v === "comment" ? "notice" : "comment"))
            }
            className={`pressable flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-ink ${
              view === "comment" ? "sparkle-pulse" : ""
            }`}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path d="M12 2.5l1.7 5.3a3 3 0 001.9 1.9l5.3 1.7-5.3 1.7a3 3 0 00-1.9 1.9L12 20.3l-1.7-5.3a3 3 0 00-1.9-1.9L3.1 11.4l5.3-1.7a3 3 0 001.9-1.9L12 2.5z" />
            </svg>
          </button>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-sm font-semibold">
              Ink
              <span className="ml-2 text-[11px] font-normal text-faint">
                tap the spark to switch
              </span>
            </p>
            <p
              key={view}
              data-selectable
              className={`ink-reveal mt-1 whitespace-pre-wrap leading-relaxed ${
                view === "comment"
                  ? "text-[15px] text-foreground/90"
                  : "text-xs italic text-faint"
              }`}
            >
              {view === "comment"
                ? post.ai_comment
                : post.ai_summary || "Nothing stood out beyond this post itself."}
            </p>
          </div>
        </div>

        {(post.ai_sentiment || (post.ai_topics && post.ai_topics.length > 0)) && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5 pl-11">
            {post.ai_sentiment && (
              <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted">
                {SENTIMENT_LABEL[post.ai_sentiment]}
              </span>
            )}
            {post.ai_topics?.map((topic) => (
              <span
                key={topic}
                className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted"
              >
                {topic}
              </span>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="pressable mt-6 w-full rounded-full bg-foreground py-2.5 text-sm font-medium text-ink"
        >
          Close
        </button>
      </div>
    </div>,
    document.body
  );
}
