/**
 * Parametric unit-plan engine.
 *
 * Room dimensions are the printed dimensions from the Ramky One Orion unit plans
 * (1265 / 1415 / 1585 / 1825 SFT). The grid solver below packs those rooms into a
 * canonical 3-column x 4-row topology, so every variant keeps the same circulation
 * (sit-out -> drawing/dining -> passage -> bedrooms) while the geometry is driven
 * purely by the real SFT schedule.
 */
import type { RoomId } from './types';

const FOOT = 0.3048;
export const ft = (v: number) => v * FOOT;

export type Side = 'n' | 's' | 'e' | 'w';
export type Finish = 'vitrified' | 'wood' | 'ceramic' | 'deck' | 'granite';
export type Fitting =
  | 'bed-king'
  | 'bed-queen'
  | 'wardrobe'
  | 'study'
  | 'sofa'
  | 'tv'
  | 'dining'
  | 'kitchen'
  | 'bath'
  | 'sit-out'
  | 'foyer'
  | 'washer';

export interface Space {
  key: string;
  room: RoomId;
  label: string;
  short: string;
  /** metres, top-left corner. +x = east, +z = south */
  x: number;
  z: number;
  w: number;
  d: number;
  /** printed dimension from the unit plan */
  dim: string;
  sqft: number;
  finish: Finish;
  fittings: Fitting[];
  /** exterior sides that get glazing */
  windows: Side[];
  /** full-height sliding glazing (balcony fronts) */
  sliders: Side[];
  /** sides with a doorway, and where along the side (0..1) */
  doors: { side: Side; at: number }[];
  /** wall the primary furniture backs onto */
  anchor: Side;
  height: number;
  tourable: boolean;
}

export interface UnitLayout {
  sqft: number;
  bhk: number;
  baths: number;
  typeName: string;
  width: number;
  depth: number;
  mirrored: boolean;
  spaces: Space[];
  carpet: number;
}

interface Box {
  w: number;
  d: number;
}
interface UnitSpec {
  bhk: number;
  baths: number;
  typeName: string;
  bed2: Box;
  bed3: Box;
  bed3Label: string;
  master: Box;
  drawing: Box;
  dining: Box;
  living?: Box;
  kitchen: Box;
  t1: Box;
  t2: Box;
  t3?: Box;
  sitOut: number;
  utility: number;
}

/** Dimensions in feet, transcribed from the Orion typical-floor unit plans. */
const SPECS: Record<number, UnitSpec> = {
  1265: {
    bhk: 3,
    baths: 2,
    typeName: 'Type 1 / 2',
    bed2: { w: 10, d: 10 },
    bed3: { w: 8.17, d: 10 },
    bed3Label: 'Study / Bedroom 3',
    master: { w: 10.92, d: 12.33 },
    drawing: { w: 10.5, d: 11 },
    dining: { w: 12.17, d: 11 },
    kitchen: { w: 8.75, d: 8.17 },
    t1: { w: 5, d: 8.5 },
    t2: { w: 6.5, d: 6.5 },
    sitOut: 5,
    utility: 4,
  },
  1415: {
    bhk: 3,
    baths: 2,
    typeName: 'Type 3 / 4',
    bed2: { w: 11, d: 10 },
    bed3: { w: 10, d: 10 },
    bed3Label: 'Bedroom 3',
    master: { w: 13, d: 12.33 },
    drawing: { w: 11.5, d: 10.5 },
    dining: { w: 15.5, d: 10.5 },
    kitchen: { w: 10, d: 8 },
    t1: { w: 5, d: 8.5 },
    t2: { w: 7, d: 5 },
    sitOut: 5,
    utility: 4,
  },
  1585: {
    bhk: 3,
    baths: 3,
    typeName: 'Type 5 / 6',
    bed2: { w: 10.17, d: 12 },
    bed3: { w: 10, d: 12 },
    bed3Label: 'Bedroom 3',
    master: { w: 13.75, d: 12.33 },
    drawing: { w: 11.5, d: 11 },
    dining: { w: 16.08, d: 11 },
    kitchen: { w: 11, d: 8.17 },
    t1: { w: 5, d: 8.5 },
    t2: { w: 4.5, d: 8 },
    t3: { w: 4.5, d: 8 },
    sitOut: 6,
    utility: 4,
  },
  1825: {
    bhk: 3,
    baths: 3,
    typeName: 'Type 7 / 8',
    bed2: { w: 11.17, d: 12 },
    bed3: { w: 11, d: 12 },
    bed3Label: 'Bedroom 3',
    master: { w: 16.17, d: 13.33 },
    drawing: { w: 11.5, d: 12 },
    dining: { w: 16.08, d: 10.33 },
    living: { w: 8.67, d: 12 },
    kitchen: { w: 11, d: 8.5 },
    t1: { w: 5.67, d: 9 },
    t2: { w: 5, d: 8 },
    t3: { w: 5, d: 8 },
    sitOut: 6,
    utility: 4.5,
  },
};

