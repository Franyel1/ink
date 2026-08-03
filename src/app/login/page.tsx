"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !email || !password) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const supabase = createClient();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }
      router.replace("/");
      router.refresh();
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }
      if (!data.session) {
        setNotice("Check your email to confirm your account, then sign in.");
        setMode("signin");
        setBusy(false);
        return;
      }
      router.replace("/");
      router.refresh();
    }
  }

  return (
    <div className="flex h-full flex-col justify-center px-8 pb-[calc(var(--safe-bottom)+2rem)] pt-[var(--safe-top)]">
      <div className="rise-in mx-auto w-full max-w-sm">
        <h1 className="font-script text-7xl leading-none">Ink.</h1>
        <p className="mt-3 text-sm text-muted">
          A feed of your own life, and a notebook that reads it back.
        </p>

        <form onSubmit={submit} className="mt-14 flex flex-col gap-8">
          <label className="write-line block pb-2">
            <span className="block text-xs uppercase tracking-widest text-faint">
              Email
            </span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="ink-input mt-1 w-full"
              placeholder="you@somewhere.com"
            />
          </label>

          <label className="write-line block pb-2">
            <span className="block text-xs uppercase tracking-widest text-faint">
              Password
            </span>
            <input
              type="password"
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="ink-input mt-1 w-full"
              placeholder="••••••••"
            />
          </label>

          {error && <p className="text-sm text-red-300/80">{error}</p>}
          {notice && <p className="text-sm text-muted">{notice}</p>}

          <button
            type="submit"
            disabled={busy}
            className="pressable mt-2 rounded-full bg-foreground py-3.5 font-medium text-ink disabled:opacity-50"
          >
            {busy
              ? "One moment…"
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
          }}
          className="mt-8 w-full text-center text-sm text-muted"
        >
          {mode === "signin"
            ? "New here? Create an account"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
