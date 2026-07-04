"use client";

import { useState } from "react";
import Image from "next/image";
import type { Post } from "@/lib/types";
import { formatPostTime } from "@/lib/dates";

interface Props {
  post: Post;
  onEdit: (post: Post) => void;
  onDelete: (post: Post) => void;
  onTogglePin: (post: Post) => void;
}

export default function PostCard({ post, onEdit, onDelete, onTogglePin }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const hasImages = post.post_images.length > 0;
  const tags = post.post_tags.map((pt) => pt.tags).filter(Boolean);

  const meta = (
    <div className="flex items-center gap-2 text-xs text-faint">
      {post.is_pinned && (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3 text-muted">
          <path d="M16 3l5 5-5.5 1.5L12 13l-1 5-2.5-2.5L4 20l-1-1 4.5-4.5L5 12l3.5-3.5L10 3l6 0z" />
        </svg>
      )}
      {post.post_type !== "thought" && (
        <span className="font-script text-sm capitalize text-muted">
          {post.post_type}
        </span>
      )}
      <span>{formatPostTime(post.created_at)}</span>
    </div>
  );

  const menu = (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label="Post options"
        onClick={() => {
          setMenuOpen((v) => !v);
          setConfirmDelete(false);
        }}
        className="pressable -mr-1 px-2 py-1 text-faint"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>
      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="fade-in absolute right-0 top-7 z-20 w-44 overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-xl shadow-black/50">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onEdit(post);
              }}
              className="block w-full px-4 py-3 text-left text-sm"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onTogglePin(post);
              }}
              className="block w-full px-4 py-3 text-left text-sm"
            >
              {post.is_pinned ? "Unpin" : "Pin"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirmDelete) {
                  setMenuOpen(false);
                  onDelete(post);
                } else {
                  setConfirmDelete(true);
                }
              }}
              className="block w-full px-4 py-3 text-left text-sm text-red-300/90"
            >
              {confirmDelete ? "Tap again to delete" : "Delete"}
            </button>
          </div>
        </>
      )}
    </div>
  );

  const tagRow = tags.length > 0 && (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted"
        >
          {tag.name}
        </span>
      ))}
    </div>
  );

  if (!hasImages) {
    // Text-only: compact, Twitter-like
    return (
      <article className="border-b border-border/60 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          {meta}
          {menu}
        </div>
        <p
          data-selectable
          className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed"
        >
          {post.content}
        </p>
        {tagRow}
      </article>
    );
  }

  // With images: large image(s), caption below, Instagram-like
  return (
    <article className="border-b border-border/60 py-4">
      <div className="flex items-start justify-between gap-3 px-5">
        {meta}
        {menu}
      </div>
      <div
        className={`mt-3 ${
          post.post_images.length > 1
            ? "scroll-x flex snap-x snap-mandatory gap-2 px-5"
            : "px-5"
        }`}
      >
        {post.post_images.map((img) => (
          <div
            key={img.id}
            className={`relative shrink-0 snap-center overflow-hidden rounded-2xl bg-surface ${
              post.post_images.length > 1 ? "w-[85%]" : "w-full"
            } aspect-[4/5]`}
          >
            <Image
              src={img.image_url}
              alt=""
              fill
              sizes="(max-width: 640px) 90vw, 500px"
              className="object-cover"
            />
          </div>
        ))}
      </div>
      {post.content && (
        <p
          data-selectable
          className="mt-3 whitespace-pre-wrap px-5 text-sm leading-relaxed text-foreground/90"
        >
          {post.content}
        </p>
      )}
      <div className="px-5">{tagRow}</div>
    </article>
  );
}
