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
  {
    href: "/people",
    label: "People",
    desktopOnly: true,
    icon: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path strokeLinecap="round" d="M3.5 20a5.5 5.5 0 0111 0M15 6.5a3 3 0 010 5.8M17 15a5 5 0 013.5 5" />
      </>
    ),
  },
  {
    href: "/memory",
    label: "Gathered",
    desktopOnly: true,
    icon: (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 4.5h11a3 3 0 013 3V20H8a3 3 0 01-3-3V4.5z" />
        <path strokeLinecap="round" d="M8 8h7M8 12h7M8 16h4" />
      </>
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
    <nav className="order-last z-40 mb-[-5px] shrink-0 border-t border-border bg-background pb-[var(--safe-bottom)] md:order-first md:mb-0 md:flex md:h-full md:w-60 md:flex-col md:border-r md:border-t-0 md:p-5">
      <Link
        href="/feed"
        className="mb-10 hidden items-baseline gap-2 px-3 md:flex"
        aria-label="Ink home"
      >
        <span className="font-script text-5xl leading-none">Ink.</span>
        <span className="text-[10px] uppercase tracking-[0.22em] text-faint">private</span>
      </Link>
      <div className="mx-auto flex max-w-lg items-stretch justify-around md:mx-0 md:max-w-none md:flex-1 md:flex-col md:justify-start md:gap-1">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`pressable group flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-0.5 transition-colors md:flex-none md:flex-row md:gap-3 md:rounded-2xl md:px-3 md:py-3 ${
                tab.desktopOnly ? "hidden md:flex" : ""
              } ${
                active ? "text-foreground" : "text-faint"
              }`}
            >
              <span className="relative">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={active ? 2 : 1.5}
                  className="h-[22px] w-[22px] md:h-5 md:w-5"
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
              <span className="text-[9px] font-medium tracking-wide md:text-sm md:tracking-normal">
                {tab.label}
              </span>
              {active && (
                <span className="ml-auto hidden h-1.5 w-1.5 rounded-full bg-foreground md:block" />
              )}
            </Link>
          );
        })}
      </div>
      <p className="hidden px-3 text-xs leading-relaxed text-faint md:block">
        Your life, kept quietly in ink.
      </p>
    </nav>
  );
}
