import type { TreeTraits } from "@/lib/github/types";

const PREFIX = "git-forest:tree-pos:";

export type TreePositionMap = Map<number, { x: number; y: number }>;

function key(username: string): string {
  return PREFIX + username.toLowerCase();
}

export function loadTreePositions(username: string): TreePositionMap {
  const map: TreePositionMap = new Map();
  if (typeof window === "undefined") return map;
  try {
    const raw = localStorage.getItem(key(username));
    if (!raw) return map;
    const parsed = JSON.parse(raw) as Array<{ id: number; x: number; y: number }>;
    if (!Array.isArray(parsed)) return map;
    for (const p of parsed) {
      if (
        typeof p?.id === "number" &&
        typeof p.x === "number" &&
        typeof p.y === "number" &&
        Number.isFinite(p.x) &&
        Number.isFinite(p.y)
      ) {
        map.set(p.id, { x: p.x, y: p.y });
      }
    }
  } catch {
    /* ignore */
  }
  return map;
}

export function saveTreePositions(
  username: string,
  trees: Pick<TreeTraits, "id" | "x" | "y">[]
): void {
  try {
    const payload = trees.map((t) => ({ id: t.id, x: t.x, y: t.y }));
    localStorage.setItem(key(username), JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

/** Overlay saved x/y onto freshly placed trees (unknown ids keep layout positions). */
export function applySavedTreePositions(
  username: string,
  trees: TreeTraits[]
): TreeTraits[] {
  const saved = loadTreePositions(username);
  if (saved.size === 0) return trees;
  return trees
    .map((t) => {
      const p = saved.get(t.id);
      return p ? { ...t, x: p.x, y: p.y } : t;
    })
    .sort((a, b) => a.y - b.y);
}
