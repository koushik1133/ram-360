Drop your Draco-compressed `towers.glb` here (or upload to your CDN and set `NEXT_PUBLIC_ASSET_CDN`).

Mesh naming convention the app expects, one mesh per flat:  `<TOWER>_F<FLOOR>_<FLATNO>`  e.g. `A_F12_01`, `B_F0_03`.
Any other meshes (podium, landscape, context) are rendered as-is. Until the file exists the app renders procedural curved towers.

Optimize: `npm run optimize:glb public/models/towers-source.glb public/models/towers.glb`
