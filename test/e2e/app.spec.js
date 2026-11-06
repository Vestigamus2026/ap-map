import { test, expect } from '@playwright/test';
import { encodePolyline } from '../../src/lib/geo.js';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

const frankfurtOder = {
  lat: '52.3471',
  lon: '14.5506',
  addresstype: 'city',
  address: { city: 'Frankfurt (Oder)', state: 'Brandenburg', country_code: 'de' },
};

async function mockServices(page, { places = [frankfurtOder] } = {}) {
  const calls = { nominatim: [], valhalla: [] };
  await page.route('**/tile.openstreetmap.de/**', (route) => route.fulfill({ contentType: 'image/png', body: PNG_1X1 }));
  await page.route('**/nominatim.openstreetmap.org/**', (route) => {
    const url = new URL(route.request().url());
    calls.nominatim.push(url);
    const body = url.pathname.startsWith('/reverse') ? { ...places[0], lat: url.searchParams.get('lat'), lon: url.searchParams.get('lon'), address: { city: 'Ausstiegsort', country_code: 'de' } } : places;
    return route.fulfill({ json: body, headers: { 'access-control-allow-origin': '*' } });
  });
  await page.route('**/valhalla1.openstreetmap.de/**', (route) => {
    const req = JSON.parse(new URL(route.request().url()).searchParams.get('json'));
    calls.valhalla.push(req);
    const [a, b] = req.locations.map((l) => [l.lon, l.lat]);
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const shortest = req.costing_options.auto.shortest;
    return route.fulfill({
      json: { trip: { summary: { length: shortest ? 101.2 : 118.7, time: shortest ? 5400 : 4500 }, legs: [{ shape: encodePolyline([a, mid, b], 6) }] } },
      headers: { 'access-control-allow-origin': '*' },
    });
  });
  return calls;
}

function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
}

async function openSearch(page) {
  await page.getByRole('link', { name: 'Suche/ Info' }).click();
  await expect(page.locator('#search')).toBeVisible();
}

