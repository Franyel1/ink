"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Post } from "@/lib/types";
import { formatPostTime } from "@/lib/dates";
import Avatar from "@/components/Avatar";
import { AISparkleButton, AICommentPopup } from "@/components/AIComment";
import QuotedPostCard, { MissingQuoteCard } from "@/components/QuotedPostCard";

export interface PostAuthor {
  name: string | null;
  avatarUrl: string | null;
}

interface Props {
  post: Post;
  author: PostAuthor;
  onEdit: (post: Post) => void;
  onDelete: (post: Post) => void;
  onTogglePin: (post: Post) => void;
  /** Omitted where quoting makes no sense, which hides the menu action. */
  onQuote?: (post: Post) => void;
}

export default function PostCard({
  post,
  author,
  onEdit,
  onDelete,
  onTogglePin,
  onQuote,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const hasImages = post.post_images.length > 0;
  const tags = post.post_tags.map((pt) => pt.tags).filter(Boolean);
  const people = (post.post_people ?? [])
    .map((pp) => pp.people)
    .filter((p): p is { id: string; name: string } => Boolean(p));
  const name = author.name || "You";
  const hasAiComment = Boolean(post.ai_comment);

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
            {onQuote && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onQuote(post);
                }}
                className="block w-full px-4 py-3 text-left text-sm"
              >
                Quote
              </button>
            )}
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

  const badges = (
    <span className="flex items-center gap-1.5">
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
    </span>
  );

  // Filled, so the people the notebook noticed read differently from the tags
  // the user chose themselves.
  const peopleRow = people.length > 0 && (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {people.map((person) => (
        <Link
          key={person.id}
          href={`/people/${person.id}`}
          className="pressable rounded-full bg-surface-raised px-2.5 py-0.5 text-[11px] text-muted"
        >
          {person.name}
        </Link>
      ))}
    </div>
  );

  // A quote whose subject was deleted keeps the empty frame rather than
  // silently becoming an ordinary post, so the reply still has something to
  // be replying to.
  const quoteRow = (post.quoted_post || post.quoted_post_id) && (
    <div className="mt-2.5">
      {post.quoted_post ? (
        <Link href={`/post/${post.quoted_post.id}`} className="pressable block">
          <QuotedPostCard post={post.quoted_post} compact />
        </Link>
      ) : (
        <MissingQuoteCard />
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
      <article className="flex gap-3 border-b border-border/60 px-4 py-3.5">
        <Avatar name={author.name} url={author.avatarUrl} size={38} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span className="truncate font-semibold">{name}</span>
              <span className="shrink-0 text-xs text-faint">
                {formatPostTime(post.created_at)}
              </span>
              {badges}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {hasAiComment && (
                <AISparkleButton onClick={() => setAiOpen(true)} />
              )}
              {menu}
            </div>
          </div>
          <p
            data-selectable
            className="mt-0.5 whitespace-pre-wrap text-[15px] leading-relaxed"
          >
            {post.content}
          </p>
          {quoteRow}
          {peopleRow}
          {tagRow}
        </div>
        {aiOpen && (
          <AICommentPopup post={post} onClose={() => setAiOpen(false)} />
        )}
      </article>
    );
  }

  // With images: large image(s), caption below, Instagram-like
  return (
    <article className="border-b border-border/60 py-3">
      <div className="flex items-center justify-between gap-2 px-4 pb-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={author.name} url={author.avatarUrl} size={32} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{name}</p>
            <p className="flex items-center gap-1.5 text-xs leading-tight text-faint">
              {formatPostTime(post.created_at)} {badges}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {hasAiComment && <AISparkleButton onClick={() => setAiOpen(true)} />}
          {menu}
        </div>
      </div>
      <div
        className={
          post.post_images.length > 1
            ? "scroll-x flex snap-x snap-mandatory gap-1.5"
            : ""
        }
      >
        {post.post_images.map((img) => (
          <div
            key={img.id}
            className={`relative shrink-0 snap-center overflow-hidden bg-surface ${
              post.post_images.length > 1 ? "w-[88%] first:ml-0" : "w-full"
            } aspect-[4/5]`}
          >
            <Image
              src={img.image_url}
              alt=""
              fill
              sizes="(max-width: 640px) 95vw, 500px"
              className="object-cover"
            />
          </div>
        ))}
      </div>
      {post.content && (
        <p
          data-selectable
          className="mt-2.5 whitespace-pre-wrap px-4 text-sm leading-relaxed text-foreground/90"
        >
          {post.content}
        </p>
      )}
      <div className="px-4">
        {quoteRow}
        {peopleRow}
        {tagRow}
      </div>
      {aiOpen && (
        <AICommentPopup post={post} onClose={() => setAiOpen(false)} />
      )}
    </article>
  );
}
