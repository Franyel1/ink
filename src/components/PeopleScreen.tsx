"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchPeople,
  fetchPostsForPerson,
  fetchMergeSuggestions,
  mergePeople,
  type Person,
  type PersonPost,
  type MergeSuggestion,
} from "@/lib/people";
import { formatPostTime } from "@/lib/dates";

function suggestionDismissKey(keepId: string, mergeId: string) {
  return `ink-merge-dismissed-${[keepId, mergeId].sort().join("-")}`;
}

export default function PeopleScreen() {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [posts, setPosts] = useState<Record<string, PersonPost[]>>({});
  const [postsLoading, setPostsLoading] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<MergeSuggestion[]>([]);
  const [confirmingSuggestion, setConfirmingSuggestion] = useState<string | null>(null);
  const [mergingSuggestion, setMergingSuggestion] = useState<string | null>(null);

  const [combineMode, setCombineMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmingCombine, setConfirmingCombine] = useState(false);
  const [combining, setCombining] = useState(false);

  useEffect(() => {
    fetchPeople()
      .then(setPeople)
      .catch(() => setLoadError(true));
    fetchMergeSuggestions()
      .then((all) =>
        setSuggestions(
          all.filter(
            (s) => !localStorage.getItem(suggestionDismissKey(s.keepId, s.mergeId))
          )
        )
      )
      .catch(() => {});
  }, []);

  function byId(id: string) {
    return people?.find((p) => p.id === id);
  }

  function dismissSuggestion(s: MergeSuggestion) {
    localStorage.setItem(suggestionDismissKey(s.keepId, s.mergeId), "1");
    setSuggestions((all) => all.filter((x) => x !== s));
    setConfirmingSuggestion(null);
  }

  async function confirmSuggestion(s: MergeSuggestion) {
    const key = `${s.keepId}-${s.mergeId}`;
    if (confirmingSuggestion !== key) {
      setConfirmingSuggestion(key);
      return;
    }
    setMergingSuggestion(key);
    try {
      await mergePeople(s.keepId, s.mergeId);
      setPeople((all) => (all ?? []).filter((p) => p.id !== s.mergeId));
      dismissSuggestion(s);
    } catch {
      // leave it in the list so they can retry
    } finally {
      setMergingSuggestion(null);
    }
  }

  function toggle(person: Person) {
    if (combineMode) {
      setSelected((sel) =>
        sel.includes(person.id)
          ? sel.filter((id) => id !== person.id)
          : sel.length < 2
            ? [...sel, person.id]
            : sel
      );
      return;
    }
    if (expanded === person.id) {
      setExpanded(null);
      return;
    }
    setExpanded(person.id);
    if (!posts[person.id]) {
      setPostsLoading(person.id);
      fetchPostsForPerson(person.id)
        .then((p) => setPosts((all) => ({ ...all, [person.id]: p })))
        .catch(() => setPosts((all) => ({ ...all, [person.id]: [] })))
        .finally(() => setPostsLoading(null));
    }
  }

  async function combineSelected() {
    if (selected.length !== 2) return;
    if (!confirmingCombine) {
      setConfirmingCombine(true);
      return;
    }
    setCombining(true);
    const [keepId, mergeId] = selected;
    try {
      await mergePeople(keepId, mergeId);
      setPeople((all) => (all ?? []).filter((p) => p.id !== mergeId));
      setSelected([]);
      setConfirmingCombine(false);
      setCombineMode(false);
    } catch {
      setConfirmingCombine(false);
    } finally {
      setCombining(false);
    }
  }

  return (
    <div className="scroll-area flex-1 pb-28">
      <header className="flex items-center justify-between gap-3 px-6 pb-2 pt-[calc(var(--safe-top)+2rem)]">
        <div className="flex items-center gap-3">
          <Link href="/profile" aria-label="Back to profile" className="pressable p-1 text-muted">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="font-script text-4xl">People</h1>
        </div>
        {people !== null && people.length > 1 && (
          <button
            type="button"
            onClick={() => {
              setCombineMode((v) => !v);
              setSelected([]);
              setConfirmingCombine(false);
              setExpanded(null);
            }}
            className={`pressable shrink-0 rounded-full border px-3 py-1.5 text-xs ${
              combineMode
                ? "border-foreground bg-foreground text-ink"
                : "border-border text-muted"
            }`}
          >
            {combineMode ? "Cancel" : "Combine"}
          </button>
        )}
      </header>
      <p className="px-6 text-sm text-faint">
        {combineMode
          ? "Tap two people who are actually the same person, then confirm."
          : "Everyone the notebook has picked up on from what you write — quietly kept, and filled in a little more each time they come up."}
      </p>

      <div className="mt-4 px-6">
        {!combineMode &&
          suggestions.map((s) => {
            const keep = byId(s.keepId);
            const merge = byId(s.mergeId);
            if (!keep || !merge) return null;
            const key = `${s.keepId}-${s.mergeId}`;
            const isConfirming = confirmingSuggestion === key;
            return (
              <div
                key={key}
                className="rise-in mb-4 rounded-2xl border border-dashed border-border/90 p-4"
              >
                <p className="text-xs uppercase tracking-[0.15em] text-faint">
                  Might be the same person
                </p>
                <p className="mt-1.5 text-sm">
                  <span className="font-semibold">{keep.name}</span>
                  {" and "}
                  <span className="font-semibold">{merge.name}</span>
                </p>
                <p className="mt-1 text-xs text-faint">{s.reason}</p>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    disabled={mergingSuggestion === key}
                    onClick={() => confirmSuggestion(s)}
                    className={`pressable rounded-full px-4 py-1.5 text-xs font-medium ${
                      isConfirming
                        ? "bg-foreground text-ink"
                        : "border border-border text-muted"
                    }`}
                  >
                    {mergingSuggestion === key
                      ? "…"
                      : isConfirming
                        ? "Tap again to combine"
                        : "Combine"}
                  </button>
                  <button
                    type="button"
                    onClick={() => dismissSuggestion(s)}
                    className="text-xs text-faint"
                  >
                    Not the same
                  </button>
                </div>
              </div>
            );
          })}

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
        {people?.map((person) => {
          const isOpen = expanded === person.id;
          const isSelected = selected.includes(person.id);
          return (
            <button
              type="button"
              key={person.id}
              onClick={() => toggle(person)}
              className={`pressable rise-in mb-4 block w-full rounded-2xl border p-4 text-left transition-colors ${
                isSelected
                  ? "border-foreground bg-surface-raised"
                  : "border-border/60 bg-surface"
              }`}
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
                {combineMode ? (
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                      isSelected
                        ? "border-foreground bg-foreground text-ink"
                        : "border-border text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                ) : (
                  <span className="shrink-0 text-xs text-faint">
                    mentioned {person.mention_count}×
                  </span>
                )}
              </div>
              {person.notes && (
                <p
                  data-selectable
                  className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground/85"
                >
                  {person.notes}
                </p>
              )}
              {!combineMode && (
                <p className="mt-2.5 text-[11px] text-faint">
                  last came up {formatPostTime(person.last_mentioned_at)} ·{" "}
                  {isOpen ? "hide posts" : "show posts"}
                </p>
              )}

              {isOpen && !combineMode && (
                <div className="fade-in mt-3 border-t border-border/40 pt-3">
                  {postsLoading === person.id && (
                    <p className="text-xs text-faint">…</p>
                  )}
                  {postsLoading !== person.id &&
                    (posts[person.id]?.length ?? 0) === 0 && (
                      <p className="text-xs text-faint">
                        No posts found for them yet.
                      </p>
                    )}
                  {posts[person.id]?.map((post) => (
                    <div key={post.id} className="mb-2.5 last:mb-0">
                      <p className="text-[11px] text-faint">
                        {formatPostTime(post.created_at)}
                      </p>
                      <p
                        data-selectable
                        className="line-clamp-2 whitespace-pre-wrap text-sm text-foreground/80"
                      >
                        {post.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {combineMode && selected.length === 2 && (
        <div className="fade-in fixed inset-x-0 bottom-0 z-30 flex justify-center border-t border-border bg-background px-6 pb-[calc(var(--safe-bottom)+1rem)] pt-3">
          <button
            type="button"
            disabled={combining}
            onClick={combineSelected}
            className="pressable w-full max-w-sm rounded-full bg-foreground py-3 text-sm font-medium text-ink disabled:opacity-50"
          >
            {combining
              ? "…"
              : confirmingCombine
                ? `Tap again to combine "${byId(selected[0])?.name}" & "${byId(selected[1])?.name}"`
                : `Combine "${byId(selected[0])?.name}" & "${byId(selected[1])?.name}"`}
          </button>
        </div>
      )}
    </div>
  );
}
