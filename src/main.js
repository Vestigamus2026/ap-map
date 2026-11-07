import './style.css';
import { motorways as motorwayData } from './data/motorways.js';
import { createZones } from './lib/zones.js';
import { buildMotorways } from './lib/motorways.js';
import { createGeoApi } from './lib/geoapi.js';
import { runSearch } from './lib/search.js';
import { buildResultEntries } from './lib/results.js';
import { formatKm, formatCoordinates, formatLocation } from './lib/format.js';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './lib/settings.js';
import { createMap } from './map.js';
import { loadConfig, configUrl, CONFIG_URL, zoneCredit } from './lib/config.js';
import { saveLastSearch, clearLastSearch, lastSearchKey } from './lib/print.js';

const $ = (id) => document.getElementById(id);
const storage = (() => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
})();

let config;
let configFile;
try {
  configFile = configUrl(window.location.search);
  config = await loadConfig(fetch, configFile);
} catch (err) {
  const box = document.createElement('p');
  box.className = 'fatal';
  box.textContent = `Fehler in der Einstellungsdatei: ${err.message}`;
  document.body.replaceChildren(box);
  throw err;
}
const { mapName, home: defaultStart, preferredExtent, colors } = config;

document.title = mapName;
const searchKey = lastSearchKey(configFile);
if (configFile !== CONFIG_URL) {
  const name = new URLSearchParams(window.location.search).get('config');
  document.querySelector('a[href="print.html"]').setAttribute('href', `print.html?config=${encodeURIComponent(name)}`);
}
const zones = createZones(config.zones);
if (zones.outer !== 3) {
  for (const label of document.querySelectorAll('label.switch span')) label.textContent = label.textContent.replace('Zone 3', `Zone ${zones.outer}`);
}
const motorways = buildMotorways(motorwayData);
const api = createGeoApi();
const credit = zoneCredit(config.zoneSources);
document.getElementById('zone_credit').textContent = credit;
const map = createMap($('map'), { zones: config.zones, start: defaultStart, colors, widths: config.widths, zoneCredit: credit });

const state = { start: defaultStart, target: null, destination: null, busy: false, settings: loadSettings(storage) };
map.setStart(state.start);

/* Seiten */
const PAGES = ['show_map', 'search', 'gpstools', 'settings', 'about'];
let pendingFit = null;
const mapVisible = () => $('show_map').classList.contains('current');
function fitWhenVisible(points) {
  if (mapVisible()) map.showPoints(points);
  else pendingFit = points;
}
const mouseDevice = window.matchMedia('(hover: hover) and (pointer: fine)');
function showPage() {
  const hash = location.hash.slice(1);
  const available = PAGES.includes(hash) && !(hash === 'gpstools' && mouseDevice.matches);
  const id = available ? hash : 'show_map';
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
  if (entry.choice) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice';
    button.textContent = entry.text;
    button.addEventListener('click', () => {
      if (state.busy) return;
      $('location').value = entry.text;
      $('result').replaceChildren();
      $('km').value = '';
      search({ target: { point: entry.choice.point, location: entry.choice } });
    });
    li.append(button);
    return li;
  }
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
let searchGen = 0;
async function search({ query, point, target }) {
  const gen = ++searchGen;
  setBusy(true);
  map.setRoute('shortest', null);
  map.setRoute('fastest', null);
  try {
    const result = await runSearch({
      query, point, target, start: state.start, settings: state.settings, api, zones, motorways, extent: preferredExtent,
    });
    if (gen !== searchGen) return;
    for (const entry of buildResultEntries(result, state.settings, colors)) addResult(entry);
    if (!result.ok) {
      if (query != null) {
        state.target = null;
        state.destination = null;
        map.setDestination(null);
        clearLastSearch(storage, searchKey);
      }
      return;
    }
    state.target = result.target;
    state.destination = result.target.point;
    map.setDestination(state.destination);
    fitWhenVisible([state.start, state.destination]);
    if (result.shortest?.points && state.settings.route_shortest) map.setRoute('shortest', result.shortest.points);
    if (result.fastest?.points && state.settings.route_fastest) map.setRoute('fastest', result.fastest.points);
    saveLastSearch(storage, {
      start: state.start,
      destination: state.destination,
      label: (result.target.location && formatLocation(result.target.location)) || formatCoordinates(state.destination),
      shortest: (state.settings.route_shortest && result.shortest?.points) || null,
      fastest: (state.settings.route_fastest && result.fastest?.points) || null,
    }, searchKey);
    if (result.motorway) {
      fillMotorways(result.motorway.section.bab, result.motorway.section.key);
      $('km').value = (Math.round(result.motorway.km * 10) / 10).toString();
    }
  } finally {
    if (gen === searchGen) setBusy(false);
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
let gpsRequest = 0;
const gpsInfo = (text, point) => addResult({ text, coordinates: point && coordsIfWanted(point) }, 'gpsinfo');
const GPS_ERRORS = { 1: 'Zugriff auf den Standort verweigert', 2: 'Position konnte nicht ermittelt werden', 3: 'Zeitüberschreitung' };
const gpsErrorText = (err) => `Position nicht verfügbar: ${GPS_ERRORS[err?.code] || 'unbekannter Fehler'}`;
const toPoint = (pos) => [pos.coords.longitude, pos.coords.latitude];

function gpsButtons(mode) {
  for (const id of ['gps_setpos', 'gps_getpos', 'gps_follow']) $(id).hidden = mode !== 'idle';
  $('gps_follow0').hidden = mode !== 'follow';
  $('gps_cancel').hidden = mode === 'idle';
}

function stopTracking() {
  gpsRequest++;
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
}

function locateOnce(onPoint) {
  if (!navigator.geolocation) {
    gpsInfo('GPS wird von diesem Gerät nicht unterstützt.');
    return;
  }
  gpsButtons('wait');
  const request = ++gpsRequest;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      if (request !== gpsRequest) return;
      gpsButtons('idle');
      onPoint(toPoint(pos));
    },
    (err) => {
      if (request !== gpsRequest) return;
      gpsButtons('idle');
      gpsInfo(gpsErrorText(err));
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
    if (state.target) {
      $('result').replaceChildren();
      search({ target: state.target });
    }
  }),
);

$('gps_follow').addEventListener('click', () => {
  if (!navigator.geolocation) return;
  gpsButtons('follow');
  watchId = navigator.geolocation.watchPosition((pos) => map.setGps(toPoint(pos)), (err) => gpsInfo(gpsErrorText(err)), {
    enableHighAccuracy: true,
  });
  gpsInfo('Verfolgen eingeschaltet');
});

$('gps_cancel').addEventListener('click', () => {
  stopTracking();
  gpsButtons('idle');
  gpsInfo('Verfolgen beendet');
});

$('gps_reset').addEventListener('click', () => {
  stopTracking();
  gpsButtons('idle');
  state.start = defaultStart;
  map.setStart(defaultStart);
  map.setGps(null);
  $('gpsinfo').replaceChildren();
  gpsInfo('Werte zurückgesetzt');
  if (state.target) {
    $('result').replaceChildren();
    search({ target: state.target });
  }
});
