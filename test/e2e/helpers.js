import { encodePolyline } from '../../src/lib/geo.js';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

export const frankfurtOder = {
  lat: '52.3471',
  lon: '14.5506',
  addresstype: 'city',
  address: { city: 'Frankfurt (Oder)', state: 'Brandenburg', country_code: 'de' },
};

export async function mockServices(page, { places = [frankfurtOder] } = {}) {
  const calls = { nominatim: [], valhalla: [] };
  await page.route('**/tile.openstreetmap.de/**', (route) => route.fulfill({ contentType: 'image/png', body: PNG_1X1, headers: { 'access-control-allow-origin': '*' } }));
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

export function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
}
