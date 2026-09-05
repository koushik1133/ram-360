/** Prove that floor-plan / room clicks open the live 3D tour, not a panorama 404. */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.SHOT_BASE ?? 'http://127.0.0.1:3001';
const OUT = 'shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
const failures = [];
page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') failures.push(`console: ${m.text().slice(0, 240)}`);
});

const shot = async (name, ms = 2500) => {
  await page.waitForTimeout(ms);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('shot:', name);
};

const assertNoPanoError = async (where) => {
  const dead = await page.getByText(/panorama cannot be loaded/i).count();
  const canvases = await page.locator('canvas').count();
  const title = await page.locator('body').innerText();
  if (dead > 0) throw new Error(`PSV error still showing at ${where}`);
  if (canvases < 1) throw new Error(`no WebGL canvas at ${where}`);
  if (/panorama cannot be loaded/i.test(title)) throw new Error(`error copy in DOM at ${where}`);
  console.log('ok:', where, 'canvases=', canvases);
};

await page.goto(`${BASE}/?instant=1`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('canvas', { timeout: 90000 });
await shot('v01-master', 4000);

await page.getByRole('button', { name: 'TOWERS' }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /Tower D/ }).first().click();
await page.getByPlaceholder(/Search flat/).fill('D-1502');
await page.waitForTimeout(400);
await page.getByRole('button', { name: /Floor 15/ }).first().click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /Flat 02/ }).first().click();
await page.getByRole('button', { name: /VIEW FLOOR PLAN/ }).first().click();
await shot('v02-plan', 2500);

// Room-select pills on the plan (this is the path from the screenshot)
await page.getByRole('button', { name: 'ROOM SELECT' }).click();
await page.getByRole('button', { name: 'SIT-OUT' }).first().click();
await shot('v03-from-pill', 7000);
await assertNoPanoError('sit-out pill');
if (!(await page.getByText(/SIT-OUT BALCONY/i).count())) {
  throw new Error('did not enter sit-out from the room pill');
}

await page.getByRole('button', { name: 'KITCHEN', exact: true }).first().click();
await shot('v04-kitchen', 4500);
await assertNoPanoError('kitchen rail');
if (!(await page.getByText(/KITCHEN/i).count())) throw new Error('kitchen rail failed');

await page.getByRole('button', { name: /FLOOR PLAN/ }).first().click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: 'FLOOR PLAN' }).click().catch(() => {});
await page.waitForTimeout(400);

// Click the actual SVG room polygon
const clicked = await page.evaluate(() => {
  const room = document.querySelector('[data-space="master"], [data-room="bedroom"]');
  if (!room) return false;
  room.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  return true;
});
if (!clicked) throw new Error('no clickable SVG room');
await shot('v05-from-svg', 7000);
await assertNoPanoError('svg room click');

await page.getByRole('button', { name: /FLOOR PLAN/ }).first().click();
await page.waitForTimeout(600);
await page.getByRole('button', { name: '3D TWIN' }).click();
await shot('v06-twin', 5000);
await page.getByRole('button', { name: /Master Bedroom/ }).first().click();
await shot('v07-from-twin', 7000);
await assertNoPanoError('3d twin click');

writeFileSync(`${OUT}/verify-log.json`, JSON.stringify({ failures, url: BASE }, null, 2));
await browser.close();
if (failures.some((f) => /panorama cannot be loaded/i.test(f))) {
  throw new Error('panorama error leaked into console');
}
console.log('done');
