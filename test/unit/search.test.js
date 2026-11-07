import { describe, it, expect, vi } from 'vitest';
import { runSearch } from '../../src/lib/search.js';
import { createZones } from '../../src/lib/zones.js';
import { buildMotorways } from '../../src/lib/motorways.js';
import { encodePolyline } from '../../src/lib/geo.js';
import { DEFAULT_SETTINGS } from '../../src/lib/settings.js';

const ring = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
const zones = createZones({
  zone1: [ring(13.3, 52.4, 13.4, 52.5)],
  zone2: [ring(13.2, 52.3, 13.5, 52.6)],
  zone3: [ring(13.0, 52.0, 14.0, 53.0)],
});
const start = [13.35, 52.45];
const outside = [14.5, 52.5];
const inZone2 = [13.25, 52.35];

function fakeApi(overrides = {}) {
  return {
    geocodeAll: vi.fn(async (q) => (q === 'nirgendwo' ? [] : [{ point: outside, city: 'Frankfurt (Oder)', quality: 'CITY', qualityCode: 'city' }])),
    reverse: vi.fn(async (p) => ({ point: p, city: 'Ausstieg', countryCode: 'DE' })),
    route: vi.fn(async (from, to, { shortest } = {}) => ({
      distanceKm: shortest ? 100 : 120,
      timeSeconds: shortest ? 4000 : 3600,
      points: [from, [13.9, 52.5], [14.2, 52.5], to],
    })),
    ...overrides,
  };
}

const settings = (over = {}) => ({ ...DEFAULT_SETTINGS, ...over });

