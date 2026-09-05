/** Sanity-check the generated unit layouts: no overlaps, nothing outside the bbox. */
import { buildUnitLayout, UNIT_SQFTS, tourSpaces } from '../lib/apartments.ts';

const EPS = 0.02;
let failures = 0;

for (const sqft of UNIT_SQFTS) {
  for (const mirrored of [false, true]) {
    const layout = buildUnitLayout(sqft, mirrored);
    const tag = `${sqft} ${mirrored ? 'west' : 'east'}`;

    for (const s of layout.spaces) {
      if (s.x < -EPS || s.z < -EPS || s.x + s.w > layout.width + EPS || s.z + s.d > layout.depth + EPS) {
        console.error(`  OUT OF BOUNDS ${tag} ${s.key}: x=${s.x.toFixed(2)} z=${s.z.toFixed(2)} w=${s.w.toFixed(2)} d=${s.d.toFixed(2)}`);
        failures++;
      }
      if (s.w < 0.9 || s.d < 0.9) {
        console.error(`  DEGENERATE ${tag} ${s.key}: ${s.w.toFixed(2)} x ${s.d.toFixed(2)}`);
        failures++;
      }
    }

    for (let i = 0; i < layout.spaces.length; i++) {
      for (let j = i + 1; j < layout.spaces.length; j++) {
        const a = layout.spaces[i];
        const b = layout.spaces[j];
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oz = Math.min(a.z + a.d, b.z + b.d) - Math.max(a.z, b.z);
        if (ox > EPS && oz > EPS) {
          console.error(`  OVERLAP ${tag}: ${a.key} <-> ${b.key} by ${ox.toFixed(2)}m x ${oz.toFixed(2)}m`);
          failures++;
        }
      }
    }

    const gross = (layout.width / 0.3048) * (layout.depth / 0.3048);
    console.log(
      `${tag}: bbox ${(layout.width / 0.3048).toFixed(1)}' x ${(layout.depth / 0.3048).toFixed(1)}' = ${gross.toFixed(0)} sft gross, ` +
        `${layout.carpet} sft of named rooms, ${tourSpaces(layout).length} tourable spaces`,
    );
  }
}

if (failures) {
  console.error(`\n${failures} layout problem(s).`);
  process.exit(1);
}
console.log('\nAll unit layouts are watertight.');
