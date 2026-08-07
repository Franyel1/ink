/**
 * Appended to every system prompt that produces text the user will read.
 *
 * Models reach for em dashes constantly, and Ink's own writing doesn't use them
 * anywhere. Without an explicit rule the app's voice splits in two: hand-written
 * copy in one style, generated lines in another.
 */
/**
 * Appended wherever a prompt is handed the user's beliefs.
 *
 * The field is a free multi-select filled in at onboarding, and it used to be
 * dumped into the prompt as raw JSON with no instruction attached. A model given
 * someone's religion and no guidance drifts into religious framing, which is not
 * what the field is for: it exists so the notebook can follow someone into their
 * own vocabulary, not so it can preach back at them.
 */
export const BELIEFS_RULE =
  "\n\nTheir beliefs are listed only so you recognise the vocabulary and frame " +
  "that are already theirs. Follow them there, never lead them there. If they " +
  "write in those terms, meet them in those terms. If they don't, their beliefs " +
  "stay completely invisible. Never introduce a religious, spiritual, or " +
  "philosophical frame they didn't bring to that post themselves, never quote or " +
  "paraphrase scripture, and never speak as any kind of spiritual authority " +
  "('trust the timing', 'everything happens for a reason', 'the universe is " +
  "telling you'). The list can hold things that contradict each other; treat it " +
  "as what's in play for them, not a doctrine you have to make consistent.";

export const NO_EM_DASHES =
  "\n\nNever use em dashes or en dashes (— or –) anywhere in your output. " +
  "Use a comma, a colon, a full stop, or parentheses instead.";

/**
 * The same principle as BELIEFS_RULE, widened from religion to everything else
 * someone can want.
 *
 * BELIEFS_RULE stopped the notebook preaching, but nothing stopped it
 * disagreeing. Asked what he was becoming, he answered "Rich", and got back
 * "How do you define success beyond financial wealth?" and then "What does
 * becoming richer truly mean to you beyond financial comfort?" Both carry the
 * same implication: that the real answer is somewhere deeper. He said no
 * twice. A notebook that keeps asking is not curious, it's arguing.
 */
export const VALUES_RULE =
  "\n\nWhat they want is theirs to decide, not yours to improve. Money, " +
  "status, comfort, ambition, family, solitude: whatever they've told you " +
  "they're after, take it at face value and stay curious about it, rather " +
  "than treating it as a surface with something worthier underneath. Never " +
  "ask what something 'really' or 'truly' means to them, never ask them to " +
  "look 'beyond' or 'deeper than' an answer they already gave, and never " +
  "imply a stated goal is shallow, a coping mechanism, or a stand-in for " +
  "something else. If an answer was thin, ask for the detail or the concrete " +
  "picture of it, not for a better answer. And don't reach for a frame they " +
  "haven't used themselves, boundaries, healing, self-care, inner child, " +
  "showing up for yourself: if they don't talk that way, neither do you.";

/**
 * Prohibitions buried in a long prompt get read as tone rather than as rules.
 * Two kept breaking often enough to be worth enforcing in code instead: em
 * dashes, which NO_EM_DASHES bans and which still reached a saved recap, and
 * the "sounds like" opener, which the comment prompt bans by name and which
 * opened four of fourteen comments.
 *
 * Deterministic repair rather than a retry: these are one-line strings, the
 * fix is unambiguous, and a second model call costs latency on a path the user
 * is waiting on.
 */
const BANNED_OPENERS: RegExp[] = [
  /^(?:it\s+)?sounds?\s+like\s+/i,
  /^(?:it\s+)?seems?\s+(?:like\s+)?/i,
  /^(?:it\s+)?looks?\s+like\s+/i,
  /^(?:it\s+)?feels?\s+like\s+/i,
  /^i\s+noticed\s+(?:that\s+)?/i,
  /^i\s+can\s+tell\s+(?:that\s+)?/i,
];

export function sanitizeVoice(text: string): string {
  let out = text.trim();

  // Any dash the model reached for becomes the comma it should have been.
  out = out.replace(/\s*[—–]\s*/g, ", ");

  for (const opener of BANNED_OPENERS) {
    if (opener.test(out)) {
      out = out.replace(opener, "");
      // Stripping the preamble leaves the next word lowercased mid-sentence.
      out = out.charAt(0).toUpperCase() + out.slice(1);
      break;
    }
  }

  // Repairs can bump punctuation together (", ," or " ,.").
  out = out
    .replace(/,\s*,/g, ",")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();

  return out;
}
