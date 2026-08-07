export type PostType =
  | "thought"
  | "memory"
  | "idea"
  | "recipe"
  | "moment"
  | "quote"
  | "dream"
  | "update";

export const POST_TYPES: PostType[] = [
  "thought",
  "memory",
  "idea",
  "recipe",
  "moment",
  "quote",
  "dream",
  "update",
];

export const DEFAULT_TAGS = [
  "Work",
  "School",
  "Friends",
  "Family",
  "Personal",
  "Idea",
  "Health",
  "Project",
];

export interface Profile {
  id: string;
  display_name: string | null;
  profile_picture_url: string | null;
  profile_color: string | null;
  beliefs: Record<string, unknown> | null;
  personality: string | null;
  handling_good: string | null;
  handling_bad: string | null;
  improvement_goal: string | null;
  /** The running note the model keeps about you, rewritten as it learns more. */
  notebook_memory: string | null;
  /** Lines removed from `notebook_memory` by hand, never to be written back. */
  notebook_forgotten?: string[];
  onboarded: boolean;
  created_at: string;
  updated_at: string;
}

export interface PostImage {
  id: string;
  post_id: string;
  image_url: string;
  created_at: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

/**
 * The shallow copy of an older post shown inside the one quoting it. Only one
 * level deep on purpose: quoting a quote shows the post you pointed at, not
 * the whole chain behind it.
 */
export interface QuotedPost {
  id: string;
  content: string;
  post_type: PostType;
  created_at: string;
  post_images: { image_url: string }[];
}

export interface Post {
  id: string;
  user_id: string;
  content: string;
  post_type: PostType;
  is_pinned: boolean;
  created_at: string;
  /** Null once the quoted post is deleted; the quote itself survives. */
  quoted_post_id?: string | null;
  quoted_post?: QuotedPost | null;
  updated_at: string;
  post_images: PostImage[];
  post_tags: { tag_id: string; tags: Tag }[];
  /**
   * Who the AI picked up on in this post. Optional because posts cached to
   * IndexedDB before this existed come back without it, and because a post is
   * only linked to anyone once `posts/analyze` has run.
   */
  post_people?: { person_id: string; people: { id: string; name: string } | null }[];
  ai_processed: boolean | null;
  ai_comment: string | null;
  ai_summary: string | null;
  ai_sentiment: "positive" | "negative" | "mixed" | "neutral" | null;
  ai_topics: string[] | null;
}

export interface Reflection {
  id: string;
  user_id: string;
  question_key: string;
  question: string;
  answer: string;
  created_at: string;
}
