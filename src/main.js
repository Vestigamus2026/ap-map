import './style.css';
import { appName, zone1, zone2, zone3, defaultStart, preferredExtent } from './data/zones.js';
import { motorways as motorwayData } from './data/motorways.js';
import { createZones } from './lib/zones.js';
import { buildMotorways } from './lib/motorways.js';
import { createGeoApi } from './lib/geoapi.js';
import { runSearch } from './lib/search.js';
import { buildResultEntries } from './lib/results.js';
import { formatKm, formatCoordinates } from './lib/format.js';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './lib/settings.js';
import { createMap } from './map.js';

const $ = (id) => document.getElementById(id);
const storage = (() => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
})();

document.title = appName;
const zones = createZones({ zone1, zone2, zone3 });
const motorways = buildMotorways(motorwayData);
const api = createGeoApi();
const map = createMap($('map'), { zone1, zone2, zone3, start: defaultStart });

const state = { start: defaultStart, destination: null, busy: false, settings: loadSettings(storage) };
map.setStart(state.start);

/* Seiten */
const PAGES = ['show_map', 'search', 'gpstools', 'settings', 'about'];
let pendingFit = null;
const mapVisible = () => $('show_map').classList.contains('current');
function fitWhenVisible(points) {
  if (mapVisible()) map.showPoints(points);
  else pendingFit = points;
}
function showPage() {
  const id = PAGES.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'show_map';
  for (const p of PAGES) $(p).classList.toggle('current', p === id);
  if (id === 'show_map') {
    map.updateSize();
    if (pendingFit) map.showPoints(pendingFit);
    pendingFit = null;
  }
}
window.addEventListener('hashchange', showPage);
showPage();

/* Einstellungen */
function applySettings() {
  const s = state.settings;
  $('onlyifshortest').hidden = !s.shortest;
  $('onlyiffastest').hidden = !s.fastest;
  $('kmform').hidden = !s.show_bab;
  document.body.classList.toggle('gps-enabled', s.show_gps);
}
for (const id of Object.keys(DEFAULT_SETTINGS)) $(id).checked = state.settings[id];
$('settingsform').addEventListener('change', (e) => {
  if (!(e.target.id in DEFAULT_SETTINGS)) return;
  state.settings = { ...state.settings, [e.target.id]: e.target.checked };
  saveSettings(storage, state.settings);
  applySettings();
});
$('settingsform').addEventListener('submit', (e) => e.preventDefault());
applySettings();

/* Ergebnisliste */
function renderEntry(entry) {
  const li = document.createElement('li');
  if (entry.highlight) li.className = 'highlight';
  li.append(entry.text);
  if (entry.km != null) {
    const km = document.createElement('span');
    km.className = 'distance';
    km.textContent = formatKm(entry.km);
    li.append(km);
  }
  if (entry.coordinates) li.append(` ${entry.coordinates}`);
  if (entry.items) {
    const ul = document.createElement('ul');
    ul.className = 'sublist';
    ul.style.backgroundColor = entry.color;
    ul.append(...entry.items.map(renderEntry));
    li.append(ul);
  }
  return li;
}
const addResult = (entry, list = 'result') => $(list).append(renderEntry(entry));
const coordsIfWanted = (p) => (state.settings.show_coordinaten ? formatCoordinates(p) : undefined);

function setBusy(busy) {
  state.busy = busy;
  for (const [id, idle] of [['submitplace', 'Absenden'], ['submitbab', 'Kilometer suchen']]) {
    $(id).textContent = busy ? 'Warten ... Adresse wird gesucht' : idle;
    $(id).className = busy ? 'grayButton' : 'blueButton';
    $(id).disabled = busy;
  }
}

/* Autobahnen */
function fillMotorways(bab, sectionKey) {
  const numbers = motorways.numbers();
  const current = Number(bab) || numbers[0];
  $('bab').replaceChildren(...numbers.map((n) => new Option(`Bundesautobahn ${n}`, String(n), false, n === current)));
  $('bab_sub').replaceChildren(...motorways.sections(current).map((s) => new Option(s.name, s.key, false, s.key === sectionKey)));
}
fillMotorways();
$('bab').addEventListener('change', (e) => fillMotorways(e.target.value));

