import { cn } from "@/lib/utils";
import leslieAvatar from "@/assets/leslie-avatar.png";

interface LeslieAvatarProps {
  className?: string;
  alt?: string;
  /** Visual shape — defaults to rounded square (rounded-lg). Use "circle" for round. */
  shape?: "rounded" | "circle" | "xl";
  /** Disable animations entirely. */
  static?: boolean;
}

/**
 * Animated Leslie avatar with subtle micro-animations:
 * - Gentle "breathing" scale loop
 * - Periodic blink overlay (eyelid sweep)
 * - Slight smile/tilt on hover
 * All pure CSS / Tailwind. Respects `prefers-reduced-motion`.
 */
export default function LeslieAvatar({
  className,
  alt = "Leslie AI",
  shape = "rounded",
  static: isStatic = false,
}: LeslieAvatarProps) {
  const radius =
    shape === "circle" ? "rounded-full" : shape === "xl" ? "rounded-xl" : "rounded-lg";

  return (
    <span
      className={cn(
        "leslie-avatar relative inline-block align-middle",
        radius,
        !isStatic && "leslie-avatar--alive",
        className,
      )}
      aria-label={alt}
      role="img"
    >
      {/* Soft glow that pulses subtly — sits behind, outside the clip */}
      {!isStatic && <span aria-hidden className="leslie-avatar__glow" />}
      {/* Inner clip wrapper — clips image + blink, but not the glow */}
      <span className={cn("leslie-avatar__clip relative block h-full w-full overflow-hidden", radius)}>
        <img
          src={leslieAvatar}
          alt={alt}
          draggable={false}
          className={cn(
            "leslie-avatar__img block h-full w-full object-cover object-top select-none",
            radius,
          )}
        />
        {/* Blink overlay — a thin bar that sweeps down across the eye area */}
        {!isStatic && <span aria-hidden className="leslie-avatar__blink" />}
      </span>
    </span>
  );
}