export const UNIT_SQFTS = Object.keys(SPECS).map(Number).sort((a, b) => a - b);

const inches = (v: number) => {
  const whole = Math.floor(v + 1e-6);
  const rem = Math.round((v - whole) * 12);
  return rem === 12 ? `${whole + 1}'0"` : `${whole}'${rem}"`;
};
const dimLabel = (b: Box) => `${inches(b.w)} × ${inches(b.d)}`;

const PASSAGE = 4.5;
const FOYER_MIN = 5.5;
const CEIL = 3.0; // 10 ft finished ceiling

/** A space still expressed in plan feet, before mirroring and metric conversion. */
interface RawSpace {
  key: string;
  room: RoomId;
  label: string;
  short: string;
  fx: number;
  fz: number;
  box: Box;
  dim?: string;
  finish: Finish;
  fittings: Fitting[];
  windows: Side[];
  sliders?: Side[];
  doors: { side: Side; at: number }[];
  anchor: Side;
  tourable?: boolean;
}

/** Build the metric layout for one unit type. `mirrored` flips west-facing units. */
export function buildUnitLayout(sqft: number, mirrored = false): UnitLayout {
  const s = SPECS[sqft] ?? SPECS[1585];

  const colL = Math.max(s.bed2.w, s.bed3.w, s.t2.w);
  const colM = Math.max(s.drawing.w + (s.living?.w ?? 0), s.t1.w + FOYER_MIN, PASSAGE + 1);
  const colR = Math.max(s.dining.w, s.kitchen.w + s.utility, s.master.w + (s.t3?.w ?? 0));
  const W = colL + colM + colR;

  const rowBal = s.sitOut;
  const rowFront = Math.max(s.bed2.d, s.drawing.d, s.dining.d, s.living?.d ?? 0);
  const rowMid = Math.max(s.t2.d, s.kitchen.d, PASSAGE);
  const rowRear = Math.max(s.bed3.d, s.master.d, s.t1.d);
  const D = rowBal + rowFront + rowMid + rowRear;

  const xL = 0;
  const xM = colL;
  const xR = colL + colM;
  const zBal = 0;
  const zFront = rowBal;
  const zMid = zFront + rowFront;
  const zRear = zMid + rowMid;

  const raw: RawSpace[] = [];

  // ---- sit-out balcony spanning the drawing/dining frontage -----------------
  raw.push({
    key: 'sitout',
    room: 'balcony',
    label: 'Sit-out Balcony',
    short: 'SIT-OUT',
    fx: xM,
    fz: zBal,
    box: { w: colM + colR, d: rowBal },
    dim: `${inches(s.sitOut)} wide deck`,
    finish: 'deck',
    fittings: ['sit-out'],
    windows: [],
    doors: [],
    anchor: 's',
  });

  // ---- front row -----------------------------------------------------------
  raw.push({
    key: 'bed2',
    room: 'bedroom',
    label: 'Bedroom 2',
    short: 'BED 2',
    fx: xL,
    fz: zFront,
    box: s.bed2,
    dim: dimLabel(s.bed2),
    finish: 'wood',
    fittings: ['bed-queen', 'wardrobe'],
    windows: ['n', 'w'],
    doors: [{ side: 's', at: 0.72 }],
    anchor: 'e',
  });
  raw.push({
    key: 'drawing',
    room: 'living',
    label: 'Drawing Room',
    short: 'DRAWING',
    fx: xM,
    fz: zFront,
    box: s.drawing,
    dim: dimLabel(s.drawing),
    finish: 'vitrified',
    fittings: ['sofa', 'tv'],
    windows: [],
    sliders: ['n'],
    doors: [{ side: 's', at: 0.5 }],
    anchor: 'e',
  });
  if (s.living) {
    raw.push({
      key: 'living',
      room: 'living',
      label: 'Living',
      short: 'LIVING',
      fx: xM + s.drawing.w,
      fz: zFront,
      box: s.living,
      dim: dimLabel(s.living),
      finish: 'vitrified',
      fittings: ['sofa'],
      windows: [],
      sliders: ['n'],
      doors: [{ side: 'w', at: 0.5 }],
      anchor: 'e',
    });
  }
  raw.push({
    key: 'dining',
    room: 'dining',
    label: 'Dining',
    short: 'DINING',
    fx: W - s.dining.w,
    fz: zFront,
    box: s.dining,
    dim: dimLabel(s.dining),
    finish: 'vitrified',
    fittings: ['dining'],
    windows: ['e'],
    sliders: ['n'],
    doors: [{ side: 's', at: 0.28 }],
    anchor: 'e',
  });

  // ---- middle row: common bath | passage | utility + kitchen ---------------
  raw.push({
    key: 't2',
    room: 'bedroom',
    label: s.t3 ? 'Toilet 2' : 'Common Toilet',
    short: s.t3 ? 'T-2' : 'C.TOILET',
    fx: xL,
    fz: zMid,
    box: s.t2,
    dim: dimLabel(s.t2),
    finish: 'ceramic',
    fittings: ['bath'],
    windows: ['w'],
    doors: [{ side: 'e', at: 0.5 }],
    anchor: 'n',
    tourable: false,
  });
  raw.push({
    key: 'passage',
    room: 'living',
    label: 'Passage',
    short: 'PASSAGE',
    fx: xM,
    fz: zMid,
    box: { w: colM, d: rowMid },
    dim: `${inches(PASSAGE)} wide`,
    finish: 'vitrified',
    fittings: [],
    windows: [],
    doors: [],
    anchor: 'n',
    tourable: false,
  });
  raw.push({
    key: 'kitchen',
    room: 'kitchen',
    label: 'Kitchen',
    short: 'KITCHEN',
    fx: W - s.kitchen.w,
    fz: zMid,
    box: s.kitchen,
    dim: dimLabel(s.kitchen),
    finish: 'vitrified',
    fittings: ['kitchen'],
    windows: ['e'],
    doors: [{ side: 'w', at: 0.3 }],
    anchor: 'e',
  });
  const utilityRoom = W - s.kitchen.w - xR >= s.utility - 0.01;
  if (utilityRoom) {
    raw.push({
      key: 'utility',
      room: 'kitchen',
      label: 'Utility',
      short: 'UTILITY',
      fx: xR,
      fz: zMid,
      box: { w: s.utility, d: s.kitchen.d },
      dim: `${inches(s.utility)} wide`,
      finish: 'ceramic',
      fittings: ['washer'],
      windows: ['n'],
      doors: [{ side: 'e', at: 0.5 }],
      anchor: 'n',
      tourable: false,
    });
  }

  // ---- rear row: bedroom 3 | toilet 1 + foyer | toilet 3 + master ----------
  raw.push({
    key: 'bed3',
    room: 'bedroom',
    label: s.bed3Label,
    short: s.bed3Label.startsWith('Study') ? 'STUDY' : 'BED 3',
    fx: xL,
    fz: zRear,
    box: s.bed3,
    dim: dimLabel(s.bed3),
    finish: 'wood',
    fittings: s.bed3Label.startsWith('Study') ? ['study', 'wardrobe'] : ['bed-queen', 'wardrobe'],
    windows: ['w', 's'],
    doors: [{ side: 'n', at: 0.75 }],
    anchor: 'e',
  });
  raw.push({
    key: 't1',
    room: 'bedroom',
    label: 'Toilet 1',
    short: 'T-1',
    fx: xM,
    fz: zRear + rowRear - s.t1.d,
    box: s.t1,
    dim: dimLabel(s.t1),
    finish: 'ceramic',
    fittings: ['bath'],
    windows: [],
    doors: [{ side: 'e', at: 0.5 }],
    anchor: 'n',
    tourable: false,
  });

  const masterX = W - s.master.w;
  if (s.t3) {
    raw.push({
      key: 't3',
      room: 'bedroom',
      label: 'Toilet 3',
      short: 'T-3',
      fx: masterX - s.t3.w,
      fz: zRear,
      box: s.t3,
      dim: dimLabel(s.t3),
      finish: 'ceramic',
      fittings: ['bath'],
      windows: [],
      doors: [{ side: 'e', at: 0.5 }],
      anchor: 'n',
      tourable: false,
    });
  }
  const foyerX = xM + s.t1.w;
  const foyerW = (s.t3 ? masterX - s.t3.w : masterX) - foyerX;
  raw.push({
    key: 'foyer',
    room: 'living',
    label: 'Foyer',
    short: 'FOYER',
    fx: foyerX,
    fz: zRear,
    box: { w: Math.max(foyerW, FOYER_MIN * 0.6), d: rowRear },
    dim: 'Entry',
    finish: 'vitrified',
    fittings: ['foyer'],
    windows: [],
    doors: [{ side: 's', at: 0.5 }],
    anchor: 'n',
    tourable: false,
  });
  raw.push({
    key: 'master',
    room: 'bedroom',
    label: 'Master Bedroom',
    short: 'MASTER',
    fx: masterX,
    fz: zRear,
    box: s.master,
    dim: dimLabel(s.master),
    finish: 'wood',
    fittings: ['bed-king', 'wardrobe', 'tv'],
    windows: ['e', 's'],
    doors: [{ side: 'n', at: 0.2 }],
    anchor: 'w',
  });

  const flip: Record<Side, Side> = { n: 'n', s: 's', e: 'w', w: 'e' };
  const spaces: Space[] = raw.map((r) => {
    const fx = mirrored ? W - r.fx - r.box.w : r.fx;
    const mapSide = (side: Side) => (mirrored ? flip[side] : side);
    return {
      key: r.key,
      room: r.room,
      label: r.label,
      short: r.short,
      x: ft(fx),
      z: ft(r.fz),
      w: ft(r.box.w),
      d: ft(r.box.d),
      dim: r.dim ?? dimLabel(r.box),
      sqft: Math.round(r.box.w * r.box.d),
      finish: r.finish,
      fittings: r.fittings,
      windows: r.windows.map(mapSide),
      sliders: (r.sliders ?? []).map(mapSide),
      doors: r.doors.map((dr) => ({ side: mapSide(dr.side), at: mirrored && (dr.side === 'n' || dr.side === 's') ? 1 - dr.at : dr.at })),
      anchor: mapSide(r.anchor),
      height: CEIL,
      tourable: r.tourable ?? true,
    };
  });

  return {
    sqft,
    bhk: s.bhk,
    baths: s.baths,
    typeName: s.typeName,
    width: ft(W),
    depth: ft(D),
    mirrored,
    spaces,
    carpet: spaces.reduce((sum, sp) => sum + sp.sqft, 0),
  };
}

