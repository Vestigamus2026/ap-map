import { test, expect } from '@playwright/test';
import { mockServices, collectErrors } from './helpers.js';

const square = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
const base = { mapName: 'Testgebiet Nord', home: [10.0, 53.55] };
const zone2 = square(9.8, 53.4, 10.2, 53.7);

async function search(page, text) {
  await page.goto('/#search');
  await page.fill('#location', text);
  await page.click('#submitplace');
}

test('works with zones 1 and 2 only and names zone 2 as the outermost zone', async ({ page }) => {
  const errors = collectErrors(page);
  await mockServices(page);
  await page.route('**/config.json', (route) => route.fulfill({ json: { ...base, zones: { zone1: square(9.9, 53.5, 10.1, 53.6), zone2 } } }));
  await page.goto('/#settings');
  await expect(page.locator('#settings')).toContainText('Minimale Entfernung zu Zone 2 ermitteln (Luftlinie)?');
  await expect(page.locator('#settings')).not.toContainText('Zone 3');
  await search(page, '53.45 9.85');
  await expect(page.locator('#result')).toContainText('Diese Position befindet sich in Zone 2.');
  await page.goto('/print.html');
  await expect(page.locator('#legend')).toContainText('Zone 2');
  await expect(page.locator('#legend')).not.toContainText('Zone 3');
  expect(errors).toEqual([]);
});

test('shows a German error when zone 1 is missing', async ({ page }) => {
  await mockServices(page);
  await page.route('**/config.json', (route) => route.fulfill({ json: { ...base, zones: { zone2 } } }));
  await page.goto('/');
  await expect(page.locator('.fatal')).toHaveText('Fehler in der Einstellungsdatei: "zones.zone1" fehlt; Zone 1 muss immer angegeben werden.');
});

test('a zone with an exclave and an enclave (hole)', async ({ page }) => {
  const errors = collectErrors(page);
  await mockServices(page);
  const zone1 = [square(9.9, 53.5, 10.0, 53.6), square(9.94, 53.54, 9.96, 53.56), square(10.1, 53.45, 10.15, 53.5)];
  await page.route('**/config.json', (route) => route.fulfill({ json: { ...base, zones: { zone1, zone2 } } }));
  await search(page, '53.55 9.95');
  await expect(page.locator('#result')).toContainText('Diese Position befindet sich in Zone 2.');
  await search(page, '53.47 10.12');
  await expect(page.locator('#result')).toContainText('Diese Position befindet sich in Zone 1.');
  await search(page, '53.52 9.92');
  await expect(page.locator('#result')).toContainText('Diese Position befindet sich in Zone 1.');
  expect(errors).toEqual([]);
});
