import { decodePolyline } from './geo.js';

export const DEFAULT_NOMINATIM_URL = 'https://nominatim.openstreetmap.org/';
export const DEFAULT_VALHALLA_URL = 'https://valhalla1.openstreetmap.de/';

export class GeoApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'GeoApiError';
    this.status = status;
  }
}

const NUMBER = '(-?\\d{1,3}(?:[.,]\\d+)?)';
const COORDINATES = new RegExp(`^\\s*${NUMBER}\\s*[\\s,;]\\s*${NUMBER}\\s*$`);

// "lat lng" (wie von GPS- und Autobahn-Werkzeug eingetragen) -> [lng, lat]
export function parseCoordinates(text) {
  const m = COORDINATES.exec(text || '');
  if (!m) return null;
  const lat = Number(m[1].replace(',', '.'));
  const lng = Number(m[2].replace(',', '.'));
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return [lng, lat];
}

const QUALITY = {
  house: 'ADDRESS',
  building: 'ADDRESS',
  road: 'STREET',
  postcode: 'ZIP',
  city: 'CITY',
  town: 'CITY',
  village: 'CITY',
  hamlet: 'CITY',
  municipality: 'CITY',
  suburb: 'CITY',
  city_district: 'CITY',
  borough: 'CITY',
  quarter: 'CITY',
  neighbourhood: 'CITY',
  county: 'COUNTY',
  state: 'STATE',
  country: 'COUNTRY',
};

function emptyLocation(point, quality, qualityCode) {
  return { point, street: '', postalCode: '', district: '', city: '', county: '', state: '', countryCode: '', quality, qualityCode };
}

function normalizePlace(place) {
  const a = place.address || {};
  const road = a.road || a.pedestrian || a.square || a.footway || '';
  return {
    point: [Number(place.lon), Number(place.lat)],
    street: [road, road && a.house_number].filter(Boolean).join(' '),
    postalCode: a.postcode || '',
    district: a.suburb || a.city_district || a.borough || a.quarter || a.neighbourhood || '',
    city: a.city || a.town || a.village || a.municipality || a.hamlet || '',
    county: a.county || '',
    state: a.state || '',
    countryCode: (a.country_code || '').toUpperCase(),
    quality: QUALITY[place.addresstype] || 'POINT',
    qualityCode: place.addresstype || '',
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createGeoApi({
  fetch = (...args) => globalThis.fetch(...args),
  nominatimUrl = DEFAULT_NOMINATIM_URL,
  valhallaUrl = DEFAULT_VALHALLA_URL,
  minIntervalMs = 1000,
  countryCodes = 'de',
  language = 'de',
} = {}) {
  let queue = Promise.resolve();
  let lastRequest = -Infinity;

  // Nominatim-Nutzungsrichtlinie: höchstens eine Anfrage pro Sekunde
  const throttled = (task) => {
    const run = queue.then(async () => {
      const wait = lastRequest + minIntervalMs - Date.now();
      if (wait > 0) await sleep(wait);
      lastRequest = Date.now();
      return task();
    });
    queue = run.catch(() => {});
    return run;
  };

  async function getJson(url) {
    let response;
    try {
      response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    } catch (e) {
      throw new GeoApiError(`Dienst nicht erreichbar: ${e.message}`);
    }
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (!response.ok) {
      throw new GeoApiError((body && body.error) || `HTTP ${response.status}`, response.status);
    }
    return body;
  }

  const nominatim = (path, params) => {
    const url = new URL(path, nominatimUrl);
    for (const [k, v] of Object.entries({ format: 'jsonv2', addressdetails: '1', 'accept-language': language, ...params })) {
      url.searchParams.set(k, v);
    }
    return throttled(() => getJson(url));
  };

  async function geocode(text, { extent } = {}) {
    const point = parseCoordinates(text);
    if (point) return emptyLocation(point, 'POINT', 'coordinates');
    const params = { q: text, limit: '1', countrycodes: countryCodes };
    if (extent) {
      const [[north, west], [south, east]] = extent;
      params.viewbox = [west, north, east, south].join(',');
    }
    const results = await nominatim('search', params);
    const place = Array.isArray(results) ? results[0] : null;
    if (!place) return null;
    const location = normalizePlace(place);
    return location.quality === 'COUNTRY' ? null : location;
  }

  async function reverse([lng, lat]) {
    const place = await nominatim('reverse', { lat: String(lat), lon: String(lng), zoom: '18' });
    if (!place || place.error) return null;
    return normalizePlace(place);
  }

  async function route(from, to, { shortest = false } = {}) {
    const request = {
      locations: [from, to].map(([lon, lat]) => ({ lat, lon })),
      costing: 'auto',
      costing_options: { auto: { shortest, use_ferry: 0 } },
      units: 'kilometers',
      directions_type: 'none',
    };
    const url = new URL('route', valhallaUrl);
    url.searchParams.set('json', JSON.stringify(request));
    const body = await getJson(url);
    const trip = body && body.trip;
    if (!trip || !trip.summary) throw new GeoApiError('Keine Route erhalten');
    return {
      distanceKm: trip.summary.length,
      timeSeconds: trip.summary.time,
      points: trip.legs.flatMap((leg) => decodePolyline(leg.shape, 6)),
    };
  }

  return { geocode, reverse, route };
}
