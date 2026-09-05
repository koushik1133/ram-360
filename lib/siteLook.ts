/**
 * Shared look for the site and the in-room city: cream stone, bronze UPVC,
 * evening glass, grass, asphalt. Drawn once and reused so the master plan
 * and the balcony view read as the same project.
 */
import * as THREE from 'three';

const cache = new Map<string, THREE.Texture>();

function canvasTex(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  cache.set(key, t);
  return t;
}

function rnd(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/** One typical floor of a Ramky-style cream tower: 5 living bays. */
export function facadeTextures() {
  const bays = 5;
  const BW = 160;
  const W = BW * bays;
  const H = 220;
  const map = canvasTex('facade-map-v4', W, H, (ctx, w, h) => {
    const n = rnd(91);
    ctx.fillStyle = '#e8e2d6';
    ctx.fillRect(0, 0, w, h);
    // stucco noise
    for (let i = 0; i < 9000; i++) {
      ctx.fillStyle = `rgba(90,70,40,${0.015 + n() * 0.03})`;
      ctx.fillRect(n() * w, n() * h, 1.6, 1.6);
    }
    // slab band
    ctx.fillStyle = '#d6cfc2';
    ctx.fillRect(0, h - 18, w, 18);
    ctx.fillStyle = 'rgba(40,30,20,0.18)';
    ctx.fillRect(0, h - 20, w, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, 0, w, 4);
    for (let b = 0; b < bays; b++) {
      const x = b * BW;
      // vertical stone fin
      ctx.fillStyle = '#cfc6b6';
      ctx.fillRect(x, 0, 10, h);
      ctx.fillRect(x + BW - 10, 0, 10, h);
      // UPVC frame
      ctx.fillStyle = '#3c352e';
      ctx.fillRect(x + 18, 14, BW - 36, 148);
      // split sliding glass
      const glass = ctx.createLinearGradient(0, 18, 0, 150);
      glass.addColorStop(0, '#9eb6c8');
      glass.addColorStop(0.35, '#314552');
      glass.addColorStop(1, '#141c22');
      ctx.fillStyle = glass;
      ctx.fillRect(x + 22, 18, 54, 140);
      ctx.fillRect(x + 80, 18, 54, 140);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(x + 22, 18, 54, 16);
      ctx.fillRect(x + 80, 18, 22, 140);
      // mullion
      ctx.fillStyle = '#2b2621';
      ctx.fillRect(x + 75, 14, 6, 148);
      // balcony rail over the lower third
      ctx.fillStyle = 'rgba(210,220,228,0.35)';
      ctx.fillRect(x + 14, 118, BW - 28, 44);
      ctx.strokeStyle = 'rgba(30,30,30,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 14, 118);
      ctx.lineTo(x + BW - 14, 118);
      ctx.stroke();
      for (let i = 0; i < 10; i++) {
        ctx.beginPath();
        ctx.moveTo(x + 18 + i * 13, 118);
        ctx.lineTo(x + 18 + i * 13, 162);
        ctx.stroke();
      }
      // outdoor AC on the slab edge
      ctx.fillStyle = '#8b949a';
      ctx.fillRect(x + BW - 38, h - 44, 24, 18);
      ctx.fillStyle = '#6e777c';
      for (let k = 0; k < 4; k++) ctx.fillRect(x + BW - 36, h - 42 + k * 4, 20, 1.5);
    }
  });
  const emissive = canvasTex('facade-em-v3', W, H, (ctx, w, h) => {
    const n = rnd(44);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    for (let b = 0; b < 5; b++) {
      if (n() < 0.38) {
        ctx.fillStyle = `rgba(255,${190 + n() * 40},${120 + n() * 40},0.95)`;
        ctx.fillRect(b * BW + 22, 22, 54, 80);
      }
      if (n() < 0.28) {
        ctx.fillStyle = `rgba(255,210,150,0.85)`;
        ctx.fillRect(b * BW + 80, 22, 54, 80);
      }
    }
  });
  return { map, emissive, bayWidth: 3.4 };
}

export function grassTexture() {
  return canvasTex('grass-v2', 512, 512, (ctx, w, h) => {
    const n = rnd(17);
    ctx.fillStyle = '#3f6d32';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 14000; i++) {
      const g = 70 + n() * 90;
      ctx.fillStyle = `rgb(${40 + n() * 30},${g},${30 + n() * 25})`;
      ctx.fillRect(n() * w, n() * h, 2 + n() * 3, 1 + n() * 2);
    }
    ctx.fillStyle = 'rgba(20,40,10,0.12)';
    for (let i = 0; i < 40; i++) ctx.fillRect(n() * w, n() * h, 40, 8);
  });
}

export function asphaltTexture() {
  return canvasTex('asphalt-v2', 512, 512, (ctx, w, h) => {
    const n = rnd(8);
    ctx.fillStyle = '#3a3a38';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 8000; i++) {
      const v = 48 + n() * 28;
      ctx.fillStyle = `rgb(${v},${v},${v - 4})`;
      ctx.fillRect(n() * w, n() * h, 2, 2);
    }
    ctx.fillStyle = 'rgba(230,220,160,0.55)';
    ctx.fillRect(w / 2 - 3, 0, 6, h);
    ctx.fillStyle = '#3a3a38';
    for (let y = 0; y < h; y += 36) ctx.fillRect(w / 2 - 3, y + 16, 6, 14);
  });
}

export function stoneTexture() {
  return canvasTex('stone-v2', 256, 256, (ctx, w, h) => {
    const n = rnd(21);
    ctx.fillStyle = '#c8c2b6';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2000; i++) {
      ctx.fillStyle = `rgba(60,50,40,${n() * 0.08})`;
      ctx.fillRect(n() * w, n() * h, 3, 2);
    }
    ctx.strokeStyle = 'rgba(80,70,55,0.25)';
    ctx.strokeRect(0, 0, w, h);
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
  });
}

export function waterMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: '#1a7aa8',
    roughness: 0.08,
    metalness: 0.12,
    transmission: 0.35,
    thickness: 0.6,
    ior: 1.33,
    transparent: true,
    opacity: 0.92,
    envMapIntensity: 1.4,
  });
}

export function glassRailMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: '#d7e4ee',
    roughness: 0.06,
    metalness: 0.05,
    transmission: 0.7,
    thickness: 0.04,
    transparent: true,
    opacity: 0.28,
    envMapIntensity: 1.6,
  });
}
