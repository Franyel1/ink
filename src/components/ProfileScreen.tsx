"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { createClient } from "@/lib/supabase/client";
import type { Post, Profile } from "@/lib/types";
import { POST_SELECT, setPinned } from "@/lib/posts";
import { formatPostTime } from "@/lib/dates";
import { clearOfflineData, readDrafts } from "@/lib/offline";

type EditableField =
  | "display_name"
  | "personality"
  | "handling_bad"
  | "handling_good"
  | "improvement_goal";

const FIELD_LABELS: Record<EditableField, string> = {
  display_name: "Name",
  personality: "Personality",
  handling_bad: "How you handle bad situations",
  handling_good: "How you handle good situations",
  improvement_goal: "One thing you want to improve",
};

type Sentiment = "positive" | "negative" | "mixed" | "neutral";

const SENTIMENT_LABEL: Record<Sentiment, string> = {
  positive: "Warm",
  negative: "Heavy",
  mixed: "Mixed",
  neutral: "Even",
};

interface Trends {
  total: number;
  sentimentCounts: Record<Sentiment, number>;
  topTopics: { topic: string; count: number }[];
}

function computeTrends(
  rows: { ai_sentiment: string | null; ai_topics: unknown }[]
): Trends {
  const sentimentCounts: Record<Sentiment, number> = {
    positive: 0,
    negative: 0,
    mixed: 0,
    neutral: 0,
  };
  const topicCounts = new Map<string, number>();
  let total = 0;

  for (const row of rows) {
    if (row.ai_sentiment && row.ai_sentiment in sentimentCounts) {
      sentimentCounts[row.ai_sentiment as Sentiment]++;
      total++;
    }
    if (Array.isArray(row.ai_topics)) {
      for (const topic of row.ai_topics) {
        if (typeof topic === "string") {
          topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
        }
      }
    }
  }

  const topTopics = [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([topic, count]) => ({ topic, count }));

  return { total, sentimentCounts, topTopics };
}

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pinnedPosts, setPinnedPosts] = useState<Post[]>([]);
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editReason, setEditReason] = useState("");
  const [wasMistake, setWasMistake] = useState(false);
  const [section, setSection] = useState<"about" | "saved" | "trends">("about");
  const [trends, setTrends] = useState<Trends | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth
      .getUser()
      .then(async ({ data: { user } }) => {
        if (!user) return;
        const [{ data: prof }, { data: pinned }, { data: recent }] =
          await Promise.all([
            supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
            supabase
              .from("posts")
              .select(POST_SELECT)
              .eq("is_pinned", true)
              .order("created_at", { ascending: false }),
            supabase
              .from("posts")
              .select("ai_sentiment, ai_topics")
              .eq("ai_processed", true)
              .order("created_at", { ascending: false })
              .limit(60),
          ]);
        if (prof) setProfile(prof as Profile);
        setPinnedPosts((pinned ?? []) as Post[]);
        setTrends(computeTrends(recent ?? []));
      })
      .catch(() => setLoadError(true));
  }, []);

  function startEdit(field: EditableField) {
    if (!profile) return;
    setEditingField(field);
    setEditValue((profile[field] as string) ?? "");
    setEditReason("");
    setWasMistake(false);
  }

  async function saveEdit() {
    if (!profile || !editingField || busy) return;
    const oldValue = (profile[editingField] as string) ?? "";
    const newValue = editValue.trim();
    if (newValue === oldValue) {
      setEditingField(null);
      return;
    }
    setBusy(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("profiles")
      .update({
        [editingField]: newValue || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    if (!error) {
      await supabase.from("profile_changes").insert({
        user_id: profile.id,
        field_changed: editingField,
        old_value: oldValue || null,
        new_value: newValue || null,
        reason: editReason.trim() || null,
        is_mistake: wasMistake,
      });
      setProfile({ ...profile, [editingField]: newValue || null });
      setEditingField(null);
      router.refresh();
    }
    setBusy(false);
  }

  async function uploadAvatar(file: File | undefined) {
    if (!file || !profile) return;
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("post-images")
      .upload(path, file, { contentType: file.type || "image/jpeg" });
    if (error) return;
    const { data } = supabase.storage.from("post-images").getPublicUrl(path);
    await supabase
      .from("profiles")
      .update({
        profile_picture_url: data.publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);
    setProfile({ ...profile, profile_picture_url: data.publicUrl });
  }

  async function unpin(post: Post) {
    setPinnedPosts((all) => all.filter((p) => p.id !== post.id));
    try {
      await setPinned(post.id, false);
    } catch {
      setPinnedPosts((all) => [post, ...all]);
    }
  }

  async function signOut() {
    // Drafts flush under whoever is signed in, so they can't outlive the
    // session — but they're unsent writing, so don't drop them silently.
    const pending = await readDrafts();
    if (pending.length > 0) {
      const ok = window.confirm(
        `${pending.length} post${pending.length === 1 ? "" : "s"} ${
          pending.length === 1 ? "hasn't" : "haven't"
        } sent yet. Signing out deletes ${
          pending.length === 1 ? "it" : "them"
        }. Sign out anyway?`
      );
      if (!ok) return;
    }
    await clearOfflineData();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (!profile) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-10">
        <span className="font-script text-2xl text-faint">
          {loadError ? "The page won't open." : "…"}
        </span>
        {loadError && (
          <button
            type="button"
            onClick={signOut}
            className="pressable rounded-full border border-border px-6 py-2.5 text-sm text-muted"
          >
            Sign out
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="scroll-area flex-1 pb-10">
      {/* Header */}
      <div className="flex flex-col items-center px-6 pt-[calc(var(--safe-top)+2.5rem)]">
        <label className="pressable relative cursor-pointer">
          <Avatar
            name={profile.display_name}
            url={profile.profile_picture_url}
            size={96}
          />
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => uploadAvatar(e.target.files?.[0])}
          />
          <span className="absolute -bottom-0.5 -right-0.5 rounded-full border border-border bg-surface-raised p-1.5 text-muted">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 3.9a2.1 2.1 0 013 3L8 18.4l-4 1 1-4L16.5 3.9z"
              />
            </svg>
          </span>
        </label>
        <h1 className="mt-4 font-script text-4xl">
          {profile.display_name || "Unnamed"}
        </h1>
      </div>

      {/* Section switch */}
      <div className="mt-8 flex justify-center gap-8 border-b border-border/60 text-sm">
        {(["about", "trends", "saved"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSection(s)}
            className={`pb-3 capitalize transition-colors ${
              section === s
                ? "border-b border-foreground text-foreground"
                : "text-faint"
            }`}
          >
            {s === "about"
              ? "About you"
              : s === "trends"
                ? "Trends"
                : `Saved (${pinnedPosts.length})`}
          </button>
        ))}
      </div>

      {section === "about" ? (
        <div className="px-6 pt-2">
          {(Object.keys(FIELD_LABELS) as EditableField[]).map((field) => (
            <div key={field} className="border-b border-border/40 py-4">
              <p className="text-xs uppercase tracking-widest text-faint">
                {FIELD_LABELS[field]}
              </p>
              {editingField === field ? (
                <div className="fade-in mt-2">
                  <textarea
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    rows={2}
                    className="ink-input paper-lines w-full resize-none"
                  />
                  <div className="write-line mt-2 pb-1">
                    <input
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                      placeholder="Why the change? (optional)"
                      className="ink-input w-full text-sm"
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setWasMistake((v) => !v)}
                      className={`text-xs ${
                        wasMistake ? "text-foreground" : "text-faint"
                      }`}
                    >
                      {wasMistake ? "✓ " : ""}It was a mistake before
                    </button>
                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => setEditingField(null)}
                        className="text-sm text-faint"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={saveEdit}
                        className="text-sm font-medium text-foreground disabled:opacity-40"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => startEdit(field)}
                  className="mt-1 block w-full text-left"
                >
                  <span
                    data-selectable
                    className={
                      profile[field] ? "text-[15px]" : "text-sm text-faint"
                    }
                  >
                    {(profile[field] as string) || "Tap to write…"}
                  </span>
                </button>
              )}
            </div>
          ))}

          <Link
            href="/people"
            className="pressable mt-6 flex w-full items-center justify-between rounded-2xl border border-border/60 px-4 py-3.5"
          >
            <span className="text-sm">People the notebook has noticed</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-faint">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
            </svg>
          </Link>

          <button
            type="button"
            onClick={signOut}
            className="pressable mt-10 w-full rounded-full border border-border py-3 text-sm text-muted"
          >
            Sign out
          </button>
        </div>
      ) : section === "trends" ? (
        <div className="px-6 pt-4">
          {!trends || trends.total === 0 ? (
            <p className="mt-14 px-4 text-center text-sm text-faint">
              Once a few posts have been looked at, patterns will start
              showing up here.
            </p>
          ) : (
            <>
              <p className="text-xs uppercase tracking-widest text-faint">
                How recent posts read
              </p>
              <div className="mt-3 space-y-2.5">
                {(["positive", "neutral", "mixed", "negative"] as const).map(
                  (s) => {
                    const count = trends.sentimentCounts[s];
                    const pct = Math.round((count / trends.total) * 100);
                    return (
                      <div key={s}>
                        <div className="flex items-center justify-between text-xs text-faint">
                          <span>{SENTIMENT_LABEL[s]}</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-border/40">
                          <div
                            className="h-full rounded-full bg-foreground transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  }
                )}
              </div>

              {trends.topTopics.length > 0 && (
                <>
                  <p className="mt-8 text-xs uppercase tracking-widest text-faint">
                    What comes up most
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {trends.topTopics.map(({ topic, count }) => (
                      <span
                        key={topic}
                        className="rounded-full border border-border px-3 py-1 text-xs text-muted"
                      >
                        {topic} · {count}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="pt-2">
          {pinnedPosts.length === 0 ? (
            <p className="mt-14 px-10 text-center text-sm text-faint">
              Nothing saved yet. Pin a post from your feed and it will wait for
              you here.
            </p>
          ) : (
            pinnedPosts.map((post) => (
              <div key={post.id} className="border-b border-border/40 px-6 py-4">
                <div className="flex items-center justify-between text-xs text-faint">
                  <span>{formatPostTime(post.created_at)}</span>
                  <button
                    type="button"
                    onClick={() => unpin(post)}
                    className="text-faint underline"
                  >
                    Unpin
                  </button>
                </div>
                <p
                  data-selectable
                  className="mt-1.5 line-clamp-4 whitespace-pre-wrap text-[15px] leading-relaxed"
                >
                  {post.content}
                </p>
                {post.post_images.length > 0 && (
                  <p className="mt-1 text-xs text-faint">
                    + {post.post_images.length} photo
                    {post.post_images.length > 1 ? "s" : ""}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
