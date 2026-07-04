"use client";

import { useMemo, useState } from "react";
import type { Post, PostType, Tag } from "@/lib/types";
import { POST_TYPES } from "@/lib/types";
import PostCard from "@/components/PostCard";

interface Props {
  open: boolean;
  posts: Post[];
  tags: Tag[];
  onClose: () => void;
  onEdit: (post: Post) => void;
  onDelete: (post: Post) => void;
  onTogglePin: (post: Post) => void;
}

export default function SearchOverlay({
  open,
  posts,
  tags,
  onClose,
  onEdit,
  onDelete,
  onTogglePin,
}: Props) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<PostType | null>(null);
  const [tagId, setTagId] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((post) => {
      if (q && !post.content.toLowerCase().includes(q)) return false;
      if (type && post.post_type !== type) return false;
      if (tagId && !post.post_tags.some((pt) => pt.tag_id === tagId))
        return false;
      if (from && new Date(post.created_at) < new Date(from)) return false;
      if (to) {
        const end = new Date(to);
        end.setDate(end.getDate() + 1);
        if (new Date(post.created_at) >= end) return false;
      }
      return true;
    });
  }, [posts, query, type, tagId, from, to]);

  if (!open) return null;

  const hasFilter = type || tagId || from || to;

  return (
    <div className="fade-in absolute inset-0 z-40 flex flex-col bg-background">
      <div className="shrink-0 px-5 pt-[calc(var(--safe-top)+0.75rem)]">
        <div className="flex items-center gap-3">
          <div className="write-line flex flex-1 items-center gap-2 pb-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4 shrink-0 text-faint">
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
            </svg>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your ink…"
              className="ink-input w-full"
            />
          </div>
          <button type="button" onClick={onClose} className="pb-2 text-sm text-muted">
            Done
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className={`mt-3 text-xs uppercase tracking-widest ${
            hasFilter ? "text-foreground" : "text-faint"
          }`}
        >
          Filters {hasFilter ? "· on" : ""}
        </button>

        {showFilters && (
          <div className="fade-in mt-3 border-b border-border/60 pb-4">
            <div className="scroll-x -mx-5 flex gap-2 px-5">
              {POST_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(type === t ? null : t)}
                  className={`shrink-0 rounded-full border px-3.5 py-1 text-sm capitalize ${
                    type === t
                      ? "border-foreground bg-foreground text-ink"
                      : "border-border text-muted"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            {tags.length > 0 && (
              <div className="scroll-x -mx-5 mt-2 flex gap-2 px-5">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => setTagId(tagId === tag.id ? null : tag.id)}
                    className={`shrink-0 rounded-full border px-3.5 py-1 text-sm ${
                      tagId === tag.id
                        ? "border-foreground bg-foreground text-ink"
                        : "border-border text-muted"
                    }`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-3 flex items-center gap-3 text-sm text-muted">
              <label className="write-line flex items-center gap-2 pb-1">
                <span className="text-xs text-faint">From</span>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="ink-input text-sm"
                />
              </label>
              <label className="write-line flex items-center gap-2 pb-1">
                <span className="text-xs text-faint">To</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="ink-input text-sm"
                />
              </label>
              {hasFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setType(null);
                    setTagId(null);
                    setFrom("");
                    setTo("");
                  }}
                  className="text-xs text-faint underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="scroll-area flex-1 pb-6">
        {results.length === 0 ? (
          <p className="mt-16 text-center text-sm text-faint">
            {query || hasFilter ? "Nothing found in your ink." : "Type to search."}
          </p>
        ) : (
          results.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onEdit={onEdit}
              onDelete={onDelete}
              onTogglePin={onTogglePin}
            />
          ))
        )}
      </div>
    </div>
  );
}
