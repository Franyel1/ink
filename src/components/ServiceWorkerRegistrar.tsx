"use client";

import { useEffect } from "react";

/**
 * Registers the service worker. Production only — in development the dev server
 * rebuilds chunks under the same URLs, so a cache-first worker would happily
 * serve you yesterday's JavaScript. To exercise offline behaviour locally, run
 * `npm run build && npm start`.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // No offline support this session; the app still works online.
      });
  }, []);

  return null;
}
