import { Container, Graphics } from "pixi.js";
import type { Season, TreeSpecies, TreeTraits } from "@/lib/github/types";
import { SEASON_PALETTE } from "@/lib/world/seasons";
import { attachRepoSign } from "./treeSign";

interface CanopyPalette {
  highlight: number;
  mid: number;
  shadow: number;
}

interface TrunkPalette {
  light: number;
  mid: number;
  dark: number;
}

const SPECIES_CANOPY: Record<TreeSpecies, CanopyPalette> = {
  oak: { highlight: 0xb4e05a, mid: 0x5aaa32, shadow: 0x2f6b24 },
  pine: { highlight: 0x6db84a, mid: 0x3d7a38, shadow: 0x1f4a28 },
  birch: { highlight: 0xc8e86a, mid: 0x7cb342, shadow: 0x4a7a28 },
  willow: { highlight: 0xa8d84a, mid: 0x689f38, shadow: 0x3d6b28 },
  maple: { highlight: 0xf0a050, mid: 0xc45c26, shadow: 0x8a3018 },
  cherry: { highlight: 0xffc0d0, mid: 0xe891a8, shadow: 0xb85a78 },
  cedar: { highlight: 0x5a9a48, mid: 0x2d6a3e, shadow: 0x1a4030 },
  dead: { highlight: 0x8a7a68, mid: 0x6b5e4f, shadow: 0x4a4038 },
  sapling: { highlight: 0xb8e878, mid: 0x81c784, shadow: 0x4a9a4a },
};

const TRUNK: TrunkPalette = {
  light: 0xc4a06a,
  mid: 0x8a5a32,
  dark: 0x4a2e18,
};

const BIRCH_TRUNK: TrunkPalette = {
  light: 0xf5f0e6,
  mid: 0xe0d8c8,
  dark: 0x9a9080,
};

function seasonCanopy(species: TreeSpecies, season: Season): CanopyPalette {
  const base = SPECIES_CANOPY[species];
  if (season === "winter" && species !== "pine" && species !== "cedar" && species !== "dead") {
    return { highlight: 0xe8f0e8, mid: 0xc8d8c8, shadow: 0x90a890 };
  }
  if (season === "autumn" && species !== "pine" && species !== "cedar" && species !== "dead") {
    if (species === "maple" || species === "cherry") {
      return { highlight: 0xffb060, mid: 0xe05a20, shadow: 0x8a2808 };
    }
    if (species === "birch") {
      return { highlight: 0xf0e050, mid: 0xd4a820, shadow: 0x8a6810 };
    }
    return { highlight: 0xf0c040, mid: 0xd97706, shadow: 0x8a4a08 };
  }
  return base;
}

function trunkFor(species: TreeSpecies): TrunkPalette {
  return species === "birch" ? BIRCH_TRUNK : TRUNK;
}

/** Snap to pixel grid for chunky sprite look */
function px(n: number): number {
  return Math.round(n);
}

function blob(
  g: Graphics,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: number
): void {
  g.ellipse(px(cx), px(cy), Math.max(2, px(rx)), Math.max(2, px(ry)));
  g.fill(color);
}

function drawTrunk(
  g: Graphics,
  trunkH: number,
  trunkW: number,
  palette: TrunkPalette,
  flare = 1.35
): void {
  const half = trunkW / 2;

  // Root flare with little “cave” gaps (Zelda-style base)
  g.moveTo(px(-half * flare * 1.15), 3);
  g.lineTo(px(-half * 1.1), px(-trunkH * 0.08));
  g.lineTo(px(-half * 0.35), 1);
  g.lineTo(px(-half * 0.15), 4);
  g.lineTo(px(half * 0.15), 4);
  g.lineTo(px(half * 0.35), 1);
  g.lineTo(px(half * 1.1), px(-trunkH * 0.08));
  g.lineTo(px(half * flare * 1.15), 3);
  g.closePath();
  g.fill(palette.dark);

  g.moveTo(px(-half * flare), 2);
  g.lineTo(px(-half), px(-trunkH * 0.15));
  g.lineTo(px(half), px(-trunkH * 0.15));
  g.lineTo(px(half * flare), 2);
  g.closePath();
  g.fill(palette.mid);

  // root highlights
  g.rect(px(-half * flare * 0.85), 0, px(half * 0.35), 2);
  g.fill(palette.light);
  g.rect(px(half * 0.2), 0, px(half * 0.4), 2);
  g.fill(palette.light);

  // main trunk
  g.rect(px(-half), px(-trunkH), px(trunkW), px(trunkH));
  g.fill(palette.mid);

  // light edge
  g.rect(px(-half), px(-trunkH), px(Math.max(1, trunkW * 0.28)), px(trunkH));
  g.fill(palette.light);

  // dark edge
  g.rect(px(half - Math.max(1, trunkW * 0.22)), px(-trunkH), px(Math.max(1, trunkW * 0.22)), px(trunkH));
  g.fill(palette.dark);

  // bark notches
  g.rect(px(-1), px(-trunkH * 0.55), 2, 3);
  g.fill(palette.dark);
  g.rect(px(half * 0.15), px(-trunkH * 0.3), 2, 2);
  g.fill(palette.dark);
}

