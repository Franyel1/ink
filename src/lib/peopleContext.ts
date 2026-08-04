/**
 * The people graph, as the AI routes see it.
 *
 * `posts/analyze` writes a person row for everyone who comes up in a post and
 * links it to that post through `post_people`. Everything that then writes
 * *about* the user's life (a monthly recap, a reflection question, a prompt for
 * a letter to their future self) reads it back through here, so there's one
 * shape and one wording rather than each route inventing its own.
 *
 * Pure formatting only: no Supabase import, so both the server routes and the
 * client screens can use the same drift math.
 */

export interface PersonContext {
  name: string;
  relationship: string | null;
  notes: string | null;
  mention_count: number;
  last_mentioned_at: string;
}

/** Columns every consumer of `formatPeopleLines` needs. */
export const PERSON_CONTEXT_SELECT =
  "name, relationship, notes, mention_count, last_mentioned_at";

export function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/**
 * Someone counts as drifted once they've come up enough times to be a real
 * presence and then gone quiet for a stretch. Both thresholds matter: without
 * the mention floor every one-off name in the notebook looks like a lapsed
 * friendship, and without the day floor everyone you didn't write about this
 * week does.
 */
export const DRIFT_MIN_MENTIONS = 3;
export const DRIFT_MIN_DAYS = 45;

export function hasDrifted(person: PersonContext): boolean {
  return (
    person.mention_count >= DRIFT_MIN_MENTIONS &&
    daysSince(person.last_mentioned_at) >= DRIFT_MIN_DAYS
  );
}

/** Drifted people, the longest-quiet first. */
export function driftedPeople<T extends PersonContext>(people: T[]): T[] {
  return people
    .filter(hasDrifted)
    .sort(
      (a, b) =>
        new Date(a.last_mentioned_at).getTime() -
        new Date(b.last_mentioned_at).getTime()
    );
}

/** "3 months", "6 weeks", "12 days" — how long someone has been quiet. */
export function describeGap(iso: string): string {
  const days = daysSince(iso);
  if (days < 14) return `${days} day${days === 1 ? "" : "s"}`;
  if (days < 60) {
    const weeks = Math.round(days / 7);
    return `${weeks} week${weeks === 1 ? "" : "s"}`;
  }
  const months = Math.round(days / 30);
  if (months < 18) return `${months} month${months === 1 ? "" : "s"}`;
  const years = Math.round(months / 12);
  return `${years} year${years === 1 ? "" : "s"}`;
}

export interface MonthBucket {
  /** Machine key, `YYYY-M`, unique across years so React keys stay stable. */
  key: string;
  /** Single letter under the bar. */
  initial: string;
  /** Full "March 2026", for the bar's title. */
  label: string;
  count: number;
}

/**
 * How often someone came up, bucketed into the last `months` calendar months
 * ending with the current one. Always returns a full run of buckets including
 * the empty ones, because the gaps are the point of the chart.
 */
export function mentionsByMonth(isoDates: string[], months = 12): MonthBucket[] {
  const now = new Date();
  const buckets: MonthBucket[] = [];
  const index = new Map<string, MonthBucket>();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const bucket: MonthBucket = {
      key: `${d.getFullYear()}-${d.getMonth()}`,
      initial: d.toLocaleDateString(undefined, { month: "narrow" }),
      label: d.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
      count: 0,
    };
    buckets.push(bucket);
    index.set(bucket.key, bucket);
  }

  for (const iso of isoDates) {
    const d = new Date(iso);
    const bucket = index.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (bucket) bucket.count += 1;
  }
  return buckets;
}

export interface PeopleLinesOptions {
  /**
   * Append mention counts and how long each person has been quiet. Wanted by
   * anything looking back over time (recaps, reflection questions, letters);
   * not wanted by `analyze`, which is asking the model to rewrite one person's
   * notes and shouldn't be nudged into commenting on frequency.
   */
  withRecency?: boolean;
  /** Cap the list so a long-running notebook can't crowd out the rest of the prompt. */
  limit?: number;
}

/**
 * The `- Name (relationship): notes` block handed to the model. Returns an
 * empty string when there's no one on record, so callers can fall back to
 * their own "(none yet)" wording.
 */
export function formatPeopleLines(
  people: PersonContext[],
  { withRecency = false, limit = 40 }: PeopleLinesOptions = {}
): string {
  return people
    .slice(0, limit)
    .map((p) => {
      const rel = p.relationship ? ` (${p.relationship})` : "";
      const notes = p.notes || "(nothing noted yet)";
      if (!withRecency) return `- ${p.name}${rel}: ${notes}`;
      const gap = hasDrifted(p)
        ? `, hasn't come up in ${describeGap(p.last_mentioned_at)}`
        : "";
      return `- ${p.name}${rel}: ${notes} [mentioned ${p.mention_count}x${gap}]`;
    })
    .join("\n");
}

/**
 * The instruction that travels with any people block. Without it the model
 * treats the list as a cast it has to work in, and starts naming people who
 * had nothing to do with what the user actually wrote.
 */
export const PEOPLE_RULE =
  "\n\nYou're given the people on record in their notebook, built up from what " +
  "they've written before. Use it to recognise a name and know who someone is, " +
  "not as a checklist. Only name a person when what you're writing genuinely " +
  "involves them, and never imply you know something about them that isn't in " +
  "their notes. Someone going quiet in the notebook is worth noticing gently at " +
  "most; it is not evidence that anything is wrong, and it is never something " +
  "to scold them about.";
