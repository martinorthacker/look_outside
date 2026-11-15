import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseNumber } from '../lib/parse.js';
import { validateResult } from '../lib/schema.js';
import { addDays, inferYear, toViennaIso, viennaIso } from '../lib/time.js';

test('viennaIso: MEZ/MESZ-Offset und Überlauf', () => {
  assert.equal(viennaIso(2026, 11, 15, 20), '2026-11-15T20:00:00+01:00');
  assert.equal(viennaIso(2026, 7, 1, 12), '2026-07-01T12:00:00+02:00');
  assert.equal(viennaIso(2026, 3, 29, 1), '2026-03-29T01:00:00+01:00'); // vor Umstellung
  assert.equal(viennaIso(2026, 3, 29, 3), '2026-03-29T03:00:00+02:00'); // nach Umstellung
  assert.equal(viennaIso(2026, 11, 15, 24), '2026-11-16T00:00:00+01:00');
  assert.equal(viennaIso(2026, 12, 31, 24), '2027-01-01T00:00:00+01:00');
});

test('toViennaIso: unabhängig von der Runner-Zeitzone', () => {
  assert.equal(toViennaIso(new Date('2026-11-15T19:33:20.500Z')), '2026-11-15T20:33:20+01:00');
  assert.equal(toViennaIso(new Date('2026-08-17T20:10:00Z')), '2026-08-17T22:10:00+02:00');
});

test('addDays / inferYear: Monats- und Jahreswechsel', () => {
  assert.deepEqual(addDays({ year: 2026, month: 12, day: 31 }, 1), { year: 2027, month: 1, day: 1 });
  assert.deepEqual(addDays({ year: 2026, month: 3, day: 1 }, -1), { year: 2026, month: 2, day: 28 });
  assert.equal(inferYear(1, new Date('2026-12-31T22:00:00Z')), 2027);
  assert.equal(inferYear(12, new Date('2027-01-01T00:30:00Z')), 2026);
  assert.equal(inferYear(11, new Date('2026-11-15T12:00:00Z')), 2026);
});

test('parseNumber: deutsche Formate', () => {
  assert.equal(parseNumber('−0,5 °C'), -0.5);
  assert.equal(parseNumber('+18.1'), 18.1);
  assert.equal(parseNumber('60%'), 60);
  assert.equal(parseNumber('0,4l'), 0.4);
  assert.equal(parseNumber('1.230m', { thousands: true }), 1230);
  assert.equal(parseNumber('570m', { thousands: true }), 570);
  assert.equal(parseNumber('Gewitterwahrscheinlichkeit: 40%'), 40);
  assert.equal(parseNumber(' - '), null);
  assert.equal(parseNumber(''), null);
  assert.equal(parseNumber(undefined), null);
});

test('validateResult: lehnt Leerwerte, Tippfehler und falsche Typen ab', () => {
  const ok = { sections: [{ id: 's', title: 'T', entries: [{ location: 'Graz', temp: 1.5, condition: null }] }] };
  validateResult(ok);
  assert.throws(() => validateResult({ sections: [] }), /sections/);
  assert.throws(() => validateResult({ sections: [{ id: 's', title: 'T', entries: [] }] }), /entries/);
  assert.throws(() => validateResult({ sections: [{ id: 's', title: 'T', entries: [{ location: 'G', tmp: 1 }] }] }), /unbekanntes Feld "tmp"/);
  assert.throws(() => validateResult({ sections: [{ id: 's', title: 'T', entries: [{ location: 'G', temp: NaN }] }] }), /temp/);
  assert.throws(() => validateResult({ sections: [{ id: 's', title: 'T', entries: [{ temp: 1 }] }] }), /Zeilenschlüssel/);
  assert.throws(() => validateResult({ sections: [{ id: 's', title: 'T', entries: [{ time: '2026-11-15 20:00' }] }] }), /time/);
});
