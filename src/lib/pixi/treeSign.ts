import { Container, Graphics, Text } from "pixi.js";
import type { TreeTraits } from "@/lib/github/types";

function px(n: number): number {
  return Math.round(n);
}

function shortName(name: string, max = 16): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

const WOOD = {
  face: 0xc4a06a,
  mid: 0xa07848,
  dark: 0x6b4a28,
  outline: 0x3d2914,
  post: 0x7a4e28,
  postDark: 0x4a2e18,
  postLight: 0x9a6a3a,
};

/**
 * Pixel wooden sign on a stake — planted in the ground in front of the tree.
 * Post is drawn continuously into the board so they stay attached.
 */
export function attachRepoSign(root: Container, tree: TreeTraits): Container {
  const name = shortName(tree.name);
  const len = Math.max(3, name.length);

  const sign = new Container();
  sign.eventMode = "none";
  sign.visible = false;

  const boardW = clamp(10 + len * 7, 36, 108);
  const boardH = clamp(14 + Math.floor(len / 8) * 2, 14, 20);
  const postW = 3;
  // Post runs from inside the board down into the dirt (no gap)
  const postTop = -Math.floor(boardH * 0.45);
  const postBottom = boardH > 0 ? 12 : 12;
  const tipY = postBottom + 4;

  const g = new Graphics();

  // --- Post first (behind the plank) ---
  g.rect(px(-postW / 2), px(postTop), postW, px(postBottom - postTop));
  g.fill(WOOD.post);
  g.rect(px(-postW / 2), px(postTop), 1, px(postBottom - postTop));
  g.fill(WOOD.postLight);
  // pointed tip — flush with post bottom
  g.moveTo(px(-postW / 2), px(postBottom));
  g.lineTo(0, px(tipY));
  g.lineTo(px(postW / 2), px(postBottom));
  g.closePath();
  g.fill(WOOD.postDark);

  // --- Board on top of post (covers the join) ---
  const bx = -boardW / 2;
  const by = -boardH;
  drawWeatheredBoard(g, bx, by, boardW, boardH);

  // Nail / band so the join reads clearly
  g.rect(px(-2), px(-1), 4, 3);
  g.fill(WOOD.dark);
  g.rect(px(-1), 0, 2, 1);
  g.fill(WOOD.mid);

  sign.addChild(g);

  const fontSize = clamp(6 + boardW * 0.035, 6, 9);
  const label = new Text({
    text: name,
    style: {
      fontFamily: '"Press Start 2P", monospace',
      fontSize,
      fill: 0x2c1810,
      align: "center",
      letterSpacing: -0.5,
    },
  });
  label.anchor.set(0.5);
  label.y = by + boardH * 0.52;

  const maxTextW = boardW * 0.82;
  if (label.width > maxTextW && label.width > 0) {
    label.scale.set(maxTextW / label.width);
  }
  if (label.scale.x < 0.45) label.scale.set(0.45);
  sign.addChild(label);

  const side = tree.id % 2 === 0 ? 1 : -1;
  sign.x = side * (6 + (tree.id % 4));
  sign.y = 6;
  sign.rotation = ((tree.id % 5) - 2) * 0.02;

  root.addChild(sign);
  return sign;
}

/** Chunky RPG sign board — solid bottom center so it seats on the post. */
function drawWeatheredBoard(g: Graphics, x: number, y: number, w: number, h: number): void {
  // Outer outline (slightly irregular sides, flat bottom for the stake join)
  g.moveTo(px(x + 2), px(y));
  g.lineTo(px(x + w - 2), px(y));
  g.lineTo(px(x + w), px(y + 2));
  g.lineTo(px(x + w), px(y + Math.floor(h * 0.35)));
  g.lineTo(px(x + w - 1), px(y + Math.floor(h * 0.35) + 2));
  g.lineTo(px(x + w), px(y + Math.floor(h * 0.35) + 4));
  g.lineTo(px(x + w), px(y + h - 1));
  g.lineTo(px(x + w - 1), px(y + h));
  // flat bottom through the middle (where the stick attaches)
  g.lineTo(px(x + 1), px(y + h));
  g.lineTo(px(x), px(y + h - 1));
  g.lineTo(px(x), px(y + Math.floor(h * 0.55) + 2));
  g.lineTo(px(x + 2), px(y + Math.floor(h * 0.55)));
  g.lineTo(px(x), px(y + Math.floor(h * 0.55) - 2));
  g.lineTo(px(x), px(y + 3));
  g.lineTo(px(x + 2), px(y + 1));
  g.closePath();
  g.fill(WOOD.outline);

  // Inner face — solid rect so nothing shows through over the post
  g.rect(px(x + 2), px(y + 1), px(w - 4), px(h - 2));
  g.fill(WOOD.face);

  // Bottom/right shade
  g.rect(px(x + 2), px(y + h - 3), px(w - 5), 2);
  g.fill(WOOD.dark);
  g.rect(px(x + w - 3), px(y + 2), 2, px(h - 5));
  g.fill(WOOD.mid);

  // Grain
  for (let i = 1; i < 3; i++) {
    const gy = y + 3 + i * Math.floor((h - 6) / 3);
    g.rect(px(x + 4), px(gy), px(w - 9), 1);
    g.fill({ color: WOOD.mid, alpha: 0.45 });
  }

  // Top highlight
  g.rect(px(x + 3), px(y + 1), px(w - 7), 1);
  g.fill({ color: 0xe8d4a8, alpha: 0.55 });
}

/** No external texture to load (procedural signs). */
export async function loadWoodPanel(): Promise<void> {}
