// GeoSphere-Parser gegen synthetisches Markup, das die Struktur der echten
// Tabelle nachbildet (Original-HTML nur lokal, ROADMAP #10).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compass, isNightIcon, parse } from '../sources/geosphere.js';

const ICONS = 'https://www.zamg.ac.at/steiermark/images/wettersymbole_neu_reduzierter_satz';

function row({ time, label, title = 'wolkig', icon = 'c', temp = '+1.0', feels = '-2.0', precip = '0.0', rot = 90, wind = 5 }) {
  const t = label ? `<span class='w3-small'>${label}</span><br>${time}` : time;
  return `<tr><td class='w3-bold'>${t}</td>`
    + `<td><img class='wx_symbol' alt='Wettersymbol' title='${title}' src='${ICONS}/${icon}.png'></td>`
    + `<td class='w3-bold' title='Radl-Temperatur: ${feels}°C'>${temp}</td>`
    + `<td title='${precip}'>${precip !== '0.0' ? "<img src='images/rain1.gif'>" : ''}</td>`
    + `<td><img alt='Windrichtung' src='images/circular-down-arrow-button.svg' style='width: 21px;height: 21px;transform: rotate(${rot}deg); -moz-transform: rotate(${rot}deg);'>&nbsp;${wind}</td>`
    + '<td></td></tr>';
}

const page = (rows) => '<h5>zuletzt aktualisiert <span>vor 3 Minuten</span></h5>'
  + "<table class='w3-table-all'><thead><tr><th>Zeit</th><th>Wetter</th><th>Temp.<br>°C</th>"
  + `<th>Nieder-<br>schlag</th><th>Wind<br>km/h</th><th></th></tr></thead><tbody>${rows.join('\n')}</tbody></table>`;

const entries = (rows, now) => parse(page(rows), { now: new Date(now) }).sections[0].entries;

test('geosphere: Tageswechsel über Label, ISO mit Wiener Offset', () => {
  const e = entries([
    row({ time: '22-23' }),
    row({ time: '23-00' }),
    row({ time: '00-01', label: 'Mo, 16.11.' }),
    row({ time: '01-02' }),
  ], '2026-11-15T22:10:00+01:00');
  assert.deepEqual(e.map((x) => [x.time, x.timeEnd]), [
    ['2026-11-15T22:00:00+01:00', '2026-11-15T23:00:00+01:00'],
    ['2026-11-15T23:00:00+01:00', '2026-11-16T00:00:00+01:00'],
    ['2026-11-16T00:00:00+01:00', '2026-11-16T01:00:00+01:00'],
    ['2026-11-16T01:00:00+01:00', '2026-11-16T02:00:00+01:00'],
  ]);
});

test('geosphere: alle Werte einer Zeile', () => {
  const [e] = entries([
    row({ time: '17-18', title: 'Regenschauer', icon: 'nf', temp: '+4.5', feels: '-1.5', precip: '0.3', rot: 332.023, wind: 10 }),
  ], '2026-11-15T17:30:00+01:00');
  assert.deepEqual(e, {
    time: '2026-11-15T17:00:00+01:00',
    timeEnd: '2026-11-15T18:00:00+01:00',
    condition: 'Regenschauer',
    isNight: true,
    iconUrl: `${ICONS}/nf.png`,
    temp: 4.5,
    tempFeels: -1.5,
    precipMm: 0.3,
    windKmh: 10,
    windDeg: 332,
    windDir: 'NW',
  });
});

test('geosphere: Negativwerte, kein Niederschlag, Tagsymbol', () => {
  const [e] = entries([row({ time: '08-09', icon: 'c', temp: '-1.3', feels: '-8.5', rot: 35.5391, wind: 0 })], '2026-11-15T08:30:00+01:00');
  assert.equal(e.temp, -1.3);
  assert.equal(e.tempFeels, -8.5);
  assert.equal(e.precipMm, 0);
  assert.equal(e.isNight, false);
  assert.equal(e.windKmh, 0);
  assert.equal(e.windDir, 'NO');
});

test('geosphere: Sommerzeit und Jahreswechsel', () => {
  assert.equal(entries([row({ time: '22-23' })], '2026-08-17T22:10:00+02:00')[0].time, '2026-08-17T22:00:00+02:00');
  const e = entries([row({ time: '23-00' }), row({ time: '00-01', label: 'Fr, 01.01.' })], '2026-12-31T23:10:00+01:00');
  assert.equal(e[0].time, '2026-12-31T23:00:00+01:00');
  assert.equal(e[1].time, '2027-01-01T00:00:00+01:00');
});

test('geosphere: Seite um 00:05 noch vom Vortag (23-00 ohne Label)', () => {
  const e = entries([row({ time: '23-00' }), row({ time: '00-01', label: 'Di, 17.11.' })], '2026-11-17T00:05:00+01:00');
  assert.equal(e[0].time, '2026-11-16T23:00:00+01:00');
  assert.equal(e[1].time, '2026-11-17T00:00:00+01:00');
});

test('geosphere: Anzeige-Hinweise', () => {
  const [section] = parse(page([row({ time: '10-11' })]), { now: new Date('2026-11-15T10:00:00+01:00') }).sections;
  assert.deepEqual(section.display, { fields: ['condition', 'temp', 'precipMm'], hidePast: true });
});

test('geosphere: fehlende Temperatur oder Zeit → Fehler', () => {
  const now = new Date('2026-11-15T10:00:00+01:00');
  assert.throws(() => parse(page([row({ time: '10-11', temp: '' })]), { now }), /keine Temperatur/);
  assert.throws(() => parse(page([row({ time: 'jetzt' })]), { now }), /Zeitspanne/);
});

test('geosphere: isNightIcon / compass', () => {
  assert.equal(isNightIcon(`${ICONS}/na.png`), true);
  assert.equal(isNightIcon(`${ICONS}/d.png`), false);
  assert.equal(isNightIcon(`${ICONS}/sonderfall.png`), null);
  assert.equal(isNightIcon(undefined), null);
  assert.equal(compass(0), 'N');
  assert.equal(compass(22), 'N');
  assert.equal(compass(23), 'NO');
  assert.equal(compass(180), 'S');
  assert.equal(compass(359), 'N');
});
