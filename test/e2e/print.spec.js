import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { mockServices, collectErrors } from './helpers.js';

const pageRule = (page) => page.locator('#page-size').evaluate((el) => el.textContent);

test('print page shows zones, home and legend without a search', async ({ page }) => {
  const errors = collectErrors(page);
  await mockServices(page);
  await page.goto('/print.html');
  await expect(page).toHaveTitle('Kroll APG 607 – Druckansicht');
  await expect(page.locator('#sheet h1')).toHaveText('Kroll APG 607');
  await expect(page.locator('#printmap canvas').first()).toBeVisible();
  const legend = page.locator('#legend');
  await expect(legend).toContainText('Zone 1');
  await expect(legend).toContainText('Zone 2');
  await expect(legend).toContainText('Zone 3');
  await expect(legend).toContainText('Start');
  await expect(legend).not.toContainText('Ziel');
  await expect(legend).not.toContainText('Verbindung');
  await expect(page.locator('#sheet .sources')).toContainText('OpenStreetMap-Mitwirkende');
  await expect(page.locator('#sheet .sources')).toContainText('Zonendaten: Januar 2015');
  await expect(page.locator('#sheet .sources')).toContainText('© 2015, Neuaufbau 2026 KLUPEA GmbH');
  await expect(page.locator('#printmap .ol-scale-bar')).toBeVisible();
  expect(await pageRule(page)).toContain('size: 210mm 297mm');
  expect(errors).toEqual([]);
});

test('print page names the zone source from the settings file', async ({ page }) => {
  await mockServices(page);
  const config = JSON.parse(await readFile('public/config.json', 'utf8'));
  const zoneSources = { zone1: 'OSM X', zone2: 'OSM X', zone3: 'OSM X' };
  await page.route('**/config.json', (route) => route.fulfill({ json: { ...config, zoneSources } }));
  await page.goto('/print.html');
  await expect(page.locator('#sheet .sources')).toContainText('Zonendaten: OSM X ·');
  await expect(page.locator('#sheet .sources')).not.toContainText('assistance partner');
});

