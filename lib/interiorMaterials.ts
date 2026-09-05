/**
 * Procedural interior materials.
 *
 * Everything is drawn on an offscreen canvas at run time: no binary texture
 * downloads, no marketplace assets, and the tile/plank module stays physically
 * correct because repeats are derived from the room size in metres.
 */
import * as THREE from 'three';
import type { Finish } from './apartments';

const texCache = new Map<string, THREE.Texture>();
const matCache = new Map<string, THREE.MeshStandardMaterial>();

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

function texture(key: string, size: number, draw: Draw): THREE.Texture {
  const hit = texCache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 16;
  texCache.set(key, tex);
  return tex;
}

/** deterministic noise so textures are stable between renders */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

function grain(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, seed = 7) {
  const rnd = rng(seed);
  for (let i = 0; i < w * h * 0.06; i++) {
    const a = rnd() * amount;
    ctx.fillStyle = rnd() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    ctx.fillRect(rnd() * w, rnd() * h, 1.4, 1.4);
  }
}

/* ---------------------------------------------------------------- floors --- */

const drawWood: Draw = (ctx, w, h) => {
  const rnd = rng(19);
  const rows = 6;
  const rowH = h / rows;
  ctx.fillStyle = '#8a5f39';
  ctx.fillRect(0, 0, w, h);
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (w / 4);
    for (let p = -1; p < 3; p++) {
      const x = offset + p * (w / 2);
      const tone = 0.82 + rnd() * 0.3;
      const base = ctx.createLinearGradient(0, r * rowH, 0, (r + 1) * rowH);
      base.addColorStop(0, `rgba(${Math.round(158 * tone)},${Math.round(110 * tone)},${Math.round(66 * tone)},1)`);
      base.addColorStop(1, `rgba(${Math.round(126 * tone)},${Math.round(84 * tone)},${Math.round(48 * tone)},1)`);
      ctx.fillStyle = base;
      ctx.fillRect(x, r * rowH, w / 2 - 2, rowH - 2);
      // grain lines
      ctx.strokeStyle = 'rgba(70,42,20,0.20)';
      ctx.lineWidth = 1;
      for (let g = 0; g < 7; g++) {
        const gy = r * rowH + 3 + rnd() * (rowH - 6);
        ctx.beginPath();
        ctx.moveTo(x + 2, gy);
        ctx.bezierCurveTo(x + w / 6, gy + (rnd() - 0.5) * 5, x + w / 3, gy - (rnd() - 0.5) * 5, x + w / 2 - 3, gy);
        ctx.stroke();
      }
    }
    ctx.fillStyle = 'rgba(40,24,10,0.5)';
    ctx.fillRect(0, (r + 1) * rowH - 2, w, 2);
  }
  grain(ctx, w, h, 0.05, 31);
};

const drawVitrified: Draw = (ctx, w, h) => {
  const rnd = rng(53);
  ctx.fillStyle = '#e9e5dd';
  ctx.fillRect(0, 0, w, h);
  // soft marble veining
  for (let i = 0; i < 26; i++) {
    ctx.strokeStyle = `rgba(${180 + rnd() * 40},${172 + rnd() * 40},${164 + rnd() * 40},${0.12 + rnd() * 0.2})`;
    ctx.lineWidth = 0.6 + rnd() * 2.4;
    ctx.beginPath();
    let x = rnd() * w;
    let y = rnd() * h;
    ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (rnd() - 0.4) * w * 0.3;
      y += (rnd() - 0.3) * h * 0.3;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // 2x2 tile grid with grout
  ctx.strokeStyle = 'rgba(150,144,134,0.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, w, h);
  ctx.beginPath();
  ctx.moveTo(w / 2, 0);
  ctx.lineTo(w / 2, h);
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();
  grain(ctx, w, h, 0.03, 11);
};

const drawCeramic: Draw = (ctx, w, h) => {
  ctx.fillStyle = '#d9dcd8';
  ctx.fillRect(0, 0, w, h);
  const cols = 4;
  const rows = 8;
  const rnd = rng(97);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = 0.94 + rnd() * 0.1;
      ctx.fillStyle = `rgba(${Math.round(214 * t)},${Math.round(219 * t)},${Math.round(214 * t)},1)`;
      ctx.fillRect((c * w) / cols + 1.5, (r * h) / rows + 1.5, w / cols - 3, h / rows - 3);
    }
  }
  grain(ctx, w, h, 0.025, 5);
};

const drawDeck: Draw = (ctx, w, h) => {
  ctx.fillStyle = '#8d8a84';
  ctx.fillRect(0, 0, w, h);
  const rnd = rng(131);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const t = 0.9 + rnd() * 0.18;
      ctx.fillStyle = `rgba(${Math.round(150 * t)},${Math.round(146 * t)},${Math.round(138 * t)},1)`;
      ctx.fillRect((c * w) / 3 + 2, (r * h) / 3 + 2, w / 3 - 4, h / 3 - 4);
    }
  }
  grain(ctx, w, h, 0.07, 17);
};

