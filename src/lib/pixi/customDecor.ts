import { Assets, Container, Graphics, Sprite, Texture } from "pixi.js";
import dandelionUrl from "@/assets/dandelion.png";
import flowersUrl from "@/assets/flowers.png";
import grassyStoneUrl from "@/assets/grassy-stone.png";
import pinkFlowersUrl from "@/assets/pink-flowers.png";
import purpleFlowersUrl from "@/assets/purple-flowers.png";
import stoneUrl from "@/assets/stone.png";

function assetSrc(mod: string | { src: string }): string {
  return typeof mod === "string" ? mod : mod.src;
}

export type DecorKind =
  | "dandelion"
  | "flowers"
  | "grassy-stone"
  | "pink-flowers"
  | "purple-flowers"
  | "stone";

export interface DecorCatalogItem {
  id: DecorKind;
  label: string;
  defaultH: number;
  minH: number;
  maxH: number;
  url: string;
}

export const DECOR_CATALOG: DecorCatalogItem[] = [
  {
    id: "dandelion",
    label: "Dandelion",
    defaultH: 36,
    minH: 16,
    maxH: 160,
    url: assetSrc(dandelionUrl as string | { src: string }),
  },
  {
    id: "flowers",
    label: "Flowers",
    defaultH: 32,
    minH: 14,
    maxH: 150,
    url: assetSrc(flowersUrl as string | { src: string }),
  },
  {
    id: "grassy-stone",
    label: "Grassy stone",
    defaultH: 40,
    minH: 18,
    maxH: 180,
    url: assetSrc(grassyStoneUrl as string | { src: string }),
  },
  {
    id: "pink-flowers",
    label: "Pink flowers",
    defaultH: 34,
    minH: 14,
    maxH: 150,
    url: assetSrc(pinkFlowersUrl as string | { src: string }),
  },
  {
    id: "purple-flowers",
    label: "Purple flowers",
    defaultH: 34,
    minH: 14,
    maxH: 150,
    url: assetSrc(purpleFlowersUrl as string | { src: string }),
  },
  {
    id: "stone",
    label: "Stone",
    defaultH: 36,
    minH: 16,
    maxH: 160,
    url: assetSrc(stoneUrl as string | { src: string }),
  },
];

export function getDecorItem(kind: DecorKind): DecorCatalogItem {
  return DECOR_CATALOG.find((d) => d.id === kind)!;
}

let customLoaded = false;

export async function loadCustomDecorSprites(): Promise<void> {
  if (customLoaded) return;
  await Assets.load(DECOR_CATALOG.map((d) => d.url));
  customLoaded = true;
}

function tex(url: string): Texture {
  return Assets.get(url) as Texture;
}

export interface PlacedDecorData {
  id: string;
  kind: DecorKind;
  x: number;
  y: number;
  height: number;
  /** Radians, clockwise-positive in screen space */
  rotation: number;
}

export type DecorHit =
  | "body"
  | "tl"
  | "tr"
  | "bl"
  | "br"
  | "rotate";

let idSeq = 0;
function nextId(): string {
  idSeq += 1;
  return `decor-${Date.now().toString(36)}-${idSeq}`;
}

const HANDLE = 7;
const ROTATE_GAP = 22;

/** User-placed decoration — Word-style move / corner-scale / tilt. */
export class PlacedDecor {
  readonly id: string;
  readonly kind: DecorKind;
  readonly root: Container;
  private readonly sprite: Sprite;
  private readonly gizmos: Graphics;
  private heightPx: number;
  private rotationRad: number;
  private selected = false;

  constructor(
    kind: DecorKind,
    x: number,
    y: number,
    height: number,
    rotation = 0,
    id?: string
  ) {
    const item = getDecorItem(kind);
    this.id = id ?? nextId();
    this.kind = kind;
    this.heightPx = height;
    this.rotationRad = rotation;

    this.root = new Container();
    this.root.x = x;
    this.root.y = y;
    this.root.rotation = rotation;
    this.root.zIndex = y;
    this.root.eventMode = "static";
    this.root.cursor = "move";

    this.gizmos = new Graphics();
    this.gizmos.eventMode = "none";

    this.sprite = new Sprite(tex(item.url));
    this.sprite.anchor.set(0.5, 0.5);
    this.applyHeight(height);

    this.root.addChild(this.sprite);
    this.root.addChild(this.gizmos);
  }

  get x(): number {
    return this.root.x;
  }

  get y(): number {
    return this.root.y;
  }

  get height(): number {
    return this.heightPx;
  }

  get rotation(): number {
    return this.rotationRad;
  }

  get boxW(): number {
    return Math.abs(this.sprite.width);
  }

  get boxH(): number {
    return Math.abs(this.sprite.height);
  }