test('shows the map with the zones and no errors', async ({ page }) => {
  const errors = collectErrors(page);
  await mockServices(page);
  await page.goto('/');
  await expect(page).toHaveTitle('Kroll APG 607');
  await expect(page.locator('#show_map h1')).toHaveText('Karte');
  await expect(page.locator('#map canvas').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'N' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('address search shows zone, both routes and the distance outside zone 3', async ({ page }) => {
  const errors = collectErrors(page);
  const calls = await mockServices(page);
  await page.goto('/');
  await openSearch(page);
  await page.fill('#location', 'Frankfurt Oder');
  await page.click('#submitplace');

  const result = page.locator('#result');
  await expect(result).toContainText('Diese Position befindet sich außerhalb aller Zonen.');
  await expect(result).toContainText('Kürzeste Verbindung:');
  await expect(result).toContainText('101.2 km');
  await expect(result).toContainText('Fahrzeit 01:30:00 h');
  await expect(result).toContainText('Schnellste Verbindung:');
  await expect(result).toContainText('118.7 km');
  await expect(result).toContainText('davon außerhalb Zone 3:');
  await expect(page.locator('#submitplace')).toHaveText('Absenden');

  expect(calls.nominatim[0].searchParams.get('q')).toBe('Frankfurt Oder');
  expect(calls.valhalla.map((r) => r.costing_options.auto.shortest).sort()).toEqual([false, true]);
  expect(calls.valhalla.every((r) => !('use_highways' in r.costing_options.auto))).toBe(true);
  expect(errors).toEqual([]);
});

test('unknown address asks to check the place and re-enables the button', async ({ page }) => {
  await mockServices(page, { places: [] });
  await page.goto('/');
  await openSearch(page);
  await page.fill('#location', 'gibt es nicht');
  await page.click('#submitplace');
  await expect(page.locator('#result')).toHaveText('Bitte Ort prüfen!');
  await expect(page.locator('#submitplace')).toHaveText('Absenden');
  await expect(page.locator('#submitplace')).toHaveClass(/blueButton/);
});

test('addresses from the service are shown as text, not HTML', async ({ page }) => {
  const evil = { ...frankfurtOder, address: { road: '<img src=x onerror="window.__xss=1">', city: 'X', country_code: 'de' } };
  await mockServices(page, { places: [evil] });
  await page.addInitScript(() => localStorage.setItem('gebietskarte_settings', 'details,true'));
  await page.goto('/');
  await openSearch(page);
  await page.fill('#location', 'x');
  await page.click('#submitplace');
  await expect(page.locator('#result')).toContainText('<img src=x onerror="window.__xss=1">');
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  await expect(page.locator('#result img')).toHaveCount(0);
});

test('settings are saved and control the visible options', async ({ page }) => {
  await mockServices(page);
  await page.goto('/');
  await openSearch(page);
  await expect(page.locator('#kmform')).toBeHidden();
  await page.locator('#search .toolbar.gpsoff').getByRole('link', { name: 'Einstellungen' }).click();
  await expect(page.locator('#settings')).toBeVisible();

  await page.check('#show_bab');
  await page.uncheck('#shortest');
  await expect(page.locator('#onlyifshortest')).toBeHidden();
  await expect(page.locator('#onlyiffastest')).toBeVisible();

  await page.reload();
  await page.goto('/#settings');
  await expect(page.locator('#show_bab')).toBeChecked();
  await expect(page.locator('#shortest')).not.toBeChecked();
  const stored = await page.evaluate(() => localStorage.getItem('gebietskarte_settings'));
  expect(stored).toContain('show_bab,true');
  expect(stored).toContain('shortest,false');

  await page.goto('/#search');
  await expect(page.locator('#kmform')).toBeVisible();
});

test('motorway kilometre is converted to a position and searched', async ({ page }) => {
  const calls = await mockServices(page);
  await page.addInitScript(() => localStorage.setItem('gebietskarte_settings', 'show_bab,true'));
  await page.goto('/#search');
  await page.selectOption('#bab', '9');
  await expect(page.locator('#bab_sub option').first()).toHaveText('BAB 9 Richtung München');
  await page.fill('#km', '10,5');
  await page.click('#submitbab');

  await expect(page.locator('#result')).toContainText('Autobahnkilometer 10.5 gefunden und in das Zielfeld eingetragen!');
  await expect(page.locator('#result')).toContainText('Diese Position befindet sich');
  await expect(page.locator('#location')).toHaveValue(/^\d+\.\d{6} \d+\.\d{6}$/);
  expect(calls.nominatim.filter((u) => u.pathname.startsWith('/search'))).toHaveLength(0);
  await expect(page.locator('#submitbab')).toHaveText('Kilometer suchen');
});

test('unknown motorway kilometre is reported', async ({ page }) => {
  await mockServices(page);
  await page.addInitScript(() => localStorage.setItem('gebietskarte_settings', 'show_bab,true'));
  await page.goto('/#search');
  await page.fill('#km', '99999');
  await page.click('#submitbab');
  await expect(page.locator('#result')).toHaveText('kein passender Autobahnkilometer gefunden!');
  await expect(page.locator('#submitbab')).toHaveText('Kilometer suchen');
});

test.describe('GPS tools', () => {
  test.use({ geolocation: { latitude: 52.3471, longitude: 14.5506 }, permissions: ['geolocation'] });

  test('sets the destination from the current position', async ({ page }) => {
    await mockServices(page);
    await page.addInitScript(() => localStorage.setItem('gebietskarte_settings', 'show_gps,true'));
    await page.goto('/#search');
    await page.locator('#search .toolbar.gpson').getByRole('link', { name: 'GPS' }).click();
    await expect(page.locator('#gpstools')).toBeVisible();
    await page.click('#gps_getpos');
    await expect(page.locator('#gpsinfo')).toContainText('Ziel-Position gesetzt');
    await expect(page.locator('#location')).toHaveValue('52.347100 14.550600');
    await page.goto('/#search');
    await expect(page.locator('#result')).toContainText('außerhalb aller Zonen');
  });
});

test('credits list the new services', async ({ page }) => {
  await mockServices(page);
  await page.goto('/#about');
  const about = page.locator('#about');
  await expect(about).toContainText('Nominatim');
  await expect(about).toContainText('Valhalla');
  await expect(about).toContainText('OpenLayers');
  await expect(about).not.toContainText('MapQuest');
});

test('a cancelled GPS lookup does not set the destination later', async ({ page }) => {
  await mockServices(page);
  await page.addInitScript(() => {
    localStorage.setItem('gebietskarte_settings', 'show_gps,true');
    const pending = [];
    window.__resolveGps = () => pending.splice(0).forEach((ok) => ok({ coords: { latitude: 52.3471, longitude: 14.5506 } }));
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: (ok) => pending.push(ok), watchPosition: () => 1, clearWatch: () => {} },
    });
  });
  await page.goto('/#gpstools');
  await page.click('#gps_getpos');
  await page.click('#gps_cancel');
  await page.evaluate(() => window.__resolveGps());
  await expect(page.locator('#gps_getpos')).toBeVisible();
  await expect(page.locator('#gpsinfo')).not.toContainText('Ziel-Position gesetzt');
  await expect(page.locator('#location')).toHaveValue('');
});

