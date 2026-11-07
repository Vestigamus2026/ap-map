import { test, expect } from '@playwright/test';
import { mockServices } from './helpers.js';

const screens = [
  ['phone with touch', { hasTouch: true, isMobile: true, viewport: { width: 360, height: 640 } }],
  ['desktop', {}],
];

for (const [name, options] of screens) {
  test.describe(name, () => {
    test.use(options);

    test('the N button sits just below the zoom buttons without overlapping "-"', async ({ page }) => {
      await mockServices(page);
      await page.goto('/');
      await expect(page.locator('.rotate-north button')).toBeVisible();
      const minus = await page.locator('.ol-zoom-out').boundingBox();
      const north = await page.locator('.rotate-north button').boundingBox();
      const gap = north.y - (minus.y + minus.height);
      expect(gap).toBeGreaterThanOrEqual(2);
      expect(gap).toBeLessThan(16);
      expect(Math.abs(north.x - minus.x)).toBeLessThan(1);
    });
  });
}
