// ORF-Parser gegen synthetisches Markup, das die Struktur der echten Seite
// nachbildet (Original-HTML nur lokal, ROADMAP #10).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse } from '../sources/orf.js';

const station = (slug, name, weather, temp) => `<tr class="odd">
  <td class="stationName"><a href="https://wetter.ORF.at/steiermark/${slug}/" id="ss-linelink-1">${name}</a></td>
  <td class="stationWeather">${weather}</td>
  <td class="stationTemperature">${temp}&thinsp;<abbr title="Grad Celsius">&deg;C</abbr></td></tr>`;

const sun = (rise, set) => `<div class="capital"><h2>Graz-Straßgang:</h2><div class="details"><div class="sunData">
  <p class="rise" title="Sonnenaufgang"><span class="offscreen">Sonnenaufgang um </span>${rise}<span class="offscreen"> Uhr.</span></p>
  <p class="set" title="Sonnenuntergang"><span class="offscreen">Sonnenuntergang um </span>${set}<span class="offscreen"> Uhr.</span></p>
  </div></div></div>`;

const page = ({ time = '20.00', rise = '07:02', set = '16:24', rows }) => `${sun(rise, set)}
  <p class="lastUpdateMessage">Letzte Messwerte von ${time} Uhr</p>
  <h2 class="stationsHeadline">Wetterstationen</h2>
  <table><thead><tr><th>Ort</th><th>Beobachtung</th><th>Temperatur</th></tr></thead><tbody>
  ${station('gleisdorf', 'Gleisdorf', 'leichter Regen', '18,0')}
  ${rows.join('\n')}
  ${station('groebming', 'Gröbming', 'stark bewölkt', '15,6')}
  </tbody></table>`;

const ALL = [
  station('grazheinrichstrasse', 'Graz Heinrichstrasse', 'wolkig', '&minus;0,5'),
  station('grazstraszgang', 'Graz-Straßgang', 'leichter Regenschauer', '18,4'),
  station('grazthalerhof', 'Graz-Thalerhof', 'heiter', '&minus;1,7'),
  station('grazuniversitaet', 'Graz-Universität', 'Nebelschwaden', '0,0'),
];

test('orf: 4 Grazer Stationen, Messzeitpunkt, Nacht aus Sonnenzeiten', () => {
  const { sections, warnings } = parse(page({ rows: ALL }), { now: new Date('2026-11-15T20:47:00+01:00') });
  assert.deepEqual(warnings, []);
  assert.equal(sections[0].observedAt, '2026-11-15T20:00:00+01:00');
  assert.deepEqual(sections[0].display, { fields: ['condition', 'temp'] });
  assert.deepEqual(sections[0].entries, [
    { location: 'Graz Heinrichstrasse', condition: 'wolkig', isNight: true, temp: -0.5 },
    { location: 'Graz-Straßgang', condition: 'leichter Regenschauer', isNight: true, temp: 18.4 },
    { location: 'Graz-Thalerhof', condition: 'heiter', isNight: true, temp: -1.7 },
    { location: 'Graz-Universität', condition: 'Nebelschwaden', isNight: true, temp: 0 },
  ]);
});

test('orf: Tag/Nacht-Grenzen', () => {
  const night = (time) => parse(page({ time, rows: ALL }), { now: new Date('2026-11-15T21:00:00+01:00') }).sections[0].entries[0].isNight;
  assert.equal(night('07.00'), true);
  assert.equal(night('08.00'), false);
  assert.equal(night('16.00'), false);
  assert.equal(night('17.00'), true);
});

test('orf: fehlende Station → Warnung, Rest bleibt gültig; Messung von gestern', () => {
  const rows = [
    station('grazthalerhof', 'Graz-Thalerhof', 'Nebel', '&minus;2,0'),
    station('grazuniversitaet', 'Graz-Universität', '', 'k.A.'),
  ];
  const { sections, warnings } = parse(page({ time: '23.00', rows }), { now: new Date('2026-11-16T00:10:00+01:00') });
  assert.equal(sections[0].observedAt, '2026-11-15T23:00:00+01:00');
  assert.deepEqual(sections[0].entries, [
    { location: 'Graz-Thalerhof', condition: 'Nebel', isNight: true, temp: -2 },
    { location: 'Graz-Universität', condition: null, isNight: true, temp: null },
  ]);
  assert.deepEqual(warnings, [
    'Station Graz Heinrichstraße fehlt auf der Seite',
    'Station Graz-Straßgang fehlt auf der Seite',
    'Station Graz-Universität: keine Temperatur',
  ]);
});

test('orf: ohne Messzeit/Sonnenzeiten → Warnung, isNight null', () => {
  const html = `<table>${ALL.join('')}</table>`;
  const { sections, warnings } = parse(html, { now: new Date() });
  assert.equal(sections[0].observedAt, undefined);
  assert.equal(sections[0].entries[0].isNight, null);
  assert.match(warnings[0], /Messzeitpunkt/);
});

test('orf: keine Grazer Station → Fehler', () => {
  const html = `<table>${station('kapfenberg', 'Kapfenberg', 'heiter', '3,1')}</table>`;
  assert.throws(() => parse(html, { now: new Date() }), /Keine der Grazer Stationen/);
});
