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

export interface Post {
  id: string;
  user_id: string;
  content: string;
  post_type: PostType;
  is_pinned: boolean;
  is_favorited: boolean;
  created_at: string;
  updated_at: string;
  post_images: PostImage[];
  post_tags: { tag_id: string; tags: Tag }[];
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