/* Suche */
async function search({ query, point }) {
  if (state.busy) return;
  setBusy(true);
  map.setRoute('shortest', null);
  map.setRoute('fastest', null);
  try {
    const result = await runSearch({
      query, point, start: state.start, settings: state.settings, api, zones, motorways, extent: preferredExtent,
    });
    for (const entry of buildResultEntries(result, state.settings)) addResult(entry);
    if (!result.ok) {
      if (query != null) {
        state.destination = null;
        map.setDestination(null);
      }
      return;
    }
    state.destination = result.target.point;
    map.setDestination(state.destination);
    fitWhenVisible([state.start, state.destination]);
    if (result.shortest?.points && state.settings.route_shortest) map.setRoute('shortest', result.shortest.points);
    if (result.fastest?.points && state.settings.route_fastest) map.setRoute('fastest', result.fastest.points);
    if (result.motorway) {
      fillMotorways(result.motorway.section.bab, result.motorway.section.key);
      $('km').value = (Math.round(result.motorway.km * 10) / 10).toString();
    }
  } finally {
    setBusy(false);
  }
}

const pointToField = ([lng, lat]) => `${lat.toFixed(6)} ${lng.toFixed(6)}`;

$('placeform').addEventListener('submit', (e) => {
  e.preventDefault();
  if (state.busy) return;
  $('result').replaceChildren();
  $('km').value = '';
  search({ query: $('location').value });
});

$('kmform').addEventListener('submit', (e) => {
  e.preventDefault();
  if (state.busy) return;
  $('result').replaceChildren();
  const km = Number($('km').value.trim().replace(',', '.'));
  const point = $('km').value.trim() ? motorways.pointAtKm($('bab_sub').value, km) : null;
  if (!point) {
    addResult({ text: 'kein passender Autobahnkilometer gefunden!' });
    return;
  }
  $('location').value = pointToField(point);
  addResult({ text: `Autobahnkilometer ${km} gefunden und in das Zielfeld eingetragen!`, coordinates: coordsIfWanted(point) });
  search({ point });
});

/* GPS */
let watchId = null;
const gpsInfo = (text, point) => addResult({ text, coordinates: point && coordsIfWanted(point) }, 'gpsinfo');
const toPoint = (pos) => [pos.coords.longitude, pos.coords.latitude];

function gpsButtons(mode) {
  for (const id of ['gps_setpos', 'gps_getpos', 'gps_follow']) $(id).hidden = mode !== 'idle';
  $('gps_follow0').hidden = mode !== 'follow';
  $('gps_cancel').hidden = mode === 'idle';
}

function stopTracking() {
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
}

function locateOnce(onPoint) {
  if (!navigator.geolocation) {
    gpsInfo('GPS wird von diesem Gerät nicht unterstützt.');
    return;
  }
  gpsButtons('wait');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      gpsButtons('idle');
      onPoint(toPoint(pos));
    },
    (err) => {
      gpsButtons('idle');
      gpsInfo(`Position nicht verfügbar: ${err.message}`);
    },
    { enableHighAccuracy: true, timeout: 20000 },
  );
}

$('gps_getpos').addEventListener('click', () =>
  locateOnce((point) => {
    $('location').value = pointToField(point);
    $('result').replaceChildren();
    gpsInfo('Ziel-Position gesetzt', point);
    search({ point });
  }),
);

$('gps_setpos').addEventListener('click', () =>
  locateOnce((point) => {
    state.start = point;
    map.setStart(point);
    gpsInfo('Start-Position gesetzt', point);
    if (state.destination) {
      $('result').replaceChildren();
      search({ point: state.destination });
    }
  }),
);

$('gps_follow').addEventListener('click', () => {
  if (!navigator.geolocation) return;
  gpsButtons('follow');
  watchId = navigator.geolocation.watchPosition((pos) => map.setGps(toPoint(pos)), (err) => gpsInfo(`Position nicht verfügbar: ${err.message}`), {
    enableHighAccuracy: true,
  });
  gpsInfo('Tracking angeschaltet');
});

$('gps_cancel').addEventListener('click', () => {
  stopTracking();
  gpsButtons('idle');
  gpsInfo('Tracking beendet');
});

$('gps_reset').addEventListener('click', () => {
  stopTracking();
  gpsButtons('idle');
  state.start = defaultStart;
  map.setStart(defaultStart);
  map.setGps(null);
  $('gpsinfo').replaceChildren();
  gpsInfo('Werte zurückgesetzt');
});