function drawCanopyCluster(
  g: Graphics,
  cx: number,
  cy: number,
  r: number,
  palette: CanopyPalette
): void {
  // shadow mass
  blob(g, cx + r * 0.12, cy + r * 0.18, r * 1.05, r * 0.95, palette.shadow);
  // mid body
  blob(g, cx - r * 0.05, cy - r * 0.05, r * 0.95, r * 0.9, palette.mid);
  // left lobe
  blob(g, cx - r * 0.55, cy + r * 0.1, r * 0.55, r * 0.5, palette.mid);
  // right lobe
  blob(g, cx + r * 0.5, cy + r * 0.05, r * 0.5, r * 0.48, palette.shadow);
  // highlight (top-left light)
  blob(g, cx - r * 0.25, cy - r * 0.45, r * 0.55, r * 0.42, palette.highlight);
  blob(g, cx + r * 0.15, cy - r * 0.35, r * 0.35, r * 0.28, palette.highlight);
}

function drawBareBranches(
  g: Graphics,
  trunkH: number,
  spread: number,
  palette: TrunkPalette,
  dense: boolean
): void {
  const tips = dense
    ? [
        [-0.7, -1.15],
        [-0.35, -1.35],
        [0.05, -1.45],
        [0.4, -1.3],
        [0.75, -1.1],
        [-0.55, -0.95],
        [0.55, -0.9],
      ]
    : [
        [-0.55, -1.15],
        [0.05, -1.35],
        [0.55, -1.15],
      ];

  for (const [tx, ty] of tips) {
    g.moveTo(0, px(-trunkH * 0.55));
    g.lineTo(px(spread * tx * 0.4), px(-trunkH * 0.85));
    g.lineTo(px(spread * tx), px(-trunkH * Math.abs(ty)));
    g.stroke({ width: dense ? 2.5 : 2, color: palette.mid });
    g.moveTo(px(spread * tx * 0.4), px(-trunkH * 0.85));
    g.lineTo(px(spread * tx * 0.7), px(-trunkH * (Math.abs(ty) - 0.15)));
    g.stroke({ width: 1.5, color: palette.dark });
  }
}

/** Image-2 style: small round garden tree */
function drawSmallTree(g: Graphics, h: number, canopy: CanopyPalette, trunk: TrunkPalette): void {
  const trunkH = h * 0.38;
  const trunkW = Math.max(5, h * 0.1);
  const r = Math.max(12, h * 0.42);
  drawTrunk(g, trunkH, trunkW, trunk, 1.5);
  drawCanopyCluster(g, 0, -trunkH - r * 0.55, r, canopy);
}

/** Image-2 style: large bushy mature tree */
function drawBroadTree(g: Graphics, h: number, canopy: CanopyPalette, trunk: TrunkPalette): void {
  const trunkH = h * 0.42;
  const trunkW = Math.max(7, h * 0.12);
  const r = Math.max(18, h * 0.48);
  drawTrunk(g, trunkH, trunkW, trunk, 1.6);
  drawCanopyCluster(g, -r * 0.15, -trunkH - r * 0.35, r * 0.85, canopy);
  drawCanopyCluster(g, r * 0.35, -trunkH - r * 0.55, r * 0.75, canopy);
  drawCanopyCluster(g, 0, -trunkH - r * 0.85, r * 0.7, canopy);
}

/** Image-2 style: taller tree with split canopy */
function drawTallTree(g: Graphics, h: number, canopy: CanopyPalette, trunk: TrunkPalette): void {
  const trunkH = h * 0.5;
  const trunkW = Math.max(5, h * 0.08);
  const r = Math.max(14, h * 0.36);
  drawTrunk(g, trunkH, trunkW, trunk, 1.3);

  // visible fork
  g.moveTo(0, px(-trunkH * 0.7));
  g.lineTo(px(-r * 0.55), px(-trunkH - r * 0.2));
  g.stroke({ width: trunkW * 0.55, color: trunk.mid });
  g.moveTo(0, px(-trunkH * 0.65));
  g.lineTo(px(r * 0.5), px(-trunkH - r * 0.15));
  g.stroke({ width: trunkW * 0.5, color: trunk.dark });

  drawCanopyCluster(g, -r * 0.55, -trunkH - r * 0.55, r * 0.7, canopy);
  drawCanopyCluster(g, r * 0.45, -trunkH - r * 0.45, r * 0.65, canopy);
  drawCanopyCluster(g, 0, -trunkH - r * 1.05, r * 0.8, canopy);
}

