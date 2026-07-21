/** Mulberry32 seeded PRNG — deterministic for a given seed */
export function createRng(seed: number) {
  let s = seed >>> 0;

  function next(): number {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,
    float(min = 0, max = 1): number {
      return min + next() * (max - min);
    },
    int(min: number, max: number): number {
      return Math.floor(min + next() * (max - min + 1));
    },
    pick<T>(arr: readonly T[]): T {
      return arr[Math.floor(next() * arr.length)]!;
    },
    chance(p: number): boolean {
      return next() < p;
    },
  };
}

export type Rng = ReturnType<typeof createRng>;
