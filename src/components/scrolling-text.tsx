"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

/** Pixels-per-second the text glides at, so long and short names feel consistent. */
const SPEED_PX_PER_S = 55;

/**
 * Single-line text that clips with no ellipsis, and on hover scrolls left to
 * reveal the rest — but only when it actually overflows. Honours
 * prefers-reduced-motion and always exposes the full string via `title`.
 *
 * `className` styles the clipping container (layout); `textClassName` styles the
 * moving text (colour / weight).
 */
export function ScrollingText({
  text,
  className,
  textClassName,
}: {
  text: string;
  className?: string;
  textClassName?: string;
}) {
  const inner = useRef<HTMLSpanElement>(null);

  function start() {
    const el = inner.current;
    const box = el?.parentElement;
    if (!el || !box) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const overflow = el.scrollWidth - box.clientWidth;
    if (overflow <= 1) return; // fits; nothing to reveal
    const duration = Math.min(Math.max(overflow / SPEED_PX_PER_S, 0.5), 8);
    el.style.transition = `transform ${duration}s linear`;
    el.style.transform = `translateX(-${overflow}px)`;
  }

  function reset() {
    const el = inner.current;
    if (!el) return;
    el.style.transition = "transform 0.3s ease";
    el.style.transform = "translateX(0)";
  }

  return (
    <span
      className={cn("block overflow-hidden whitespace-nowrap", className)}
      onMouseEnter={start}
      onMouseLeave={reset}
      title={text}
    >
      <span ref={inner} className={cn("inline-block will-change-transform", textClassName)}>
        {text}
      </span>
    </span>
  );
}