/** Pine / cedar layered triangles, pixel-shaded */
function drawEvergreen(g: Graphics, h: number, canopy: CanopyPalette, trunk: TrunkPalette): void {
  const trunkH = h * 0.28;
  const trunkW = Math.max(4, h * 0.07);
  drawTrunk(g, trunkH, trunkW, trunk, 1.2);
  const layers = 4;
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);
    const ly = -trunkH - i * (h * 0.16);
    const lw = h * 0.38 * (1.05 - t * 0.55);
    g.moveTo(0, px(ly - h * 0.14));
    g.lineTo(px(-lw), px(ly + h * 0.06));
    g.lineTo(px(lw), px(ly + h * 0.06));
    g.closePath();
    g.fill(i % 2 === 0 ? canopy.mid : canopy.shadow);
    // highlight edge
    g.moveTo(0, px(ly - h * 0.14));
    g.lineTo(px(-lw * 0.35), px(ly));
    g.lineTo(0, px(ly + h * 0.02));
    g.closePath();
    g.fill(canopy.highlight);
  }
}

/** Image-1 style: lush weeping elder — highest commit trees only */
function drawLegendaryTree(g: Graphics, h: number, canopy: CanopyPalette, trunk: TrunkPalette): void {
  const scale = Math.max(1, h / 90);
  const trunkH = 38 * scale;
  const trunkW = 10 * scale;

  // shadow
  g.ellipse(0, 4, 28 * scale, 8 * scale);
  g.fill({ color: 0x000000, alpha: 0.2 });

  // thick curved trunk (lean right)
  g.moveTo(px(-trunkW * 0.7), 2);
  g.quadraticCurveTo(px(-trunkW * 0.2), px(-trunkH * 0.4), px(trunkW * 0.1), px(-trunkH * 0.75));
  g.lineTo(px(trunkW * 0.85), px(-trunkH * 0.7));
  g.quadraticCurveTo(px(trunkW * 0.4), px(-trunkH * 0.35), px(trunkW * 0.9), 2);
  g.closePath();
  g.fill(trunk.mid);

  g.moveTo(px(-trunkW * 0.55), 2);
  g.quadraticCurveTo(px(-trunkW * 0.1), px(-trunkH * 0.4), px(trunkW * 0.15), px(-trunkH * 0.72));
  g.lineTo(px(trunkW * 0.35), px(-trunkH * 0.7));
  g.quadraticCurveTo(px(0), px(-trunkH * 0.35), px(-trunkW * 0.15), 2);
  g.closePath();
  g.fill(trunk.light);

  // inner branches peeking through
  const branchY = -trunkH * 0.85;
  for (const [bx, by] of [
    [-0.9, -0.2],
    [-0.4, -0.55],
    [0.3, -0.65],
    [0.85, -0.25],
    [0.1, -0.95],
  ] as const) {
    g.moveTo(px(trunkW * 0.2), px(branchY));
    g.lineTo(px(bx * 32 * scale), px(branchY + by * 36 * scale));
    g.stroke({ width: 2.5 * scale, color: trunk.dark });
  }

  // dense rounded canopy masses
  const cy = -trunkH - 18 * scale;
  drawCanopyCluster(g, -22 * scale, cy + 6 * scale, 20 * scale, canopy);
  drawCanopyCluster(g, 18 * scale, cy + 2 * scale, 22 * scale, canopy);
  drawCanopyCluster(g, -4 * scale, cy - 16 * scale, 24 * scale, canopy);
  drawCanopyCluster(g, 28 * scale, cy - 10 * scale, 16 * scale, canopy);
  drawCanopyCluster(g, -28 * scale, cy - 8 * scale, 15 * scale, canopy);

  // weeping vines (signature of the reference)
  const vineColor = canopy.highlight;
  const vineShadow = canopy.mid;
  for (let i = 0; i < 28; i++) {
    const vx = (-34 + i * 2.5) * scale;
    const top = cy + (8 + (i % 5) * 2) * scale;
    const len = (14 + (i * 7) % 22) * scale;
    g.moveTo(px(vx), px(top));
    g.lineTo(px(vx + (i % 3) - 1), px(top + len));
    g.stroke({ width: Math.max(1, scale), color: i % 2 === 0 ? vineColor : vineShadow, alpha: 0.95 });
  }
}

