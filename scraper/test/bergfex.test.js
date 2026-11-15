// bergfex-Parser gegen synthetisches Markup, das die Struktur der echten Seite
// nachbildet (Original-HTML nur lokal, ROADMAP #10).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse } from '../sources/bergfex.js';

const IMG = '//vcdn.bergfex.at/images/wetter/bergfex-shaded';

function day(i, date, o = {}) {
  const { title = 'stark bewölkt 1h Sonne', icon = 'd', tmax = '3°C', tmin = '-3°C', nschnee = '-', rrp = '-', rrr = '-',
    sonne = '1h', sgrenze = '570m', wgew = 0, ff = 'NW-SW 1' } = o;
  return `<div id="forecast-day-${i}" class="day ${i === 0 ? 'selected' : ''} selectable fields" title="Wetterprognose ${date}">
    <div class="date">Tag ${i}</div>
    <div class="icon"><img src="${IMG}/${icon}.png" title="${title}" /></div>
    <div class="group"><div class="tmax">${tmax}</div><div class="tmin">${tmin}</div><div class="nschnee "> ${nschnee}</div></div>
    <div class="group"><div class="rrp  "> ${rrp}</div></div>
    <div class="group"><div class="rrr rrr0"> ${rrr}</div><div class="sonne sonne10"> ${sonne}</div></div>
    <div class="group sgrenze"> ${sgrenze}</div>
    <div class="group"><span class="wgew " title="Gewitterwahrscheinlichkeit: ${wgew}%"> ${wgew ? `${wgew}%` : '-'}</span></div>
    <div class="group"><div class="ff ff0"> ${ff}</div></div>
  </div>`;
}

function interval(time, o = {}) {
  const { title = 'heiter ', icon = 'night/b', tmax = '-2°C', rrr = '-', rrp = '-', sgrenze = '100m', wgew = 0, ff = 'NW 1', kmh = '5 km/h' } = o;
  return `<div class="interval fields  ">
    <div class="time offset">${time}</div>
    <div class="icon"><img src="${IMG}/${icon}.png" title="${title}"/></div>
    <div class="group offset"><div class="tmax">${tmax}</div></div>
    <div class="sonne  sonne0"></div>
    <div class="group"><div><div class="rrr"> ${rrr}</div><div class="rrp " title="% Niederschlagswahrscheinlichkeit"> ${rrp}</div></div></div>
    <div class="group sgrenze"> ${sgrenze}</div>
    <div class="group wgew " title="Gewitterwahrscheinlichkeit: ${wgew}%"> -</div>
    <div class="group"><div class="ff ff0"> ${ff}</div><div class="ff ff0 ff-kmh"> ${kmh}</div></div>
  </div>`;
}

const intervals = (i, items) => `<div class="forecast-day-${i}-intervals forecast-day-detail intervals3h">
  <div class="touch-scroll-x"><div class="forecast9d-intervals">${items.join('')}</div></div>
  <div class="legend labels"><div class="group"><div class="value-day value-day-big">3°C</div></div></div></div>`;

// Wie auf der echten Seite: Jeder Tag 01:00 … 22:00 plus 01:00 des Folgetags.
const WINTER = ['01:00', '04:00', '07:00', '10:00', '13:00', '16:00', '19:00', '22:00', '01:00'];
const fullPage = (o = {}) => [
  day(0, '15.11.2026', o.day0), day(1, '16.11.2026'),
  intervals(0, WINTER.map((t) => interval(t, o.iv?.[t]))), intervals(1, WINTER.map((t) => interval(t))),
].join('\n');

