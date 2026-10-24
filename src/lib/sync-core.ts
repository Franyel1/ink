// Queue policy shared by the app and failure-injection tests.
export interface PendingOperation {
  id: string;
  postId: string;
  userId: string;
  createdAt: string;
  state: "pending" | "conflict" | "error";
}
export async function drainQueue<T extends PendingOperation, R>(options: {
  userId: string; drafts: T[];
  send: (draft: T) => Promise<R>;
  remove: (id: string) => Promise<void>;
  fail: (draft: T, error: unknown) => Promise<void>;
}): Promise<R[]> {
  const blocked = new Set<string>();
  const results: R[] = [];
  for (const draft of [...options.drafts].sort((a,b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))) {
    if (draft.userId !== options.userId || blocked.has(draft.postId)) continue;
    if (draft.state !== "pending") { blocked.add(draft.postId); continue; }
    try {
      const result = await options.send(draft);
      await options.remove(draft.id);
      results.push(result);
    } catch (error) {
      blocked.add(draft.postId);
      await options.fail(draft,error);
    }
  }
  return results;
}
