"use client";

import type { Post, PostType, Tag } from "@/lib/types";
import { savePostOperation, WriteConflict, type PostInput } from "@/lib/posts";
import { createClient } from "@/lib/supabase/client";
import { drainQueue } from "@/lib/sync-core";
import { CACHE, DRAFTS, idbAvailable, idbDelete, idbGet, idbGetAll, idbPut, idbReplace } from "@/lib/idb";

export interface QueuedDraft {
  id: string; userId: string; postId: string; baseRevision: number | null;
  content: string; postType: PostType; tagIds: string[]; files: File[];
  createdAt: string; quotedPostId?: string | null;
  state: "pending" | "conflict" | "error"; error?: string;
}
interface CachedFeed { posts: Post[]; tags: Tag[]; savedAt: string }
export const QUEUE_EVENT = "ink-queue-changed";
export const SYNC_EVENT = "ink-synced";
const changed = () => window.dispatchEvent(new Event(QUEUE_EVENT));
const ACCOUNT_KEY = "active-account";

export async function rememberAccount(userId: string | null): Promise<void> {
  if (!idbAvailable()) return;
  if (userId) await idbPut(CACHE,userId,ACCOUNT_KEY);
  else await idbDelete(CACHE,ACCOUNT_KEY);
}

/** Local identity selects a cache; the server independently authorizes writes. */
export async function localUserId(): Promise<string | null> {
  // An expired offline session cannot refresh. Its last known local identity
  // can still own a draft; it never authorizes a server request.
  if (isOffline() && idbAvailable()) {
    const remembered = await idbGet<string>(CACHE,ACCOUNT_KEY);
    if (remembered) return remembered;
  }
  const { data: { session },error } = await createClient().auth.getSession();
  if (error?.name === "AuthRetryableFetchError" && idbAvailable()) {
    return await idbGet<string>(CACHE,ACCOUNT_KEY) ?? null;
  }
  const userId = session?.user.id ?? null;
  await rememberAccount(userId).catch(() => {});
  return userId;
}
export function isOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}
export async function queueDraft(input: PostInput, editing?: Post | null): Promise<QueuedDraft> {
  const userId = await localUserId();
  if (!userId || (editing && editing.user_id !== userId)) throw new Error("Sign in to save this writing.");
  if (editing && (await readDrafts()).some(d => d.postId === editing.id)) {
    throw new Error("An edit to this entry is already waiting. Review it in Sync first.");
  }
  const id = crypto.randomUUID();
  const draft: QueuedDraft = {
    id,userId,postId:editing?.id ?? id,baseRevision:editing ? editing.revision ?? 1 : null,
    content:input.content,postType:input.postType,tagIds:input.tagIds,files:input.newFiles,
    createdAt:new Date().toISOString(),quotedPostId:input.quotedPostId ?? null,state:"pending",
  };
  await idbPut(DRAFTS,draft);
  changed();
  return draft;
}
export async function readDrafts(): Promise<QueuedDraft[]> {
  if (!idbAvailable()) return [];
  const userId = await localUserId();
  if (!userId) return [];
  return (await idbGetAll<QueuedDraft>(DRAFTS)).filter(d => d.userId === userId)
    .sort((a,b) => b.createdAt.localeCompare(a.createdAt));
}
// Old drafts have no owner. Never attribute or send them automatically.
export async function readLegacyDrafts(): Promise<QueuedDraft[]> {
  return (await idbGetAll<QueuedDraft>(DRAFTS)).filter(d => !d.userId);
}
export async function discardDraft(id: string): Promise<void> {
  const draft = await idbGet<QueuedDraft>(DRAFTS,id);
  if (draft?.userId && draft.userId !== await localUserId()) throw new Error("Different account");
  await idbDelete(DRAFTS,id);
  changed();
}
export async function reviseDraft(draft: QueuedDraft,current: Post | null,content: string,asCopy = false) {
  if (draft.userId !== await localUserId()) throw new Error("Different account");
  // Changing an attempted payload requires a fresh operation ID.
  const id = crypto.randomUUID();
  await idbReplace(DRAFTS,draft.id,{...draft,id,content,state:"pending",error:undefined,
    postId:asCopy ? id : draft.postId,baseRevision:asCopy ? null : current?.revision ?? draft.baseRevision,
    quotedPostId:asCopy ? current?.id ?? null : draft.quotedPostId});
  changed();
}
export async function retryDraft(draft: QueuedDraft) {
  if (draft.userId !== await localUserId()) throw new Error("Different account");
  await idbPut(DRAFTS,{...draft,state:"pending",error:undefined});
  changed();
}
let activeFlush: Promise<Post[]> | null = null;
export function flushDrafts(): Promise<Post[]> {
  if (activeFlush) return activeFlush;
  const flush = async () => {
    if (isOffline()) return [];
    const userId = await localUserId();
    if (!userId) return [];
    const posted = await drainQueue({userId,drafts:await readDrafts(),
      send:d => savePostOperation({content:d.content,postType:d.postType,tagIds:d.tagIds,
        newFiles:d.files,quotedPostId:d.quotedPostId},d),
      remove:discardDraft,
      fail:async (draft,error) => {
        if (await localUserId() !== userId || !await idbGet(DRAFTS,draft.id)) return;
        const message = error instanceof Error ? error.message :
          typeof error === "object" && error && "message" in error ? String(error.message) : "Couldn't sync. Try again.";
        await idbPut(DRAFTS,{...draft,state:error instanceof WriteConflict ? "conflict" : "error",error:message});
      },
    });
    if (posted.length && await localUserId() === userId) {
      const cached = await readCachedFeed();
      const merged = new Map((cached?.posts ?? []).map(p => [p.id,p]));
      posted.forEach(p => merged.set(p.id,p));
      await cacheFeed([...merged.values()].sort((a,b) => b.created_at.localeCompare(a.created_at)),cached?.tags ?? []);
      window.dispatchEvent(new Event(SYNC_EVENT));
    }
    return posted;
  };
  activeFlush = (async () => typeof navigator !== "undefined" && navigator.locks
    ? await navigator.locks.request("ink-sync",flush) : await flush())().finally(() => {activeFlush = null; changed();});
  return activeFlush;
}
export async function cacheFeed(posts: Post[],tags: Tag[]): Promise<void> {
  const userId = await localUserId();
  if (!userId || posts.some(p => p.user_id !== userId)) return;
  try {await idbPut(CACHE,{posts,tags,savedAt:new Date().toISOString()},`feed:${userId}`);} catch { /* optional cache */ }
}
export async function readCachedFeed(): Promise<CachedFeed | null> {
  const userId = await localUserId();
  if (!userId) return null;
  try {return await idbGet<CachedFeed>(CACHE,`feed:${userId}`) ?? null;} catch {return null;}
}
export async function clearOfflineData(): Promise<void> {
  if (idbAvailable()) {
    const userId = await localUserId();
    const drafts = await idbGetAll<QueuedDraft>(DRAFTS);
    await Promise.all(drafts.filter(d => d.userId === userId).map(d => idbDelete(DRAFTS,d.id)));
    if (userId) await idbDelete(CACHE,`feed:${userId}`);
    await idbDelete(CACHE,"feed");
    await rememberAccount(null);
  }
  if (typeof caches !== "undefined") {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith("ink-images-") || k.startsWith("ink-shell-")).map(k => caches.delete(k)));
  }
}