const drawGranite: Draw = (ctx, w, h) => {
  ctx.fillStyle = '#26282b';
  ctx.fillRect(0, 0, w, h);
  const rnd = rng(211);
  for (let i = 0; i < w * h * 0.12; i++) {
    const a = rnd();
    ctx.fillStyle = a > 0.7 ? 'rgba(220,220,225,0.5)' : a > 0.4 ? 'rgba(120,126,132,0.45)' : 'rgba(10,10,12,0.5)';
    ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
  }
};

const drawPaint: Draw = (ctx, w, h) => {
  ctx.fillStyle = '#f1ede5';
  ctx.fillRect(0, 0, w, h);
  grain(ctx, w, h, 0.035, 71);
};

const drawLinen: Draw = (ctx, w, h) => {
  ctx.fillStyle = '#e8e2d6';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(190,182,168,0.5)';
  ctx.lineWidth = 1;
  for (let i = 0; i < w; i += 4) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, h);
    ctx.moveTo(0, i);
    ctx.lineTo(w, i);
    ctx.stroke();
  }
  grain(ctx, w, h, 0.05, 23);
};

/** Walnut veneer used for wardrobe and kitchen base shutters. */
const drawVeneer: Draw = (ctx, w, h) => {
  const rnd = rng(313);
  const base = ctx.createLinearGradient(0, 0, w, 0);
  base.addColorStop(0, '#8b6746');
  base.addColorStop(0.5, '#9c7752');
  base.addColorStop(1, '#82603f');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  ctx.lineWidth = 1;
  for (let i = 0; i < 90; i++) {
    ctx.strokeStyle = `rgba(80,52,30,${0.05 + rnd() * 0.14})`;
    const x = rnd() * w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + (rnd() - 0.5) * 14, h / 3, x + (rnd() - 0.5) * 14, (h * 2) / 3, x + (rnd() - 0.5) * 10, h);
    ctx.stroke();
  }
  grain(ctx, w, h, 0.03, 41);
};

/** Matte lacquer shutter for kitchen wall units. */
const drawShutter: Draw = (ctx, w, h) => {
  ctx.fillStyle = '#e3ded4';
  ctx.fillRect(0, 0, w, h);
  grain(ctx, w, h, 0.02, 61);
};

const FLOOR: Record<Finish, { draw: Draw; tile: number; roughness: number; metalness: number }> = {
  wood: { draw: drawWood, tile: 1.8, roughness: 0.55, metalness: 0.02 },
  vitrified: { draw: drawVitrified, tile: 1.6, roughness: 0.16, metalness: 0.06 },
  ceramic: { draw: drawCeramic, tile: 1.2, roughness: 0.3, metalness: 0.02 },
  deck: { draw: drawDeck, tile: 1.2, roughness: 0.72, metalness: 0.0 },
  granite: { draw: drawGranite, tile: 1.0, roughness: 0.24, metalness: 0.1 },
};

/** Floor material sized to the room so tiles keep a real-world module. */
export function floorMaterial(finish: Finish, w: number, d: number): THREE.MeshStandardMaterial {
  const spec = FLOOR[finish];
  const rx = Math.max(1, Math.round(w / spec.tile));
  const rz = Math.max(1, Math.round(d / spec.tile));
  const key = `floor-${finish}-${rx}-${rz}`;
  const hit = matCache.get(key);
  if (hit) return hit;
  const map = texture(`tex-${finish}`, 512, spec.draw).clone();
  map.needsUpdate = true;
  map.repeat.set(rx, rz);
  const glossy = finish === 'vitrified' || finish === 'granite';
  const mat = new THREE.MeshPhysicalMaterial({
    map,
    roughness: spec.roughness,
    metalness: spec.metalness,
    clearcoat: glossy ? 0.62 : 0.08,
    clearcoatRoughness: glossy ? 0.18 : 0.6,
    envMapIntensity: 1.15,
  }) as unknown as THREE.MeshStandardMaterial;
  matCache.set(key, mat);
  return mat;
}

function simple(key: string, build: () => THREE.MeshStandardMaterial) {
  const hit = matCache.get(key);
  if (hit) return hit;
  const mat = build();
  matCache.set(key, mat);
  return mat;
}

export const wallMaterial = () =>
  simple('wall', () => {
    const map = texture('tex-paint', 256, drawPaint).clone();
    map.needsUpdate = true;
    map.repeat.set(3, 2);
    return new THREE.MeshStandardMaterial({ map, roughness: 0.92, metalness: 0 });
  });

export const accentWallMaterial = () =>
  simple('wall-accent', () => new THREE.MeshStandardMaterial({ color: '#7d6a55', roughness: 0.85 }));

export const ceilingMaterial = () => simple('ceiling', () => new THREE.MeshStandardMaterial({ color: '#fbf9f4', roughness: 0.96 }));