function drawForm(
  g: Graphics,
  tree: TreeTraits,
  canopy: CanopyPalette,
  trunk: TrunkPalette
): void {
  if (tree.form === "legendary") {
    drawLegendaryTree(g, tree.height, canopy, trunk);
    return;
  }
  if (tree.form === "bare" || tree.isDead) {
    const trunkH = tree.height * 0.45;
    const trunkW = Math.max(5, tree.height * 0.09);
    drawTrunk(g, trunkH, trunkW, trunk, 1.45);
    drawBareBranches(g, trunkH, tree.height * 0.4, trunk, tree.height > 60);
    return;
  }
  if (tree.species === "pine" || tree.species === "cedar") {
    drawEvergreen(g, tree.height, canopy, trunk);
    return;
  }
  if (tree.form === "small" || tree.species === "sapling") {
    drawSmallTree(g, Math.max(28, tree.height), canopy, trunk);
    return;
  }
  if (tree.form === "tall") {
    drawTallTree(g, tree.height, canopy, trunk);
    return;
  }
  drawBroadTree(g, tree.height, canopy, trunk);
}

export function drawTree(tree: TreeTraits, season: Season): Container {
  const root = new Container();
  root.x = tree.x;
  root.y = tree.y;
  root.eventMode = "static";
  root.cursor = "pointer";
  (root as Container & { treeData?: TreeTraits }).treeData = tree;

  const g = new Graphics();
  const h = tree.height;
  const canopyR = tree.form === "legendary" ? h * 0.55 : Math.max(14, h * 0.4);
  const canopy = seasonCanopy(tree.species, season);
  const trunk = trunkFor(tree.species);

  // ground shadow
  g.ellipse(0, 3, canopyR * 0.65, canopyR * 0.2);
  g.fill({ color: 0x000000, alpha: 0.16 });

  drawForm(g, tree, canopy, trunk);

  // flowers (stars) — skip on bare/winter snow look
  if (tree.flowers > 0 && !tree.isDead && tree.form !== "bare" && season !== "winter") {
    const flowerColor = tree.species === "cherry" ? 0xfff0f5 : SEASON_PALETTE[season].accent;
    const count = tree.form === "legendary" ? tree.flowers + 4 : tree.flowers;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const fx = Math.cos(angle) * canopyR * 0.5;
      const fy = -h * 0.55 + Math.sin(angle) * canopyR * 0.35;
      g.rect(px(fx - 1), px(fy - 1), 3, 3);
      g.fill(flowerColor);
    }
  }

  // bird nests (issues)
  for (let i = 0; i < tree.nests; i++) {
    const nx = -canopyR * 0.25 + i * 7;
    const ny = -h * 0.45;
    g.ellipse(px(nx), px(ny), 3.5, 2);
    g.fill(0x5d4037);
  }

  // fork saplings at base
  for (let i = 0; i < tree.saplings; i++) {
    const sx = -16 + i * 7;
    g.rect(px(sx - 1), -5, 2, 7);
    g.fill(TRUNK.mid);
    g.circle(px(sx), -8, 3.5);
    g.fill(0x66bb6a);
  }

  root.addChild(g);
  const sign = attachRepoSign(root, tree, h);
  (root as Container & { repoSign?: Container }).repoSign = sign;

  const hitR = tree.form === "legendary" ? canopyR + 20 : canopyR + 12;
  root.hitArea = {
    contains(x: number, y: number) {
      return x * x + (y + h * 0.4) * (y + h * 0.4) < hitR * hitR;
    },
  };

  return root;
}

export function drawFireflies(
  tree: TreeTraits,
  container: Container,
  time: number
): void {
  if (tree.fireflies <= 0 || tree.isDead) return;
  const g = new Graphics();
  g.eventMode = "none";
  const count = tree.form === "legendary" ? tree.fireflies + 4 : tree.fireflies;
  for (let i = 0; i < count; i++) {
    const phase = time * 0.002 + i * 1.7 + tree.id * 0.01;
    const ox = Math.sin(phase) * 28 + Math.cos(phase * 0.7) * 10;
    const oy = -tree.height * 0.5 + Math.cos(phase * 1.3) * 20;
    const alpha = 0.4 + 0.6 * ((Math.sin(phase * 3) + 1) / 2);
    g.circle(tree.x + ox, tree.y + oy, 2);
    g.fill({ color: 0xfff59d, alpha });
  }
  container.addChild(g);
}
