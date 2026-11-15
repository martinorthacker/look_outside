// bergfex Graz Prognose: Tageswerte und 3-h-Intervalle für Heute und Morgen.
// Tagesblock:  <div id="forecast-day-0" class="day selected selectable fields" title="Wetterprognose 15.11.2026">
//                .icon img[title="stark bewölkt 1h Sonne"], .tmax "3°C", .tmin "-3°C", .nschnee "-",
//                .rrp "60%", .rrr "0,4l", .sonne "1h", .sgrenze "1.230m",
//                .wgew[title="Gewitterwahrscheinlichkeit: 0%"], .ff "NW-SW 1" (Richtung + Bft)
// Intervalle:  .forecast-day-0-intervals .interval → .time "13:00", .tmax, .rrr, .rrp, .sgrenze,
//                .wgew[title], .ff (Richtung + Bft), .ff-kmh "5 km/h"
// Die Intervall-Liste eines Tages endet mit 01:00 des Folgetags (= erstes
// Intervall des nächsten Tages) → wird dedupliziert.
// "-" bedeutet auf bergfex "kein Wert" → null.

import * as cheerio from 'cheerio';
import { runIfMain } from '../lib/cli.js';
import { cleanText, parseNumber } from '../lib/parse.js';
import { addDays, isoDate, viennaIso } from '../lib/time.js';

const source = {
  id: 'bergfex',
  name: 'bergfex Graz',
  url: 'https://www.bergfex.at/sommer/graz/wetter/prognose/',
  parse,
};
export default source;

const DAYS = [0, 1]; // Heute, Morgen

// Anzeige laut ROADMAP „Anzeige": alles außer Schneefallgrenze; „Morgen" ab
// 18 Uhr (horizonHours 6), Intervalle rollierend die nächsten 8.
const DISPLAY_DAILY = {
  layout: 'cards',
  fields: ['condition', 'tempMax', 'tempMin', 'precipMm', 'precipProb', 'sunHours', 'thunderProb', 'newSnowCm', ['windDir', 'windBft']],
  hidePast: true,
  horizonHours: 6,
};
const DISPLAY_INTERVALS = {
  fields: ['condition', 'temp', ['precipMm', 'precipProb'], 'thunderProb', ['windDir', 'windBft', 'windKmh']],
  hidePast: true,
  limit: 8,
};

const absUrl = (src) => (src ? new URL(src, source.url).href : null);
const isNight = (src) => (src ? /\/night\//.test(src) : null);

/** Icon-Titel "stark bewölkt 1.00h Sonne" → "stark bewölkt" */
const condition = (title) => cleanText(title).replace(/\s*\d+(?:[.,]\d+)?h Sonne$/, '') || null;

/** "NW-SW 1" → { windDir: "NW-SW", windBft: 1 }; "-" → nulls */
function wind(text) {
  const t = cleanText(text);
  const m = t.match(/^(.*?)\s*(\d+)$/);
  if (m) return { windDir: m[1] || null, windBft: Number(m[2]) };
  return { windDir: t && t !== '-' ? t : null, windBft: null };
}

const num = (el, opts) => parseNumber(el.first().text(), opts);
const thunder = (el) => parseNumber(el.first().attr('title'));

// Kein `now` nötig: bergfex nennt das Datum absolut (title "Wetterprognose 15.11.2026").
export function parse(html) {
  const $ = cheerio.load(html);
  const daily = [];
  const intervals = [];
  const seen = new Set();

  for (const i of DAYS) {
    const day = $(`#forecast-day-${i}`);
    if (!day.length) throw new Error(`Tagesblock #forecast-day-${i} nicht gefunden`);
    const d = (day.attr('title') ?? '').match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (!d) throw new Error(`Tag ${i}: Datum im title nicht erkennbar`);
    const date = { year: Number(d[3]), month: Number(d[2]), day: Number(d[1]) };

    const icon = day.find('.icon img').first();
    const entry = {
      date: isoDate(date),
      condition: condition(icon.attr('title')),
      isNight: isNight(icon.attr('src')),
      iconUrl: absUrl(icon.attr('src')),
      tempMax: num(day.find('.tmax')),
      tempMin: num(day.find('.tmin')),
      precipMm: num(day.find('.rrr')),
      precipProb: num(day.find('.rrp')),
      thunderProb: thunder(day.find('.wgew')),
      sunHours: num(day.find('.sonne')),
      snowLineM: num(day.find('.sgrenze'), { thousands: true }),
      newSnowCm: num(day.find('.nschnee')),
      ...wind(day.find('.ff').first().text()),
    };
    if (entry.tempMax === null || entry.tempMin === null) throw new Error(`Tag ${i}: Min/Max-Temperatur fehlt`);
    daily.push(entry);

    const ivs = $(`.forecast-day-${i}-intervals .interval`).toArray();
    if (!ivs.length) throw new Error(`Tag ${i}: keine 3-h-Intervalle gefunden`);
    let ivDate = date;
    let prevMinutes = -1;
    for (const el of ivs) {
      const iv = $(el);
      const t = cleanText(iv.find('.time').text()).match(/^(\d{1,2}):(\d{2})$/);
      if (!t) throw new Error(`Tag ${i}: Intervall-Uhrzeit nicht erkennbar`);
      const minutes = Number(t[1]) * 60 + Number(t[2]);
      if (minutes < prevMinutes) ivDate = addDays(ivDate, 1);
      prevMinutes = minutes;

      const time = viennaIso(ivDate.year, ivDate.month, ivDate.day, Number(t[1]), Number(t[2]));
      if (seen.has(time)) continue;
      seen.add(time);

      const ivIcon = iv.find('.icon img').first();
      const e = {
        time,
        condition: condition(ivIcon.attr('title')),
        isNight: isNight(ivIcon.attr('src')),
        iconUrl: absUrl(ivIcon.attr('src')),
        temp: num(iv.find('.tmax')),
        precipMm: num(iv.find('.rrr')),
        precipProb: num(iv.find('.rrp')),
        thunderProb: thunder(iv.find('.wgew')),
        snowLineM: num(iv.find('.sgrenze'), { thousands: true }),
        ...wind(iv.find('.ff').not('.ff-kmh').first().text()),
        windKmh: num(iv.find('.ff-kmh')),
      };
      if (e.temp === null) throw new Error(`Intervall ${time}: keine Temperatur`);
      intervals.push(e);
    }
  }

  return {
    sections: [
      { id: 'daily', title: 'Tageswerte', display: DISPLAY_DAILY, entries: daily },
      { id: 'intervals', title: '3-Stunden-Prognose', display: DISPLAY_INTERVALS, entries: intervals },
    ],
    warnings: [],
  };
}

await runIfMain(import.meta.url, source);
