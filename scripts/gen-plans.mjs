// Typical floor plate for RAMKY ONE GENEXT: double-loaded corridor, 10 units (01–05 east face, 06–10 west face).
// Used by the 2D plan viewer AND rasterised as the top-face texture of the 3D floor cut-away, so styles are embedded.
import { writeFileSync, mkdirSync } from 'node:fs';

const W = 1600, H = 1000, UW = 300, UH = 400;
const units = [];
for (let i = 0; i < 5; i++) units.push({ no: String(i + 1).padStart(2, '0'), x: 50 + i * UW, y: 40, side: 'EAST', bhk: [2, 3, 2, 3, 2][i] });
for (let i = 0; i < 5; i++) units.push({ no: String(i + 6).padStart(2, '0'), x: 50 + i * UW, y: 560, side: 'WEST', bhk: [3, 2, 3, 2, 3][i] });

function furniture(x, y, flip) {
  const f = flip ? (v) => UH - v : (v) => v; // mirror vertically for the west row so balconies face outwards
  return `
  <g transform="translate(${x},${y})" class="fur">
    <rect x="18" y="${f(18) - (flip ? 130 : 0)}" width="120" height="130" rx="3"/><rect x="34" y="${f(30) - (flip ? 70 : 0)}" width="88" height="70" rx="6"/>
    <rect x="150" y="${f(18) - (flip ? 170 : 0)}" width="132" height="170" rx="3"/><rect x="168" y="${f(120) - (flip ? 34 : 0)}" width="96" height="34" rx="8"/><circle cx="215" cy="${f(70)}" r="18"/>
    <rect x="18" y="${f(160) - (flip ? 100 : 0)}" width="120" height="100" rx="3"/><rect x="24" y="${f(166) - (flip ? 18 : 0)}" width="108" height="18"/>
    <rect x="150" y="${f(200) - (flip ? 70 : 0)}" width="132" height="70" rx="3"/><rect x="180" y="${f(215) - (flip ? 36 : 0)}" width="72" height="36" rx="4"/>
    <rect x="18" y="${f(272) - (flip ? 60 : 0)}" width="60" height="60" rx="3"/><circle cx="48" cy="${f(302)}" r="10"/>
    <rect x="18" y="${f(345) - (flip ? 40 : 0)}" width="264" height="40" rx="3" stroke-dasharray="6 4"/>
  </g>`;
}

const svg = `<svg class="plan-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <style>
    .flat { fill: #1c1c1c; stroke: #5a5a5a; stroke-width: 2.5; cursor: pointer; }
    .flat.selected { fill: url(#hatch); stroke: #3b82f6; stroke-width: 4; }
    .flat-label { fill: #a3a3a3; font: 700 20px Inter, Arial, sans-serif; pointer-events: none; }
    .fur rect, .fur circle { fill: none; stroke: #6e6e6e; stroke-width: 1.6; }
    .dims { stroke: #3b82f6; stroke-width: 1.2; fill: #3b82f6; font: 12px Inter, Arial, sans-serif; }
    .core { fill: #181818; stroke: #5a5a5a; stroke-width: 2; }
    .hidden-layer { display: none; }
    .corridor { fill: #232323; }
    .t { fill: #7a7a7a; font: 700 11px Inter, Arial, sans-serif; text-anchor: middle; }
  </style>
  <defs>
    <pattern id="hatch" width="12" height="12" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
      <rect width="12" height="12" fill="#3b82f6" fill-opacity="0.2"/><line x1="0" y1="0" x2="0" y2="12" stroke="#3b82f6" stroke-width="3"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="#0f0f0f"/>
  <rect class="corridor" x="50" y="440" width="1500" height="120"/>
  ${units.map((u) => `<rect class="flat" id="flat-${u.no}" x="${u.x}" y="${u.y}" width="${UW}" height="${UH}"/>`).join('\n  ')}
  <g id="furniture">${units.map((u) => furniture(u.x, u.y, u.side === 'WEST')).join('')}</g>
  ${units.map((u) => `<text class="flat-label" x="${u.x + 14}" y="${u.side === 'EAST' ? u.y + UH - 14 : u.y + 30}">${u.no} · ${u.bhk} BHK · ${u.side}</text>
  <circle id="status-${u.no}" cx="${u.x + UW - 20}" cy="${u.side === 'EAST' ? u.y + UH - 20 : u.y + 20}" r="8" fill="#22c55e" stroke="#0f0f0f" stroke-width="2"/>`).join('\n  ')}
  <!-- lift + stair cores at both ends -->
  <g class="core">
    <rect x="50" y="440" width="120" height="120"/><rect x="60" y="450" width="45" height="45" /><rect x="115" y="450" width="45" height="45"/><path d="M60 510h100M60 522h100M60 534h100M60 546h100"/>
    <rect x="1430" y="440" width="120" height="120"/><rect x="1440" y="450" width="45" height="45"/><rect x="1495" y="450" width="45" height="45"/><path d="M1440 510h100M1440 522h100M1440 534h100M1440 546h100"/>
  </g>
  <text class="t" x="110" y="586">LIFT LOBBY A</text><text class="t" x="1490" y="586">LIFT LOBBY B</text><text class="t" x="800" y="504">CORRIDOR · 2.4 m</text>
  <g id="dimensions" class="dims">
    <line x1="50" y1="24" x2="1550" y2="24"/><text x="800" y="18" text-anchor="middle">78.9 m (259')</text>
    <line x1="24" y1="40" x2="24" y2="960"/><text x="14" y="500" text-anchor="middle" transform="rotate(-90 14 500)">48.8 m (160')</text>
  </g>
  <g id="vastu" class="hidden-layer" opacity="0.32">
    <rect x="950" y="40" width="600" height="400" fill="#38bdf8"/><text x="1250" y="240" text-anchor="middle" fill="#fff" font-size="18" font-weight="700">NE · WATER</text>
    <rect x="950" y="560" width="600" height="400" fill="#fb923c"/><text x="1250" y="760" text-anchor="middle" fill="#fff" font-size="18" font-weight="700">SE · FIRE</text>
    <rect x="50" y="560" width="600" height="400" fill="#a3e635"/><text x="350" y="760" text-anchor="middle" fill="#fff" font-size="18" font-weight="700">SW · EARTH</text>
    <rect x="50" y="40" width="600" height="400" fill="#c084fc"/><text x="350" y="240" text-anchor="middle" fill="#fff" font-size="18" font-weight="700">NW · AIR</text>
  </g>
  <g transform="translate(1520,930)"><circle r="24" fill="#0f0f0f" stroke="#3b82f6" stroke-width="1.5"/><path d="M0 -18 L8 7 L0 2 L-8 7 Z" fill="#3b82f6"/><text y="-28" text-anchor="middle" fill="#3b82f6" font-size="12" font-weight="700">N</text></g>
  <text x="800" y="990" text-anchor="middle" fill="#5a5a5a" font-size="11" letter-spacing="3">RAMKY ONE GENEXT · TYPICAL FLOOR · 10 UNITS · NOT TO SCALE</text>
</svg>`;
mkdirSync(new URL('../public/plans/', import.meta.url), { recursive: true });
writeFileSync(new URL('../public/plans/typical-floor.svg', import.meta.url), svg);
console.log('wrote public/plans/typical-floor.svg');
