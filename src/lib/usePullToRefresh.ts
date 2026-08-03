"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

const THRESHOLD = 80;
const MAX_PULL = 150;

/**
 * Pull-to-refresh for a scrollable container. Native pull-to-refresh doesn't
 * fire here because `.scroll-area` sets `overscroll-behavior: contain`
 * (needed to stop the whole page rubber-banding), so this reimplements it
 * by hand: track touches only while scrolled to the top, apply increasing
 * resistance the further you pull (like the native gesture), and fire
 * `onRefresh` past the threshold.
 */
export function usePullToRefresh<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onRefresh: () => Promise<void> | void
) {
  const [pull, setPull] = useState(0);
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const active = useRef(false);
  const pullValue = useRef(0);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      if (el!.scrollTop <= 0 && !refreshingRef.current) {
        startY.current = e.touches[0].clientY;
        active.current = true;
      } else {
        startY.current = null;
        active.current = false;
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (!active.current || startY.current === null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0 || el!.scrollTop > 0) {
        active.current = false;
        pullValue.current = 0;
        setPulling(false);
        setPull(0);
        return;
      }
      e.preventDefault();
      // Rubber-band resistance: approaches MAX_PULL but never exceeds it.
      const damped = MAX_PULL * (1 - Math.exp(-delta / MAX_PULL));
      pullValue.current = damped;
      setPulling(true);
      setPull(damped);
    }

    async function onTouchEnd() {
      if (!active.current) return;
      active.current = false;
      startY.current = null;
      setPulling(false);
      if (pullValue.current >= THRESHOLD) {
        refreshingRef.current = true;
        setRefreshing(true);
        setPull(THRESHOLD);
        try {
          await onRefreshRef.current();
        } finally {
          refreshingRef.current = false;
          setRefreshing(false);
          pullValue.current = 0;
          setPull(0);
        }
      } else {
        pullValue.current = 0;
        setPull(0);
      }
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [ref]);

  return { pull, pulling, refreshing, threshold: THRESHOLD };
}
