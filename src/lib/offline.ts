"use client";

import type { Post, PostType, Tag } from "@/lib/types";
import { createPost, type PostInput } from "@/lib/posts";
import {
  CACHE,
  DRAFTS,
  idbAvailable,
  idbDelete,
  idbGet,
  idbGetAll,
  idbPut,
} from "@/lib/idb";

/** A post written while offline, waiting for a network to send it on. */
export interface QueuedDraft {
  id: string;
  content: string;
  postType: PostType;
  tagIds: string[];
  files: File[];
  createdAt: string;
}

interface CachedFeed {
  posts: Post[];
  tags: Tag[];
  savedAt: string;
}

const FEED_KEY = "feed";

/**
 * A failed write isn't proof of being offline — the request may have reached
 * Supabase and failed there, in which case queueing it would post it twice. Only
 * treat it as offline when the browser agrees the network is gone.
 */
export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export async function queueDraft(input: PostInput): Promise<QueuedDraft> {
  const draft: QueuedDraft = {
    id: crypto.randomUUID(),
    content: input.content,
    postType: input.postType,
    tagIds: input.tagIds,
    // Files are structured-cloneable, so the images ride along in IndexedDB.
    files: input.newFiles,
    createdAt: new Date().toISOString(),
  };
  await idbPut(DRAFTS, draft);
  return draft;
}

export async function readDrafts(): Promise<QueuedDraft[]> {
  if (!idbAvailable()) return [];
  try {
    const drafts = await idbGetAll<QueuedDraft>(DRAFTS);
    return drafts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function discardDraft(id: string): Promise<void> {
  try {
    await idbDelete(DRAFTS, id);
  } catch {
    /* nothing to do — the draft stays queued and retries later */
  }
}

/**
 * Send every queued draft, oldest first so the feed ends up in the order things
 * were actually written. A draft is only dropped once it's safely posted; if one
 * fails we stop and leave the rest for the next attempt rather than reordering
 * them around a failure.
 */
let flushing = false;

export async function flushDrafts(): Promise<Post[]> {
  // Mount and the `online` event can fire within a moment of each other. Two
  // overlapping flushes would each read the same draft before either had
  // deleted it, and post it twice.
  if (flushing) return [];
  flushing = true;
  try {
    const drafts = (await readDrafts()).reverse();
    const posted: Post[] = [];
    for (const draft of drafts) {
      try {
        const post = await createPost({
          content: draft.content,
          postType: draft.postType,
          tagIds: draft.tagIds,
          newFiles: draft.files,
        });
        await discardDraft(draft.id);
        posted.push(post);
      } catch {
        break;
      }
    }
    return posted;
  } finally {
    flushing = false;
  }
}

export async function cacheFeed(posts: Post[], tags: Tag[]): Promise<void> {
  if (!idbAvailable()) return;
  try {
    const payload: CachedFeed = {
      posts,
      tags,
      savedAt: new Date().toISOString(),
    };
    await idbPut(CACHE, payload, FEED_KEY);
  } catch {
    /* a full disk shouldn't break posting */
  }
}

/**
 * Wipe everything this device is holding on the signed-in user's behalf. Called
 * on sign-out: the cached feed is their writing, and a leftover draft would
 * otherwise flush into whichever account signs in next.
 */
export async function clearOfflineData(): Promise<void> {
  if (!idbAvailable()) return;
  try {
    const drafts = await idbGetAll<QueuedDraft>(DRAFTS);
    await Promise.all(drafts.map((d) => idbDelete(DRAFTS, d.id)));
    await idbDelete(CACHE, FEED_KEY);
  } catch {
    /* best effort */
  }
  if (typeof caches !== "undefined") {
    try {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith("ink-images-")).map((k) => caches.delete(k))
      );
    } catch {
      /* best effort */
    }
  }
}

export async function readCachedFeed(): Promise<CachedFeed | null> {
  if (!idbAvailable()) return null;
  try {
    return (await idbGet<CachedFeed>(CACHE, FEED_KEY)) ?? null;
  } catch {
    return null;
  }
}
