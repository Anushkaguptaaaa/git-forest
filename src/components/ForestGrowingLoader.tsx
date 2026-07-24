"use client";

import treeGif from "@/assets/treegif.gif";

function gifSrc(mod: string | { src: string }): string {
  return typeof mod === "string" ? mod : mod.src;
}

interface ForestGrowingLoaderProps {
  label?: string;
}

export function ForestGrowingLoader({
  label = "Growing forest…",
}: ForestGrowingLoaderProps) {
  return (
    <div className="forest-growing forest-bg" role="status" aria-live="polite">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={gifSrc(treeGif as string | { src: string })}
        alt=""
        className="forest-growing-gif"
        width={220}
        height={220}
      />
      <p className="font-pixel forest-growing-label">{label}</p>
    </div>
  );
}
