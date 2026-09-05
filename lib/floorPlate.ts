/**
 * Typical-floor plate drawn the way the builder printed it:
 * paper-cream ground, units tinted by SFT, numbers on each flat, lifts at the core.
 */
import { SFT_COLOR, SFT_INK, STATUS_DOT } from './palette';

export type PlateShape = 'bar' | 'cross';

export interface PlateFlat {
  id: string;
  flatNo: string;
  sqft: number;
  bhk: number;
  facing: string;
  status?: string;
}

export interface UnitFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  flat: PlateFlat;
}

export interface PlateLayout {
  W: number;
  H: number;
  frames: UnitFrame[];
}

const PAPER = '#f3efe6';
const WALL = '#2b2924';
const CORRIDOR = '#d9d3c7';
const CORE = '#c6bfb2';

const sftFill = (sqft: number) => SFT_COLOR[sqft] ?? '#d8d2c4';
const sftInk = (sqft: number) => SFT_INK[sqft] ?? '#2b2924';

const rowOf = (list: PlateFlat[], x0: number, y: number, innerW: number, h: number): UnitFrame[] => {
  const weights = list.map((f) => f.sqft);
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  let x = x0;
  return list.map((flat) => {
    const w = (flat.sqft / sum) * innerW;
    const box = { x, y, w, h, flat };
    x += w;
    return box;
  });
};

const splitRows = (flats: PlateFlat[]) => {
  const east = flats.filter((f) => Number(f.flatNo) <= 5).sort((a, b) => Number(a.flatNo) - Number(b.flatNo));
  const west = flats.filter((f) => Number(f.flatNo) > 5).sort((a, b) => Number(a.flatNo) - Number(b.flatNo));
  return {
    east: east.length ? east : flats.slice(0, 5),
    west: west.length ? west : flats.slice(5),
  };
};

function layoutBar(flats: PlateFlat[]): PlateLayout {
  const W = 2200;
  const H = 1180;
  const pad = 64;
  const coreW = 118;
  const corridorH = 148;
  const innerW = W - pad * 2 - coreW * 2;
  const eastH = (H - pad * 2 - corridorH) / 2;
  const { east, west } = splitRows(flats);
  return {
    W,
    H,
    frames: [
      ...rowOf(east, pad + coreW, pad, innerW, eastH),
      ...rowOf(west, pad + coreW, pad + eastH + corridorH, innerW, eastH),
    ],
  };
}

function layoutCross(flats: PlateFlat[]): PlateLayout {
  const W = 1800;
  const H = 1800;
  const pad = 70;
  const core = 420;
  const gap = 36;
  const rowH = (H - pad * 2 - core - gap * 2) / 2;
  const innerW = W - pad * 2;
  const { east, west } = splitRows(flats);
  return {
    W,
    H,
    frames: [
      ...rowOf(east, pad, pad, innerW, rowH),
      ...rowOf(west, pad, H - pad - rowH, innerW, rowH),
    ],
  };
}

export function unitFrames(flats: PlateFlat[], shape: PlateShape = 'bar'): PlateLayout {
  return shape === 'cross' ? layoutCross(flats) : layoutBar(flats);
}

/** Map a painted cell onto tower-local metres so 3D click boxes sit on the texture. */
export function plateSlots3D(flats: PlateFlat[], footprint: [number, number], shape: PlateShape = 'bar') {
  const { W, H, frames } = unitFrames(flats, shape);
  const [w, d] = footprint;
  return frames.map(({ x, y, w: fw, h: fh, flat }) => {
    const cx = (x + fw / 2) / W;
    const cy = (y + fh / 2) / H;
    return {
      flat,
      lx: (0.5 - cy) * w,
      lz: (cx - 0.5) * d,
      pw: (fw / W) * d,
      pd: (fh / H) * w,
      side: Number(flat.flatNo) <= 5 ? 1 : -1,
    };
  });
}

