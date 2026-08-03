import Link from "next/link";
import ReflectFlow from "@/components/ReflectFlow";

export default function PastPage() {
  return (
    <>
      <div className="flex shrink-0 items-center gap-2 px-4 pb-1 pt-[calc(var(--safe-top)+0.6rem)]">
        <Link href="/reflect" aria-label="Back to reflect" className="pressable p-1 text-muted">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <span className="text-xs uppercase tracking-[0.2em] text-faint">Past</span>
      </div>
      <ReflectFlow />
    </>
  );
}
