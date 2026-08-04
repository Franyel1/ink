"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchPerson,
  fetchPostsForPerson,
  type Person,
  type PersonPost,
} from "@/lib/people";
import { formatPostTime } from "@/lib/dates";
import { describeGap, hasDrifted, mentionsByMonth } from "@/lib/peopleContext";

const SENTIMENT_LABELS: Record<string, string> = {
  positive: "warm",
  negative: "hard",
  mixed: "mixed",
  neutral: "even",
};

function longDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-[0.15em] text-faint">{label}</p>
      <p className="mt-0.5 truncate text-sm">{value}</p>
    </div>
  );
}

export default function PersonScreen({ personId }: { personId: string }) {
  const [person, setPerson] = useState<Person | null>(null);
  const [posts, setPosts] = useState<PersonPost[] | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">(
    "loading"
  );

  useEffect(() => {
    let stale = false;
    Promise.all([fetchPerson(personId), fetchPostsForPerson(personId)])
      .then(([p, ps]) => {
        if (stale) return;
        if (!p) {
          setState("missing");
          return;
        }
        setPerson(p);
        setPosts(ps);
        setState("ready");
      })
      .catch(() => {
        if (!stale) setState("error");
      });
    return () => {
      stale = true;
    };
  }, [personId]);

  const back = (
    <Link href="/people" aria-label="Back to people" className="pressable p-1 text-muted">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
      </svg>
    </Link>
  );

  if (state !== "ready" || !person || !posts) {
    return (
      <div className="scroll-area flex-1 pb-28">
        <header className="flex items-center gap-3 px-6 pb-2 pt-[calc(var(--safe-top)+2rem)]">
          {back}
        </header>
        <p className="mt-10 text-center text-sm text-faint">
          {state === "loading"
            ? "…"
            : state === "missing"
              ? "This person isn't in the notebook anymore."
              : "Couldn't load this page. Try again in a bit."}
        </p>
      </div>
    );
  }

  // Mentions come from the post links rather than mention_count, so a merged
  // person's history reads as one continuous run.
  const months = mentionsByMonth(posts.map((p) => p.created_at));
  const peak = Math.max(1, ...months.map((m) => m.count));

  const sentiments = posts.reduce<Record<string, number>>((acc, post) => {
    if (post.ai_sentiment) acc[post.ai_sentiment] = (acc[post.ai_sentiment] ?? 0) + 1;
    return acc;
  }, {});
  const sentimentTotal = Object.values(sentiments).reduce((a, b) => a + b, 0);
  const sentimentParts = Object.entries(sentiments)
    .sort((a, b) => b[1] - a[1])
    .map(([key, n]) => `${Math.round((n / sentimentTotal) * 100)}% ${SENTIMENT_LABELS[key] ?? key}`);

  const quiet = hasDrifted(person);

  return (
    <div className="scroll-area flex-1 pb-28">
      <header className="flex items-center gap-3 px-6 pb-1 pt-[calc(var(--safe-top)+2rem)]">
        {back}
        <div className="min-w-0">
          <h1 className="truncate font-script text-4xl">{person.name}</h1>
          {person.relationship && (
            <p className="text-xs uppercase tracking-[0.15em] text-faint">
              {person.relationship}
            </p>
          )}
        </div>
      </header>

      <div className="px-6">
        {person.notes && (
          <p
            data-selectable
            className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/85"
          >
            {person.notes}
          </p>
        )}

        {quiet && (
          <p className="rise-in mt-4 rounded-2xl border border-dashed border-border/90 p-4 text-sm text-muted">
            You haven&apos;t written about {person.name} in{" "}
            {describeGap(person.last_mentioned_at)}.
          </p>
        )}

        <div className="mt-5 grid grid-cols-3 gap-3 border-y border-border/50 py-3.5">
          {/* Counted from the post links, not people.mention_count: that
              counter only ever goes up, so deleting a post leaves it claiming
              mentions there's nothing left to open. */}
          <Stat
            label="Posts"
            value={`${posts.length}`}
          />
          <Stat label="First" value={longDate(person.first_mentioned_at)} />
          <Stat label="Last" value={longDate(person.last_mentioned_at)} />
        </div>

        <div className="mt-5">
          <p className="text-[10px] uppercase tracking-[0.15em] text-faint">
            Last 12 months
          </p>
          <div className="mt-2.5 flex items-end gap-1">
            {months.map((month) => (
              <div key={month.key} className="flex flex-1 flex-col items-center gap-1">
                <div
                  title={`${month.label}: ${month.count} post${
                    month.count === 1 ? "" : "s"
                  }`}
                  style={{ height: `${Math.round((month.count / peak) * 44) || 2}px` }}
                  className={`w-full rounded-sm ${
                    month.count > 0 ? "bg-foreground/70" : "bg-border"
                  }`}
                />
                <span className="text-[9px] text-faint">{month.initial}</span>
              </div>
            ))}
          </div>
        </div>

        {sentimentParts.length > 0 && (
          <p className="mt-4 text-xs text-faint">
            Posts they appear in read {sentimentParts.join(", ")}.
          </p>
        )}

        <p className="mt-7 text-[10px] uppercase tracking-[0.15em] text-faint">
          Every mention
        </p>
        {posts.length === 0 && (
          <p className="mt-3 text-sm text-faint">
            No posts are linked to them yet.
          </p>
        )}
        {posts.map((post) => (
          <div key={post.id} className="rise-in mt-3 border-t border-border/40 pt-3">
            <p className="text-[11px] text-faint">
              {formatPostTime(post.created_at)}
              {post.post_type !== "thought" && ` · ${post.post_type}`}
            </p>
            <p
              data-selectable
              className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground/85"
            >
              {post.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
