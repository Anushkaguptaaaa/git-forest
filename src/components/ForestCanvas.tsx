"use client";

import { useEffect, useRef } from "react";
import type { WorldConfig } from "@/lib/github/types";
import { ForestApp } from "@/lib/pixi/ForestApp";
import { useForestStore } from "@/store/forestStore";
import { CustomizePanel } from "./CustomizePanel";

interface ForestCanvasProps {
  world: WorldConfig;
}

function waitForHostSize(el: HTMLElement): Promise<void> {
  if (el.clientWidth > 0 && el.clientHeight > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const ro = new ResizeObserver(() => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        ro.disconnect();
        resolve();
      }
    });
    ro.observe(el);
  });
}

export function ForestCanvas({ world }: ForestCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<ForestApp | null>(null);
  const selectTree = useForestStore((s) => s.selectTree);
  const selectRef = useRef(selectTree);
  selectRef.current = selectTree;

  const customizeOpen = useForestStore((s) => s.customizeOpen);
  const decorBrush = useForestStore((s) => s.decorBrush);
  const setSelectedDecor = useForestStore((s) => s.setSelectedDecor);
  const setSelectedDecorScale = useForestStore((s) => s.setSelectedDecorScale);

  const mountIdRef = useRef(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const mountId = ++mountIdRef.current;
    let cancelled = false;
    const app = new ForestApp(world, (tree) => selectRef.current(tree));
    app.setDecorSelectHandler((info) => {
      setSelectedDecor(info);
      if (info) setSelectedDecorScale(info.scale);
    });
    appRef.current = app;

    void (async () => {
      try {
        await waitForHostSize(host);
        if (cancelled || mountIdRef.current !== mountId) return;
        await app.init(host);
      } catch (err) {
        if (!cancelled && mountIdRef.current === mountId) {
          console.error("Forest init failed", err);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (appRef.current === app) appRef.current = null;
      void app.destroy();
    };
  }, [world, setSelectedDecor, setSelectedDecorScale]);

  useEffect(() => {
    appRef.current?.setCustomizeMode(customizeOpen);
  }, [customizeOpen]);

  useEffect(() => {
    appRef.current?.setDecorBrush(decorBrush);
  }, [decorBrush]);

  return (
    <>
      <div
        ref={hostRef}
        className="absolute inset-0 overflow-hidden bg-[#1a2e1a]"
        aria-label="Explorable Git Forest"
        data-map="meadow-v3"
      />
      <CustomizePanel
        onDelete={() => appRef.current?.deleteSelectedDecor()}
        onClearAll={() => {
          if (window.confirm("Remove all custom props from this forest?")) {
            appRef.current?.clearAllCustomDecor();
          }
        }}
      />
    </>
  );
}
