import { create } from "zustand";
import type { ForestData, TreeTraits, WorldConfig } from "@/lib/github/types";

interface ForestState {
  data: ForestData | null;
  world: WorldConfig | null;
  selectedTree: TreeTraits | null;
  loading: boolean;
  error: string | null;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setForest: (data: ForestData, world: WorldConfig) => void;
  selectTree: (tree: TreeTraits | null) => void;
  reset: () => void;
}

export const useForestStore = create<ForestState>((set) => ({
  data: null,
  world: null,
  selectedTree: null,
  loading: false,
  error: null,
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
  setForest: (data, world) =>
    set({ data, world, loading: false, error: null, selectedTree: null }),
  selectTree: (tree) => set({ selectedTree: tree }),
  reset: () =>
    set({ data: null, world: null, selectedTree: null, loading: false, error: null }),
}));