function drawMiniRooms(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, sqft: number, east: boolean) {
  const inset = 14;
  const rx = x + inset;
  const ry = y + inset;
  const rw = w - inset * 2;
  const rh = h - inset * 2;
  const hasLiving = sqft >= 1825;
  const baths = sqft >= 1585 ? 3 : 2;
  ctx.save();
  if (!east) {
    ctx.translate(rx + rw / 2, ry + rh / 2);
    ctx.rotate(Math.PI);
    ctx.translate(-(rx + rw / 2), -(ry + rh / 2));
  }
  ctx.strokeStyle = 'rgba(43,41,36,0.38)';
  ctx.lineWidth = 1.6;
  const colL = rw * 0.28;
  const colR = rw * (hasLiving ? 0.34 : 0.38);
  const colM = rw - colL - colR;
  const rowBal = rh * 0.12;
  const rowFront = rh * 0.36;
  const rowMid = rh * 0.2;
  const rowRear = rh - rowBal - rowFront - rowMid;

  const rooms: [number, number, number, number][] = [
    [rx + colL, ry, colM + colR, rowBal],
    [rx, ry + rowBal, colL, rowFront],
    [rx + colL, ry + rowBal, hasLiving ? colM * 0.55 : colM, rowFront],
    [rx + rw - colR, ry + rowBal, colR, rowFront],
    [rx, ry + rowBal + rowFront, colL, rowMid],
    [rx + rw - colR, ry + rowBal + rowFront, colR, rowMid],
    [rx, ry + rowBal + rowFront + rowMid, colL, rowRear],
    [rx + rw - colR * 0.72, ry + rowBal + rowFront + rowMid, colR * 0.72, rowRear],
  ];
  if (hasLiving) rooms.push([rx + colL + colM * 0.55, ry + rowBal, colM * 0.45, rowFront]);
  if (baths === 3) rooms.push([rx + colL + colM * 0.35, ry + rowBal + rowFront + rowMid, colM * 0.28, rowRear * 0.7]);

  rooms.forEach(([ax, ay, aw, ah]) => {
    ctx.strokeRect(ax, ay, aw, ah);
  });
  ctx.fillStyle = '#8b6a3e';
  ctx.globalAlpha = 0.5;
  ctx.fillRect(rx + colL, ry, colM + colR, rowBal);
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawCoresBar(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const pad = 64;
  const coreW = 118;
  const corridorH = 148;
  const eastH = (H - pad * 2 - corridorH) / 2;
  ctx.fillStyle = CORRIDOR;
  ctx.fillRect(pad + coreW, pad + eastH, W - pad * 2 - coreW * 2, corridorH);
  [
    [pad, pad],
    [W - pad - coreW, pad],
  ].forEach(([x, y]) => {
    ctx.fillStyle = CORE;
    ctx.fillRect(x, y, coreW, H - pad * 2);
    ctx.strokeStyle = WALL;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 10, y + 18, coreW - 20, 86);
    ctx.strokeRect(x + 10, y + H - pad * 2 - 104, coreW - 20, 86);
    ctx.fillStyle = '#4a453c';
    ctx.font = '700 16px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LIFT', x + coreW / 2, y + 66);
    ctx.fillText('STAIR', x + coreW / 2, y + H - pad * 2 - 56);
  });
  ctx.fillStyle = '#5c564c';
  ctx.font = '700 20px Inter, Arial, sans-serif';
  ctx.fillText('CORRIDOR  ·  2.4 m', W / 2, pad + eastH + corridorH / 2 + 7);
}

