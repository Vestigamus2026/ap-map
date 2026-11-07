import { describe, it, expect } from 'vitest';
import { buildResultEntries, entryText } from '../../src/lib/results.js';
import { DEFAULT_SETTINGS } from '../../src/lib/settings.js';

const settings = (over = {}) => ({ ...DEFAULT_SETTINGS, ...over });
const target = { point: [14.5, 52.5], location: { street: 'Markt 1', postalCode: '15230', city: 'Frankfurt (Oder)', countryCode: 'DE', quality: 'ADDRESS', qualityCode: 'house' } };
const route = (km, s) => ({
  distanceKm: km,
  timeSeconds: s,
  points: [],
  outside: { distanceKm: 40.62, lastOutside: [14.2, 52.5], firstInside: [13.9, 52.5], exit: { location: { city: 'Ausstieg', countryCode: 'DE' }, timeSeconds: 1800 } },
});
const full = {
  ok: true,
  target,
  zone: 0,
  motorway: null,
  closest: { point: [14, 52.5], distanceKm: 33.84, location: { city: 'Rand', countryCode: 'DE' } },
  shortest: route(100, 4000),
  fastest: route(120, 3600),
};

describe('buildResultEntries', () => {
  it('shows the failure message', () => {
    const e = buildResultEntries({ ok: false, message: 'Bitte Ort prüfen!' }, settings());
    expect(e.map(entryText)).toEqual(['Bitte Ort prüfen!']);
  });

  it('describes the zone', () => {
    expect(entryText(buildResultEntries({ ...full, zone: 2 }, settings())[0])).toBe('Diese Position befindet sich in Zone 2.');
    expect(entryText(buildResultEntries(full, settings())[0])).toBe('Diese Position befindet sich außerhalb aller Zonen.');
  });

  it('lists shortest and fastest routes like the old version', () => {
    const e = buildResultEntries(full, settings({ show_endpoints: true }));
    const shortest = e.find((x) => x.text === 'Kürzeste Verbindung:');
    expect(shortest.color).toBe('rgba(55, 158, 86, 0.6)');
    expect(shortest.items.map(entryText)).toEqual([
      '100.0 km',
      'Fahrzeit 01:06:40 h',
      'davon außerhalb Zone 3: 40.6 km',
      'Ausstieg (DE)',
      'Fahrzeit von dort noch 00:30:00 h',
    ]);
    const fastest = e.find((x) => x.text === 'Schnellste Verbindung:');
    expect(fastest.color).toBe('rgba(237, 26, 26, 0.6)');
    expect(fastest.items.map(entryText)[1]).toBe('Fahrzeit 01:00:00 h');
  });

  it('hides travel times when "Fahrzeiten" is off', () => {
    const e = buildResultEntries(full, settings({ show_times: false, show_endpoints: true }));
    const texts = e.find((x) => x.text === 'Kürzeste Verbindung:').items.map(entryText);
    expect(texts.some((t) => t.startsWith('Fahrzeit'))).toBe(false);
  });

  it('shows the straight-line distance to zone 3', () => {
    const e = buildResultEntries(full, settings());
    const closest = e.find((x) => x.text === 'Entfernung zu Zone 3');
    expect(closest.items.map(entryText)).toEqual(['Luftlinie 33.8 km', 'Rand (DE)']);
  });

  it('shows the result quality in German, also for unknown kinds', () => {
    const point = buildResultEntries({ ...full, target: { ...target, location: { ...target.location, quality: 'POINT', qualityCode: 'square' } } }, settings({ details: true }));
    expect(entryText(point[1])).toMatch(/Ergebnisqualität: Punkt$/);
    expect(entryText(point[1])).not.toContain('square');
  });

  it('shows address details and quality on demand', () => {
    const e = buildResultEntries(full, settings({ details: true }));
    expect(entryText(e[1])).toBe('Markt 1, 15230 Frankfurt (Oder) (DE) Ergebnisqualität: Adresse');
  });

  it('appends coordinates only when "Koordinaten" is on', () => {
    expect(entryText(buildResultEntries(full, settings({ show_coordinaten: true }))[0])).toBe(
      'Diese Position befindet sich außerhalb aller Zonen. [52.500000 14.500000]',
    );
    expect(entryText(buildResultEntries(full, settings())[0])).not.toContain('[');
  });

  it('reports a route error', () => {
    const e = buildResultEntries({ ...full, fastest: { error: 'Keine Route gefunden' } }, settings());
    expect(e.find((x) => x.text === 'Schnellste Verbindung:').items.map(entryText)).toEqual(['Keine Route gefunden']);
  });

  it('mentions a detected motorway kilometre', () => {
    const e = buildResultEntries({ ...full, motorway: { section: { key: 'A3_up', bab: 3 }, km: 12.34 } }, settings());
    expect(e.map(entryText)).toContain('Punkt auf der Autobahn A3 bei km 12.3! Kilometer und Autobahn eingetragen.');
  });
});

describe('several hits', () => {
  it('lists the hits to choose from', () => {
    const hits = [
      { name: 'Netto', street: 'Böllberger Weg 168', postalCode: '06128', city: 'Halle (Saale)', point: [11.95, 51.46] },
      { street: 'Industriestraße 116', city: 'Halle (Saale)', point: [11.97, 51.43] },
      { name: 'Halle (Saale)', city: 'Halle (Saale)', point: [11.97, 51.48] },
    ];
    const e = buildResultEntries({ ok: false, message: 'Mehrere Treffer, bitte auswählen:', choices: hits }, DEFAULT_SETTINGS);
    expect(e.map(entryText)).toEqual([
      'Mehrere Treffer, bitte auswählen:',
      'Netto, Böllberger Weg 168, 06128 Halle (Saale)',
      'Industriestraße 116, Halle (Saale)',
      'Halle (Saale)',
    ]);
    expect(e[1].choice).toBe(hits[0]);
  });
});
