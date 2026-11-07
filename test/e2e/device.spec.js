import { test, expect } from '@playwright/test';
import { mockServices } from './helpers.js';

const phone = { hasTouch: true, isMobile: true, viewport: { width: 360, height: 640 } };
const gpsOn = () => localStorage.setItem('gebietskarte_settings', 'show_gps,true');

test.describe('phone (touch)', () => {
  test.use(phone);

  test('hides "Drucken" and keeps the GPS tools', async ({ page }) => {
    await mockServices(page);
    await page.addInitScript(gpsOn);
    await page.goto('/');
    await expect(page.locator('#show_map .toolbar h1')).toHaveText('Karte');
    await expect(page.getByRole('link', { name: 'Drucken' })).toBeHidden();
    await page.goto('/#search');
    await expect(page.locator('#search .toolbar.gpson').getByRole('link', { name: 'GPS' })).toBeVisible();
    await page.goto('/#settings');
    await expect(page.getByText('Zeige GPS-Werkzeuge?')).toBeVisible();
  });
});

test.describe('desktop (mouse)', () => {
  test('shows "Drucken" and hides the GPS tools, even if switched on', async ({ page }) => {
    await mockServices(page);
    await page.addInitScript(gpsOn);
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Drucken' })).toBeVisible();
    await page.goto('/#search');
    await expect(page.locator('#search .toolbar.gpson')).toBeHidden();
    await expect(page.locator('#search .toolbar.gpsoff').getByRole('link', { name: 'Einstellungen' })).toBeVisible();
    await page.goto('/#settings');
    await expect(page.locator('#settings .toolbar.gpson')).toBeHidden();
    await expect(page.locator('#settings .toolbar.gpsoff')).toBeVisible();
    await expect(page.getByText('Zeige GPS-Werkzeuge?')).toBeHidden();
  });
});
