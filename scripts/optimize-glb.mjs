// Draco-compresses + resizes textures of public/models/towers.glb using gltf-transform.
// Usage: npm run optimize:glb [input.glb] [output.glb]
import { spawnSync } from 'node:child_process';
const [input = 'public/models/towers-source.glb', output = 'public/models/towers.glb'] = process.argv.slice(2);
const run = (args) => { const r = spawnSync('npx', ['-y', '@gltf-transform/cli', ...args], { stdio: 'inherit' }); if (r.status) process.exit(r.status); };
run(['resize', input, output, '--width', '2048', '--height', '2048']);
run(['webp', output, output]);
run(['draco', output, output, '--method', 'edgebreaker']);
console.log(`optimized -> ${output}`);
