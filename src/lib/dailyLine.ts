export async function fetchDailyLine(): Promise<string | null> {
  try {
    const res = await fetch("/api/daily-line/generate", { method: "POST" });
    if (!res.ok) return null;
    const body = await res.json().catch(() => ({}));
    return (body?.line as string | null) ?? null;
  } catch {
    return null;
  }
}
