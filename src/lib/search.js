import { choiceLabel } from './results.js';

export const MSG_CHECK_PLACE = 'Bitte Ort prüfen!';
export const MSG_SERVICE_DOWN = 'Adresssuche zurzeit nicht möglich. Bitte später erneut versuchen.';
export const MSG_NO_ROUTE = 'Keine Route gefunden';
export const MSG_CHOOSE = 'Mehrere Treffer, bitte auswählen:';

const orNull = (promise) => promise.catch(() => null);

async function analyseRoute({ start, target, shortest, withOutside, withExit, api, zones }) {
  let route;
  try {
    route = await api.route(start, target, { shortest });
  } catch {
    return { error: MSG_NO_ROUTE };
  }
  let outside = null;
  if (withOutside) {
    outside = { ...zones.outsideStretch(route.points), exit: null };
    if (withExit) {
      const [rest, location] = await Promise.all([
        orNull(api.route(outside.lastOutside, target, { shortest })),
        orNull(api.reverse(outside.lastOutside)),
      ]);
      outside.exit = { location, timeSeconds: rest ? rest.timeSeconds : null };
    }
  }
  return { ...route, outside };
}

export async function runSearch({ query, point, target: resolved = null, start, settings, api, zones, motorways = null, extent }) {
  let target;
  const typed = point == null && resolved == null;
  if (resolved) {
    target = resolved;
  } else if (typed) {
    const text = (query || '').trim();
    if (!text) return { ok: false, message: MSG_CHECK_PLACE };
    let hits;
    try {
      hits = await api.geocodeAll(text, { extent });
    } catch {
      return { ok: false, message: MSG_SERVICE_DOWN };
    }
    const keys = hits.map((h) => `${choiceLabel(h)}|${h.point.map((v) => v.toFixed(4))}`);
    const choices = hits.filter((_, i) => keys.indexOf(keys[i]) === i);
    if (!choices.length) return { ok: false, message: MSG_CHECK_PLACE };
    if (choices.length > 1) return { ok: false, message: MSG_CHOOSE, choices };
    target = { point: choices[0].point, location: choices[0] };
  } else {
    target = { point, location: null };
  }

  const zone = zones.lookup(target.point);
  const outsideAll = zone === 0;
  const motorway = (typed || target.location) && settings.show_bab && motorways ? motorways.locate(target.point) : null;

  const closestTask = (async () => {
    if (!(settings.closest && outsideAll)) return null;
    const closest = { ...zones.closestOnOuter(target.point), location: null };
    if (settings.show_endpoints) closest.location = await orNull(api.reverse(closest.point));
    return closest;
  })();

  const routeTask = (shortest) => {
    const key = shortest ? 'shortest' : 'fastest';
    if (!settings[key]) return Promise.resolve(null);
    return analyseRoute({
      start,
      target: target.point,
      shortest,
      withOutside: settings[`overhead_${key}`] && outsideAll,
      withExit: settings.show_endpoints,
      api,
      zones,
    });
  };

  const [closest, shortest, fastest] = await Promise.all([closestTask, routeTask(true), routeTask(false)]);
  return { ok: true, target, zone, outerZone: zones.outer, motorway, closest, shortest, fastest };
}
