/** Official Orion unit-plan colours — one tint per SFT, used on the site, floor plate and 2D plans. */
export const SFT_COLOR: Record<number, string> = {
  1265: '#8eb9cc',
  1415: '#e4d3b0',
  1585: '#e08a4a',
  1825: '#c9a227',
};

export const SFT_INK: Record<number, string> = {
  1265: '#1d3a48',
  1415: '#4a3d22',
  1585: '#4a2a12',
  1825: '#3d3208',
};

export const SFT_LABEL: Record<number, string> = {
  1265: 'Type 1 / 2 · 1265 SFT',
  1415: 'Type 3 / 4 · 1415 SFT',
  1585: 'Type 5 / 6 · 1585 SFT',
  1825: 'Type 7 / 8 · 1825 SFT',
};

export const SFT_TYPE: Record<number, string> = {
  1265: 'Type 1 / 2',
  1415: 'Type 3 / 4',
  1585: 'Type 5 / 6',
  1825: 'Type 7 / 8',
};

export const UNIT_SQFTS = [1265, 1415, 1585, 1825] as const;

export const STATUS_DOT: Record<string, string> = {
  available: '#3d8f62',
  reserved: '#c49a3a',
  sold: '#a34b42',
};

/** Numbered podium markers from the printed Ramky One Orion master layout. */
export const AMENITIES_ON_PLOT: { n: number; name: string; x: number; z: number }[] = [
  { n: 1, name: 'Entrance', x: -52, z: 78 },
  { n: 2, name: '7M Driveway', x: -56, z: 8 },
  { n: 3, name: 'Mini Golf', x: -58, z: 28 },
  { n: 4, name: 'Basketball', x: -54, z: -72 },
  { n: 6, name: 'Cricket Net', x: 6, z: -80 },
  { n: 8, name: 'Clubhouse', x: 52, z: -72 },
  { n: 11, name: 'Walking Track', x: 58, z: 8 },
  { n: 12, name: 'Amphitheatre', x: 50, z: 74 },
  { n: 13, name: 'Kids Play', x: 6, z: 72 },
  { n: 14, name: 'Entrance Portal', x: -28, z: 80 },
  { n: 15, name: 'Party Lawn', x: 4, z: 10 },
  { n: 16, name: 'Courtyard', x: -8, z: -8 },
  { n: 17, name: 'Gazebo', x: 22, z: 18 },
  { n: 20, name: 'Seniors Court', x: 24, z: 68 },
  { n: 22, name: 'Basement Entry', x: -18, z: 82 },
];
