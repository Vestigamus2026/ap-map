import { test, expect } from '@playwright/test';
import { encodePolyline } from '../../src/lib/geo.js';
import { mockServices, collectErrors, frankfurtOder } from './helpers.js';

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
  await expect(page.locator('#about h1')).toHaveText('Credits');
  await expect(about).toContainText('© Sven Hering 2015, Neuaufbau 2026');
  await expect(about).toContainText('Nominatim');
  await expect(about).toContainText('Valhalla');
  await expect(about).toContainText('OpenLayers');
  await expect(about).not.toContainText('MapQuest');
  await page.goto('/#show_map');
  await expect(page.locator('#show_map .ol-attribution ul')).toContainText('Programm: © 2015, Neuaufbau 2026 KLUPEA GmbH');
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

test.describe('Einstellungsdatei config.json', () => {
  const square = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
  const custom = {
    mapName: 'Testgebiet Nord',
    home: [10.0, 53.55],
    colors: { shortestRoute: 'rgb(0, 0, 255)' },
    zones: {
      zone1: square(9.9, 53.5, 10.1, 53.6),
      zone2: square(9.8, 53.4, 10.2, 53.7),
      zone3: square(9.5, 53.2, 10.5, 53.9),
    },
  };

  test('shows the original zone source by default', async ({ page }) => {
    await mockServices(page);
    await page.goto('/#about');
    await expect(page.locator('#zone_credit')).toHaveText('Zonendaten: Januar 2015, assistance partner GmbH & Co. KG');
    await page.goto('/#show_map');
    await expect(page.locator('#show_map .ol-attribution ul')).toContainText('Zonendaten: Januar 2015, assistance partner GmbH & Co. KG');
  });

  test('shows the zone sources from the file in the Credits and the map attribution', async ({ page }) => {
    await mockServices(page);
    await page.route('**/config.json', (route) => route.fulfill({ json: { ...custom, zoneSources: { zone1: 'OSM-Test' } } }));
    await page.goto('/#about');
    const credit = 'Zonendaten: Zone 1: OSM-Test; Zone 2 und 3: Januar 2015, assistance partner GmbH & Co. KG';
    await expect(page.locator('#zone_credit')).toHaveText(credit);
    await page.goto('/#show_map');
    await expect(page.locator('#show_map .ol-attribution ul')).toContainText(credit);
  });

  test('shows zone sources as plain text, not as HTML', async ({ page }) => {
    await mockServices(page);
    const evil = '<img src=x onerror="window.injected=1">';
    await page.route('**/config.json', (route) => route.fulfill({ json: { ...custom, zoneSources: { zone1: evil, zone2: evil, zone3: evil } } }));
    await page.goto('/#show_map');
    const attribution = page.locator('#show_map .ol-attribution ul');
    await expect(attribution).toContainText(`Zonendaten: ${evil}`);
    await expect(attribution.locator('img[src="x"]')).toHaveCount(0);
    expect(await page.evaluate(() => window.injected)).toBeUndefined();
  });

  test('uses map name, home position, zones and colours from the file', async ({ page }) => {
    const calls = await mockServices(page);
    await page.route('**/config.json', (route) => route.fulfill({ json: custom }));
    await page.goto('/#search');
    await expect(page).toHaveTitle('Testgebiet Nord');
    await page.fill('#location', '53.55 10.05');
    await page.click('#submitplace');
    await expect(page.locator('#result')).toContainText('Diese Position befindet sich in Zone 1.');
    await expect.poll(() => calls.valhalla.at(-1)?.locations[0]).toEqual({ lat: 53.55, lon: 10 });
    const shortest = page.locator('#result > li', { hasText: 'Kürzeste Verbindung:' }).locator('ul.sublist');
    await expect(shortest).toHaveCSS('background-color', 'rgb(0, 0, 255)');
  });

  test('opens with both the zones and a home position outside of them in view', async ({ page }) => {
    await mockServices(page);
    const km = async () => {
      const text = await page.locator('.ol-scale-line-inner').textContent();
      return Number(text.replace(/[^0-9.]/g, '')) * (text.includes(' m') && !text.includes('km') ? 0.001 : 1);
    };
    await page.route('**/config.json', (route) => route.fulfill({ json: custom }));
    await page.goto('/');
    await expect(page.locator('.ol-scale-line-inner')).toContainText('m');
    const zonesOnly = await km();
    await page.unroute('**/config.json');
    await page.route('**/config.json', (route) => route.fulfill({ json: { ...custom, home: [11.58, 48.14] } }));
    await page.reload();
    await expect(page.locator('.ol-scale-line-inner')).toContainText('m');
    await expect.poll(km).toBeGreaterThanOrEqual(zonesOnly * 4);
  });

  test('zooms out further than usual when home is very far from the zones', async ({ page }) => {
    await mockServices(page);
    await page.route('**/config.json', (route) => route.fulfill({ json: { ...custom, home: [-9.14, 38.72], colors: { fastestRoute: 'hwb(0 0% 0%)' } } }));
    await page.goto('/');
    const bar = page.locator('.ol-scale-line-inner');
    await expect(bar).toContainText('km');
    // Hamburg to Lisbon needs more than 4 km per pixel on a 414 px wide screen; zoom level 5 gives about 3.4.
    await expect.poll(async () => {
      const km = Number((await bar.textContent()).replace(/[^0-9.]/g, ''));
      const px = await bar.evaluate((el) => el.getBoundingClientRect().width);
      return km / px;
    }).toBeGreaterThan(4);
  });

  test('shows a German error for a broken file', async ({ page }) => {
    await mockServices(page);
    await page.route('**/config.json', (route) => route.fulfill({ json: { ...custom, home: 'Hamburg' } }));
    await page.goto('/');
    await expect(page.locator('body')).toContainText('Fehler in der Einstellungsdatei: "home" muss [Länge, Breite] sein.');
  });

  test('is part of the build with the original values', async ({ page }) => {
    const res = await page.request.get('/config.json');
    expect(res.ok()).toBe(true);
    const c = await res.json();
    expect(c.mapName).toBe('Kroll APG 607');
    expect(c.home).toEqual([13.363081, 52.461527]);
    expect(c.zones.zone3).toHaveLength(11);
  });
});

test('GPS page and settings use German labels', async ({ page }) => {
  await mockServices(page);
  await page.addInitScript(() => localStorage.setItem('gebietskarte_settings', 'show_gps,true'));
  await page.goto('/#gpstools');
  await expect(page.locator('#gpstools h1')).toHaveText('GPS-Werkzeuge');
  await page.goto('/#settings');
  await expect(page.locator('#settings')).toContainText('Zeige GPS-Werkzeuge?');
  await expect(page.locator('body')).not.toContainText(/Tools?\b|Tracking|Operation|Kredits/);
});
