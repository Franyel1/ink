"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchPeople, type Person } from "@/lib/people";
import { formatPostTime } from "@/lib/dates";

export default function PeopleScreen() {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetchPeople()
      .then(setPeople)
      .catch(() => setLoadError(true));
  }, []);

  return (
    <div className="scroll-area flex-1 pb-10">
      <header className="flex items-center gap-3 px-6 pb-2 pt-[calc(var(--safe-top)+2rem)]">
        <Link href="/profile" aria-label="Back to profile" className="pressable p-1 text-muted">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="font-script text-4xl">People</h1>
      </header>
      <p className="px-6 text-sm text-faint">
        Everyone the notebook has picked up on from what you write — quietly
        kept, and filled in a little more each time they come up.
      </p>

      <div className="mt-4 px-6">
        {loadError && (
          <p className="mt-10 text-center text-sm text-faint">
            Couldn&apos;t load this page. Try again in a bit.
          </p>
        )}
        {people === null && !loadError && (
          <div className="mt-10 flex justify-center">
            <span className="font-script text-2xl text-faint">…</span>
          </div>
        )}
        {people !== null && people.length === 0 && (
          <div className="rise-in mt-14 text-center">
            <p className="font-script text-3xl text-muted">No one yet.</p>
            <p className="mt-3 text-sm text-faint">
              Mention someone in a post and they&apos;ll start showing up here.
            </p>
          </div>
        )}
        {people?.map((person) => (
          <div
            key={person.id}
            className="rise-in mb-4 rounded-2xl border border-border/60 bg-surface p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold">
                  {person.name}
                </p>
                {person.relationship && (
                  <p className="text-xs uppercase tracking-[0.15em] text-faint">
                    {person.relationship}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-xs text-faint">
                mentioned {person.mention_count}×
              </span>
            </div>
            {person.notes && (
              <p
                data-selectable
                className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground/85"
              >
                {person.notes}
              </p>
            )}
            <p className="mt-2.5 text-[11px] text-faint">
              last came up {formatPostTime(person.last_mentioned_at)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
