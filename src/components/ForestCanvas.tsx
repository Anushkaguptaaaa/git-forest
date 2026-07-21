"use client";

import { useEffect, useRef } from "react";
import type { WorldConfig } from "@/lib/github/types";
import { ForestApp } from "@/lib/pixi/ForestApp";
import { useForestStore } from "@/store/forestStore";

interface ForestCanvasProps {
  world: WorldConfig;
}

export function ForestCanvas({ world }: ForestCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<ForestApp | null>(null);
  const selectTree = useForestStore((s) => s.selectTree);
  const selectRef = useRef(selectTree);
  selectRef.current = selectTree;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    const app = new ForestApp(world, (tree) => selectRef.current(tree));
    appRef.current = app;

    void app.init(host).catch((err) => {
      if (!cancelled) console.error("Forest init failed", err);
    });

    return () => {
      cancelled = true;
      void app.destroy().then(() => {
        host.replaceChildren();
      });
      appRef.current = null;
    };
  }, [world]);

  return (
    <div
      ref={hostRef}
      className="absolute inset-0 overflow-hidden bg-[#1a2e1a]"
      aria-label="Explorable Git Forest"
    />
  );
}
