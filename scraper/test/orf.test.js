// Handgeprüfte Werte aus fixtures/orf.html (erfasst 15.11.2026 20:47).

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parse } from '../sources/orf.js';

const html = await readFile(new URL('../fixtures/orf.html', import.meta.url), 'utf8');

test('orf: 4 Grazer Stationen mit Messzeitpunkt', () => {
  const { sections, warnings } = parse(html, { now: new Date('2026-11-15T20:47:00+01:00') });
  assert.deepEqual(warnings, []);
  assert.equal(sections[0].observedAt, '2026-11-15T20:00:00+01:00');
  assert.deepEqual(sections[0].entries, [
    { location: 'Graz Heinrichstrasse', condition: 'wolkig', temp: -0.5 },
    { location: 'Graz-Straßgang', condition: 'wolkig', temp: -0.8 },
    { location: 'Graz-Thalerhof', condition: 'heiter', temp: -1.7 },
    { location: 'Graz-Universität', condition: 'wolkig', temp: -0.5 },
  ]);
});

const station = (slug, name, weather, temp) => `<tr>
  <td class="stationName"><a href="https://wetter.ORF.at/steiermark/${slug}/">${name}</a></td>
  <td class="stationWeather">${weather}</td>
  <td class="stationTemperature">${temp}&thinsp;<abbr>&deg;C</abbr></td></tr>`;

test('orf: fehlende Station → Warnung, Rest bleibt gültig', () => {
  const page = `<p class="lastUpdateMessage">Letzte Messwerte von 23.00 Uhr</p><table>
    ${station('grazthalerhof', 'Graz-Thalerhof', 'Nebel', '&minus;2,0')}
    ${station('grazuniversitaet', 'Graz-Universität', '', 'k.A.')}
    ${station('kapfenberg', 'Kapfenberg', 'heiter', '3,1')}</table>`;
  const { sections, warnings } = parse(page, { now: new Date('2026-11-16T00:10:00+01:00') });
  // 23.00 Uhr um 00:10 → Messung von gestern
  assert.equal(sections[0].observedAt, '2026-11-15T23:00:00+01:00');
  assert.deepEqual(sections[0].entries, [
    { location: 'Graz-Thalerhof', condition: 'Nebel', temp: -2 },
    { location: 'Graz-Universität', condition: null, temp: null },
  ]);
  assert.deepEqual(warnings, [
    'Station Graz Heinrichstraße fehlt auf der Seite',
    'Station Graz-Straßgang fehlt auf der Seite',
    'Station Graz-Universität: keine Temperatur',
  ]);
});

test('orf: keine Grazer Station → Fehler', () => {
  const page = `<table>${station('kapfenberg', 'Kapfenberg', 'heiter', '3,1')}</table>`;
  assert.throws(() => parse(page, { now: new Date() }), /Keine der Grazer Stationen/);
});