describe('runSearch', () => {
  it('fails with "Bitte Ort prüfen!" for an empty query', async () => {
    const api = fakeApi();
    const r = await runSearch({ query: '  ', start, settings: settings(), api, zones });
    expect(r).toEqual({ ok: false, message: 'Bitte Ort prüfen!' });
    expect(api.geocodeAll).not.toHaveBeenCalled();
  });

  it('fails with "Bitte Ort prüfen!" when the address is unknown', async () => {
    const r = await runSearch({ query: 'nirgendwo', start, settings: settings(), api: fakeApi(), zones });
    expect(r).toEqual({ ok: false, message: 'Bitte Ort prüfen!' });
  });

  it('reports a service outage instead of crashing', async () => {
    const api = fakeApi({ geocodeAll: vi.fn(async () => { throw new Error('offline'); }) });
    const r = await runSearch({ query: 'Potsdam', start, settings: settings(), api, zones });
    expect(r.ok).toBe(false);
    expect(r.message).toBe('Adresssuche zurzeit nicht möglich. Bitte später erneut versuchen.');
  });

  it('geocodes the address, finds the zone and computes both routes', async () => {
    const api = fakeApi();
    const r = await runSearch({ query: 'Frankfurt Oder', start, settings: settings(), api, zones });
    expect(r.ok).toBe(true);
    expect(r.target.point).toEqual(outside);
    expect(r.target.location.city).toBe('Frankfurt (Oder)');
    expect(r.zone).toBe(0);
    expect(api.route).toHaveBeenCalledWith(start, outside, { shortest: true });
    expect(api.route).toHaveBeenCalledWith(start, outside, { shortest: false });
    expect(r.shortest.distanceKm).toBe(100);
    expect(r.fastest.distanceKm).toBe(120);
  });

  it('computes the distance outside zone 3 for both routes', async () => {
    const r = await runSearch({ query: 'x', start, settings: settings(), api: fakeApi(), zones });
    expect(r.shortest.outside.distanceKm).toBeCloseTo(20.3, 0);
    expect(r.shortest.outside.lastOutside).toEqual([14.2, 52.5]);
    expect(r.shortest.outside.exit).toBeNull();
    expect(r.fastest.outside.distanceKm).toBeCloseTo(20.3, 0);
  });

  it('looks up exit points and remaining drive time when "Schnittpunkte" is on', async () => {
    const api = fakeApi();
    const r = await runSearch({ query: 'x', start, settings: settings({ show_endpoints: true }), api, zones });
    expect(api.route).toHaveBeenCalledWith([14.2, 52.5], outside, { shortest: true });
    expect(api.route).toHaveBeenCalledWith([14.2, 52.5], outside, { shortest: false });
    expect(api.reverse).toHaveBeenCalledWith([14.2, 52.5]);
    expect(r.shortest.outside.exit.location.city).toBe('Ausstieg');
    expect(r.shortest.outside.exit.timeSeconds).toBe(4000);
    expect(r.fastest.outside.exit.timeSeconds).toBe(3600);
  });

  it('skips the outside calculation inside a zone', async () => {
    const api = fakeApi({ geocodeAll: vi.fn(async () => [{ point: inZone2 }]) });
    const r = await runSearch({ query: 'x', start, settings: settings({ show_endpoints: true, closest: true }), api, zones });
    expect(r.zone).toBe(2);
    expect(r.shortest.outside).toBeNull();
    expect(r.closest).toBeNull();
    expect(api.route).toHaveBeenCalledTimes(2);
  });

  it('honours disabled route options', async () => {
    const api = fakeApi();
    const r = await runSearch({
      query: 'x',
      start,
      settings: settings({ shortest: false, overhead_fastest: false }),
      api,
      zones,
    });
    expect(r.shortest).toBeNull();
    expect(r.fastest.outside).toBeNull();
    expect(api.route).toHaveBeenCalledTimes(1);
  });

  it('computes the straight-line distance to zone 3 and its address on demand', async () => {
    const api = fakeApi();
    const r = await runSearch({
      query: 'x',
      start,
      settings: settings({ closest: true, show_endpoints: true, shortest: false, fastest: false }),
      api,
      zones,
    });
    expect(r.closest.distanceKm).toBeCloseTo(33.8, 0);
    expect(r.closest.point[0]).toBeCloseTo(14, 6);
    expect(r.closest.location.city).toBe('Ausstieg');
  });

  it('keeps the zone result when routing fails', async () => {
    const api = fakeApi({ route: vi.fn(async () => { throw new Error('No path could be found'); }) });
    const r = await runSearch({ query: 'x', start, settings: settings(), api, zones });
    expect(r.ok).toBe(true);
    expect(r.zone).toBe(0);
    expect(r.shortest).toEqual({ error: 'Keine Route gefunden' });
    expect(r.fastest).toEqual({ error: 'Keine Route gefunden' });
  });

  it('keeps the route when the exit-point address lookup fails', async () => {
    const api = fakeApi({ reverse: vi.fn(async () => { throw new Error('429'); }) });
    const r = await runSearch({ query: 'x', start, settings: settings({ show_endpoints: true }), api, zones });
    expect(r.shortest.outside.exit.location).toBeNull();
    expect(r.shortest.outside.exit.timeSeconds).toBe(4000);
  });

  it('uses a given point without geocoding (GPS / motorway kilometre)', async () => {
    const api = fakeApi();
    const r = await runSearch({ point: inZone2, start, settings: settings(), api, zones });
    expect(api.geocodeAll).not.toHaveBeenCalled();
    expect(r.target).toEqual({ point: inZone2, location: null });
    expect(r.zone).toBe(2);
  });

  it('reuses an already resolved target without geocoding again', async () => {
    const motorways = buildMotorways({
      A9_up: { name: 'BAB 9', bab: 9, ascending: true, offset: 5, shape: encodePolyline([[14.5, 52.4], [14.5, 52.6]], 6) },
    });
    const api = fakeApi();
    const location = { point: outside, city: 'Frankfurt (Oder)', quality: 'CITY', qualityCode: 'city' };
    const r = await runSearch({ target: { point: outside, location }, start, settings: settings({ show_bab: true }), api, zones, motorways });
    expect(api.geocodeAll).not.toHaveBeenCalled();
    expect(r.ok).toBe(true);
    expect(r.target.location).toEqual(location);
    expect(r.motorway.section.key).toBe('A9_up');
    expect(r.shortest.distanceKm).toBe(100);
  });

  it('detects a point on a motorway for typed searches when the motorway tool is on', async () => {
    const motorways = buildMotorways({
      A9_up: { name: 'BAB 9', bab: 9, ascending: true, offset: 5, shape: encodePolyline([[14.5, 52.4], [14.5, 52.6]], 6) },
    });
    const opts = { query: 'x', start, api: fakeApi(), zones, motorways };
    const on = await runSearch({ ...opts, settings: settings({ show_bab: true }) });
    expect(on.motorway.section.key).toBe('A9_up');
    expect(on.motorway.km).toBeCloseTo(16.1, 0);

    const off = await runSearch({ ...opts, settings: settings() });
    expect(off.motorway).toBeNull();

    const byPoint = await runSearch({ ...opts, query: undefined, point: outside, settings: settings({ show_bab: true }) });
    expect(byPoint.motorway).toBeNull();
  });
});

describe('several hits', () => {
  const netto = (point, street) => ({ point, name: 'Netto', street, city: 'Halle (Saale)', quality: 'POINT', qualityCode: 'shop' });

  it('asks to choose when the address has several different hits', async () => {
    const hits = [netto(outside, 'Böllberger Weg 168'), netto(inZone2, 'Industriestraße 116')];
    const api = fakeApi({ geocodeAll: vi.fn(async () => hits) });
    const r = await runSearch({ query: 'Netto', start, settings: DEFAULT_SETTINGS, api, zones });
    expect(r).toEqual({ ok: false, message: 'Mehrere Treffer, bitte auswählen:', choices: hits });
    expect(api.route).not.toHaveBeenCalled();
  });

  it('uses the hit directly when all hits are the same place', async () => {
    const api = fakeApi({ geocodeAll: vi.fn(async () => [netto(inZone2, 'Lutherplatz'), netto(inZone2, 'Lutherplatz')]) });
    const r = await runSearch({ query: 'Netto', start, settings: DEFAULT_SETTINGS, api, zones });
    expect(r.ok).toBe(true);
    expect(r.zone).toBe(2);
  });
});
