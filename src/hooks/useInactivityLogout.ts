import { useEffect, useRef } from "react";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "visibilitychange"] as const;
const STORAGE_KEY_LAST_ACTIVITY = "leslie_last_activity";

/**
 * Logs the user out after `minutes` of inactivity (no mouse/keyboard/touch).
 * Set `minutes` to 0 to disable.
 */
export function useInactivityLogout(minutes: number, enabled: boolean, onTimeout: () => void) {
  const timerRef = useRef<number | null>(null);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    if (!enabled || !minutes || minutes <= 0) return;
    const timeoutMs = minutes * 60 * 1000;

    const reset = () => {
      try { localStorage.setItem(STORAGE_KEY_LAST_ACTIVITY, String(Date.now())); } catch { /* ignore */ }
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        onTimeoutRef.current();
      }, timeoutMs);
    };

    reset();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [minutes, enabled]);
}

const STORAGE_KEY_MINUTES = "leslie_inactivity_minutes";
export const DEFAULT_INACTIVITY_MINUTES = 30;

export function getInactivityMinutes(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MINUTES);
    if (raw == null) return DEFAULT_INACTIVITY_MINUTES;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return DEFAULT_INACTIVITY_MINUTES;
    return n;
  } catch {
    return DEFAULT_INACTIVITY_MINUTES;
  }
}

export function setInactivityMinutes(minutes: number) {
  try { localStorage.setItem(STORAGE_KEY_MINUTES, String(minutes)); } catch { /* ignore */ }
}