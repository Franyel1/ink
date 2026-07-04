"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import type { Post, Profile } from "@/lib/types";
import { ACCENT_COLORS } from "@/lib/types";
import { POST_SELECT, setPinned } from "@/lib/posts";
import { formatPostTime } from "@/lib/dates";

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

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pinnedPosts, setPinnedPosts] = useState<Post[]>([]);
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editReason, setEditReason] = useState("");
  const [wasMistake, setWasMistake] = useState(false);
  const [section, setSection] = useState<"about" | "saved">("about");
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth
      .getUser()
      .then(async ({ data: { user } }) => {
        if (!user) return;
        const [{ data: prof }, { data: pinned }] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
          supabase
            .from("posts")
            .select(POST_SELECT)
            .eq("is_pinned", true)
            .order("created_at", { ascending: false }),
        ]);
        if (prof) setProfile(prof as Profile);
        setPinnedPosts((pinned ?? []) as Post[]);
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

  async function setColor(color: string) {
    if (!profile) return;
    setProfile({ ...profile, profile_color: color });
    const supabase = createClient();
    await supabase
      .from("profiles")
      .update({ profile_color: color, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
    router.refresh();
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

  const initial = (profile.display_name || "I").trim().charAt(0).toUpperCase();
  const accent = profile.profile_color || "#F5F5F5";

  return (
    <div className="scroll-area flex-1 pb-10">
      {/* Header */}
      <div className="flex flex-col items-center px-6 pt-[calc(var(--safe-top)+2.5rem)]">
        <label className="pressable relative h-24 w-24 cursor-pointer overflow-hidden rounded-full border border-border">
          {profile.profile_picture_url ? (
            <Image
              src={profile.profile_picture_url}
              alt="Profile picture"
              fill
              sizes="96px"
              className="object-cover"
            />
          ) : (
            <span
              className="flex h-full w-full items-center justify-center font-script text-5xl"
              style={{ color: accent }}
            >
              {initial}
            </span>
          )}
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => uploadAvatar(e.target.files?.[0])}
          />
        </label>
        <h1 className="mt-4 font-script text-4xl" style={{ color: accent }}>
          {profile.display_name || "Unnamed"}
        </h1>

        {/* Accent color */}
        <div className="mt-5 flex gap-2.5">
          {ACCENT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Accent ${c}`}
              onClick={() => setColor(c)}
              className={`h-6 w-6 rounded-full border transition-transform ${
                accent === c ? "scale-110 border-foreground" : "border-border"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {/* Section switch */}
      <div className="mt-8 flex justify-center gap-8 border-b border-border/60 text-sm">
        {(["about", "saved"] as const).map((s) => (
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
            {s === "about" ? "About you" : `Saved (${pinnedPosts.length})`}
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
                        className="text-sm font-medium disabled:opacity-40"
                        style={{ color: accent }}
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

          <button
            type="button"
            onClick={signOut}
            className="pressable mt-10 w-full rounded-full border border-border py-3 text-sm text-muted"
          >
            Sign out
          </button>
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
