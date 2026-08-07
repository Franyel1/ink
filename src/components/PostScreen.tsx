"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Post, Tag } from "@/lib/types";
import { POST_SELECT, deletePost, fetchTags, normalizePost, setPinned } from "@/lib/posts";
import { createClient } from "@/lib/supabase/client";
import PostCard, { type PostAuthor } from "@/components/PostCard";
import Composer from "@/components/Composer";

/**
 * A single post on its own page, so everything that references one has
 * somewhere to point: people chips, search results, On This Day, and any link
 * shared out of the app.
 */
export default function PostScreen({ postId }: { postId: string }) {
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [author, setAuthor] = useState<PostAuthor>({ name: null, avatarUrl: null });
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">(
    "loading"
  );
  const [editing, setEditing] = useState<Post | null>(null);
  const [quoting, setQuoting] = useState<Post | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    try {
      const [{ data, error }, t, { data: userData }] = await Promise.all([
        supabase.from("posts").select(POST_SELECT).eq("id", postId).maybeSingle(),
        fetchTags(),
        supabase.auth.getUser(),
      ]);
      if (error) throw error;
      if (!data) {
        setState("missing");
        return;
      }
      setPost(normalizePost(data));
      setTags(t);
      if (userData.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, profile_picture_url")
          .eq("id", userData.user.id)
          .maybeSingle();
        if (profile) {
          setAuthor({
            name: profile.display_name,
            avatarUrl: profile.profile_picture_url,
          });
        }
      }
      setState("ready");
    } catch {
      setState("error");
    }
  }, [postId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleDelete(target: Post) {
    await deletePost(target.id);
    // Nothing left to show, so leave rather than sit on a dead permalink.
    router.push("/feed");
  }

  async function handleTogglePin(target: Post) {
    const next = !target.is_pinned;
    setPost((p) => (p ? { ...p, is_pinned: next } : p));
    try {
      await setPinned(target.id, next);
    } catch {
      setPost((p) => (p ? { ...p, is_pinned: !next } : p));
    }
  }

  const back = (
    <Link href="/feed" aria-label="Back to feed" className="pressable p-1 text-muted">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
      </svg>
    </Link>
  );

  return (
    <div className="scroll-area flex-1 pb-28">
      <header className="flex items-center gap-3 px-4 pb-2 pt-[calc(var(--safe-top)+1rem)]">
        {back}
        <span className="text-xs uppercase tracking-[0.2em] text-faint">Post</span>
      </header>

      {state !== "ready" || !post ? (
        <p className="mt-16 text-center text-sm text-faint">
          {state === "loading"
            ? "…"
            : state === "missing"
              ? "This post isn't here anymore."
              : "Couldn't load this post. Try again in a bit."}
        </p>
      ) : (
        <PostCard
          post={post}
          author={author}
          onEdit={(p) => {
            setQuoting(null);
            setEditing(p);
          }}
          onDelete={handleDelete}
          onTogglePin={handleTogglePin}
          onQuote={(p) => {
            setEditing(null);
            setQuoting(p);
          }}
        />
      )}

      {(editing || quoting) && (
        <Composer
          key={editing ? `edit-${editing.id}` : `quote-${quoting?.id}`}
          editing={editing}
          quoting={quoting}
          tags={tags}
          author={author}
          onClose={() => {
            setEditing(null);
            setQuoting(null);
          }}
          onSaved={(saved) => {
            // An edit updates this page; a quote is a different post, so go
            // read it where it now lives rather than silently staying here.
            if (editing) setPost(saved);
            else router.push(`/post/${saved.id}`);
            setEditing(null);
            setQuoting(null);
          }}
          onQueued={() => {
            setEditing(null);
            setQuoting(null);
          }}
          onTagCreated={(tag) => setTags((all) => [...all, tag])}
        />
      )}
    </div>
  );
}
