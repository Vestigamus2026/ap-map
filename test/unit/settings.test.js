import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, STORAGE_KEY } from '../../src/lib/settings.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    data,
  };
}

describe('settings', () => {
  it('keeps the storage key of the old version', () => {
    expect(STORAGE_KEY).toBe('gebietskarte_settings');
  });

  it('uses the defaults of the old version', () => {
    expect(DEFAULT_SETTINGS).toEqual({
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
  });

  it('returns defaults when nothing is stored', () => {
    expect(loadSettings(memoryStorage())).toEqual(DEFAULT_SETTINGS);
  });

  it('reads settings saved by the old version', () => {
    const s = loadSettings(memoryStorage({ [STORAGE_KEY]: 'shortest,false;show_bab,true;details,true' }));
    expect(s.shortest).toBe(false);
    expect(s.show_bab).toBe(true);
    expect(s.details).toBe(true);
    expect(s.fastest).toBe(true);
  });

  it('ignores unknown ids from storage', () => {
    const s = loadSettings(memoryStorage({ [STORAGE_KEY]: 'evil,true;__proto__,true' }));
    expect(s).toEqual(DEFAULT_SETTINGS);
    expect(Object.prototype.hasOwnProperty.call(s, 'evil')).toBe(false);
  });

  it('writes the format of the old version', () => {
    const storage = memoryStorage();
    saveSettings(storage, { ...DEFAULT_SETTINGS, closest: true });
    expect(storage.data[STORAGE_KEY]).toContain('closest,true');
    expect(storage.data[STORAGE_KEY]).toContain('shortest,true;');
    expect(loadSettings(storage).closest).toBe(true);
  });

  it('survives a missing or broken storage', () => {
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); } };
    expect(loadSettings(broken)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(broken, DEFAULT_SETTINGS)).not.toThrow();
    expect(loadSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });
});
