"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import type { Post, PostType, Tag } from "@/lib/types";
import { POST_TYPES } from "@/lib/types";
import { createPost, updatePost, createTag, type PostInput } from "@/lib/posts";
import { useKeyboardInset } from "@/lib/useKeyboardInset";

interface Props {
  editing: Post | null;
  tags: Tag[];
  onClose: () => void;
  onSaved: (post: Post, isEdit: boolean) => void;
  onTagCreated: (tag: Tag) => void;
}

interface PendingFile {
  file: File;
  url: string;
}

// Mounted only while open (keyed by the post being edited), so state
// initializes straight from props.
export default function Composer({
  editing,
  tags,
  onClose,
  onSaved,
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
  const [showExtras, setShowExtras] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const keyboardInset = useKeyboardInset();

  useEffect(() => {
    // Focus after the sheet slides in
    const t = setTimeout(() => textareaRef.current?.focus(), 350);
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
    el.style.height = Math.min(el.scrollHeight, 240) + "px";
  }

  useEffect(autoresize, [content]);

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
    };
    try {
      const post = editing
        ? await updatePost(editing.id, input)
        : await createPost(input);
      files.forEach((f) => URL.revokeObjectURL(f.url));
      onSaved(post, !!editing);
    } catch {
      setError("Something didn't stick. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (typeof document === "undefined") return null;

  const canPost = content.trim().length > 0 || files.length > 0;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close composer"
        onClick={onClose}
        className="fade-in absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />
      <div
        className="sheet-up relative flex max-h-[calc(100dvh-var(--safe-top)-2rem)] flex-col rounded-t-3xl border-t border-border bg-surface"
        style={{ paddingBottom: keyboardInset || undefined }}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-border" />

        <div className="flex items-center justify-between px-5 pt-3">
          <button type="button" onClick={onClose} className="py-1 text-sm text-muted">
            Cancel
          </button>
          <span className="font-script text-xl text-muted">
            {editing ? "Edit" : "Ink."}
          </span>
          <button
            type="button"
            disabled={!canPost || busy}
            onClick={submit}
            className="pressable rounded-full bg-foreground px-5 py-1.5 text-sm font-semibold text-ink disabled:opacity-30"
          >
            {busy ? "…" : editing ? "Save" : "Post"}
          </button>
        </div>

        <div className="scroll-area flex-1 px-5 pb-[calc(var(--safe-bottom)+1rem)] pt-4">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => textareaRef.current?.scrollIntoView({ block: "nearest" })}
            placeholder="What's on your mind?"
            rows={3}
            className="ink-input w-full resize-none text-[17px] leading-relaxed"
          />

          {files.length > 0 && (
            <div className="scroll-x -mx-1 mt-2 flex gap-2 px-1">
              {files.map((f, i) => (
                <div
                  key={f.url}
                  className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    aria-label="Remove image"
                    onClick={() =>
                      setFiles((all) => {
                        URL.revokeObjectURL(f.url);
                        return all.filter((_, j) => j !== i);
                      })
                    }
                    className="absolute right-1 top-1 rounded-full bg-black/70 p-1"
                  >
                    <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" className="h-3 w-3">
                      <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {editing && editing.post_images.length > 0 && (
            <div className="scroll-x -mx-1 mt-2 flex gap-2 px-1">
              {editing.post_images.map((img) => (
                <div
                  key={img.id}
                  className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl opacity-70"
                >
                  <Image src={img.image_url} alt="" fill sizes="96px" className="object-cover" />
                </div>
              ))}
            </div>
          )}

          {error && <p className="mt-3 text-sm text-red-300/80">{error}</p>}

          <div className="mt-4 flex items-center gap-4 border-t border-border/60 pt-3">
            <button
              type="button"
              aria-label="Add photos"
              onClick={() => fileInputRef.current?.click()}
              className="pressable text-muted"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
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
            <button
              type="button"
              onClick={() => setShowExtras((v) => !v)}
              className={`pressable text-sm ${showExtras ? "text-foreground" : "text-muted"}`}
            >
              <span className="font-script text-lg capitalize">{postType}</span>
              {tagIds.length > 0 && (
                <span className="ml-2 text-xs text-faint">
                  {tagIds.length} tag{tagIds.length > 1 ? "s" : ""}
                </span>
              )}
            </button>
          </div>

          {showExtras && (
            <div className="fade-in mt-4">
              <p className="text-xs uppercase tracking-widest text-faint">Type</p>
              <div className="scroll-x -mx-5 mt-2 flex gap-2 px-5">
                {POST_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPostType(t)}
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

              <p className="mt-5 text-xs uppercase tracking-widest text-faint">Tags</p>
              <div className="mt-2 flex flex-wrap gap-2">
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
                      className={`rounded-full border px-3.5 py-1 text-sm transition-colors ${
                        on
                          ? "border-foreground bg-foreground text-ink"
                          : "border-border text-muted"
                      }`}
                    >
                      {tag.name}
                    </button>
                  );
                })}
                <span className="write-line inline-flex items-center gap-1 pb-0.5">
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
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
