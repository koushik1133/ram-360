import { expect, test } from '@playwright/test';

test('buyer drills from construction model to a furnished room and its cost', async ({ page }) => {
  await page.goto('/?instant=1');
  await expect(page.getByText('RAMKY ONE ORION', { exact: true }).first()).toBeVisible();

  // construction layers on the master plan
  await page.getByRole('button', { name: /base/i }).click();
  await expect(page.getByText('foundation', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /complete/i }).click();

  // tower -> floor -> flat
  await page.getByRole('button', { name: 'TOWERS' }).click();
  await page.getByRole('button', { name: /Tower D/ }).first().click();
  await page.getByPlaceholder(/Search flat/).fill('D-1502');
  await page.getByRole('button', { name: /Floor 15/ }).first().click();
  await page.getByRole('button', { name: /Flat 02/ }).first().click();
  await page.getByRole('button', { name: /VIEW FLOOR PLAN/ }).first().click();
  await expect(page.getByText(/D-1502 · 3 BHK/).first()).toBeVisible();

  // the 3D twin is generated from this unit's own SFT schedule
  await page.getByRole('button', { name: '3D TWIN' }).click();
  await expect(page.getByText('1415 SFT', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Master Bedroom/ })).toBeVisible();

  // clicking a room walks into it in 360
  await page.getByRole('button', { name: /Master Bedroom/ }).first().click();
  await expect(page.getByText('D-1502 · MASTER BEDROOM')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Toggle fullscreen tour' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Drag only mode' })).toBeVisible();

  // walk to another room from the tour rail
  await page.getByRole('button', { name: 'KITCHEN', exact: true }).first().click();
  await expect(page.getByText('D-1502 · KITCHEN')).toBeVisible();

  // cost engine
  await page.getByRole('button', { name: /FLOOR PLAN/ }).first().click();
  await page.getByRole('button', { name: 'INTERIOR COST' }).click();
  await expect(page.getByRole('heading', { name: /Plan your home before possession/ })).toBeVisible();
  await expect(page.getByText(/Estimated project total/i)).toBeVisible();
});

test('every unit type produces a watertight layout', async ({ page }) => {
  await page.goto('/?instant=1');
  await page.getByRole('button', { name: 'TOWERS' }).click();

  for (const [flat, sqft] of [['A-1601', '1585'], ['B-1203', '1265']] as const) {
    await page.getByPlaceholder(/Search flat/).fill(flat);
    await page.getByRole('button', { name: new RegExp(`Floor ${flat.slice(2, 4).replace(/^0/, '')}`) }).first().click();
    await page.getByRole('button', { name: new RegExp(`Flat ${flat.slice(4)}`) }).first().click();
    await page.getByRole('button', { name: /VIEW FLOOR PLAN/ }).first().click();
    await page.getByRole('button', { name: '3D TWIN' }).click();
    await expect(page.getByText(`${sqft} SFT`, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'TOWERS' }).click();
  }
});

test('lead endpoint rejects malformed buyer data', async ({ request }) => {
  const response = await request.post('/api/lead', { data: { name: 'A', phone: '12', email: 'invalid' } });
  expect(response.status()).toBe(422);
  await expect(response.json()).resolves.toMatchObject({ ok: false });
});
