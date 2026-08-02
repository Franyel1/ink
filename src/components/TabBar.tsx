"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
        d="M12 3c-4.97 0-9 3.58-9 8 0 2.49 1.28 4.71 3.29 6.18L5 21l4.13-1.74c.9.24 1.87.37 2.87.37 4.97 0 9-3.58 9-8s-4.03-8-9-8z"
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
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={active ? 2 : 1.5}
                className="h-[22px] w-[22px]"
              >
                {tab.icon}
              </svg>
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
