"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchGoals, addGoal, toggleGoalDone, deleteGoal, type Goal } from "@/lib/goals";
import { fetchWants, addWant, toggleWantDone, deleteWant, type Want } from "@/lib/wants";
import {
  fetchLetGos,
  addLetGo,
  toggleReleased,
  deleteLetGo,
  type LetGo,
} from "@/lib/letgos";

interface Item {
  id: string;
  label: string;
  done: boolean;
}

function ItemRow({
  item,
  accentClass,
  onToggle,
  onDelete,
}: {
  item: Item;
  accentClass: string;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group flex items-start gap-2.5 border-b border-border/30 py-2.5 last:border-b-0">
      <button
        type="button"
        aria-label={item.done ? "Mark not done" : "Mark done"}
        onClick={onToggle}
        className={`pressable mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] ${
          item.done ? `${accentClass} text-ink` : "border-border text-transparent"
        }`}
      >
        ✓
      </button>
      <p
        data-selectable
        className={`min-w-0 flex-1 text-sm leading-snug ${
          item.done ? "text-faint line-through" : "text-foreground/85"
        }`}
      >
        {item.label}
      </p>
      <button
        type="button"
        aria-label="Remove"
        onClick={onDelete}
        className="pressable shrink-0 text-faint opacity-0 group-hover:opacity-100"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
          <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}

function Column({
  title,
  hint,
  placeholder,
  accentClass,
  items,
  onAdd,
  onToggle,
  onDelete,
}: {
  title: string;
  hint: string;
  placeholder: string;
  accentClass: string;
  items: Item[];
  onAdd: (text: string) => void;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");

  function submit() {
    const t = draft.trim();
    if (!t) return;
    onAdd(t);
    setDraft("");
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-surface p-4">
      <p className="text-xs uppercase tracking-[0.15em] text-faint">{title}</p>
      <p className="mt-0.5 text-[11px] text-faint">{hint}</p>

      <div className="write-line mt-3 flex items-center gap-2 pb-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={placeholder}
          className="ink-input w-full text-sm"
        />
        {draft.trim() && (
          <button type="button" onClick={submit} className="shrink-0 text-xs text-muted">
            Add
          </button>
        )}
      </div>

      <div className="mt-1">
        {items.length === 0 && (
          <p className="py-2 text-xs text-faint">Nothing here yet.</p>
        )}
        {items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            accentClass={accentClass}
            onToggle={() => onToggle(item.id, !item.done)}
            onDelete={() => onDelete(item.id)}
          />
        ))}
      </div>
    </div>
  );
}

export default function GoalsWantsLetGo() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [wants, setWants] = useState<Want[]>([]);
  const [letGos, setLetGos] = useState<LetGo[]>([]);

  useEffect(() => {
    fetchGoals().then(setGoals).catch(() => {});
    fetchWants().then(setWants).catch(() => {});
    fetchLetGos().then(setLetGos).catch(() => {});
  }, []);

  return (
    <div className="scroll-area flex-1 pb-10">
      <header className="flex items-center gap-3 px-6 pb-2 pt-[calc(var(--safe-top)+2rem)]">
        <Link href="/reflect" aria-label="Back to reflect" className="pressable p-1 text-muted">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="font-script text-4xl">Yours</h1>
      </header>
      <p className="px-6 text-sm text-faint">
        Building, wanting, letting go. Three lists, all in your own words.
      </p>

      <div className="mt-5 space-y-4 px-6 pb-16">
        <Column
          title="Goals"
          hint="Write it plainly. The notebook only tightens your wording, never adds to it."
          placeholder="A goal, in your own words…"
          accentClass="border-foreground bg-foreground"
          items={goals.map((g) => ({ id: g.id, label: g.refined_text || g.raw_text, done: g.done }))}
          onAdd={(text) => addGoal(text).then((g) => setGoals((all) => [g, ...all]))}
          onToggle={(id, done) => {
            setGoals((all) => all.map((g) => (g.id === id ? { ...g, done } : g)));
            toggleGoalDone(id, done).catch(() => {});
          }}
          onDelete={(id) => {
            setGoals((all) => all.filter((g) => g.id !== id));
            deleteGoal(id).catch(() => {});
          }}
        />
        <Column
          title="Wants"
          hint="Activities, small gifts to yourself. No AI involved, just yours."
          placeholder="Something you want to do or have…"
          accentClass="border-foreground bg-foreground"
          items={wants.map((w) => ({ id: w.id, label: w.text, done: w.done }))}
          onAdd={(text) => addWant(text).then((w) => setWants((all) => [w, ...all]))}
          onToggle={(id, done) => {
            setWants((all) => all.map((w) => (w.id === id ? { ...w, done } : w)));
            toggleWantDone(id, done).catch(() => {});
          }}
          onDelete={(id) => {
            setWants((all) => all.filter((w) => w.id !== id));
            deleteWant(id).catch(() => {});
          }}
        />
        <Column
          title="Let go"
          hint="A grudge, a habit, an expectation. Things you're ready to set down."
          placeholder="Something you're trying to let go of…"
          accentClass="border-foreground bg-foreground"
          items={letGos.map((l) => ({ id: l.id, label: l.text, done: l.released }))}
          onAdd={(text) => addLetGo(text).then((l) => setLetGos((all) => [l, ...all]))}
          onToggle={(id, done) => {
            setLetGos((all) => all.map((l) => (l.id === id ? { ...l, released: done } : l)));
            toggleReleased(id, done).catch(() => {});
          }}
          onDelete={(id) => {
            setLetGos((all) => all.filter((l) => l.id !== id));
            deleteLetGo(id).catch(() => {});
          }}
        />
      </div>
    </div>
  );
}
