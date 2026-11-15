// Handgeprüfte Werte aus fixtures/bergfex.html (erfasst 15.11.2026 20:48).

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parse } from '../sources/bergfex.js';

const html = await readFile(new URL('../fixtures/bergfex.html', import.meta.url), 'utf8');
const [daily, intervals] = parse(html).sections;

test('bergfex: Tageswerte Heute', () => {
  assert.deepEqual(daily.entries[0], {
    date: '2026-11-15',
    condition: 'stark bewölkt',
    iconUrl: 'https://vcdn.bergfex.at/images/wetter/bergfex-shaded/d.png',
    tempMax: 3,
    tempMin: -3,
    precipMm: null,
    precipProb: null,
    thunderProb: 0,
    sunHours: 1,
    snowLineM: 570,
    newSnowCm: null,
    windDir: 'NW-SW',
    windBft: 1,
  });
  assert.equal(daily.entries[1].date, '2026-11-16');
});

test('bergfex: 3-h-Intervalle Heute + Morgen, Überlappung dedupliziert', () => {
  const times = intervals.entries.map((e) => e.time);
  assert.equal(times.length, 17);
  assert.equal(new Set(times).size, 17);
  assert.equal(times[0], '2026-11-15T01:00:00+01:00');
  assert.equal(times[8], '2026-11-16T01:00:00+01:00');
  assert.equal(times[16], '2026-11-17T01:00:00+01:00');
});

test('bergfex: Intervallwerte inkl. Tausendertrenner und "-"', () => {
  const at = (t) => intervals.entries.find((e) => e.time === t);
  assert.deepEqual(at('2026-11-15T22:00:00+01:00'), {
    time: '2026-11-15T22:00:00+01:00',
    condition: 'stark bewölkt',
    iconUrl: 'https://vcdn.bergfex.at/images/wetter/bergfex-shaded/night/d.png',
    temp: -1,
    precipMm: null,
    precipProb: null,
    thunderProb: 0,
    snowLineM: 1230,
    windDir: 'NW',
    windBft: 1,
    windKmh: 5,
  });
  // 10:00: "bedeckt 0.20h Sonne" → Sonnenanteil abgeschnitten, km/h "-"
  assert.equal(at('2026-11-15T10:00:00+01:00').condition, 'bedeckt');
  assert.equal(at('2026-11-15T10:00:00+01:00').windKmh, null);
});

test('bergfex: Sommerformate (Niederschlag, Wahrscheinlichkeit, Wind)', () => {
  const page = `
    <div id="forecast-day-0" title="Wetterprognose 17.08.2026">
      <div class="icon"><img src="//vcdn.bergfex.at/x.png" title="Regenschauer 2h Sonne"></div>
      <div class="tmax">25°C</div><div class="tmin">17°C</div><div class="nschnee">-</div>
      <div class="rrp">90%</div><div class="rrr rrr10">4l</div><div class="sonne">2h</div>
      <div class="sgrenze">3.330m</div><span class="wgew" title="Gewitterwahrscheinlichkeit: 30%">30%</span>
      <div class="ff">NW 2</div>
    </div>
    <div class="forecast-day-0-intervals"><div class="interval">
      <div class="time">14:00</div><div class="icon"><img src="//vcdn.bergfex.at/y.png" title="Gewitter "></div>
      <div class="tmax">22°C</div><div class="rrr">0,4l</div><div class="rrp">60%</div>
      <div class="sgrenze">3.250m</div><div class="wgew" title="Gewitterwahrscheinlichkeit: 40%">40%</div>
      <div class="ff">SüdO-NW 2</div><div class="ff ff-kmh">10 km/h</div>
    </div></div>
    <div id="forecast-day-1" title="Wetterprognose 18.08.2026">
      <div class="tmax">24°C</div><div class="tmin">16°C</div>
    </div>
    <div class="forecast-day-1-intervals"><div class="interval">
      <div class="time">02:00</div><div class="tmax">17°C</div>
    </div></div>`;
  const [d, iv] = parse(page).sections;
  assert.equal(d.entries[0].precipMm, 4);
  assert.equal(d.entries[0].precipProb, 90);
  assert.equal(d.entries[0].sunHours, 2);
  assert.equal(d.entries[0].snowLineM, 3330);
  assert.equal(d.entries[0].condition, 'Regenschauer');
  assert.deepEqual(iv.entries[0], {
    time: '2026-08-17T14:00:00+02:00',
    condition: 'Gewitter',
    iconUrl: 'https://vcdn.bergfex.at/y.png',
    temp: 22,
    precipMm: 0.4,
    precipProb: 60,
    thunderProb: 40,
    snowLineM: 3250,
    windDir: 'SüdO-NW',
    windBft: 2,
    windKmh: 10,
  });
  assert.equal(iv.entries[1].time, '2026-08-18T02:00:00+02:00');
});

test('bergfex: fehlender Morgen-Block → Fehler', () => {
  const page = html.replace('id="forecast-day-1"', 'id="forecast-day-x"');
  assert.throws(() => parse(page), /forecast-day-1/);
});
