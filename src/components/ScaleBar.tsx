"use client";

import type { CSSProperties } from "react";
import { MAX_SPREAD, MIN_SPREAD } from "@/lib/world/viewState";

interface ScaleBarProps {
  value: number;
  onChange: (spread: number) => void;
  disabled?: boolean;
}

export function ScaleBar({ value, onChange, disabled }: ScaleBarProps) {
  const pct = ((value - MIN_SPREAD) / (MAX_SPREAD - MIN_SPREAD)) * 100;

  return (
    <div
      className="scale-bar"
      role="group"
      aria-label="Forest scale"
      onWheel={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <p className="font-pixel scale-bar-label">Scale</p>
      <div className="scale-bar-row">
        <span className="font-pixel scale-bar-end" aria-hidden>
          −
        </span>
        <input
          type="range"
          className="scale-bar-input"
          min={MIN_SPREAD}
          max={MAX_SPREAD}
          step={0.05}
          value={value}
          disabled={disabled}
          aria-valuemin={MIN_SPREAD}
          aria-valuemax={MAX_SPREAD}
          aria-valuenow={Number(value.toFixed(2))}
          aria-label="Spread forest"
          style={{ "--scale-pct": `${pct}%` } as CSSProperties}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="font-pixel scale-bar-end" aria-hidden>
          +
        </span>
      </div>
      <p className="font-pixel scale-bar-hint">Wider meadow</p>
    </div>
  );
}
