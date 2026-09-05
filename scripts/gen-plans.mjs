// Orion unit plans — one SVG per SFT, room topology matches lib/apartments.ts SPECS.
import { writeFileSync, mkdirSync } from 'node:fs';

const SFT_COLOR = { 1265: '#8eb9cc', 1415: '#e4d3b0', 1585: '#e08a4a', 1825: '#c9a227' };
const TYPE = { 1265: 'Type 1 / 2 · 3 BHK + 2T', 1415: 'Type 3 / 4 · 3 BHK + 2T', 1585: 'Type 5 / 6 · 3 BHK + 3T', 1825: 'Type 7 / 8 · 3 BHK + 3T' };

const SPECS = {
  1265: {
    bed2: [10, 10], bed3: [8.17, 10], bed3Label: 'Study / Bedroom 3', master: [10.92, 12.33],
    drawing: [10.5, 11], dining: [12.17, 11], living: null, kitchen: [8.75, 8],
    t1: [5, 8.5], t2: [6.5, 6.5], t3: null, sitOut: 5, utility: 4,
  },
  1415: {
    bed2: [11, 10], bed3: [10, 10], bed3Label: 'Bedroom 3', master: [13, 12.33],
    drawing: [11.5, 10.5], dining: [15.5, 10.5], living: null, kitchen: [10, 8],
    t1: [5, 8.5], t2: [7, 5], t3: null, sitOut: 5, utility: 4,
  },
  1585: {
    bed2: [10.17, 12], bed3: [10, 12], bed3Label: 'Bedroom 3', master: [13.75, 12.33],
    drawing: [11.5, 11], dining: [16.08, 11], living: null, kitchen: [11, 8.17],
    t1: [5, 8.5], t2: [4.5, 8], t3: [4.5, 8], sitOut: 6, utility: 4,
  },
  1825: {
    bed2: [11.17, 12], bed3: [11, 12], bed3Label: 'Bedroom 3', master: [16.17, 13.33],
    drawing: [11.5, 12], dining: [16.08, 10.33], living: [8.67, 12], kitchen: [11, 8.5],
    t1: [5.67, 9], t2: [5, 8], t3: [5, 8], sitOut: 6, utility: 4.5,
  },
};

const PASSAGE = 4.5;
const FOYER = 5.5;
const PX = 20;

const inches = (v) => {
  const whole = Math.floor(v + 1e-6);
  const rem = Math.round((v - whole) * 12);
  return rem === 12 ? `${whole + 1}'0"` : `${whole}'${rem}"`;
};
const dim = (b) => `${inches(b[0])} × ${inches(b[1])}`;

function layout(sqft) {
  const s = SPECS[sqft];
  const colL = Math.max(s.bed2[0], s.bed3[0], s.t2[0]);
  const colM = Math.max(s.drawing[0] + (s.living ? s.living[0] : 0), s.t1[0] + FOYER, PASSAGE + 1);
  const colR = Math.max(s.dining[0], s.kitchen[0] + s.utility, s.master[0] + (s.t3 ? s.t3[0] : 0));
  const W = colL + colM + colR;
  const rowBal = s.sitOut;
  const rowFront = Math.max(s.bed2[1], s.drawing[1], s.dining[1], s.living ? s.living[1] : 0);
  const rowMid = Math.max(s.t2[1], s.kitchen[1], PASSAGE);
  const rowRear = Math.max(s.bed3[1], s.master[1], s.t1[1]);
  const D = rowBal + rowFront + rowMid + rowRear;
  const xL = 0, xM = colL, xR = colL + colM;
  const zBal = 0, zFront = rowBal, zMid = zFront + rowFront, zRear = zMid + rowMid;
  const rooms = [];
  const add = (key, room, label, fx, fz, box, fill) => {
    rooms.push({ key, room, label, dim: dim(box), x: fx, z: fz, w: box[0], d: box[1], fill });
  };
  add('sitout', 'balcony', 'Sit-out', xM, zBal, [colM + colR, rowBal], '#8a6840');
  add('bed2', 'bedroom', 'Bedroom 2', xL, zFront, s.bed2, '#efece4');
  add('drawing', 'living', 'Drawing Room', xM, zFront, s.drawing, '#f3f0e8');
  if (s.living) add('living', 'living', 'Living', xM + s.drawing[0], zFront, s.living, '#f3f0e8');
  add('dining', 'dining', 'Dining', W - s.dining[0], zFront, s.dining, '#f3f0e8');
  add('t2', 'bedroom', s.t3 ? 'Toilet 2' : 'C. Toilet', xL, zMid, s.t2, '#e4e0da');
  add('passage', 'living', 'Passage', xM, zMid, [colM, rowMid], '#f6f3ec');
  add('kitchen', 'kitchen', 'Kitchen', W - s.kitchen[0], zMid, s.kitchen, '#eeebe3');
  add('utility', 'kitchen', 'Utility', xR, zMid, [s.utility, s.kitchen[1]], '#e7e3dc');
  add('bed3', 'bedroom', s.bed3Label, xL, zRear, s.bed3, '#efece4');
  add('t1', 'bedroom', 'Toilet 1', xM, zRear + rowRear - s.t1[1], s.t1, '#e4e0da');
  const masterX = W - s.master[0];
  if (s.t3) add('t3', 'bedroom', 'Toilet 3', masterX - s.t3[0], zRear, s.t3, '#e4e0da');
  const foyerX = xM + s.t1[0];
  const foyerW = (s.t3 ? masterX - s.t3[0] : masterX) - foyerX;
  add('foyer', 'living', 'Foyer', foyerX, zRear, [Math.max(foyerW, 3), rowRear], '#f6f3ec');
  add('master', 'bedroom', 'Master Bedroom', masterX, zRear, s.master, '#efece4');
  return { W, D, rooms, type: TYPE[sqft] };
}

