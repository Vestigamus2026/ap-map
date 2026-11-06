export const MSG_CHECK_PLACE = 'Bitte Ort prüfen!';
export const MSG_SERVICE_DOWN = 'Adresssuche zurzeit nicht möglich. Bitte später erneut versuchen.';
export const MSG_NO_ROUTE = 'Keine Route gefunden';

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
    let location;
    try {
      location = await api.geocode(text, { extent });
    } catch {
      return { ok: false, message: MSG_SERVICE_DOWN };
    }
    if (!location) return { ok: false, message: MSG_CHECK_PLACE };
    target = { point: location.point, location };
  } else {
    target = { point, location: null };
  }

  const zone = zones.lookup(target.point);
  const outsideAll = zone === 0;
  const motorway = (typed || target.location) && settings.show_bab && motorways ? motorways.locate(target.point) : null;

  const closestTask = (async () => {
    if (!(settings.closest && outsideAll)) return null;
    const closest = { ...zones.closestOnZone3(target.point), location: null };
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
  return { ok: true, target, zone, motorway, closest, shortest, fastest };
}
