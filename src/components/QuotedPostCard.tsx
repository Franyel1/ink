"use client";

import Image from "next/image";
import type { QuotedPost } from "@/lib/types";
import { formatPostTime } from "@/lib/dates";

/**
 * An older post shown inside the one quoting it: a smaller, rounded, bordered
 * block, visibly nested rather than a second post in the stream.
 *
 * Rendered as a plain div here. The caller decides whether it's tappable,
 * because a Link inside the Composer preview would navigate away mid-draft.
 */
export default function QuotedPostCard({
  post,
  compact = false,
}: {
  post: QuotedPost;
  compact?: boolean;
}) {
  const image = post.post_images?.[0];
  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-surface/60">
      {image && (
        <div className={`relative w-full ${compact ? "aspect-[16/9]" : "aspect-[2/1]"}`}>
          <Image
            src={image.image_url}
            alt=""
            fill
            sizes="(max-width: 640px) 90vw, 460px"
            className="object-cover"
          />
        </div>
      )}
      <div className="px-3 py-2.5">
        <p className="flex items-center gap-1.5 text-[11px] text-faint">
          <span>{formatPostTime(post.created_at)}</span>
          {post.post_type !== "thought" && (
            <span className="font-script text-sm capitalize">{post.post_type}</span>
          )}
        </p>
        {post.content?.trim() ? (
          <p
            className={`mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/75 ${
              compact ? "line-clamp-3" : "line-clamp-6"
            }`}
          >
            {post.content}
          </p>
        ) : (
          <p className="mt-0.5 text-[13px] text-faint">A photo</p>
        )}
      </div>
    </div>
  );
}

/** Shown in place of a quote whose post has since been deleted. */
export function MissingQuoteCard() {
  return (
    <div className="rounded-xl border border-dashed border-border/80 px-3 py-2.5">
      <p className="text-[13px] text-faint">
        The post this quoted isn&apos;t here anymore.
      </p>
    </div>
  );
}
