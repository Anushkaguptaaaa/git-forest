"use client";

import { useEffect, useRef, useState } from "react";
import type { WorldConfig } from "@/lib/github/types";
import { ForestApp } from "@/lib/pixi/ForestApp";
import { loadLayoutSpread } from "@/lib/world/viewState";
import { useForestStore } from "@/store/forestStore";
import { CustomizePanel } from "./CustomizePanel";
import { ScaleBar } from "./ScaleBar";

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
  const worldRef = useRef(world);
  worldRef.current = world;

  const selectTree = useForestStore((s) => s.selectTree);
  const selectRef = useRef(selectTree);
  selectRef.current = selectTree;

  const customizeOpen = useForestStore((s) => s.customizeOpen);
  const decorBrush = useForestStore((s) => s.decorBrush);
  const selectedTree = useForestStore((s) => s.selectedTree);
  const setSelectedDecor = useForestStore((s) => s.setSelectedDecor);
  const setSelectedDecorScale = useForestStore((s) => s.setSelectedDecorScale);

  const [spread, setSpread] = useState(() => loadLayoutSpread(world.username));
  const [scaleReady, setScaleReady] = useState(false);

  const mountIdRef = useRef(0);

  // Remount only when the forest identity changes — not on season toggles
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const mountId = ++mountIdRef.current;
    let cancelled = false;
    setScaleReady(false);
    setSpread(loadLayoutSpread(worldRef.current.username));
    const app = new ForestApp(worldRef.current, (tree) => selectRef.current(tree));
    app.setDecorSelectHandler((info) => {
      setSelectedDecor(info);
      if (info) setSelectedDecorScale(info.scale);
    });
    app.setSpreadChangeHandler((next) => {
      if (mountIdRef.current !== mountId) return;
      setSpread(next);
    });
    appRef.current = app;

    void (async () => {
      try {
        await waitForHostSize(host);
        if (cancelled || mountIdRef.current !== mountId) return;
        await app.init(host);
        if (cancelled || mountIdRef.current !== mountId) return;
        setSpread(app.getLayoutSpread());
        setScaleReady(true);
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
  }, [world.username, world.seed, setSelectedDecor, setSelectedDecorScale]);

  useEffect(() => {
    appRef.current?.setSeason(world.season, world.weather);
  }, [world.season, world.weather]);

  useEffect(() => {
    appRef.current?.setCustomizeMode(customizeOpen);
  }, [customizeOpen]);

  useEffect(() => {
    appRef.current?.setDecorBrush(decorBrush);
  }, [decorBrush]);

  useEffect(() => {
    if (selectedTree === null) {
      appRef.current?.clearTreeSelection();
    }
  }, [selectedTree]);

  return (
    <>
      <div
        ref={hostRef}
        className="absolute inset-0 overflow-hidden bg-[#1a2e1a]"
        aria-label="Explorable Git Forest"
        data-map="meadow-v3"
      />
      <ScaleBar
        value={spread}
        disabled={!scaleReady}
        onChange={(next) => {
          setSpread(next);
          appRef.current?.setLayoutSpreadFromUi(next);
        }}
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