/** Spaces a buyer can step into, in walkthrough order. */
export const tourSpaces = (layout: UnitLayout) => layout.spaces.filter((s) => s.tourable);

/**
 * Where the buyer stands in a room and which way they face.
 *
 * They stand near the wall opposite the furniture and look back at it, so the
 * bed / sofa / kitchen run is framed on arrival instead of a blank wall. In
 * shallow spaces like the sit-out there is no room to step back, so they stand
 * centred and look along the length instead.
 */
export function viewpoint(space: Space, eye = 1.58): { position: [number, number, number]; yaw: number } {
  const cx = space.x + space.w / 2;
  const cz = space.z + space.d / 2;
  const alongZ = space.anchor === 'n' || space.anchor === 's';
  const span = alongZ ? space.d : space.w;

  // camera looks down -Z by default, so rotateY(theta) aims it at (-sin, 0, -cos)
  const yawTo = (dx: number, dz: number) => Math.atan2(-dx, -dz);
  const facing: Record<Side, number> = { n: 0, s: Math.PI, w: Math.PI / 2, e: -Math.PI / 2 };

  // A balcony's whole point is the view out, so face over the open edge.
  if (space.room === 'balcony') {
    return { position: [cx, eye, cz], yaw: facing[outwardSide(space)] };
  }

  // inward normal from the furniture wall, plus the lateral axis along it
  const inward: Record<Side, [number, number]> = { n: [0, 1], s: [0, -1], e: [-1, 0], w: [1, 0] };
  const [nx, nz] = inward[space.anchor];
  const wallX = space.anchor === 'e' ? space.x + space.w : space.x;
  const wallZ = space.anchor === 's' ? space.z + space.d : space.z;
  const anchorCentre: [number, number] = alongZ ? [cx, wallZ] : [wallX, cz];
  const lateralSpan = alongZ ? space.w : space.d;

  const dist = Math.min(Math.max(span - 0.7, 1.7), 5.2);
  // stand a little off the room's axis: a three-quarter view reads far better
  // than a symmetrical head-on shot of the bed or sofa
  const lat = Math.min(lateralSpan * 0.17, Math.max(0, lateralSpan / 2 - 0.75));
  const [lx, lz] = alongZ ? [1, 0] : [0, 1];

  const px = anchorCentre[0] + nx * dist + lx * lat;
  const pz = anchorCentre[1] + nz * dist + lz * lat;
  // aim just in front of the furniture wall, on the room's centre line
  const tx = anchorCentre[0] + nx * 0.6;
  const tz = anchorCentre[1] + nz * 0.6;
  return { position: [px, eye, pz], yaw: yawTo(tx - px, tz - pz) };
}

/** The open edge of a balcony: the side facing away from the flat. */
export function outwardSide(space: Space): Side {
  const opposite: Record<Side, Side> = { n: 's', s: 'n', e: 'w', w: 'e' };
  return opposite[space.anchor];
}

/** Floor position of a room's tour marker. */
export const station = (space: Space, y = 0.06): [number, number, number] => {
  const [x, , z] = viewpoint(space).position;
  return [x, y, z];
};

export const spaceForRoom = (layout: UnitLayout, room: RoomId) =>
  tourSpaces(layout).find((s) => s.room === room) ?? tourSpaces(layout)[0];
