"use client";

import { useEffect, useState } from "react";

/** Dev-only: shows screen vs viewport metrics to locate letterboxing. */
export default function DebugViewport() {
  const [info, setInfo] = useState("");

  useEffect(() => {
    function update() {
      const probe = document.createElement("div");
      probe.style.cssText =
        "position:fixed;bottom:0;height:env(safe-area-inset-bottom,0px)";
      document.body.appendChild(probe);
      const sab = probe.getBoundingClientRect().height;
      probe.remove();
      const standalone =
        (navigator as unknown as { standalone?: boolean }).standalone ?? "n/a";
      const nav = document.querySelector("nav");
      const navGap = nav
        ? Math.round(window.innerHeight - nav.getBoundingClientRect().bottom)
        : -1;
      const navPb = nav ? getComputedStyle(nav).paddingBottom : "?";
      const varVal = getComputedStyle(document.documentElement)
        .getPropertyValue("--safe-bottom")
        .trim();
      setInfo(
        `sh${screen.height} ih${window.innerHeight} ` +
          `vv${Math.round(window.visualViewport?.height ?? 0)} ` +
          `sab${Math.round(sab)} st:${standalone} | ` +
          `navGap${navGap} navPb${navPb} var:${varVal || "unset"}`
      );
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div className="pointer-events-none fixed left-1 top-1 z-[99] rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-lime-400">
      {info}
    </div>
  );
}