function furniture(r) {
  const { x, z, w, d, key } = r;
  const cx = x + w / 2;
  const cz = z + d / 2;
  if (key === 'sitout') {
    return `<rect x="${x + 8}" y="${z + 6}" width="${Math.min(28, w * 0.18)}" height="${d - 12}" rx="4" fill="#d7b07a" stroke="#5c4324" stroke-width="1.2"/>
      <rect x="${x + w - 36}" y="${z + 6}" width="${Math.min(28, w * 0.18)}" height="${d - 12}" rx="4" fill="#d7b07a" stroke="#5c4324" stroke-width="1.2"/>`;
  }
  if (key === 'drawing' || key === 'living') {
    return `<rect x="${x + 8}" y="${z + 12}" width="${Math.min(w * 0.4, 88)}" height="22" rx="5" fill="#cfc6b4" stroke="#6a6254" stroke-width="1.1"/>
      <rect x="${x + 8}" y="${z + 36}" width="22" height="${Math.max(d - 52, 28)}" rx="5" fill="#cfc6b4" stroke="#6a6254" stroke-width="1.1"/>
      <rect x="${x + 36}" y="${z + 40}" width="28" height="20" rx="3" fill="#b7aa94"/>
      <rect x="${x + w - 20}" y="${cz - 24}" width="8" height="48" rx="1" fill="#3a3530"/>`;
  }
  if (key === 'dining') {
    return `<rect x="${cx - 38}" y="${cz - 18}" width="76" height="36" rx="3" fill="#c4a46a" stroke="#5c4a2a" stroke-width="1.2"/>
      <circle cx="${cx - 28}" cy="${cz - 26}" r="5" fill="#d8c4a0"/><circle cx="${cx + 28}" cy="${cz - 26}" r="5" fill="#d8c4a0"/>
      <circle cx="${cx - 28}" cy="${cz + 26}" r="5" fill="#d8c4a0"/><circle cx="${cx + 28}" cy="${cz + 26}" r="5" fill="#d8c4a0"/>`;
  }
  if (key === 'kitchen') {
    return `<rect x="${x + 4}" y="${z + 4}" width="${w - 8}" height="14" rx="1" fill="#9aa39a"/>
      <rect x="${x + w - 16}" y="${z + 4}" width="12" height="${d - 8}" rx="1" fill="#9aa39a"/>`;
  }
  if (key === 'master' || key === 'bed2' || key === 'bed3') {
    const bw = Math.min(w * 0.52, 72);
    return `<rect x="${x + 12}" y="${cz - 24}" width="${bw}" height="48" rx="5" fill="#e8eef4" stroke="#5a6570" stroke-width="1.1"/>
      <rect x="${x + 16}" y="${cz - 28}" width="${bw * 0.38}" height="14" rx="4" fill="#f4f1ea"/>
      <rect x="${x + 16 + bw * 0.4}" y="${cz - 28}" width="${bw * 0.38}" height="14" rx="4" fill="#f4f1ea"/>
      <rect x="${x + 14}" y="${cz + 6}" width="${bw - 4}" height="10" rx="2" fill="#c4a057" opacity="0.75"/>
      <rect x="${x + w - 16}" y="${z + 8}" width="10" height="${d - 16}" rx="1" fill="#8a6d45"/>
      <rect x="${x + w - 14}" y="${z + 12}" width="2" height="${d - 24}" fill="#5c4a2e"/>`;
  }
  if (key.startsWith('t')) {
    return `<circle cx="${x + 14}" cy="${z + 16}" r="7" fill="none" stroke="#6a6660" stroke-width="1.4"/>
      <rect x="${x + w - 22}" y="${z + d - 18}" width="14" height="10" rx="2" fill="none" stroke="#6a6660" stroke-width="1.4"/>`;
  }
  if (key === 'utility') return `<rect x="${x + 4}" y="${z + 6}" width="16" height="12" rx="1" fill="none" stroke="#6a6660" stroke-width="1.3"/>`;
  return '';
}

