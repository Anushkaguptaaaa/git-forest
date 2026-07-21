import type { Season, Weather } from "@/lib/github/types";
import type { Rng } from "./rng";

export function seasonFromSeed(rng: Rng): Season {
  return rng.pick(["spring", "summer", "autumn", "winter"] as const);
}

export function weatherFromSeed(rng: Rng, season: Season): Weather {
  const roll = rng.next();
  if (season === "winter") {
    if (roll < 0.35) return "snow";
    if (roll < 0.55) return "fog";
    if (roll < 0.75) return "cloudy";
    return "clear";
  }
  if (season === "autumn") {
    if (roll < 0.25) return "rain";
    if (roll < 0.45) return "fog";
    if (roll < 0.7) return "cloudy";
    return "clear";
  }
  if (season === "spring") {
    if (roll < 0.3) return "rain";
    if (roll < 0.5) return "cloudy";
    return "clear";
  }
  // summer
  if (roll < 0.15) return "rain";
  if (roll < 0.35) return "cloudy";
  return "clear";
}

export const SEASON_PALETTE: Record<
  Season,
  { grass: number; grassDark: number; skyTop: number; skyBottom: number; accent: number }
> = {
  spring: {
    grass: 0x6bbf59,
    grassDark: 0x4a9a3f,
    skyTop: 0x87c8ef,
    skyBottom: 0xd4eef8,
    accent: 0xffb7c5,
  },
  summer: {
    grass: 0x5aad3a,
    grassDark: 0x3d7e28,
    skyTop: 0x4a9fe0,
    skyBottom: 0xb8dff5,
    accent: 0xffd166,
  },
  autumn: {
    grass: 0x8a9a3e,
    grassDark: 0x6b7530,
    skyTop: 0xd4895a,
    skyBottom: 0xf0c9a0,
    accent: 0xe07a3d,
  },
  winter: {
    grass: 0xc8d4c0,
    grassDark: 0xa8b8a0,
    skyTop: 0x8aa4b8,
    skyBottom: 0xdce6ec,
    accent: 0xb8d4e8,
  },
};
