"use client";

import Image from "next/image";

interface Props {
  name: string | null;
  url: string | null;
  /** Pixel size of the circle */
  size?: number;
  className?: string;
}

export default function Avatar({ name, url, size = 36, className = "" }: Props) {
  const initial = (name || "I").trim().charAt(0).toUpperCase();

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full border border-border bg-surface ${className}`}
      style={{ width: size, height: size }}
    >
      {url ? (
        <Image
          src={url}
          alt=""
          fill
          sizes={`${size}px`}
          className="object-cover"
        />
      ) : (
        <span
          className="font-script absolute inset-0 grid place-items-center leading-none"
          style={{
            fontSize: size * 0.52,
            // Caveat is italic-leaning; nudge left and down to center optically
            transform: `translate(${-size * 0.045}px, ${size * 0.01}px)`,
          }}
        >
          {initial}
        </span>
      )}
    </div>
  );
}