export const skirtingMaterial = () => simple('skirting', () => new THREE.MeshStandardMaterial({ color: '#efece4', roughness: 0.5 }));

export const glassMaterial = () =>
  simple('glass', () =>
    new THREE.MeshPhysicalMaterial({
      color: '#9eb6c4',
      transparent: true,
      opacity: 0.42,
      roughness: 0.08,
      metalness: 0.04,
      transmission: 0.22,
      thickness: 0.03,
      ior: 1.45,
      envMapIntensity: 1.3,
    }) as unknown as THREE.MeshStandardMaterial,
  );

export const frameMaterial = () => simple('frame', () => new THREE.MeshStandardMaterial({ color: '#4a4f55', roughness: 0.42, metalness: 0.5 }));

export const railMaterial = () => simple('rail', () => new THREE.MeshStandardMaterial({ color: '#2c2f33', roughness: 0.35, metalness: 0.7 }));

export const doorMaterial = () =>
  simple('door', () => {
    const map = texture('tex-wood', 512, drawWood).clone();
    map.needsUpdate = true;
    map.repeat.set(1, 1.6);
    return new THREE.MeshStandardMaterial({ map, color: '#c9a882', roughness: 0.45 });
  });

export const linenMaterial = () =>
  simple('linen', () => {
    const map = texture('tex-linen', 256, drawLinen).clone();
    map.needsUpdate = true;
    map.repeat.set(2, 2);
    return new THREE.MeshStandardMaterial({ map, roughness: 0.86 });
  });

export const laminateMaterial = () =>
  simple('veneer', () => {
    const map = texture('tex-veneer', 512, drawVeneer).clone();
    map.needsUpdate = true;
    map.repeat.set(2, 1);
    return new THREE.MeshStandardMaterial({ map, roughness: 0.38, metalness: 0.04 });
  });

export const shutterMaterial = () =>
  simple('shutter', () => {
    const map = texture('tex-shutter', 256, drawShutter).clone();
    map.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map, roughness: 0.42, metalness: 0.03 });
  });

/** Room name + dimension baked onto the floor, the way printed 3D plans do it. */
export function floorLabelTexture(short: string, dim: string, w: number, d: number): THREE.Texture {
  const key = `label-${short}-${dim}-${w.toFixed(1)}-${d.toFixed(1)}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const long = Math.max(w, d);
  const cw = Math.max(64, Math.round((1024 * w) / long));
  const ch = Math.max(64, Math.round((1024 * d) / long));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, cw, ch);
  // keep the caption a constant real-world height (~19 cm) whatever the room size
  const pxPerMetre = 1024 / long;
  const px = Math.max(14, Math.min(0.19 * pxPerMetre, Math.min(cw, ch) * 0.3));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(28,28,28,0.82)';
  ctx.font = `700 ${px}px Inter, Helvetica, Arial, sans-serif`;
  ctx.fillText(short, cw / 2, ch / 2 - px * 0.36);
  ctx.fillStyle = 'rgba(58,58,58,0.62)';
  ctx.font = `500 ${px * 0.62}px Inter, Helvetica, Arial, sans-serif`;
  ctx.fillText(dim, cw / 2, ch / 2 + px * 0.55);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  texCache.set(key, tex);
  return tex;
}

export const graniteMaterial = () =>
  simple('granite-slab', () => {
    const map = texture('tex-granite', 256, drawGranite).clone();
    map.needsUpdate = true;
    map.repeat.set(3, 1);
    return new THREE.MeshStandardMaterial({ map, roughness: 0.2, metalness: 0.12 });
  });

export const fabricMaterial = (color: string) =>
  simple(`fabric-${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));

export const woodMaterial = (color = '#b0855c') =>
  simple(`wood-${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));

export const metalMaterial = () => simple('metal', () => new THREE.MeshStandardMaterial({ color: '#c8ccd0', roughness: 0.22, metalness: 0.85 }));

export const porcelainMaterial = () => simple('porcelain', () => new THREE.MeshStandardMaterial({ color: '#f8f8f6', roughness: 0.12 }));

export const screenMaterial = () =>
  simple('screen', () => new THREE.MeshStandardMaterial({ color: '#0b0d10', roughness: 0.08, metalness: 0.4, emissive: new THREE.Color('#0d1b2a'), emissiveIntensity: 0.4 }));

export const plantMaterial = () => simple('plant', () => new THREE.MeshStandardMaterial({ color: '#3f7a3c', roughness: 0.85 }));

export const potMaterial = () => simple('pot', () => new THREE.MeshStandardMaterial({ color: '#9c6b4d', roughness: 0.75 }));

export const rugMaterial = () => simple('rug', () => new THREE.MeshStandardMaterial({ color: '#8f7a63', roughness: 0.95 }));

export function disposeInteriorMaterials() {
  matCache.forEach((m) => {
    if (m.map) m.map.dispose();
    m.dispose();
  });
  matCache.clear();
  texCache.forEach((t) => t.dispose());
  texCache.clear();
}
