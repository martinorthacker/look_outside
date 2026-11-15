// GeoSphere Austria – Radl-Wetter Graz: Stundenprognose für das Stadtzentrum.
// Tabelle (serverseitig gerendert), Spalten: Zeit | Wetter | Temp. | Niederschlag | Wind | (Warnung)
//   Zeit:         "20-21", beim Tageswechsel mit <span>Mo, 16.11.</span><br>00-01
//   Wetter:       <img title="bedeckt" src="…/ne.png">
//   Temp.:        "-1.3", title="Radl-Temperatur: -8.5°C"
//   Niederschlag: leer, Menge in mm im title="0.3"
//   Wind:         Pfeil-Bild mit transform: rotate(35.5deg), danach "&nbsp;10" (km/h)

import * as cheerio from 'cheerio';
import { runIfMain } from '../lib/cli.js';
import { cleanText, parseNumber } from '../lib/parse.js';
import { addDays, inferYear, viennaIso, viennaParts, viennaToday } from '../lib/time.js';

const source = {
  id: 'geosphere',
  name: 'GeoSphere Radl-Wetter Graz',
  url: 'https://www.zamg.ac.at/steiermark/stadt-graz/radlwetter/',
  parse,
};
export default source;

// Anzeige laut ROADMAP „Anzeige": ohne Radl-Temperatur und Wind.
const DISPLAY = { fields: ['condition', 'temp', 'precipMm'], hidePast: true };

const COMPASS = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];

/** Symbolnamen: Tag "c.png", Nacht "nc.png". Unbekanntes Muster → null. */
export function isNightIcon(src) {
  const name = (src ?? '').split('/').pop().replace(/\.png$/i, '');
  if (/^n[a-z]$/.test(name)) return true;
  if (/^[a-z]$/.test(name)) return false;
  return null;
}

/** Grad (woher) → 8-teilige Himmelsrichtung, deutsch. */
export function compass(deg) {
  return COMPASS[Math.round(deg / 45) % 8];
}

export function parse(html, { now }) {
  const $ = cheerio.load(html);
  const table = $('table')
    .filter((_, t) => cleanText($(t).find('thead th').first().text()) === 'Zeit')
    .first();
  if (!table.length) throw new Error('Prognosetabelle (Spalte „Zeit") nicht gefunden');
  const rows = table.find('tbody > tr').toArray();
  if (!rows.length) throw new Error('Prognosetabelle ohne Zeilen');

  const nowHour = viennaParts(now).hour;
  let date = null;
  let prevHour = null;

  const entries = rows.map((tr, i) => {
    const where = `Zeile ${i + 1}`;
    const td = $(tr).children('td');
    if (td.length < 5) throw new Error(`${where}: ${td.length} statt ≥ 5 Spalten`);

    const timeText = cleanText(td.eq(0).text());
    const span = timeText.match(/(\d{2})\s*-\s*(\d{2})$/);
    if (!span) throw new Error(`${where}: Zeitspanne nicht erkennbar („${timeText}")`);
    const hour = Number(span[1]);

    // Datum: explizites Label beim Tageswechsel, sonst fortschreiben.
    const label = cleanText(td.eq(0).find('span').text()).match(/(\d{1,2})\.(\d{1,2})\./);
    if (label) {
      const month = Number(label[2]);
      date = { year: inferYear(month, now), month, day: Number(label[1]) };
    } else if (date === null) {
      date = viennaToday(now);
      // Erste Zeile liegt deutlich "nach" jetzt → Seite noch vom Vortag (z.B. 23-00 um 00:05).
      if (hour > nowHour + 2) date = addDays(date, -1);
    } else if (hour < prevHour) {
      date = addDays(date, 1);
    }
    prevHour = hour;

    const temp = parseNumber(td.eq(2).text());
    if (temp === null) throw new Error(`${where}: keine Temperatur`);
    const feels = (td.eq(2).attr('title') ?? '').match(/Radl-Temperatur:\s*(\S+?)\s*°/);

    const img = td.eq(1).find('img').first();
    const rotation = (td.eq(4).find('img').attr('style') ?? '').match(/rotate\(\s*(-?[\d.]+)deg/);
    // Der Pfeil zeigt ungedreht nach unten (Wind aus Nord) → Drehwinkel = Herkunftsrichtung.
    const windDeg = rotation ? Math.round(((Number(rotation[1]) % 360) + 360) % 360) % 360 : null;

    return {
      time: viennaIso(date.year, date.month, date.day, hour),
      timeEnd: viennaIso(date.year, date.month, date.day, hour + 1),
      condition: cleanText(img.attr('title')) || null,
      isNight: isNightIcon(img.attr('src')),
      iconUrl: img.attr('src') ? new URL(img.attr('src'), source.url).href : null,
      temp,
      tempFeels: feels ? parseNumber(feels[1]) : null,
      precipMm: parseNumber(td.eq(3).attr('title')),
      windKmh: parseNumber(td.eq(4).text()),
      windDeg,
      windDir: windDeg === null ? null : compass(windDeg),
    };
  });

  return {
    sections: [{ id: 'hourly', title: 'Stundenprognose Stadtzentrum', display: DISPLAY, entries }],
    warnings: [],
  };
}

await runIfMain(import.meta.url, source);