test('bergfex: Tageswerte Heute', () => {
  const [daily] = parse(fullPage()).sections;
  assert.deepEqual(daily.entries[0], {
    date: '2026-11-15',
    condition: 'stark bewölkt',
    isNight: false,
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
  const times = parse(fullPage()).sections[1].entries.map((e) => e.time);
  assert.equal(times.length, 17);
  assert.equal(new Set(times).size, 17);
  assert.equal(times[0], '2026-11-15T01:00:00+01:00');
  assert.equal(times[8], '2026-11-16T01:00:00+01:00');
  assert.equal(times[16], '2026-11-17T01:00:00+01:00');
});

test('bergfex: Intervallwerte inkl. Tausendertrenner, "-" und Sonnenanteil im Titel', () => {
  const page = fullPage({ iv: {
    '10:00': { title: 'bedeckt 0.20h Sonne', icon: 'e', tmax: '0°C', kmh: '-' },
    '22:00': { title: 'stark bewölkt ', icon: 'night/d', tmax: '-1°C', sgrenze: '1.230m', ff: '-', kmh: '-' },
  } });
  const at = (t) => parse(page).sections[1].entries.find((e) => e.time === t);
  assert.deepEqual(at('2026-11-15T10:00:00+01:00'), {
    time: '2026-11-15T10:00:00+01:00',
    condition: 'bedeckt',
    isNight: false,
    iconUrl: 'https://vcdn.bergfex.at/images/wetter/bergfex-shaded/e.png',
    temp: 0,
    precipMm: null,
    precipProb: null,
    thunderProb: 0,
    snowLineM: 100,
    windDir: 'NW',
    windBft: 1,
    windKmh: null,
  });
  const late = at('2026-11-15T22:00:00+01:00');
  assert.equal(late.isNight, true);
  assert.equal(late.snowLineM, 1230);
  assert.equal(late.windDir, null);
  assert.equal(late.windBft, null);
});

test('bergfex: Sommerformate (Niederschlag, Wahrscheinlichkeit, Wind, MESZ)', () => {
  const page = [
    day(0, '17.08.2026', { title: 'Regenschauer 2h Sonne', icon: 'f', tmax: '25°C', tmin: '17°C', rrp: '90%', rrr: '4l', sonne: '2h', sgrenze: '3.330m', wgew: 30, ff: 'NW 2' }),
    day(1, '18.08.2026', { tmax: '24°C', tmin: '16°C' }),
    intervals(0, [interval('14:00', { title: 'Gewitter ', icon: 'g', tmax: '22°C', rrr: '0,4l', rrp: '60%', sgrenze: '3.250m', wgew: 40, ff: 'SüdO-NW 2', kmh: '10 km/h' })]),
    intervals(1, [interval('02:00', { tmax: '17°C' })]),
  ].join('');
  const [d, iv] = parse(page).sections;
  assert.equal(d.entries[0].precipMm, 4);
  assert.equal(d.entries[0].precipProb, 90);
  assert.equal(d.entries[0].sunHours, 2);
  assert.equal(d.entries[0].snowLineM, 3330);
  assert.equal(d.entries[0].thunderProb, 30);
  assert.equal(d.entries[0].condition, 'Regenschauer');
  assert.deepEqual(iv.entries[0], {
    time: '2026-08-17T14:00:00+02:00',
    condition: 'Gewitter',
    isNight: false,
    iconUrl: 'https://vcdn.bergfex.at/images/wetter/bergfex-shaded/g.png',
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

test('bergfex: Anzeige-Hinweise (Karten, Morgen ab 18 Uhr, nächste 8 Intervalle)', () => {
  const [daily, iv] = parse(fullPage()).sections;
  assert.equal(daily.display.layout, 'cards');
  assert.equal(daily.display.horizonHours, 6);
  assert.equal(iv.display.limit, 8);
  assert.ok(!daily.display.fields.flat().includes('snowLineM'));
  assert.ok(!iv.display.fields.flat().includes('snowLineM'));
});

test('bergfex: fehlender Morgen-Block oder Temperatur → Fehler', () => {
  assert.throws(() => parse(fullPage().replace('id="forecast-day-1"', 'id="forecast-day-x"')), /forecast-day-1/);
  assert.throws(() => parse(fullPage({ day0: { tmax: '-' } })), /Min\/Max/);
  assert.throws(() => parse(fullPage({ iv: { '13:00': { tmax: '' } } })), /keine Temperatur/);
});