  setPosition(x: number, y: number): void {
    this.root.x = x;
    this.root.y = y;
    this.root.zIndex = y;
  }

  setHeight(h: number): void {
    const item = getDecorItem(this.kind);
    this.heightPx = Math.max(item.minH, Math.min(item.maxH, h));
    this.applyHeight(this.heightPx);
    if (this.selected) this.redrawGizmos();
  }

  setRotation(rad: number): void {
    this.rotationRad = rad;
    this.root.rotation = rad;
  }

  setSelected(on: boolean): void {
    this.selected = on;
    this.redrawGizmos();
  }

  /** World → local (unrotated) coords relative to decor center. */
  worldToLocal(worldX: number, worldY: number): { x: number; y: number } {
    const dx = worldX - this.root.x;
    const dy = worldY - this.root.y;
    const c = Math.cos(-this.rotationRad);
    const s = Math.sin(-this.rotationRad);
    return { x: dx * c - dy * s, y: dx * s + dy * c };
  }

  hitTest(worldX: number, worldY: number): DecorHit | null {
    const local = this.worldToLocal(worldX, worldY);
    const hw = this.boxW / 2;
    const hh = this.boxH / 2;
    const pad = HANDLE + 2;

    if (this.selected) {
      const rotY = -hh - ROTATE_GAP;
      if (Math.hypot(local.x, local.y - rotY) <= HANDLE + 3) return "rotate";

      const corners: { hit: DecorHit; x: number; y: number }[] = [
        { hit: "tl", x: -hw, y: -hh },
        { hit: "tr", x: hw, y: -hh },
        { hit: "bl", x: -hw, y: hh },
        { hit: "br", x: hw, y: hh },
      ];
      for (const c of corners) {
        if (Math.hypot(local.x - c.x, local.y - c.y) <= pad) return c.hit;
      }
    }

    if (local.x >= -hw - 2 && local.x <= hw + 2 && local.y >= -hh - 2 && local.y <= hh + 2) {
      return "body";
    }
    return null;
  }

  toData(): PlacedDecorData {
    return {
      id: this.id,
      kind: this.kind,
      x: this.root.x,
      y: this.root.y,
      height: this.heightPx,
      rotation: this.rotationRad,
    };
  }

  private applyHeight(h: number): void {
    const scale = h / this.sprite.texture.height;
    this.sprite.scale.set(scale);
  }

  private redrawGizmos(): void {
    this.gizmos.clear();
    if (!this.selected) return;

    const hw = this.boxW / 2;
    const hh = this.boxH / 2;

    // Selection rectangle
    this.gizmos.rect(px(-hw - 2), px(-hh - 2), px(this.boxW + 4), px(this.boxH + 4));
    this.gizmos.stroke({ width: 1.5, color: 0x2c6bed, alpha: 0.95 });

    // Rotation stem + knob (Word-style, above top edge)
    const rotY = -hh - ROTATE_GAP;
    this.gizmos.moveTo(0, -hh - 2);
    this.gizmos.lineTo(0, rotY);
    this.gizmos.stroke({ width: 1.5, color: 0x2c6bed, alpha: 0.95 });
    this.gizmos.circle(0, rotY, HANDLE - 1);
    this.gizmos.fill(0xffffff);
    this.gizmos.stroke({ width: 1.5, color: 0x2c6bed });

    // Corner scale handles
    for (const [cx, cy] of [
      [-hw, -hh],
      [hw, -hh],
      [-hw, hh],
      [hw, hh],
    ] as const) {
      this.gizmos.rect(px(cx - HANDLE / 2), px(cy - HANDLE / 2), HANDLE, HANDLE);
      this.gizmos.fill(0xffffff);
      this.gizmos.stroke({ width: 1.5, color: 0x2c6bed });
    }
  }
}

function px(n: number): number {
  return Math.round(n);
}

export function storageKeyForUser(username: string): string {
  return `git-forest:custom-decor:${username.toLowerCase()}`;
}

export function loadPlacementsFromStorage(username: string): PlacedDecorData[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKeyForUser(username));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PlacedDecorData[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (p) =>
          p &&
          typeof p.id === "string" &&
          typeof p.kind === "string" &&
          typeof p.x === "number" &&
          typeof p.y === "number" &&
          typeof p.height === "number" &&
          DECOR_CATALOG.some((d) => d.id === p.kind)
      )
      .map((p) => ({
        ...p,
        rotation: typeof p.rotation === "number" ? p.rotation : 0,
      }));
  } catch {
    return [];
  }
}

export function savePlacementsToStorage(username: string, items: PlacedDecorData[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKeyForUser(username), JSON.stringify(items));
  } catch {
    // ignore quota / private mode
  }
}
