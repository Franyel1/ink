"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * Read a browser-only boolean (feature detection, a localStorage flag) without
 * the setState-in-effect dance: renders `false` on the server and during
 * hydration, then the real value on the first client render after.
 *
 * `read` runs during render, so keep it cheap and side-effect free. Changes to
 * the underlying value aren't subscribed to — if something in the app mutates
 * it, track that with ordinary state alongside this.
 */
export function useClientFlag(read: () => boolean): boolean {
  return useSyncExternalStore(noopSubscribe, read, () => false);
}
