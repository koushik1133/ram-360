/** Drive the buyer journey through the real UI and capture screenshots for review. */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.SHOT_BASE ?? 'http://127.0.0.1:3003';
const OUT = 'shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));
page.on('console', (m) => {
  if (m.type() === 'error') console.error('CONSOLE:', m.text().slice(0, 240));
});

const shot = async (name, ms = 3000) => {
  await page.waitForTimeout(ms);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('shot:', name);
};

await page.goto(`${BASE}/?instant=1`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('canvas', { timeout: 90000 });
await shot('01-master', 9000);

await page.getByRole('button', { name: 'TOWERS' }).click();
await page.waitForTimeout(1200);
await page.getByRole('button', { name: /Tower D/ }).first().click();
await shot('02-tower', 4000);

await page.getByPlaceholder(/Search flat/).fill('D-1502');
await page.waitForTimeout(600);
await page.getByRole('button', { name: /Floor 15/ }).first().click();
await page.waitForTimeout(900);
await page.getByRole('button', { name: /Flat 02/ }).first().click();
await shot('03-floor-cutaway', 4500);

await page.getByRole('button', { name: /VIEW FLOOR PLAN/ }).first().click();
await shot('04-plan', 3000);

await page.getByRole('button', { name: '3D TWIN' }).click();
await shot('05-twin-iso', 7000);

await page.getByRole('button', { name: 'TOP', exact: true }).click();
await shot('06-twin-top', 4000);

await page.getByRole('button', { name: 'ISO', exact: true }).click();
await page.waitForTimeout(2500);
await page.getByRole('button', { name: /Master Bedroom/ }).first().click();
await shot('07-360-master', 9000);

for (const [key, name] of [['DRAWING', '08-360-drawing'], ['KITCHEN', '09-360-kitchen'], ['SIT-OUT', '10-360-sitout']]) {
  await page.getByRole('button', { name: key, exact: true }).first().click();
  await shot(name, 4500);
}

await browser.close();
console.log('done');
