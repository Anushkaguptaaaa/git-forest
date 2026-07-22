"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DECOR_CATALOG, getDecorItem } from "@/lib/pixi/customDecor";
import { useForestStore } from "@/store/forestStore";

interface CustomizePanelProps {
  onDelete: () => void;
  onClearAll: () => void;
}

const DEFAULT_POS = { x: 16, y: 76 };

export function CustomizePanel({ onDelete, onClearAll }: CustomizePanelProps) {
  const open = useForestStore((s) => s.customizeOpen);
  const brush = useForestStore((s) => s.decorBrush);
  const selectedId = useForestStore((s) => s.selectedDecorId);
  const selectedKind = useForestStore((s) => s.selectedDecorKind);
  const setCustomizeOpen = useForestStore((s) => s.setCustomizeOpen);
  const setDecorBrush = useForestStore((s) => s.setDecorBrush);

  const [pos, setPos] = useState(DEFAULT_POS);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  // Reset to top-left whenever customize opens
  useEffect(() => {
    if (open) setPos(DEFAULT_POS);
  }, [open]);

  const clampToViewport = useCallback((x: number, y: number) => {
    const el = panelRef.current;
    const w = el?.offsetWidth ?? 320;
    const h = el?.offsetHeight ?? 200;
    const maxX = Math.max(8, window.innerWidth - w - 8);
    const maxY = Math.max(8, window.innerHeight - h - 8);
    return {
      x: Math.min(maxX, Math.max(8, x)),
      y: Math.min(maxY, Math.max(8, y)),
    };
  }, []);

  const onDragPointerDown = (e: React.PointerEvent) => {
    // Only left button / primary touch; ignore interactive controls in the head
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;

    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };
  };

  const onDragPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const next = clampToViewport(
      drag.origX + (e.clientX - drag.startX),
      drag.origY + (e.clientY - drag.startY)
    );
    setPos(next);
  };

  const onDragPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    }
  };

  if (!open) return null;

  const activeItem = selectedKind
    ? getDecorItem(selectedKind)
    : brush
      ? getDecorItem(brush)
      : null;

  return (
    <aside
      ref={panelRef}
      className="customize-panel"
      role="dialog"
      aria-label="Customize forest"
      style={{ left: pos.x, top: pos.y }}
    >
      <div
        className="customize-panel-head customize-panel-drag"
        onPointerDown={onDragPointerDown}
        onPointerMove={onDragPointerMove}
        onPointerUp={onDragPointerUp}
        onPointerCancel={onDragPointerUp}
      >
        <p className="font-display customize-title">Customize</p>
        <button
          type="button"
          className="pixel-btn customize-done"
          onClick={() => setCustomizeOpen(false)}
        >
          Done
        </button>
      </div>

      <p className="font-pixel customize-help">
        Drag the title bar to move this panel · drag trees to rearrange · place props · corners
        resize · top knob tilts
      </p>

      <div className="customize-grid">
        {DECOR_CATALOG.map((item) => {
          const active = brush === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`customize-swatch${active ? " is-active" : ""}`}
              onClick={() => setDecorBrush(active ? null : item.id)}
              title={item.label}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt="" className="customize-swatch-img" />
              <span className="font-pixel customize-swatch-label">{item.label}</span>
            </button>
          );
        })}
      </div>

      {selectedId && activeItem && (
        <div className="customize-selected">
          <p className="font-pixel customize-selected-label">Selected · {activeItem.label}</p>
          <div className="customize-actions">
            <button type="button" className="pixel-btn" onClick={onDelete}>
              Delete
            </button>
          </div>
        </div>
      )}

      <button type="button" className="pixel-btn customize-clear" onClick={onClearAll}>
        Clear all props
      </button>
    </aside>
  );
}