function apartmentPlan(sqft) {
  const { W, D, rooms, type } = layout(sqft);
  const pad = 70;
  const VW = W * PX + pad * 2;
  const VH = D * PX + pad * 2 + 36;
  const toX = (ft) => pad + ft * PX;
  const toY = (ft) => pad + ft * PX;
  const fill = SFT_COLOR[sqft];
  const roomRects = rooms.map((r) => {
    const x = toX(r.x), y = toY(r.z), w = r.w * PX, h = r.d * PX;
    const clickable = ['sitout', 'bed2', 'drawing', 'living', 'dining', 'kitchen', 'master', 'bed3'].includes(r.key);
    const cls = clickable ? 'room' : 'service';
    const data = clickable ? ` data-room="${r.room}" data-space="${r.key}"` : '';
    return `<rect class="${cls}" id="space-${r.key}"${data} x="${x}" y="${y}" width="${w}" height="${h}" fill="${r.fill}"/>
      <text class="label" x="${x + w / 2}" y="${y + h / 2 - 6}">${r.label.toUpperCase()}</text>`;
  }).join('\n  ');
  const furnitureLayer = rooms.map((r) => furniture({ ...r, x: toX(r.x), z: toY(r.z), w: r.w * PX, d: r.d * PX, key: r.key })).join('\n  ');
  const dimLayer = rooms.map((r) => {
    const x = toX(r.x), y = toY(r.z), w = r.w * PX, h = r.d * PX;
    return `<text class="dim" x="${x + w / 2}" y="${y + h / 2 + 12}">${r.dim}</text>`;
  }).join('\n  ');

  return `<svg class="apartment-plan" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" width="${VW}" height="${VH}">
  <style>
    .shell{fill:#f4f1e9;stroke:#2b2924;stroke-width:10}
    .room{stroke:#2f2c28;stroke-width:3.5;cursor:pointer;pointer-events:all}
    .room:hover,.room.selected{stroke:#c4a057;stroke-width:7}
    .service{stroke:#2f2c28;stroke-width:3;pointer-events:none}
    .label{fill:#2b2924;font:700 13px Inter,Arial,sans-serif;text-anchor:middle;pointer-events:none}
    .dim{fill:#6a6358;font:600 11px Inter,Arial,sans-serif;text-anchor:middle;pointer-events:none}
    .head{fill:#1e3a5f;font:700 22px Inter,Arial,sans-serif}
    .sub{fill:#6a6358;font:600 12px Inter,Arial,sans-serif}
    .north{fill:#c4a057;font:700 14px Inter,Arial,sans-serif;text-anchor:middle}
    .fur{pointer-events:none}
    .hidden-layer{display:none}
  </style>
  <rect width="${VW}" height="${VH}" fill="#f7f3ea"/>
  <rect x="24" y="16" width="8" height="28" fill="${fill}"/>
  <text class="head" x="42" y="38">UNIT PLAN  ·  ${sqft} SFT</text>
  <text class="sub" x="42" y="56">${type}  ·  EAST FACING  ·  TAP A ROOM TO ENTER 360°</text>
  <rect class="shell" x="${pad - 8}" y="${pad - 8}" width="${W * PX + 16}" height="${D * PX + 16}" rx="2"/>
  ${roomRects}
  <g id="furniture">${furnitureLayer}</g>
  <g id="dimensions">${dimLayer}</g>
  <g id="vastu" class="hidden-layer" opacity="0.22">
    <rect x="${pad}" y="${pad}" width="${W * PX * 0.5}" height="${D * PX * 0.5}" fill="#38bdf8"/>
    <rect x="${pad + W * PX * 0.5}" y="${pad}" width="${W * PX * 0.5}" height="${D * PX * 0.5}" fill="#c084fc"/>
    <rect x="${pad}" y="${pad + D * PX * 0.5}" width="${W * PX * 0.5}" height="${D * PX * 0.5}" fill="#a3e635"/>
    <rect x="${pad + W * PX * 0.5}" y="${pad + D * PX * 0.5}" width="${W * PX * 0.5}" height="${D * PX * 0.5}" fill="#fb923c"/>
  </g>
  <g transform="translate(${VW - 70},${VH - 48})">
    <circle r="18" fill="#1e3a5f"/><path d="M0 -12 L6 6 L0 2 L-6 6 Z" fill="#c4a057"/>
    <text class="north" y="32">N</text>
  </g>
  <text class="sub" x="${VW / 2}" y="${VH - 14}" text-anchor="middle">RAMKY ONE ORION  ·  ${sqft} SFT  ·  ${type}</text>
</svg>`;
}

