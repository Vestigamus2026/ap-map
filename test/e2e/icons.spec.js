import { test, expect } from '@playwright/test';
import { mockServices } from './helpers.js';

const size = (page, src) =>
  page.evaluate(
    (s) =>
      new Promise((ok, fail) => {
        const img = new Image();
        img.onload = () => ok([img.naturalWidth, img.naturalHeight]);
        img.onerror = () => fail(new Error(`${s} lädt nicht`));
        img.src = s;
      }),
    src,
  );

for (const file of ['/', '/print.html']) {
  test(`${file} links the Maps favicons`, async ({ page }) => {
    await mockServices(page);
    await page.goto(file);
    const links = await page.$$eval('link[rel~="icon"], link[rel="apple-touch-icon"]', (ls) =>
      ls.map((l) => `${l.rel} ${l.getAttribute('href')} ${l.getAttribute('sizes') || ''}`.trim()),
    );
    expect(links).toEqual([
      'icon favicon.ico 16x16 24x24 32x32 48x48 64x64',
      'icon favicon-32.png 32x32',
      'icon favicon-16.png 16x16',
      'apple-touch-icon apple-touch-icon.png 180x180',
    ]);
    expect(await size(page, 'favicon-32.png')).toEqual([32, 32]);
    expect(await size(page, 'favicon-16.png')).toEqual([16, 16]);
    expect(await size(page, 'apple-touch-icon.png')).toEqual([180, 180]);
    const ico = await page.request.get('favicon.ico');
    expect(ico.ok()).toBe(true);
    expect([...(await ico.body()).subarray(0, 6)]).toEqual([0, 0, 1, 0, 5, 0]);
  });
}

test('Credits name the icon designer and licence', async ({ page }) => {
  await mockServices(page);
  await page.goto('/#about');
  await expect(page.locator('#about')).toContainText('Symbol: „Maps“ von EatosDesign (Win 10x Icons) unter CC BY-ND 4.0');
  await expect(page.locator('#about a[href="https://creativecommons.org/licenses/by-nd/4.0/deed.de"]')).toHaveCount(1);
});
