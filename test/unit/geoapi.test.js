import { describe, it, expect, vi } from 'vitest';
import { createGeoApi, parseCoordinates, GeoApiError } from '../../src/lib/geoapi.js';
import { encodePolyline } from '../../src/lib/geo.js';

const jsonResponse = (body, status = 200) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });

function fakeFetch(handler) {
  const calls = [];
  const fn = vi.fn((url, init) => {
    calls.push({ url: new URL(url), init, at: Date.now() });
    return handler(new URL(url), init);
  });
  fn.calls = calls;
  return fn;
}

const NOMINATIM = 'https://nominatim.example/';
const VALHALLA = 'https://valhalla.example/';
const make = (fetch, extra = {}) =>
  createGeoApi({ fetch, nominatimUrl: NOMINATIM, valhallaUrl: VALHALLA, minIntervalMs: 0, ...extra });

const potsdam = {
  lat: '52.3915',
  lon: '13.0665',
  addresstype: 'house',
  category: 'building',
  type: 'yes',
  display_name: 'Babelsberger Straße 16, Potsdam',
  address: {
    road: 'Babelsberger Straße',
    house_number: '16',
    postcode: '14473',
    suburb: 'Teltower Vorstadt',
    city: 'Potsdam',
    state: 'Brandenburg',
    country: 'Deutschland',
    country_code: 'de',
  },
};

describe('parseCoordinates', () => {
  it('reads "lat lng" as written by the GPS and motorway tools', () => {
    expect(parseCoordinates('52.461527 13.363081')).toEqual([13.363081, 52.461527]);
  });

  it('accepts comma separators and German decimal commas', () => {
    expect(parseCoordinates('52.46, 13.36')).toEqual([13.36, 52.46]);
    expect(parseCoordinates(' 52,46 13,36 ')).toEqual([13.36, 52.46]);
    expect(parseCoordinates('52.46;13.36')).toEqual([13.36, 52.46]);
  });

  it('rejects addresses and out-of-range values', () => {
    expect(parseCoordinates('Potsdam')).toBeNull();
    expect(parseCoordinates('Hauptstraße 5, 14467 Potsdam')).toBeNull();
    expect(parseCoordinates('5 14467')).toBeNull();
    expect(parseCoordinates('95 13')).toBeNull();
    expect(parseCoordinates('')).toBeNull();
  });
});

describe('geocode (Nominatim)', () => {
  it('searches in Germany, prefers the configured area and normalizes the address', async () => {
    const fetch = fakeFetch(() => jsonResponse([potsdam]));
    const api = make(fetch);
    const loc = await api.geocode('Babelsberger Str. 16 Potsdam', { extent: [[52.9, 12.4], [51.9, 14.2]] });

    const url = fetch.calls[0].url;
    expect(url.origin + url.pathname).toBe('https://nominatim.example/search');
    expect(url.searchParams.get('q')).toBe('Babelsberger Str. 16 Potsdam');
    expect(url.searchParams.get('format')).toBe('jsonv2');
    expect(url.searchParams.get('addressdetails')).toBe('1');
    expect(url.searchParams.get('limit')).toBe('1');
    expect(url.searchParams.get('countrycodes')).toBe('de');
    expect(url.searchParams.get('accept-language')).toBe('de');
    expect(url.searchParams.get('viewbox')).toBe('12.4,52.9,14.2,51.9');

    expect(loc).toEqual({
      point: [13.0665, 52.3915],
      street: 'Babelsberger Straße 16',
      postalCode: '14473',
      district: 'Teltower Vorstadt',
      city: 'Potsdam',
      county: '',
      state: 'Brandenburg',
      countryCode: 'DE',
      quality: 'ADDRESS',
      qualityCode: 'house',
    });
  });

  it('does not call the service for coordinates', async () => {
    const fetch = fakeFetch(() => jsonResponse([]));
    const loc = await make(fetch).geocode('52.4 13.1');
    expect(fetch).not.toHaveBeenCalled();
    expect(loc.point).toEqual([13.1, 52.4]);
    expect(loc.quality).toBe('POINT');
  });

  it('returns null when nothing was found', async () => {
    expect(await make(fakeFetch(() => jsonResponse([]))).geocode('xyz')).toBeNull();
  });

  it('returns null for country-level matches (old MapQuest rule)', async () => {
    const country = { ...potsdam, addresstype: 'country', address: { country: 'Deutschland', country_code: 'de' } };
    expect(await make(fakeFetch(() => jsonResponse([country]))).geocode('Deutschland')).toBeNull();
  });

  it('throws a GeoApiError on HTTP errors', async () => {
    const api = make(fakeFetch(() => jsonResponse({}, 503)));
    await expect(api.geocode('Potsdam')).rejects.toBeInstanceOf(GeoApiError);
  });
});

