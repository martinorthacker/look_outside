// Handgeprüfte Werte aus fixtures/geosphere.html (erfasst 15.11.2026 20:45).

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { compass, parse } from '../sources/geosphere.js';

const html = await readFile(new URL('../fixtures/geosphere.html', import.meta.url), 'utf8');
const now = new Date('2026-11-15T20:45:34+01:00');
const [section] = parse(html, { now }).sections;
const e = section.entries;

test('geosphere: 24 Stunden ab aktueller Stunde', () => {
  assert.equal(e.length, 24);
  assert.equal(e[0].time, '2026-11-15T20:00:00+01:00');
  assert.equal(e[0].timeEnd, '2026-11-15T21:00:00+01:00');
  assert.equal(e[23].time, '2026-11-16T19:00:00+01:00');
});

test('geosphere: Tageswechsel über Label "Mo, 16.11."', () => {
  assert.equal(e[3].time, '2026-11-15T23:00:00+01:00');
  assert.equal(e[3].timeEnd, '2026-11-16T00:00:00+01:00');
  assert.equal(e[4].time, '2026-11-16T00:00:00+01:00');
});

test('geosphere: Werte der ersten Zeile', () => {
  assert.deepEqual(e[0], {
    time: '2026-11-15T20:00:00+01:00',
    timeEnd: '2026-11-15T21:00:00+01:00',
    condition: 'bedeckt',
    iconUrl: 'https://www.zamg.ac.at/steiermark/images/wettersymbole_neu_reduzierter_satz/ne.png',
    temp: -1.3,
    tempFeels: -8.5,
    precipMm: 0,
    windKmh: 0,
    windDeg: 36,
    windDir: 'NO',
  });
});

test('geosphere: Niederschlag aus title, Wind aus Pfeildrehung', () => {
  // 17-18: Regenschauer, title="0.3", +4.5 (Radl -1.5)
  assert.equal(e[21].condition, 'Regenschauer');
  assert.equal(e[21].precipMm, 0.3);
  assert.equal(e[21].temp, 4.5);
  assert.equal(e[21].tempFeels, -1.5);
  // 16-17: rotate(332.023deg), 10 km/h
  assert.equal(e[20].windKmh, 10);
  assert.equal(e[20].windDeg, 332);
  assert.equal(e[20].windDir, 'NW');
});

test('geosphere: compass', () => {
  assert.equal(compass(0), 'N');
  assert.equal(compass(22), 'N');
  assert.equal(compass(23), 'NO');
  assert.equal(compass(180), 'S');
  assert.equal(compass(359), 'N');
});

test('geosphere: Seite um 00:05 noch vom Vortag (23-00 ohne Label)', () => {
  const row = (time) => `<tr><td>${time}</td><td><img title="heiter" src="x.png"></td><td title="Radl-Temperatur: 1.0°C">+2.0</td><td title="0.0"></td><td>5</td><td></td></tr>`;
  const page = `<table><thead><tr><th>Zeit</th></tr></thead><tbody>${row('23-00')}${row('<span>Di, 17.11.</span><br>00-01')}</tbody></table>`;
  const [s] = parse(page, { now: new Date('2026-11-17T00:05:00+01:00') }).sections;
  assert.equal(s.entries[0].time, '2026-11-16T23:00:00+01:00');
  assert.equal(s.entries[1].time, '2026-11-17T00:00:00+01:00');
  assert.equal(s.entries[0].windDeg, null);
});
