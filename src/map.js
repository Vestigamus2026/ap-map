import 'ol/ol.css';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import Feature from 'ol/Feature.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import XYZ from 'ol/source/XYZ.js';
import VectorSource from 'ol/source/Vector.js';
import { Polygon, Point, LineString } from 'ol/geom.js';
import { fromLonLat } from 'ol/proj.js';
import { boundingExtent, containsCoordinate, extend } from 'ol/extent.js';
import { Style, Stroke, Fill, Icon } from 'ol/style.js';
import { defaults as defaultControls, ScaleLine, Control } from 'ol/control.js';

const ring = (points) => points.map((p) => fromLonLat(p));
const fill = ({ border, fill: fillColor }, width) => new Style({ stroke: new Stroke({ color: border, width }), fill: new Fill({ color: fillColor }) });
const icon = (src, anchor, anchorXUnits, zIndex) =>
  new Style({ image: new Icon({ src, anchor, anchorXUnits, anchorYUnits: 'fraction' }), zIndex });
const line = (color, width, zIndex) => new Style({ stroke: new Stroke({ color, width }), zIndex });

function vectorLayer(style, attributions) {
  const source = new VectorSource({ attributions });
  return { source, layer: new VectorLayer({ source, style }) };
}

class FitZonesControl extends Control {
  constructor(onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'N';
    button.title = 'Gesamtes Gebiet anzeigen';
    const element = document.createElement('div');
    element.className = 'rotate-north ol-unselectable ol-control';
    element.appendChild(button);
    super({ element });
    button.addEventListener('click', onClick);
  }
}

export function createMap(target, { zones: { zone1, zone2, zone3 }, start, colors, widths, print = false }) {
  const zoneGeometry = new Polygon([ring(zone3), ring(zone2)]);
  const zones = vectorLayer(null, '<a href="https://www.klupea.de" target="_blank" rel="noopener">Programm: © 2015, Neuaufbau 2026 KLUPEA GmbH</a>');
  zones.source.addFeatures([
    new Feature({ geometry: zoneGeometry, style: 3 }),
    new Feature({ geometry: new Polygon([ring(zone2), ring(zone1)]), style: 2 }),
    new Feature({ geometry: new Polygon([ring(zone1)]), style: 1 }),
  ]);
  const zoneStyles = {
    1: fill(colors.zone1, widths.zone1),
    2: fill(colors.zone2, widths.zone2),
    3: fill(colors.zone3, widths.zone3),
  };
  zones.layer.setStyle((f) => zoneStyles[f.get('style')]);

  const routes = {
    shortest: vectorLayer(line(colors.shortestRoute, widths.shortestRoute, 101)),
    fastest: vectorLayer(line(colors.fastestRoute, widths.fastestRoute, 100)),
  };
  const destination = vectorLayer(icon('img/finish_flag.png', [0.333, 0.95], 'fraction', 1000), 'Zonendaten: Januar 2015, assistance partner GmbH & Co. KG');
  const startMarker = vectorLayer(icon('img/marker_start.png', [8, 1], 'pixels', 100));
  const gpsMarker = vectorLayer(icon('img/marker_pos.png', [14, 1], 'pixels', 100));

  const base = new TileLayer({
    source: new XYZ({
      url: 'https://tile.openstreetmap.de/{z}/{x}/{y}.png',
      attributions: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap-Mitwirkende</a>',
      maxZoom: 18,
      crossOrigin: 'anonymous',
    }),
  });

  const view = new View({ center: fromLonLat(start), zoom: 10, maxZoom: 18, minZoom: print ? 0 : 5 });
  let defaultResolution = null;

  const fitZones = () => view.fit(zoneGeometry, { padding: [20, 20, 20, 20] });

  const map = new Map({
    target,
    layers: [base, zones.layer, routes.fastest.layer, routes.shortest.layer, destination.layer, startMarker.layer, gpsMarker.layer],
    view,
    controls: print
      ? [new ScaleLine({ bar: true, text: true, minWidth: 120 })]
      : defaultControls({ attributionOptions: { collapsible: true } }).extend([new ScaleLine(), new FitZonesControl(fitZones)]),
    interactions: print ? [] : undefined,
  });

  const setPoint = ({ source }, point) => {
    source.clear();
    if (point) source.addFeature(new Feature(new Point(fromLonLat(point))));
  };

  if (!print) map.once('change:size', () => {
    fitZones();
    defaultResolution = view.getResolution();
    const home = fromLonLat(start);
    const zonesExtent = zoneGeometry.getExtent();
    if (!containsCoordinate(zonesExtent, home)) {
      const both = extend(boundingExtent([home]), zonesExtent);
      const [w, h] = map.getSize();
      const zoom = view.getZoomForResolution(view.getResolutionForExtent(both, [w - 80, h - 80]));
      if (zoom < view.getMinZoom()) view.setMinZoom(Math.max(0, Math.floor(zoom)));
      view.fit(both, { padding: [40, 40, 40, 40] });
    }
  });

  return {
    updateSize: () => map.updateSize(),
    fitAll(points) {
      const extent = zoneGeometry.getExtent().slice();
      for (const p of points) extend(extent, boundingExtent([fromLonLat(p)]));
      view.fit(extent, { padding: [40, 40, 40, 40] });
    },
    whenRendered: () => new Promise((resolve) => { map.once('rendercomplete', resolve); map.render(); }),
    toCanvas() {
      const layers = [...map.getViewport().querySelectorAll('.ol-layer canvas, canvas.ol-layer')].filter((c) => c.width > 0);
      const [w, h] = map.getSize();
      const scale = layers.length ? layers[0].width / layers[0].getBoundingClientRect().width : 1;
      const out = document.createElement('canvas');
      out.width = Math.round(w * scale);
      out.height = Math.round(h * scale);
      const ctx = out.getContext('2d');
      for (const canvas of layers) {
        const opacity = canvas.parentNode.style.opacity || canvas.style.opacity;
        ctx.globalAlpha = opacity === '' ? 1 : Number(opacity);
        const m = canvas.style.transform.match(/^matrix\(([^(]*)\)$/)?.[1].split(',').map(Number) || [1, 0, 0, 1, 0, 0];
        ctx.setTransform(...m.map((v) => v * scale));
        ctx.drawImage(canvas, 0, 0);
      }
      return out;
    },
    setStart: (p) => setPoint(startMarker, p),
    setDestination: (p) => setPoint(destination, p),
    setGps: (p) => setPoint(gpsMarker, p),
    setRoute(kind, points) {
      routes[kind].source.clear();
      if (points && points.length > 1) routes[kind].source.addFeature(new Feature(new LineString(points.map((p) => fromLonLat(p)))));
    },
    showPoints(points) {
      view.fit(boundingExtent(points.map((p) => fromLonLat(p))), { padding: [50, 50, 50, 50] });
      if (defaultResolution && view.getResolution() < defaultResolution) view.setResolution(defaultResolution);
    },
  };
}