describe('reverse (Nominatim)', () => {
  it('looks up the address of a point', async () => {
    const fetch = fakeFetch(() => jsonResponse(potsdam));
    const loc = await make(fetch).reverse([13.0665, 52.3915]);
    const url = fetch.calls[0].url;
    expect(url.pathname).toBe('/reverse');
    expect(url.searchParams.get('lat')).toBe('52.3915');
    expect(url.searchParams.get('lon')).toBe('13.0665');
    expect(url.searchParams.get('format')).toBe('jsonv2');
    expect(loc.city).toBe('Potsdam');
    expect(loc.street).toBe('Babelsberger Straße 16');
  });

  it('returns null when Nominatim cannot geocode the point', async () => {
    expect(await make(fakeFetch(() => jsonResponse({ error: 'Unable to geocode' }))).reverse([0, 0])).toBeNull();
  });

  it('keeps at least minIntervalMs between Nominatim requests (usage policy)', async () => {
    const fetch = fakeFetch(() => jsonResponse(potsdam));
    const api = make(fetch, { minIntervalMs: 60 });
    await Promise.all([api.reverse([13, 52]), api.reverse([13.1, 52]), api.geocode('Potsdam')]);
    const [a, b, c] = fetch.calls.map((x) => x.at);
    expect(b - a).toBeGreaterThanOrEqual(55);
    expect(c - b).toBeGreaterThanOrEqual(55);
  });
});

describe('route (Valhalla)', () => {
  const shape = encodePolyline([[13.36, 52.46], [13.2, 52.43], [13.06, 52.4]], 6);
  const trip = {
    trip: {
      summary: { length: 24.555, time: 3252.8 },
      legs: [{ shape }],
      status: 0,
    },
  };

  function requestJson(fetch) {
    return JSON.parse(fetch.calls[0].url.searchParams.get('json'));
  }

  it('requests the fastest car route with motorways allowed', async () => {
    const fetch = fakeFetch(() => jsonResponse(trip));
    const route = await make(fetch).route([13.36, 52.46], [13.06, 52.4], { shortest: false });

    expect(fetch.calls[0].url.origin + fetch.calls[0].url.pathname).toBe('https://valhalla.example/route');
    const req = requestJson(fetch);
    expect(req.locations).toEqual([{ lat: 52.46, lon: 13.36 }, { lat: 52.4, lon: 13.06 }]);
    expect(req.costing).toBe('auto');
    expect(req.units).toBe('kilometers');
    expect(req.directions_type).toBe('none');
    expect(req.costing_options.auto.shortest).toBe(false);
    expect(req.costing_options.auto.use_ferry).toBe(0);
    expect(req.costing_options.auto).not.toHaveProperty('use_highways');

    expect(route.distanceKm).toBe(24.555);
    expect(route.timeSeconds).toBe(3252.8);
    expect(route.points).toHaveLength(3);
    expect(route.points[0][0]).toBeCloseTo(13.36, 6);
    expect(route.points[0][1]).toBeCloseTo(52.46, 6);
  });

  it('requests the shortest route', async () => {
    const fetch = fakeFetch(() => jsonResponse(trip));
    await make(fetch).route([13.36, 52.46], [13.06, 52.4], { shortest: true });
    expect(requestJson(fetch).costing_options.auto.shortest).toBe(true);
  });

  it('joins the shapes of all legs', async () => {
    const two = { trip: { summary: { length: 1, time: 1 }, legs: [{ shape }, { shape }] } };
    const route = await make(fakeFetch(() => jsonResponse(two))).route([13, 52], [13.1, 52]);
    expect(route.points).toHaveLength(6);
  });

  it('throws a GeoApiError with the Valhalla message when no route exists', async () => {
    const api = make(fakeFetch(() => jsonResponse({ error_code: 442, error: 'No path could be found for input' }, 400)));
    await expect(api.route([13, 52], [0, 0])).rejects.toThrow('No path could be found for input');
  });
});

describe('geocodeAll (several hits)', () => {
  const netto = (lon, road) => ({ lat: '51.48', lon, name: 'Netto', addresstype: 'shop', address: { road, house_number: '1', postcode: '06112', city: 'Halle (Saale)', country_code: 'de' } });

  it('asks for up to 10 hits and returns all except whole countries', async () => {
    const country = { lat: '51', lon: '10', addresstype: 'country', address: { country_code: 'de' } };
    const fetch = fakeFetch(() => jsonResponse([netto('11.9', 'Böllberger Weg'), netto('12.0', 'Industriestraße'), country]));
    const all = await make(fetch).geocodeAll('Netto', { extent: [[51.55, 11.85], [51.4, 12.1]] });
    expect(fetch.calls[0].url.searchParams.get('limit')).toBe('10');
    expect(fetch.calls[0].url.searchParams.get('viewbox')).toBe('11.85,51.55,12.1,51.4');
    expect(all.map((l) => [l.name, l.street, l.point])).toEqual([
      ['Netto', 'Böllberger Weg 1', [11.9, 51.48]],
      ['Netto', 'Industriestraße 1', [12, 51.48]],
    ]);
  });

  it('returns the point itself for coordinates', async () => {
    const fetch = fakeFetch(() => jsonResponse([]));
    const all = await make(fetch).geocodeAll('51.48 11.97');
    expect(all.map((l) => l.point)).toEqual([[11.97, 51.48]]);
    expect(fetch.calls).toHaveLength(0);
  });
});