function drawCoresCross(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const pad = 70;
  const core = 420;
  const cx = (W - core) / 2;
  const cy = (H - core) / 2;
  ctx.fillStyle = CORRIDOR;
  ctx.fillRect(cx - 40, cy + 70, core + 80, core - 140);
  ctx.fillStyle = CORE;
  ctx.fillRect(cx, cy, core, core);
  ctx.strokeStyle = WALL;
  ctx.lineWidth = 5;
  ctx.strokeRect(cx + 16, cy + 16, core - 32, core - 32);
  const cell = 88;
  [
    [cx + 36, cy + 40],
    [cx + 36 + cell + 16, cy + 40],
    [cx + core - 36 - cell, cy + 40],
    [cx + 36, cy + core - 40 - cell],
    [cx + core - 36 - cell, cy + core - 40 - cell],
  ].forEach(([x, y]) => {
    ctx.strokeRect(x, y, cell, cell);
  });
  ctx.fillStyle = '#4a453c';
  ctx.font = '700 22px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LIFT  ·  STAIR  CORE', W / 2, cy + core / 2 + 8);
  ctx.font = '600 16px Inter, Arial, sans-serif';
  ctx.fillText('TYPICAL CROSS PLATE', W / 2, cy + core / 2 + 32);
}

export function drawTypicalFloor(
  ctx: CanvasRenderingContext2D,
  flats: PlateFlat[],
  selectedId: string | null,
  statuses: Record<string, string> = {},
  shape: PlateShape = 'bar',
) {
  const { W, H, frames } = unitFrames(flats, shape);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = WALL;
  ctx.lineWidth = 10;
  ctx.strokeRect(18, 18, W - 36, H - 36);

  if (shape === 'cross') drawCoresCross(ctx, W, H);
  else drawCoresBar(ctx, W, H);

  frames.forEach(({ x, y, w, h, flat }) => {
    const sel = flat.id === selectedId;
    const east = Number(flat.flatNo) <= 5;
    ctx.fillStyle = sel ? '#d7e4f2' : sftFill(flat.sqft);
    ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
    ctx.strokeStyle = sel ? '#1e3a5f' : WALL;
    ctx.lineWidth = sel ? 8 : 3.5;
    ctx.strokeRect(x + 5, y + 5, w - 10, h - 10);
    drawMiniRooms(ctx, x, y, w, h, flat.sqft, east);

    const ink = sel ? '#102033' : sftInk(flat.sqft);
    ctx.fillStyle = ink;
    ctx.textAlign = 'left';
    const fs = Math.min(52, Math.max(28, w * 0.16));
    ctx.font = `700 ${fs}px Inter, Arial, sans-serif`;
    const ty = east ? y + h - 76 : y + 58;
    ctx.fillText(flat.flatNo, x + 16, ty);
    ctx.font = '700 18px Inter, Arial, sans-serif';
    ctx.fillText(`${flat.bhk} BHK  ·  ${flat.sqft} SFT`, x + 16, ty + 28);
    ctx.font = '600 14px Inter, Arial, sans-serif';
    ctx.fillStyle = sel ? '#1e3a5f' : '#5a5348';
    ctx.fillText(flat.facing.toUpperCase(), x + 16, ty + 48);

    const st = statuses[flat.id] ?? flat.status ?? 'available';
    ctx.beginPath();
    ctx.fillStyle = STATUS_DOT[st] ?? '#888';
    ctx.arc(x + w - 26, east ? y + h - 26 : y + 26, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  ctx.fillStyle = '#6a6358';
  ctx.font = '600 17px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    shape === 'cross'
      ? 'TYPICAL CROSS FLOOR  ·  UNITS COLOURED BY SFT  ·  1265  ·  1415  ·  1585  ·  1825'
      : 'TYPICAL LINEAR FLOOR  ·  UNITS COLOURED BY SFT  ·  1265  ·  1415  ·  1585  ·  1825',
    W / 2,
    H - 26,
  );
}

export function makeFloorCanvas(
  flats: PlateFlat[],
  selectedId: string | null,
  statuses: Record<string, string> = {},
  shape: PlateShape = 'bar',
) {
  const { W, H } = unitFrames(flats, shape);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  drawTypicalFloor(canvas.getContext('2d')!, flats, selectedId, statuses, shape);
  return { canvas, width: W, height: H };
}
