"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import type { Post, PostType, Tag } from "@/lib/types";
import { POST_TYPES } from "@/lib/types";
import { createPost, updatePost, createTag, type PostInput } from "@/lib/posts";
import { isOffline, queueDraft } from "@/lib/offline";
import { useKeyboardInset } from "@/lib/useKeyboardInset";
import { useSpeechToText } from "@/lib/useSpeechToText";
import Avatar from "@/components/Avatar";
import QuotedPostCard from "@/components/QuotedPostCard";

interface Author {
  name: string | null;
  avatarUrl: string | null;
}

interface Props {
  editing: Post | null;
  /**
   * The post being quoted, when writing a new one. Quoting is fixed at the
   * moment of writing: editing a post later can change its words but not what
   * it was written in response to.
   */
  quoting?: Post | null;
  tags: Tag[];
  author: Author;
  onClose: () => void;
  onSaved: (post: Post, isEdit: boolean) => void;
  onQueued: () => void;
  onTagCreated: (tag: Tag) => void;
}

interface PendingFile {
  file: File;
  url: string;
}

type Picker = "none" | "type" | "tags";

// Mounted only while open (keyed by the post being edited), so state
// initializes straight from props.
export default function Composer({
  editing,
  quoting = null,
  tags,
  author,
  onClose,
  onSaved,
  onQueued,
  onTagCreated,
}: Props) {
  const [content, setContent] = useState(editing?.content ?? "");
  const [postType, setPostType] = useState<PostType>(
    editing?.post_type ?? "thought"
  );
  const [tagIds, setTagIds] = useState<string[]>(
    editing?.post_tags.map((pt) => pt.tag_id) ?? []
  );
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [picker, setPicker] = useState<Picker>("none");
  const [newTag, setNewTag] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const keyboardInset = useKeyboardInset();

  useEffect(() => {
    const t = setTimeout(() => textareaRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    return () => files.forEach((f) => URL.revokeObjectURL(f.url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function autoresize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = el.scrollHeight + "px";
  }

  useEffect(autoresize, [content]);

  const speech = useSpeechToText((chunk) => {
    setContent((c) => (c && !c.endsWith(" ") ? c + " " : c) + chunk);
  });

  function pickFiles(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list)
      .slice(0, 6 - files.length)
      .map((file) => ({ file, url: URL.createObjectURL(file) }));
    setFiles((f) => [...f, ...picked]);
  }

  async function addTag() {
    const name = newTag.trim();
    if (!name) return;
    try {
      const tag = await createTag(name);
      onTagCreated(tag);
      setTagIds((ids) => (ids.includes(tag.id) ? ids : [...ids, tag.id]));
      setNewTag("");
    } catch {
      setError("Couldn't add tag");
    }
  }

  async function submit() {
    const trimmed = content.trim();
    if (busy || (!trimmed && files.length === 0)) return;
    setBusy(true);
    setError(null);
    const input: PostInput = {
      content: trimmed,
      postType,
      tagIds,
      newFiles: files.map((f) => f.file),
      quotedPostId: editing ? null : quoting?.id ?? null,
    };
    try {
      const post = editing
        ? await updatePost(editing.id, input)
        : await createPost(input);
      files.forEach((f) => URL.revokeObjectURL(f.url));
      onSaved(post, !!editing);
    } catch {
      // A new post can wait on the doorstep until there's a network. An edit
      // can't — replaying it later would clobber whatever the post looks like
      // by then — so that one has to be retried by hand.
      if (!editing && isOffline()) {
        try {
          await queueDraft(input);
          files.forEach((f) => URL.revokeObjectURL(f.url));
          onQueued();
          return;
        } catch {
          setError("No signal, and nowhere to keep this. Try again.");
        }
      } else {
        setError("Something didn't stick. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (typeof document === "undefined") return null;

  // A quote with no words of your own is just a repost, and this app has no
  // audience to repost to. Photos still stand alone.
  const canPost =
    content.trim().length > 0 || (files.length > 0 && !quoting);
  const selectedTags = tags.filter((t) => tagIds.includes(t.id));

  return createPortal(
    <div
      className="fade-in fixed inset-0 z-50 flex flex-col bg-background"
      style={{ paddingBottom: keyboardInset || undefined }}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-[calc(var(--safe-top)+0.65rem)]">
        <button
          type="button"
          onClick={onClose}
          className="pressable px-2 py-1.5 text-[15px] text-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canPost || busy}
          onClick={submit}
          className="pressable rounded-full bg-foreground px-5 py-1.5 text-[15px] font-semibold text-ink disabled:opacity-30"
        >
          {busy ? "…" : editing ? "Save" : "Post"}
        </button>
      </div>

      {/* Writing surface */}
      <div className="scroll-area flex-1 px-4 pt-2">
        <div className="flex gap-3">
          <Avatar name={author.name} url={author.avatarUrl} size={38} />
          <div className="min-w-0 flex-1 pt-1.5">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onFocus={() =>
                textareaRef.current?.scrollIntoView({ block: "nearest" })
              }
              placeholder={quoting ? "Add something to this…" : "What's on your mind?"}
              rows={quoting ? 3 : 4}
              className="ink-input w-full resize-none text-[17px] leading-relaxed"
            />

            {quoting && (
              <div className="mt-2">
                <QuotedPostCard
                  post={{
                    id: quoting.id,
                    content: quoting.content,
                    post_type: quoting.post_type,
                    created_at: quoting.created_at,
                    post_images: quoting.post_images,
                  }}
                  compact
                />
              </div>
            )}

            {files.length > 0 && (
              <div
                className={`mt-2 grid gap-2 ${
                  files.length === 1 ? "grid-cols-1" : "grid-cols-2"
                }`}
              >
                {files.map((f, i) => (
                  <div
                    key={f.url}
                    className={`relative overflow-hidden rounded-2xl border border-border/60 ${
                      files.length === 1 ? "aspect-[4/3]" : "aspect-square"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={f.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      aria-label="Remove image"
                      onClick={() =>
                        setFiles((all) => {
                          URL.revokeObjectURL(f.url);
                          return all.filter((_, j) => j !== i);
                        })
                      }
                      className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5"
                    >
                      <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" className="h-3.5 w-3.5">
                        <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {editing && editing.post_images.length > 0 && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {editing.post_images.map((img) => (
                  <div
                    key={img.id}
                    className="relative aspect-square overflow-hidden rounded-2xl opacity-70"
                  >
                    <Image src={img.image_url} alt="" fill sizes="200px" className="object-cover" />
                  </div>
                ))}
              </div>
            )}

            {selectedTags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {selectedTags.map((tag) => (
                  <span
                    key={tag.id}
                    className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted"
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}

            {error && <p className="mt-3 text-sm text-red-300/80">{error}</p>}
          </div>
        </div>
      </div>

      {/* Picker panel (sits directly above the toolbar / keyboard) */}
      {picker === "type" && (
        <div className="fade-in scroll-x flex shrink-0 gap-2 border-t border-border/50 px-4 py-3">
          {POST_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setPostType(t);
                setPicker("none");
              }}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-sm capitalize transition-colors ${
                postType === t
                  ? "border-foreground bg-foreground text-ink"
                  : "border-border text-muted"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}
      {picker === "tags" && (
        <div className="fade-in scroll-x flex shrink-0 items-center gap-2 border-t border-border/50 px-4 py-3">
          {tags.map((tag) => {
            const on = tagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() =>
                  setTagIds((ids) =>
                    on ? ids.filter((x) => x !== tag.id) : [...ids, tag.id]
                  )
                }
                className={`shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors ${
                  on
                    ? "border-foreground bg-foreground text-ink"
                    : "border-border text-muted"
                }`}
              >
                {tag.name}
              </button>
            );
          })}
          <span className="write-line inline-flex shrink-0 items-center gap-1 pb-0.5">
            <input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="New tag…"
              className="ink-input w-24 text-sm"
            />
            {newTag.trim() && (
              <button type="button" onClick={addTag} className="text-sm text-muted">
                Add
              </button>
            )}
          </span>
        </div>
      )}

      {/* Toolbar — pinned above the keyboard */}
      <div
        className="flex shrink-0 items-center gap-1 border-t border-border px-3 py-2"
        style={{
          paddingBottom: keyboardInset
            ? undefined
            : "calc(var(--safe-bottom) + 0.5rem)",
        }}
      >
        <button
          type="button"
          aria-label="Add photos"
          onClick={() => fileInputRef.current?.click()}
          className="pressable rounded-full p-2.5 text-muted"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-[22px] w-[22px]">
            <rect x="3" y="5" width="18" height="14" rx="3" />
            <circle cx="9" cy="10" r="1.5" />
            <path strokeLinecap="round" d="M5 17l4.5-4.5a1.5 1.5 0 012.1 0L18 19" />
          </svg>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            pickFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {speech.supported && (
          <button
            type="button"
            aria-label={speech.listening ? "Stop dictating" : "Dictate"}
            onClick={speech.toggle}
            className={`pressable rounded-full p-2.5 ${
              speech.listening ? "sparkle-pulse text-red-400" : "text-muted"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-[22px] w-[22px]">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path strokeLinecap="round" d="M5 11a7 7 0 0014 0M12 18v3" />
            </svg>
          </button>
        )}
        <button
          type="button"
          aria-label="Tags"
          onClick={() => setPicker(picker === "tags" ? "none" : "tags")}
          className={`pressable relative rounded-full p-2.5 ${
            picker === "tags" || tagIds.length > 0 ? "text-foreground" : "text-muted"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-[22px] w-[22px]">
            <path strokeLinecap="round" d="M9 4L7 20M17 4l-2 16M4.5 9h16M3.5 15h16" />
          </svg>
          {tagIds.length > 0 && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-[10px] font-semibold text-ink">
              {tagIds.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setPicker(picker === "type" ? "none" : "type")}
          className={`pressable ml-1 rounded-full border px-3.5 py-1 font-script text-lg capitalize leading-snug ${
            picker === "type"
              ? "border-foreground text-foreground"
              : "border-border text-muted"
          }`}
        >
          {postType}
        </button>
      </div>
    </div>,
    document.body
  );
}
