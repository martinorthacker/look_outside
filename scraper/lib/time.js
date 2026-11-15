// Zeit-Helfer für Europe/Vienna. Die Quellen liefern lokale Wanduhrzeiten
// ohne Offset ("20-21", "13:00"); daraus werden ISO-Strings mit korrektem
// Offset (MEZ +01:00 / MESZ +02:00), unabhängig von der Zeitzone des Runners
// (GitHub Actions läuft in UTC).

export const TZ = 'Europe/Vienna';

const partsFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

const pad = (n) => String(n).padStart(2, '0');

/** Wiener Wanduhr-Bestandteile für einen Zeitpunkt. */
export function viennaParts(date) {
  const p = {};
  for (const { type, value } of partsFormat.formatToParts(date)) {
    if (type !== 'literal') p[type] = Number(value);
  }
  return { year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute, second: p.second };
}

/** Offset Wien gegenüber UTC in Minuten zum Zeitpunkt date. */
function offsetMinutes(date) {
  const p = viennaParts(date);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((wallAsUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** ISO 8601 mit Wiener Offset, sekundengenau, z.B. 2026-11-15T20:00:00+01:00 */
export function toViennaIso(date) {
  const d = new Date(Math.floor(date.getTime() / 1000) * 1000);
  const p = viennaParts(d);
  const off = offsetMinutes(d);
  const a = Math.abs(off);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`
    + `${off < 0 ? '-' : '+'}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

/** Wiener Wanduhrzeit → Date. Überläufe (Stunde 24, Tag 32 …) werden normalisiert. */
export function fromVienna(year, month, day, hour = 0, minute = 0) {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  // Der Offset hängt vom gesuchten UTC-Zeitpunkt ab → einmal nachkorrigieren.
  let ts = wall - offsetMinutes(new Date(wall)) * 60000;
  ts = wall - offsetMinutes(new Date(ts)) * 60000;
  return new Date(ts);
}

export function viennaIso(year, month, day, hour = 0, minute = 0) {
  return toViennaIso(fromVienna(year, month, day, hour, minute));
}

/** Kalenderdatum {year, month, day} plus n Tage. */
export function addDays({ year, month, day }, n) {
  const d = new Date(Date.UTC(year, month - 1, day + n));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function isoDate({ year, month, day }) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Heutiges Wiener Kalenderdatum relativ zu now. */
export function viennaToday(now) {
  const { year, month, day } = viennaParts(now);
  return { year, month, day };
}

/** Jahr zu einer Datumsangabe ohne Jahr ("16.11."), Jahreswechsel berücksichtigt. */
export function inferYear(month, now) {
  const { year, month: nowMonth } = viennaParts(now);
  if (month - nowMonth > 6) return year - 1;
  if (nowMonth - month > 6) return year + 1;
  return year;
}
