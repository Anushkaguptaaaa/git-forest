"use client";

import { DECOR_CATALOG, getDecorItem } from "@/lib/pixi/customDecor";
import { useForestStore } from "@/store/forestStore";

interface CustomizePanelProps {
  onDelete: () => void;
  onClearAll: () => void;
}

export function CustomizePanel({ onDelete, onClearAll }: CustomizePanelProps) {
  const open = useForestStore((s) => s.customizeOpen);
  const brush = useForestStore((s) => s.decorBrush);
  const selectedId = useForestStore((s) => s.selectedDecorId);
  const selectedKind = useForestStore((s) => s.selectedDecorKind);
  const setCustomizeOpen = useForestStore((s) => s.setCustomizeOpen);
  const setDecorBrush = useForestStore((s) => s.setDecorBrush);

  if (!open) return null;

  const activeItem = selectedKind
    ? getDecorItem(selectedKind)
    : brush
      ? getDecorItem(brush)
      : null;

  return (
    <aside className="customize-panel" role="dialog" aria-label="Customize forest">
      <div className="customize-panel-head">
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
        Place · drag to move · corner handles to resize · top knob to tilt · [ ] to nudge angle · del
        to remove
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
