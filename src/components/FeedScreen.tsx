"use client";

import { useCallback, useEffect, useState } from "react";
import type { Post, Tag } from "@/lib/types";
import { fetchPosts, fetchTags, deletePost, setPinned } from "@/lib/posts";
import PostCard from "@/components/PostCard";
import Composer from "@/components/Composer";
import SearchOverlay from "@/components/SearchOverlay";

export default function FeedScreen() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchPosts(), fetchTags()])
      .then(([p, t]) => {
        if (cancelled) return;
        setPosts(p);
        setTags(t);
      })
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, []);

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
      <div className="scroll-area flex-1 pb-28">
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
        {posts !== null && posts.length === 0 && (
          <div className="rise-in mt-20 px-10 text-center">
            <p className="font-script text-3xl text-muted">A blank page.</p>
            <p className="mt-3 text-sm text-faint">
              Write anything — a thought, a moment, a recipe, a memory.
            </p>
          </div>
        )}
        {posts?.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onTogglePin={handleTogglePin}
          />
        ))}
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
          onClose={() => {
            setComposerOpen(false);
            setEditing(null);
          }}
          onSaved={handleSaved}
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
