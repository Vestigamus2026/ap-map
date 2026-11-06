const pad = (n) => String(n).padStart(2, '0');

export const formatKm = (km) => `${km.toFixed(1)} km`;

export function formatDuration(seconds) {
  const s = Math.round(seconds);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export const formatCoordinates = ([lng, lat]) => `[${lat.toFixed(6)} ${lng.toFixed(6)}]`;

export function formatLocation(loc) {
  if (!loc) return '';
  const place = [loc.postalCode, loc.city].filter(Boolean).join(' ');
  const main = [loc.street, place].filter(Boolean).join(', ');
  const region = [loc.district, loc.county, loc.state, loc.countryCode].filter(Boolean).join(', ');
  return [main, region && `(${region})`].filter(Boolean).join(' ');
}
