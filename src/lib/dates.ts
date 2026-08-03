/** Find the closest-in-years past post that shares today's month and day. */
export function findOnThisDay<T extends { created_at: string }>(
  posts: T[]
): T | null {
  const now = new Date();
  const todayMonth = now.getMonth();
  const todayDate = now.getDate();

  let best: T | null = null;
  let bestYearsAgo = Infinity;
  for (const post of posts) {
    const d = new Date(post.created_at);
    if (d.getMonth() !== todayMonth || d.getDate() !== todayDate) continue;
    const yearsAgo = now.getFullYear() - d.getFullYear();
    if (yearsAgo <= 0) continue;
    if (yearsAgo < bestYearsAgo) {
      best = post;
      bestYearsAgo = yearsAgo;
    }
  }
  return best;
}

export function formatPostTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60000);

  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;

  const sameYear = date.getFullYear() === now.getFullYear();
  const dateStr = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const timeStr = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${dateStr} · ${timeStr}`;
}
