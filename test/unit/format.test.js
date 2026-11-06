import { describe, it, expect } from 'vitest';
import { formatKm, formatDuration, formatLocation, formatCoordinates } from '../../src/lib/format.js';

describe('format', () => {
  it('formats kilometres with one decimal', () => {
    expect(formatKm(12.345)).toBe('12.3 km');
    expect(formatKm(0)).toBe('0.0 km');
  });

  it('formats durations as HH:MM:SS', () => {
    expect(formatDuration(3725.4)).toBe('01:02:05');
    expect(formatDuration(59)).toBe('00:00:59');
  });

  it('formats coordinates as [lat lng] with 6 decimals', () => {
    expect(formatCoordinates([13.3630811, 52.4615272])).toBe('[52.461527 13.363081]');
  });

  it('formats a location as readable address', () => {
    expect(
      formatLocation({
        street: 'Babelsberger Straße 16',
        postalCode: '14473',
        city: 'Potsdam',
        district: 'Teltower Vorstadt',
        county: '',
        state: 'Brandenburg',
        countryCode: 'DE',
      }),
    ).toBe('Babelsberger Straße 16, 14473 Potsdam (Teltower Vorstadt, Brandenburg, DE)');
  });

  it('skips missing parts', () => {
    expect(formatLocation({ city: 'Teltow', countryCode: 'DE' })).toBe('Teltow (DE)');
    expect(formatLocation(null)).toBe('');
  });
});
