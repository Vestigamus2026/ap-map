import './print.css';
import { loadConfig, zoneCredit } from './lib/config.js';
import { createMap } from './map.js';
import { PRINT_MARGIN_MM, paperSize, pageCss, loadLastSearch, legendEntries, pngFileName } from './lib/print.js';

const $ = (id) => document.getElementById(id);
const storage = (() => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
})();

let config;
try {
  config = await loadConfig();
} catch (err) {
  const box = document.createElement('p');
  box.className = 'fatal';
  box.textContent = `Fehler in der Einstellungsdatei: ${err.message}`;
  document.body.replaceChildren(box);
  throw err;
}
const { mapName, colors } = config;
const last = loadLastSearch(storage);
const start = last?.start || config.home;

document.title = `${mapName} – Druckansicht`;
$('title').textContent = mapName;
$('date').textContent = `Stand: ${new Date().toLocaleDateString('de-DE')}`;

function legendItem(entry) {
  const li = document.createElement('li');
  if (entry.kind === 'zone') {
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.backgroundColor = entry.fill;
    swatch.style.borderColor = entry.border;
    li.append(swatch);
  } else if (entry.kind === 'line') {
    const line = document.createElement('span');
    line.className = 'line';
    line.style.backgroundColor = entry.color;
    li.append(line);
  } else {
    const img = document.createElement('img');
    img.src = entry.icon;
    img.alt = '';
    li.append(img);
  }
  li.append(entry.label);
  return li;
}
$('legend').replaceChildren(...legendEntries(colors, last, Object.keys(config.zones)).map(legendItem));

const credit = zoneCredit(config.zoneSources);
$('zone_credit').textContent = credit;
const map = createMap($('printmap'), { zones: config.zones, start, colors, widths: config.widths, print: true, zoneCredit: credit });
map.setStart(start);
const fitPoints = [start];
if (last) {
  map.setDestination(last.destination);
  map.setRoute('shortest', last.shortest);
  map.setRoute('fastest', last.fastest);
  fitPoints.push(last.destination, ...(last.shortest || []), ...(last.fastest || []));
}

function layout() {
  const { width, height } = paperSize($('format').value, $('orientation').value);
  $('sheet').style.width = `${width - 2 * PRINT_MARGIN_MM}mm`;
  $('sheet').style.height = `${height - 2 * PRINT_MARGIN_MM}mm`;
  $('page-size').textContent = pageCss($('format').value, $('orientation').value);
  map.updateSize();
  map.fitAll(fitPoints);
}
$('format').addEventListener('change', layout);
$('orientation').addEventListener('change', layout);
layout();

$('print').addEventListener('click', async () => {
  await map.whenRendered();
  window.print();
});

const MM = 96 / 25.4;

// Zeichnet Hintergründe, Rahmen, Bilder und Texte des Blatts (außer der Karte) auf die Leinwand.
function drawElements(ctx, elements, { background = true } = {}) {
  for (const el of elements) {
    if (el.tagName === 'CANVAS') continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el);
    if (background && cs.backgroundColor && !/rgba\(.*,\s*0\)$|transparent/.test(cs.backgroundColor)) {
      ctx.fillStyle = cs.backgroundColor;
      ctx.fillRect(r.left, r.top, r.width, r.height);
    }
    const bw = parseFloat(cs.borderTopWidth);
    if (bw > 0 && cs.borderTopStyle !== 'none') {
      ctx.strokeStyle = cs.borderTopColor;
      ctx.lineWidth = bw;
      ctx.strokeRect(r.left + bw / 2, r.top + bw / 2, r.width - bw, r.height - bw);
    }
    if (el.tagName === 'IMG' && el.complete) ctx.drawImage(el, r.left, r.top, r.width, r.height);
    for (const node of el.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE) continue;
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      ctx.fillStyle = cs.color;
      ctx.textBaseline = 'middle';
      const range = document.createRange();
      for (const m of node.data.matchAll(/\S+/g)) {
        range.setStart(node, m.index);
        range.setEnd(node, m.index + m[0].length);
        const w = range.getBoundingClientRect();
        if (w.width) ctx.fillText(m[0], w.left, w.top + w.height / 2);
      }
    }
  }
}

$('png').addEventListener('click', async () => {
  await map.whenRendered();
  const sheet = $('sheet');
  const s = sheet.getBoundingClientRect();
  const margin = PRINT_MARGIN_MM * MM;
  const k = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round((s.width + 2 * margin) * k);
  canvas.height = Math.round((s.height + 2 * margin) * k);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(k, k);
  ctx.translate(margin - s.left, margin - s.top);
  const all = [...sheet.querySelectorAll('*')];
  drawElements(ctx, all.filter((el) => !el.closest('.printmap')));
  const m = $('printmap').getBoundingClientRect();
  ctx.drawImage(map.toCanvas(), m.left, m.top, m.width, m.height);
  drawElements(ctx, all.filter((el) => el.closest('.ol-scale-bar')));
  drawElements(ctx, [$('printmap')], { background: false });
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = pngFileName(mapName, $('format').value, $('orientation').value);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
