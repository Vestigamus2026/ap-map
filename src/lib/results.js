import { formatKm, formatDuration, formatLocation, formatCoordinates } from './format.js';

export const SHORTEST_COLOR = 'rgba(55, 158, 86, 0.6)';
export const FASTEST_COLOR = 'rgba(237, 26, 26, 0.6)';
export const CLOSEST_COLOR = 'lightgray';

const QUALITY_DE = {
  ADDRESS: 'Adresse',
  STREET: 'Straße',
  ZIP: 'Postleitzahl',
  CITY: 'Ort',
  COUNTY: 'Landkreis',
  STATE: 'Bundesland',
  COUNTRY: 'Land',
  POINT: 'Punkt',
};

export function entryText(entry) {
  const main = entry.text + (entry.km != null ? formatKm(entry.km) : '');
  return entry.coordinates ? `${main} ${entry.coordinates}` : main;
}

function routeEntry(title, color, route, settings, outer) {
  if (route.error) return { text: title, color, items: [{ text: route.error }] };
  const coords = (p) => (settings.show_coordinaten && p ? formatCoordinates(p) : undefined);
  const items = [{ text: '', km: route.distanceKm }];
  if (settings.show_times) items.push({ text: `Fahrzeit ${formatDuration(route.timeSeconds)} h` });
  if (route.outside) {
    const o = route.outside;
    items.push({ text: `davon außerhalb Zone ${outer}: `, km: o.distanceKm, coordinates: coords(o.firstInside || o.lastOutside) });
    if (o.exit) {
      if (o.exit.location) items.push({ text: formatLocation(o.exit.location) });
      if (settings.show_times && o.exit.timeSeconds != null) {
        items.push({ text: `Fahrzeit von dort noch ${formatDuration(o.exit.timeSeconds)} h` });
      }
    }
  }
  return { text: title, color, items };
}

export function buildResultEntries(result, settings, colors = { shortestRoute: SHORTEST_COLOR, fastestRoute: FASTEST_COLOR }) {
  if (!result.ok) return [{ text: result.message }];
  const coords = (p) => (settings.show_coordinaten && p ? formatCoordinates(p) : undefined);
  const entries = [];
  const outer = result.outerZone ?? 3;
  const where = result.zone > 0 ? `in Zone ${result.zone}.` : 'außerhalb aller Zonen.';
  entries.push({ text: `Diese Position befindet sich ${where}`, coordinates: coords(result.target.point) });

  const loc = result.target.location;
  if (settings.details && loc) {
    entries.push({
      text: `${formatLocation(loc)} Ergebnisqualität: ${QUALITY_DE[loc.quality] || QUALITY_DE.POINT}`,
      coordinates: coords(result.target.point),
    });
  }

  if (result.motorway) {
    const { section, km } = result.motorway;
    entries.push({
      text: `Punkt auf der Autobahn A${section.bab} bei km ${km.toFixed(1)}! Kilometer und Autobahn eingetragen.`,
      highlight: true,
      coordinates: coords(result.motorway.point),
    });
  }

  if (result.closest) {
    const items = [{ text: 'Luftlinie ', km: result.closest.distanceKm, coordinates: coords(result.closest.point) }];
    if (result.closest.location) items.push({ text: formatLocation(result.closest.location) });
    entries.push({ text: `Entfernung zu Zone ${outer}`, color: CLOSEST_COLOR, items });
  }

  if (result.shortest) entries.push(routeEntry('Kürzeste Verbindung:', colors.shortestRoute, result.shortest, settings, outer));
  if (result.fastest) entries.push(routeEntry('Schnellste Verbindung:', colors.fastestRoute, result.fastest, settings, outer));
  return entries;
}
