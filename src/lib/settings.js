export const STORAGE_KEY = 'gebietskarte_settings';

export const DEFAULT_SETTINGS = Object.freeze({
  shortest: true,
  route_shortest: true,
  overhead_shortest: true,
  fastest: true,
  route_fastest: true,
  overhead_fastest: true,
  closest: false,
  details: false,
  show_coordinaten: false,
  show_times: true,
  show_endpoints: false,
  show_bab: false,
  show_gps: false,
});

// Format der alten Version: "id,true;id,false;..."
export function loadSettings(storage) {
  const settings = { ...DEFAULT_SETTINGS };
  let stored = null;
  try {
    stored = storage ? storage.getItem(STORAGE_KEY) : null;
  } catch {
    stored = null;
  }
  if (!stored) return settings;
  for (const pair of stored.split(';')) {
    const [id, value] = pair.split(',');
    if (Object.hasOwn(DEFAULT_SETTINGS, id)) settings[id] = value === 'true';
  }
  return settings;
}

export function saveSettings(storage, settings) {
  const value = Object.keys(DEFAULT_SETTINGS)
    .map((id) => `${id},${!!settings[id]}`)
    .join(';');
  try {
    storage.setItem(STORAGE_KEY, value);
  } catch {
    // z. B. privater Modus oder Speicher voll: Einstellungen gelten dann nur bis zum Neuladen
  }
}
