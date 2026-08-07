/**
 * Shared settings for the post embedding pipeline.
 *
 * The dimension here has to match the `vector(1536)` column and the
 * `match_posts` signature in the schema. Changing the model means changing
 * all three and re-embedding every post, since vectors from different models
 * are not comparable.
 */
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

/** Roughly 8k tokens; posts are short, but a pasted wall of text isn't. */
export const MAX_EMBED_CHARS = 24_000;

export interface PostMatch {
  id: string;
  similarity: number;
}