function typicalFloor() {
  const units = [
    { no: '01', sqft: 1585 }, { no: '02', sqft: 1415 }, { no: '03', sqft: 1265 }, { no: '04', sqft: 1415 }, { no: '05', sqft: 1585 },
    { no: '06', sqft: 1585 }, { no: '07', sqft: 1415 }, { no: '08', sqft: 1265 }, { no: '09', sqft: 1415 }, { no: '10', sqft: 1825 },
  ];
  const W = 2000, H = 1100, pad = 70, coreW = 120, corridorH = 140;
  const weights = units.slice(0, 5).map((u) => u.sqft);
  const sum = weights.reduce((a, b) => a + b, 0);
  const inner = W - pad * 2 - coreW * 2;
  const eastH = (H - pad * 2 - corridorH) / 2;
  const row = (list, y) => {
    let x = pad + coreW;
    return list.map((u) => {
      const w = (u.sqft / sum) * inner;
      const box = { ...u, x, y, w, h: eastH };
      x += w;
      return box;
    });
  };
  const frames = [...row(units.slice(0, 5), pad), ...row(units.slice(5), pad + eastH + corridorH)];
  const cells = frames.map((u) => {
    const east = Number(u.no) <= 5;
    return `<rect class="flat" id="flat-${u.no}" x="${u.x + 3}" y="${u.y + 3}" width="${u.w - 6}" height="${u.h - 6}" fill="${SFT_COLOR[u.sqft]}" stroke="#2b2924" stroke-width="3"/>
      <text class="flat-label" x="${u.x + 16}" y="${east ? u.y + u.h - 48 : u.y + 36}" fill="#2b2924">${u.no}</text>
      <text class="flat-label" x="${u.x + 16}" y="${east ? u.y + u.h - 24 : u.y + 58}" fill="#5a5348" font-size="14">3 BHK · ${u.sqft} SFT</text>
      <circle id="status-${u.no}" cx="${u.x + u.w - 22}" cy="${east ? u.y + u.h - 22 : u.y + 22}" r="8" fill="#3d8f62" stroke="#fff" stroke-width="2"/>`;
  }).join('\n  ');
  return `<svg class="plan-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#f3efe6"/>
  <rect x="${pad + coreW}" y="${pad + eastH}" width="${inner}" height="${corridorH}" fill="#d9d3c7"/>
  <rect x="${pad}" y="${pad}" width="${coreW}" height="${H - pad * 2}" fill="#c6bfb2"/>
  <rect x="${W - pad - coreW}" y="${pad}" width="${coreW}" height="${H - pad * 2}" fill="#c6bfb2"/>
  ${cells}
  <text x="${W / 2}" y="${H - 24}" text-anchor="middle" fill="#6a6358" font-size="16" font-family="Inter,Arial">TYPICAL FLOOR · UNITS COLOURED BY SFT</text>
</svg>`;
}

mkdirSync(new URL('../public/plans/', import.meta.url), { recursive: true });
writeFileSync(new URL('../public/plans/typical-floor.svg', import.meta.url), typicalFloor());
for (const sqft of [1265, 1415, 1585, 1825]) {
  writeFileSync(new URL(`../public/plans/orion-${sqft}.svg`, import.meta.url), apartmentPlan(sqft));
}
console.log('wrote typical floor and four Orion apartment plans');
