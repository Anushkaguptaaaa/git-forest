import { create } from "zustand";
import type { ForestData, TreeTraits, WorldConfig } from "@/lib/github/types";
import type { DecorKind } from "@/lib/pixi/customDecor";

interface ForestState {
  data: ForestData | null;
  world: WorldConfig | null;
  selectedTree: TreeTraits | null;
  loading: boolean;
  error: string | null;
  customizeOpen: boolean;
  decorBrush: DecorKind | null;
  selectedDecorId: string | null;
  selectedDecorKind: DecorKind | null;
  selectedDecorScale: number;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setForest: (data: ForestData, world: WorldConfig) => void;
  selectTree: (tree: TreeTraits | null) => void;
  setCustomizeOpen: (open: boolean) => void;
  setDecorBrush: (brush: DecorKind | null) => void;
  setSelectedDecor: (
    info: { id: string; kind: DecorKind; scale: number } | null
  ) => void;
  setSelectedDecorScale: (scale: number) => void;
  reset: () => void;
}

export const useForestStore = create<ForestState>((set) => ({
  data: null,
  world: null,
  selectedTree: null,
  loading: false,
  error: null,
  customizeOpen: false,
  decorBrush: null,
  selectedDecorId: null,
  selectedDecorKind: null,
  selectedDecorScale: 36,
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
  setForest: (data, world) =>
    set({
      data,
      world,
      loading: false,
      error: null,
      selectedTree: null,
      customizeOpen: false,
      decorBrush: null,
      selectedDecorId: null,
      selectedDecorKind: null,
    }),
  selectTree: (tree) => set({ selectedTree: tree }),
  setCustomizeOpen: (open) =>
    set(
      open
        ? { customizeOpen: true, selectedTree: null }
        : {
            customizeOpen: false,
            decorBrush: null,
            selectedDecorId: null,
            selectedDecorKind: null,
          }
    ),
  setDecorBrush: (brush) =>
    set({
      decorBrush: brush,
      selectedDecorId: null,
      selectedDecorKind: null,
    }),
  setSelectedDecor: (info) =>
    set(
      info
        ? {
            selectedDecorId: info.id,
            selectedDecorKind: info.kind,
            selectedDecorScale: info.scale,
            decorBrush: null,
          }
        : {
            selectedDecorId: null,
            selectedDecorKind: null,
          }
    ),
  setSelectedDecorScale: (scale) => set({ selectedDecorScale: scale }),
  reset: () =>
    set({
      data: null,
      world: null,
      selectedTree: null,
      loading: false,
      error: null,
      customizeOpen: false,
      decorBrush: null,
      selectedDecorId: null,
      selectedDecorKind: null,
    }),
}));
