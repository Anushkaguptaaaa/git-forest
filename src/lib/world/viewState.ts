/** Persist meadow spread + camera zoom across seasons / reloads */

const SPREAD_PREFIX = "git-forest:spread:";
const ZOOM_PREFIX = "git-forest:zoom-ratio:";

export const MIN_SPREAD = 1;
export const MAX_SPREAD = 2.5;
export const SPREAD_STEP = 0.14;

function spreadKey(username: string): string {
  return SPREAD_PREFIX + username.toLowerCase();
}

function zoomKey(username: string): string {
  return ZOOM_PREFIX + username.toLowerCase();
}

export function loadLayoutSpread(username: string): number {
  if (typeof window === "undefined") return MIN_SPREAD;
  try {
    const raw = localStorage.getItem(spreadKey(username));
    if (!raw) return MIN_SPREAD;
    const n = Number(raw);
    if (!Number.isFinite(n)) return MIN_SPREAD;
    return Math.min(MAX_SPREAD, Math.max(MIN_SPREAD, n));
  } catch {
    return MIN_SPREAD;
  }
}

export function saveLayoutSpread(username: string, spread: number): void {
  try {
    localStorage.setItem(spreadKey(username), String(spread));
  } catch {
    /* ignore */
  }
}

/** Camera zoom as a multiple of contain-zoom (1 = full meadow fit). */
export function loadZoomRatio(username: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(zoomKey(username));
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0.9) return null;
    return n;
  } catch {
    return null;
  }
}

export function saveZoomRatio(username: string, ratio: number): void {
  try {
    localStorage.setItem(zoomKey(username), String(ratio));
  } catch {
    /* ignore */
  }
}
