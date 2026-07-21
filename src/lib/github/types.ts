export type TreeSpecies =
  | "oak"
  | "pine"
  | "birch"
  | "willow"
  | "maple"
  | "cherry"
  | "cedar"
  | "dead"
  | "sapling";

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  language: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  isArchived: boolean;
  isFork: boolean;
  pushedAt: string | null;
  createdAt: string;
  size: number;
}

export interface GitHubProfile {
  login: string;
  name: string | null;
  avatarUrl: string;
  bio: string | null;
  publicRepos: number;
  followers: number;
  following: number;
  htmlUrl: string;
}

export interface ForestData {
  profile: GitHubProfile;
  repos: GitHubRepo[];
  fetchedAt: string;
}

export interface TreeTraits {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  language: string | null;
  species: TreeSpecies;
  height: number;
  flowers: number;
  saplings: number;
  nests: number;
  fireflies: number;
  isDead: boolean;
  stars: number;
  forks: number;
  openIssues: number;
  x: number;
  y: number;
}

export type Season = "spring" | "summer" | "autumn" | "winter";
export type Weather = "clear" | "cloudy" | "rain" | "snow" | "fog";

export interface WorldConfig {
  seed: number;
  username: string;
  season: Season;
  weather: Weather;
  worldWidth: number;
  worldHeight: number;
  trees: TreeTraits[];
}
