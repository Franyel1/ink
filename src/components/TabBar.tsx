"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { countReadyLetters } from "@/lib/letters";

const TABS = [
  {
    href: "/feed",
    label: "Feed",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 6h16M4 12h16M4 18h10"
      />
    ),
  },
  {
    href: "/reflect",
    label: "Reflect",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
      />
    ),
  },
  {
    href: "/profile",
    label: "Profile",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.1a8.25 8.25 0 0115 0"
      />
    ),
  },
];

export default function TabBar() {
  const pathname = usePathname();
  const [lettersReady, setLettersReady] = useState(0);

  // Re-checked on every tab change so the dot clears as soon as you've read the
  // letter, without needing to plumb state up from the Future page.
  useEffect(() => {
    let stale = false;
    countReadyLetters().then((n) => {
      if (!stale) setLettersReady(n);
    });
    return () => {
      stale = true;
    };
  }, [pathname]);

  return (
    <nav className="shrink-0 border-t border-border bg-background pb-[var(--safe-bottom)] mb-[-5px]">
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`pressable flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-0.5 transition-colors ${
                active ? "text-foreground" : "text-faint"
              }`}
            >
              <span className="relative">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={active ? 2 : 1.5}
                  className="h-[22px] w-[22px]"
                >
                  {tab.icon}
                </svg>
                {tab.href === "/reflect" && lettersReady > 0 && (
                  <span
                    aria-label={`${lettersReady} letter${
                      lettersReady === 1 ? "" : "s"
                    } ready to open`}
                    role="status"
                    className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-foreground ring-2 ring-background"
                  />
                )}
              </span>
              <span className="text-[9px] font-medium tracking-wide">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
