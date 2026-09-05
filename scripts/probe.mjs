import { chromium } from '@playwright/test';

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const notes = [];
page.on('pageerror', (e) => notes.push(`PAGEERROR ${e.message}`));
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' && !/hmr|websocket/i.test(t)) notes.push(`CONSOLE ${t.slice(0, 400)}`);
});
page.on('response', (r) => {
  if (r.status() >= 400) notes.push(`HTTP${r.status()} ${r.url()}`);
});
page.on('requestfailed', (r) => notes.push(`REQFAIL ${r.url()} ${r.failure()?.errorText}`));

await page.goto('http://127.0.0.1:3002/?instant=1', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(25000);

const info = await page.evaluate(() => ({
  hasStore: Boolean(window.__navigo),
  canvases: document.querySelectorAll('canvas').length,
  reactRoot: Boolean(document.querySelector('[data-reactroot], #__next, body > div')),
  webgl: (() => {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      return gl ? gl.getParameter(gl.VERSION) : 'NO WEBGL';
    } catch (e) {
      return `WEBGL ERR ${e.message}`;
    }
  })(),
}));
console.log('INFO', JSON.stringify(info, null, 2));
console.log('NOTES:\n' + (notes.join('\n') || '(none)'));
await browser.close();
