"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Post, Tag } from "@/lib/types";
import { fetchPosts, fetchTags, deletePost, setPinned } from "@/lib/posts";
import { createClient } from "@/lib/supabase/client";
import { usePullToRefresh } from "@/lib/usePullToRefresh";
import {
  cacheFeed,
  discardDraft,
  flushDrafts,
  readCachedFeed,
  readDrafts,
  type QueuedDraft,
} from "@/lib/offline";
import PostCard, { type PostAuthor } from "@/components/PostCard";
import Composer from "@/components/Composer";
import SearchOverlay from "@/components/SearchOverlay";
import OnThisDay from "@/components/OnThisDay";

export default function FeedScreen() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [author, setAuthor] = useState<PostAuthor>({
    name: null,
    avatarUrl: null,
  });
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [stale, setStale] = useState(false);
  const [drafts, setDrafts] = useState<QueuedDraft[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadFeed = useCallback(async () => {
    const supabase = createClient();
    const loadAuthor = supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("display_name, profile_picture_url")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    });
    setDrafts(await readDrafts());
    try {
      const [p, t, prof] = await Promise.all([fetchPosts(), fetchTags(), loadAuthor]);
      setPosts(p);
      setTags(t);
      if (prof) setAuthor({ name: prof.display_name, avatarUrl: prof.profile_picture_url });
      setLoadError(false);
      setStale(false);
      void cacheFeed(p, t);
    } catch {
      // No network — fall back to the last feed we saw on this device. Only a
      // genuinely empty cache counts as an error worth showing.
      const cached = await readCachedFeed();
      if (cached) {
        setPosts(cached.posts);
        setTags(cached.tags);
        setStale(true);
        setLoadError(false);
      } else {
        setLoadError(true);
      }
    }
  }, []);

  useEffect(() => {
    // Mount fetch: every setState inside loadFeed happens after an await, so
    // there's no cascading render here — the compiler just can't see across the
    // async boundary. Deliberately client-side rather than server-fetched, so
    // the feed can fall back to the offline cache when the network is gone.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFeed();
  }, [loadFeed]);

  const { pull, pulling, refreshing } = usePullToRefresh(scrollRef, loadFeed);

  // Anything written offline goes out the moment there's a network again —
  // on reconnect, and on mount to catch drafts left over from a previous visit.
  useEffect(() => {
    let cancelled = false;
    async function send() {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      if ((await readDrafts()).length === 0) return;
      await flushDrafts();
      if (!cancelled) await loadFeed();
    }
    void send();
    window.addEventListener("online", send);
    return () => {
      cancelled = true;
      window.removeEventListener("online", send);
    };
  }, [loadFeed]);

  const handleEdit = useCallback((post: Post) => {
    setEditing(post);
    setComposerOpen(true);
  }, []);

  const handleDelete = useCallback(async (post: Post) => {
    setPosts((all) => (all ?? []).filter((p) => p.id !== post.id));
    try {
      await deletePost(post.id);
    } catch {
      setPosts((all) => (all ? [post, ...all] : [post]));
    }
  }, []);

  const handleTogglePin = useCallback(async (post: Post) => {
    const next = !post.is_pinned;
    setPosts((all) =>
      (all ?? []).map((p) => (p.id === post.id ? { ...p, is_pinned: next } : p))
    );
    try {
      await setPinned(post.id, next);
    } catch {
      setPosts((all) =>
        (all ?? []).map((p) =>
          p.id === post.id ? { ...p, is_pinned: !next } : p
        )
      );
    }
  }, []);

  function handleSaved(post: Post, isEdit: boolean) {
    setPosts((all) =>
      isEdit
        ? (all ?? []).map((p) => (p.id === post.id ? post : p))
        : [post, ...(all ?? [])]
    );
    setComposerOpen(false);
    setEditing(null);
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Top bar */}
      <header className="flex shrink-0 items-center justify-between px-5 pb-2 pt-[calc(var(--safe-top)+0.75rem)]">
        <h1 className="font-script text-4xl leading-none">Ink.</h1>
        <button
          type="button"
          aria-label="Search"
          onClick={() => setSearchOpen(true)}
          className="pressable p-2 text-muted"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
          </svg>
        </button>
      </header>

      {/* Feed */}
      <div ref={scrollRef} className="scroll-area relative flex-1 bg-background pb-28">
        {/* Revealed as the content below slides down — a plain black gap with the spinner in it */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex h-16 items-center justify-center">
          <span
            className={`text-lg text-faint transition-opacity ${
              pull > 4 ? "opacity-100" : "opacity-0"
            } ${refreshing ? "animate-spin" : ""}`}
            style={!refreshing ? { transform: `rotate(${Math.min(pull * 2.4, 200)}deg)` } : undefined}
          >
            {refreshing ? "◌" : "↓"}
          </span>
        </div>

        <div
          className="relative bg-background"
          style={{
            // Only set a transform while it's actually needed: any transform,
            // even translateY(0), makes this the containing block for
            // descendant `position: fixed` elements (like post menus and the
            // AI comment popup), which breaks their full-viewport positioning.
            transform: pull !== 0 ? `translateY(${pull}px)` : undefined,
            transition: pulling ? "none" : "transform 250ms cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          {loadError && (
            <p className="mt-16 text-center text-sm text-faint">
              Couldn&apos;t load your ink. Pull yourself together and reopen.
            </p>
          )}
          {posts === null && !loadError && (
            <div className="mt-16 flex justify-center">
              <span className="font-script text-2xl text-faint">…</span>
            </div>
          )}
          {stale && (
            <p className="mx-4 mb-1 mt-2 text-center text-[11px] uppercase tracking-[0.15em] text-faint">
              Offline. Showing what&apos;s saved here
            </p>
          )}

          {/* Written with no signal, still on this device. Shown as itself
              rather than as a finished post, so nothing looks more permanent
              than it is. */}
          {drafts.map((draft) => (
            <div
              key={draft.id}
              className="rise-in mx-4 mb-4 mt-2 rounded-2xl border border-dashed border-border/80 bg-surface/50 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] uppercase tracking-[0.15em] text-faint">
                  Waiting for signal
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    await discardDraft(draft.id);
                    setDrafts((all) => all.filter((d) => d.id !== draft.id));
                  }}
                  className="pressable shrink-0 text-[11px] text-faint underline"
                >
                  Discard
                </button>
              </div>
              <p
                data-selectable
                className="font-script mt-2 whitespace-pre-wrap text-xl leading-snug text-foreground/70"
              >
                {draft.content}
              </p>
              {draft.files.length > 0 && (
                <p className="mt-2 text-[11px] text-faint">
                  {draft.files.length} image
                  {draft.files.length === 1 ? "" : "s"} attached
                </p>
              )}
            </div>
          ))}

          {posts !== null && posts.length === 0 && drafts.length === 0 && (
            <div className="rise-in mt-20 px-10 text-center">
              <p className="font-script text-3xl text-muted">A blank page.</p>
              <p className="mt-3 text-sm text-faint">
                Write anything: a thought, a moment, a recipe, a memory.
              </p>
            </div>
          )}
          {posts !== null && posts.length > 0 && <OnThisDay posts={posts} />}
          {posts?.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              author={author}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onTogglePin={handleTogglePin}
            />
          ))}
        </div>
      </div>

      {/* Floating composer button */}
      <button
        type="button"
        aria-label="New post"
        onClick={() => {
          setEditing(null);
          setComposerOpen(true);
        }}
        className="pressable absolute bottom-6 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-ink shadow-lg shadow-black/40"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 3.9a2.1 2.1 0 013 3L8 18.4l-4 1 1-4L16.5 3.9z"
          />
        </svg>
      </button>

      <SearchOverlay
        open={searchOpen}
        posts={posts ?? []}
        tags={tags}
        author={author}
        onClose={() => setSearchOpen(false)}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onTogglePin={handleTogglePin}
      />

      {composerOpen && (
        <Composer
          key={editing?.id ?? "new"}
          editing={editing}
          tags={tags}
          author={author}
          onClose={() => {
            setComposerOpen(false);
            setEditing(null);
          }}
          onSaved={handleSaved}
          onQueued={async () => {
            setDrafts(await readDrafts());
            setComposerOpen(false);
            setEditing(null);
          }}
          onTagCreated={(tag) =>
            setTags((all) =>
              all.some((t) => t.id === tag.id) ? all : [...all, tag]
            )
          }
        />
      )}
    </div>
  );
}
