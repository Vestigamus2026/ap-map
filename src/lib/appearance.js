import { parseConfig } from './config.js';
import { setTopLevel } from './relation.js';

const WIDTHS_KEY = { colors: 'widths', printColors: 'printWidths' };

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const inline = (v) =>
  isObject(v) ? `{ ${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${JSON.stringify(x)}`).join(', ')} }` : JSON.stringify(v);
const block = (obj) => `{\n${Object.entries(obj).map(([k, v]) => `    ${JSON.stringify(k)}: ${inline(v)}`).join(',\n')}\n  }`;

function merge(current, changes) {
  const out = isObject(current) ? { ...current } : {};
  for (const [key, value] of Object.entries(changes)) out[key] = isObject(value) ? { ...(isObject(out[key]) ? out[key] : {}), ...value } : value;
  return out;
}

export function updateConfigMapName(text, name) {
  const out = setTopLevel(text, 'mapName', JSON.stringify(name.trim()));
  parseConfig(JSON.parse(out));
  return out;
}

// section: "colors" oder "printColors"; die Linienbreiten landen in "widths" bzw. "printWidths"
export function updateConfigColors(text, section, colors = {}, widths = {}) {
  if (!WIDTHS_KEY[section]) throw new Error(`Unbekannter Bereich „${section}“, erlaubt sind colors und printColors.`);
  const raw = JSON.parse(text);
  let out = text;
  if (Object.keys(colors).length) out = setTopLevel(out, section, block(merge(raw[section], colors)));
  if (Object.keys(widths).length) out = setTopLevel(out, WIDTHS_KEY[section], block(merge(raw[WIDTHS_KEY[section]], widths)));
  parseConfig(JSON.parse(out));
  return out;
}

export const widthsKey = (section) => WIDTHS_KEY[section];