test.describe('GPS reset', () => {
  test.use({ geolocation: { latitude: 52.45, longitude: 13.3 }, permissions: ['geolocation'] });

  test('recalculates the routes from the default start', async ({ page }) => {
    const calls = await mockServices(page);
    await page.addInitScript(() => localStorage.setItem('gebietskarte_settings', 'show_gps,true'));
    await page.goto('/#search');
    await page.fill('#location', '52.40 13.06');
    await page.click('#submitplace');
    await expect(page.locator('#result')).toContainText('Kürzeste Verbindung:');
    await page.goto('/#gpstools');
    await page.click('#gps_setpos');
    await expect(page.locator('#gpsinfo')).toContainText('Start-Position gesetzt');
    await expect.poll(() => calls.valhalla.at(-1).locations[0].lat).toBe(52.45);
    await page.click('#gps_reset');
    await expect.poll(() => calls.valhalla.at(-1).locations[0]).toEqual({ lat: 52.461527, lon: 13.363081 });
    await page.goto('/#search');
    await expect(page.locator('#result')).toContainText('Kürzeste Verbindung:');
  });
});

test('GPS errors are explained in German', async ({ page }) => {
  await mockServices(page);
  await page.addInitScript(() => {
    localStorage.setItem('gebietskarte_settings', 'show_gps,true');
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: (ok, err) => err({ code: 1, message: '' }), watchPosition: () => 1, clearWatch: () => {} },
    });
  });
  await page.goto('/#gpstools');
  await page.click('#gps_getpos');
  await expect(page.locator('#gpsinfo')).toHaveText('Position nicht verfügbar: Zugriff auf den Standort verweigert');
});

test.describe('GPS reset while routing', () => {
  test.use({ geolocation: { latitude: 52.45, longitude: 13.3 }, permissions: ['geolocation'] });

  test('a pending route from the GPS start cannot overwrite the reset result', async ({ page }) => {
    await mockServices(page);
    await page.route('**/valhalla1.openstreetmap.de/**', async (route) => {
      const req = JSON.parse(new URL(route.request().url()).searchParams.get('json'));
      const [a, b] = req.locations.map((l) => [l.lon, l.lat]);
      const fromGps = req.locations[0].lat === 52.45;
      if (fromGps) await new Promise((r) => setTimeout(r, 1500));
      return route.fulfill({
        json: { trip: { summary: { length: fromGps ? 11.1 : 22.2, time: 600 }, legs: [{ shape: encodePolyline([a, b], 6) }] } },
        headers: { 'access-control-allow-origin': '*' },
      });
    });
    await page.addInitScript(() => localStorage.setItem('gebietskarte_settings', 'show_gps,true;fastest,false;overhead_shortest,false'));
    await page.goto('/#search');
    await page.fill('#location', '52.40 13.06');
    await page.click('#submitplace');
    await expect(page.locator('#result')).toContainText('22.2 km');
    await page.goto('/#gpstools');
    await page.click('#gps_setpos');
    await expect(page.locator('#gpsinfo')).toContainText('Start-Position gesetzt');
    await page.click('#gps_reset');
    await page.waitForTimeout(2000);
    await expect(page.locator('#result')).toContainText('22.2 km');
    await expect(page.locator('#result')).not.toContainText('11.1 km');
  });

  test('keeps the address details of a searched destination', async ({ page }) => {
    await mockServices(page);
    await page.addInitScript(() => localStorage.setItem('gebietskarte_settings', 'show_gps,true;details,true'));
    await page.goto('/#search');
    await page.fill('#location', 'Frankfurt Oder');
    await page.click('#submitplace');
    await expect(page.locator('#result')).toContainText('Ergebnisqualität: Ort');
    await page.goto('/#gpstools');
    await page.click('#gps_reset');
    await page.goto('/#search');
    await expect(page.locator('#result')).toContainText('Kürzeste Verbindung:');
    await expect(page.locator('#result')).toContainText('Ergebnisqualität: Ort');
  });
});
