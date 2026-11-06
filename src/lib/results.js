import { formatKm, formatDuration, formatLocation, formatCoordinates } from './format.js';

export const SHORTEST_COLOR = 'rgba(55, 158, 86, 0.6)';
export const FASTEST_COLOR = 'rgba(237, 26, 26, 0.6)';
export const CLOSEST_COLOR = 'lightgray';

export function entryText(entry) {
  const main = entry.text + (entry.km != null ? formatKm(entry.km) : '');
  return entry.coordinates ? `${main} ${entry.coordinates}` : main;
}

function routeEntry(title, color, route, settings) {
  if (route.error) return { text: title, color, items: [{ text: route.error }] };
  const coords = (p) => (settings.show_coordinaten && p ? formatCoordinates(p) : undefined);
  const items = [{ text: '', km: route.distanceKm }];
  if (settings.show_times) items.push({ text: `Fahrzeit ${formatDuration(route.timeSeconds)} h` });
  if (route.outside) {
    const o = route.outside;
    items.push({ text: 'davon außerhalb Zone 3: ', km: o.distanceKm, coordinates: coords(o.firstInside || o.lastOutside) });
    if (o.exit) {
      if (o.exit.location) items.push({ text: formatLocation(o.exit.location) });
      if (settings.show_times && o.exit.timeSeconds != null) {
        items.push({ text: `Fahrzeit von dort noch ${formatDuration(o.exit.timeSeconds)} h` });
      }
    }
  }
  return { text: title, color, items };
}

export function buildResultEntries(result, settings) {
  if (!result.ok) return [{ text: result.message }];
  const coords = (p) => (settings.show_coordinaten && p ? formatCoordinates(p) : undefined);
  const entries = [];
  const where = result.zone > 0 ? `in Zone ${result.zone}.` : 'außerhalb aller Zonen.';
  entries.push({ text: `Diese Position befindet sich ${where}`, coordinates: coords(result.target.point) });

  const loc = result.target.location;
  if (settings.details && loc) {
    entries.push({
      text: `${formatLocation(loc)} Ergebnisqualität: ${loc.quality} (${loc.qualityCode})`,
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
    entries.push({ text: 'Entfernung zu Zone 3', color: CLOSEST_COLOR, items });
  }

  if (result.shortest) entries.push(routeEntry('Kürzeste Verbindung:', SHORTEST_COLOR, result.shortest, settings));
  if (result.fastest) entries.push(routeEntry('Schnellste Verbindung:', FASTEST_COLOR, result.fastest, settings));
  return entries;
}
