// ORF Wetter Steiermark: aktuelle Messwerte der Grazer Wetterstationen.
// Tabelle "Wetterstationen", Zeilen:
//   <td class="stationName"><a href="https://wetter.ORF.at/steiermark/grazthalerhof/">Graz-Thalerhof</a></td>
//   <td class="stationWeather">heiter</td>
//   <td class="stationTemperature">&minus;1,7&thinsp;<abbr>°C</abbr></td>
// Messzeitpunkt: <p class="lastUpdateMessage">Letzte Messwerte von 20.00 Uhr</p>

import * as cheerio from 'cheerio';
import { runIfMain } from '../lib/cli.js';
import { cleanText, parseNumber } from '../lib/parse.js';
import { addDays, viennaIso, viennaParts, viennaToday } from '../lib/time.js';

const source = {
  id: 'orf',
  name: 'ORF Wetter Steiermark',
  url: 'https://wetter.orf.at/steiermark/',
  parse,
};
export default source;

// Zuordnung über den URL-Slug, nicht über den Anzeigenamen (der variiert:
// "Graz Heinrichstrasse" vs. "Graz-Straßgang").
const STATIONS = [
  { slug: 'grazheinrichstrasse', name: 'Graz Heinrichstraße' },
  { slug: 'grazstraszgang', name: 'Graz-Straßgang' },
  { slug: 'grazthalerhof', name: 'Graz-Thalerhof' },
  { slug: 'grazuniversitaet', name: 'Graz-Universität' },
];

/** "Letzte Messwerte von 20.00 Uhr" → ISO. Liegt die Uhrzeit nach jetzt, ist sie von gestern. */
function parseObservedAt(text, now) {
  const m = cleanText(text).match(/(\d{1,2})[.:](\d{2})\s*Uhr/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  const p = viennaParts(now);
  let date = viennaToday(now);
  if (hour * 60 + minute > p.hour * 60 + p.minute + 30) date = addDays(date, -1);
  return viennaIso(date.year, date.month, date.day, hour, minute);
}

export function parse(html, { now }) {
  const $ = cheerio.load(html);
  const rows = $('tr').has('td.stationName');
  if (!rows.length) throw new Error('Stationstabelle (td.stationName) nicht gefunden');

  const bySlug = new Map();
  rows.each((_, tr) => {
    const href = $(tr).find('td.stationName a').attr('href') ?? '';
    const m = href.match(/\/steiermark\/([a-z0-9-]+)\/?$/i);
    if (m) bySlug.set(m[1].toLowerCase(), $(tr));
  });

  const warnings = [];
  const entries = [];
  for (const station of STATIONS) {
    const tr = bySlug.get(station.slug);
    // Einzelne Stationen fallen real gelegentlich aus → Warnung, kein Quellenfehler.
    if (!tr) {
      warnings.push(`Station ${station.name} fehlt auf der Seite`);
      continue;
    }
    const temp = parseNumber(tr.find('td.stationTemperature').text());
    if (temp === null) warnings.push(`Station ${station.name}: keine Temperatur`);
    entries.push({
      location: cleanText(tr.find('td.stationName').text()) || station.name,
      condition: cleanText(tr.find('td.stationWeather').text()) || null,
      temp,
    });
  }
  if (!entries.length) throw new Error('Keine der Grazer Stationen gefunden');
  if (entries.every((e) => e.temp === null)) throw new Error('Keine Station mit Temperatur');

  const observedAt = parseObservedAt($('.lastUpdateMessage').first().text(), now);
  if (!observedAt) warnings.push('Messzeitpunkt („Letzte Messwerte von …") nicht gefunden');

  return {
    sections: [{ id: 'stations', title: 'Messstationen Graz', ...(observedAt && { observedAt }), entries }],
    warnings,
  };
}

await runIfMain(import.meta.url, source);