test('print page uses printColors, e.g. only a coloured border for Zone 1', async ({ page }) => {
  await mockServices(page);
  const config = JSON.parse(await readFile('public/config.json', 'utf8'));
  const printColors = { zone1: { fill: 'transparent', border: 'rgb(0, 0, 255)' } };
  await page.route('**/config.json', (route) => route.fulfill({ json: { ...config, printColors } }));
  await page.goto('/print.html');
  const swatches = page.locator('#legend .swatch');
  await expect(swatches.first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(swatches.first()).toHaveCSS('border-top-color', 'rgb(0, 0, 255)');
  await expect(swatches.nth(1)).toHaveCSS('background-color', 'rgba(215, 179, 104, 0.3)');
});

test('print page reads colours written as "Farbe, Deckkraft"', async ({ page }) => {
  await mockServices(page);
  const config = JSON.parse(await readFile('public/config.json', 'utf8'));
  const printColors = { zone1: { fill: 'red, 30%', border: 'blue, 1' } };
  await page.route('**/config.json', (route) => route.fulfill({ json: { ...config, printColors } }));
  await page.goto('/print.html');
  const swatch = page.locator('#legend .swatch').first();
  await expect(swatch).toHaveCSS('background-color', 'rgba(255, 0, 0, 0.3)');
  await expect(swatch).toHaveCSS('border-top-color', 'rgb(0, 0, 255)');
});

test('paper size and orientation change the sheet and the @page rule', async ({ page }) => {
  await mockServices(page);
  await page.goto('/print.html');
  await expect(page.locator('#format option')).toHaveText(['A4', 'A3', 'A2', 'A1', 'A0']);
  await page.selectOption('#format', 'A3');
  await page.selectOption('#orientation', 'landscape');
  expect(await pageRule(page)).toContain('size: 420mm 297mm');
  const box = await page.locator('#sheet').boundingBox();
  expect(box.width / box.height).toBeCloseTo(400 / 277, 1);
  await page.selectOption('#format', 'A0');
  await page.selectOption('#orientation', 'portrait');
  expect(await pageRule(page)).toContain('size: 841mm 1189mm');
});

test('shows destination and routes of the last search; a failed search removes them', async ({ page }) => {
  await mockServices(page);
  await page.goto('/#search');
  await page.fill('#location', 'Frankfurt Oder');
  await page.click('#submitplace');
  await expect(page.locator('#result')).toContainText('Schnellste Verbindung:');
  await page.goto('/print.html');
  const legend = page.locator('#legend');
  await expect(legend).toContainText('Ziel: Frankfurt (Oder)');
  await expect(legend).toContainText('Kürzeste Verbindung');
  await expect(legend).toContainText('Schnellste Verbindung');

  await page.unrouteAll();
  await mockServices(page, { places: [] });
  await page.goto('/#search');
  await page.fill('#location', 'Gibtsnicht');
  await page.click('#submitplace');
  await expect(page.locator('#result')).toContainText('Bitte Ort prüfen!');
  await page.goto('/print.html');
  await expect(page.locator('#legend')).toContainText('Zone 3');
  await expect(page.locator('#legend')).not.toContainText('Ziel');
});

test('saves the sheet as a PNG with paper-shaped dimensions', async ({ page }) => {
  await mockServices(page);
  await page.goto('/print.html');
  await page.selectOption('#orientation', 'landscape');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#png')]);
  expect(download.suggestedFilename()).toBe('Kroll APG 607 A4 quer.png');
  const png = await readFile(await download.path());
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  expect(width / height).toBeCloseTo(297 / 210, 1);
  expect(width).toBeGreaterThanOrEqual(1000);
  const mapPixels = await page.evaluate(async (b64) => {
    const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const c = new OffscreenCanvas(img.width, img.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const colours = new Set();
    for (let x = 0.3; x <= 0.7; x += 0.05) {
      for (let y = 0.3; y <= 0.6; y += 0.05) colours.add(ctx.getImageData(Math.round(img.width * x), Math.round(img.height * y), 1, 1).data.join());
    }
    return [...colours];
  }, png.toString('base64'));
  expect(mapPixels).not.toEqual(['229,227,223,255']);
});

test('a coordinate search labels the destination with its coordinates', async ({ page }) => {
  await mockServices(page);
  await page.goto('/#search');
  await page.fill('#location', '52.34 14.55');
  await page.click('#submitplace');
  await expect(page.locator('#result')).toContainText('Schnellste Verbindung:');
  await page.goto('/print.html');
  await expect(page.locator('#legend')).toContainText(/Ziel: \S*52[.,]34/);
});

const pngGrid = (page) =>
  page.evaluate(async () => {
    const [blob] = await Promise.all([
      new Promise((resolve) => {
        const orig = URL.createObjectURL;
        URL.createObjectURL = (b) => { resolve(b); return orig(b); };
      }),
      document.getElementById('png').click(),
    ]);
    const img = await createImageBitmap(blob);
    const c = new OffscreenCanvas(img.width, img.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const grid = [];
    for (let x = 0.1; x < 0.95; x += 0.04) {
      for (let y = 0.15; y < 0.8; y += 0.04) grid.push([...ctx.getImageData(Math.round(img.width * x), Math.round(img.height * y), 1, 1).data]);
    }
    return { width: img.width, grid };
  });

test('the PNG map on a high-density screen matches the normal one', async ({ browser }) => {
  const shots = [];
  for (const deviceScaleFactor of [1, 2]) {
    const context = await browser.newContext({ deviceScaleFactor, acceptDownloads: true });
    const page = await context.newPage();
    await mockServices(page);
    await page.goto('/print.html');
    await expect(page.locator('#printmap canvas').first()).toBeVisible();
    shots.push(await pngGrid(page));
    await context.close();
  }
  expect(Math.abs(shots[1].width - shots[0].width * 2)).toBeLessThanOrEqual(2);
  const same = shots[0].grid.filter((p, i) => p.every((v, j) => Math.abs(v - shots[1].grid[i][j]) < 25)).length;
  expect(same / shots[0].grid.length).toBeGreaterThan(0.9);
});

test('the print button opens the print dialog after the map is drawn', async ({ page }) => {
  await mockServices(page);
  await page.addInitScript(() => {
    window.print = () => { window.__printed = (window.__printed || 0) + 1; };
  });
  await page.goto('/print.html');
  await page.click('#print');
  await expect.poll(() => page.evaluate(() => window.__printed)).toBe(1);
  await expect(page.locator('#tools')).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#tools')).toBeHidden();
});

test('the map page links to the print page', async ({ page }) => {
  await mockServices(page);
  await page.goto('/');
  const link = page.locator('#show_map').getByRole('link', { name: 'Drucken' });
  await expect(link).toHaveAttribute('href', 'print.html');
});

test('print page shows a German error for a broken settings file', async ({ page }) => {
  await mockServices(page);
  await page.route('**/config.json', (route) => route.fulfill({ body: '{kaputt', contentType: 'application/json' }));
  await page.goto('/print.html');
  await expect(page.locator('.fatal')).toHaveText('Fehler in der Einstellungsdatei: Die Einstellungsdatei config.json ist kein gültiges JSON.');
});
