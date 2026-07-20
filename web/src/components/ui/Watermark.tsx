/**
 * Oversized outlined Hangul watermark anchoring a section background (spec §5 signature move).
 * 15–20% opacity, non-interactive, positioned absolute by the caller.
 */
export function Watermark({text, className = ''}: {text: string; className?: string}) {
  return (
    <span
      aria-hidden
      className={`hanja-watermark absolute select-none text-[22vw] leading-none ${className}`}
    >
      {text}
    </span>
  );
}
