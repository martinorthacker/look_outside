// look_outside – rendert data.json generisch (Schema: scraper/schema.md).
// Kein quellenspezifischer Code: Welche Felder/Einträge sichtbar sind, steht
// in section.display; hier ist nur das Feldvokabular (Beschriftung, Einheit) bekannt.
// Texte aus den Quellen werden ausschließlich als Textknoten eingefügt.

const NBSP = ' ';
const STALE_AFTER_MS = 2 * 3600e3; // Hinweis, wenn der Workflow länger nicht lief

// Feldvokabular. digits = max. Nachkommastellen; zeroIsNone: 0 als „–" zeigen.
const FIELDS = {
  condition: { label: 'Wetter' },
  temp: { label: 'Temp.', unit: '°', digits: 1 },
  tempFeels: { label: 'Gefühlt', unit: '°', digits: 1 },
  tempMax: { label: 'Max', unit: '°', digits: 1 },
  tempMin: { label: 'Min', unit: '°', digits: 1 },
  precipMm: { label: 'Nieder­schlag', unit: `${NBSP}mm`, digits: 1, zeroIsNone: true },
  precipProb: { label: 'Regen-Wahrsch.', unit: `${NBSP}%`, zeroIsNone: true },
  thunderProb: { label: 'Gewitter', unit: `${NBSP}%`, zeroIsNone: true },
  sunHours: { label: 'Sonne', unit: `${NBSP}h`, digits: 1 },
  snowLineM: { label: 'Schneefallgrenze', unit: `${NBSP}m` },
  newSnowCm: { label: 'Neuschnee', unit: `${NBSP}cm`, zeroIsNone: true },
  windKmh: { label: 'Wind', unit: `${NBSP}km/h` },
  windBft: { label: 'Wind', unit: `${NBSP}Bft` },
  windDeg: { label: 'Windrichtung', unit: '°' },
  windDir: { label: 'Wind' },
};
const NOT_SHOWN = new Set(['location', 'date', 'time', 'timeEnd', 'iconUrl', 'isNight']);
const KEY_LABEL = { time: 'Zeit', date: 'Tag', location: 'Ort' };

// Wettertext → Emoji (ROADMAP #11). Reihenfolge = Priorität.
const EMOJI = [
  [/gewitter/, '⛈️'],
  [/schnee|graupel/, '🌨️'],
  [/schauer/, '🌦️'],
  [/regen|niesel/, '🌧️'],
  [/nebel|dunst/, '🌫️'],
  [/bedeckt|stark bewölkt/, '☁️'],
  [/wolkig|bewölkt/, '⛅'],
  [/heiter|sonnig/, '🌤️'],
  [/wolkenlos|klar/, '☀️'],
];
const NIGHT = { '☀️': '🌙', '🌤️': '🌙', '⛅': '☁️', '🌦️': '🌧️' };

function emoji(condition, isNight) {
  const text = (condition ?? '').toLowerCase();
  const hit = EMOJI.find(([re]) => re.test(text));
  if (!hit) return '·';
  return isNight ? (NIGHT[hit[1]] ?? hit[1]) : hit[1];
}

// ---------- DOM ----------

function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else el.setAttribute(k, v);
  }
  el.append(...children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false));
  return el;
}

// ---------- Zeit (Europe/Vienna, unabhängig von der Gerätezeitzone) ----------

let tz = 'Europe/Vienna';
const formatters = new Map();
function dtf(opts) {
  const key = tz + JSON.stringify(opts);
  if (!formatters.has(key)) formatters.set(key, new Intl.DateTimeFormat('de-AT', { timeZone: tz, ...opts }));
  return formatters.get(key);
}

/** Wanduhr-Bestandteile in tz */
function parts(ms) {
  const p = {};
  const f = dtf({ year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' });
  for (const { type, value } of f.formatToParts(new Date(ms))) p[type] = value;
  p.weekday = p.weekday.replace('.', '');
  return p;
}

const dayKey = (ms) => { const p = parts(ms); return `${p.year}-${p.month}-${p.day}`; };
const hm = (ms) => { const p = parts(ms); return `${p.hour}:${p.minute}`; };

/** "YYYY-MM-DD" + n Tage */
function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** 00:00 Uhr in tz am Tag key → Epoch-ms */
function midnight(key) {
  const [y, m, d] = key.split('-').map(Number);
  const target = Date.UTC(y, m - 1, d);
  let t = target;
  for (let i = 0; i < 2; i++) {
    const p = parts(t);
    t -= Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - target;
  }
  return t;
}

function dayLabel(key, now, { short = false } = {}) {
  const today = dayKey(now);
  const p = parts(midnight(key) + 12 * 3600e3);
  const date = `${p.weekday} ${p.day}.${p.month}.`;
  if (key === today) return 'Heute';
  if (key === addDays(today, 1)) return short ? 'Morgen' : `Morgen, ${date}`;
  return date;
}

/** "20:45" heute, sonst "14.11. 20:45" */
function when(iso, now) {
  const ms = Date.parse(iso);
  if (dayKey(ms) === dayKey(now)) return hm(ms);
  const p = parts(ms);
  return `${p.day}.${p.month}. ${p.hour}:${p.minute}`;
}

function ago(ms, now) {
  const min = Math.round((now - ms) / 60e3);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min}${NBSP}Min`;
  return `vor ${Math.round(min / 60)}${NBSP}Std`;
}

// ---------- Werte ----------

const numberFormats = new Map();
function num(v, digits) {
  if (!numberFormats.has(digits)) {
    numberFormats.set(digits, new Intl.NumberFormat('de-AT', {
      minimumFractionDigits: digits, maximumFractionDigits: digits, signDisplay: 'negative',
    }));
  }
  return numberFormats.get(digits).format(v).replace('-', '−');
}

/** Nachkommastellen pro Feld einheitlich für alle angezeigten Einträge (Spalte). */
function digitsFor(field, entries) {
  const max = FIELDS[field]?.digits ?? 0;
  return entries.some((e) => typeof e[field] === 'number' && !Number.isInteger(e[field])) ? max : 0;
}

/** Formatierter Wert oder null (= nicht vorhanden / nichts). */
function fmt(field, value, digits) {
  const def = FIELDS[field] ?? {};
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number') return String(value);
  if (def.zeroIsNone && value === 0) return null;
  return num(value, digits) + (def.unit ?? '');
}

/** Zellinhalt einer Feldgruppe: Werte nebeneinander, umbrechbar zwischen Werten. */
function valueNodes(group, entry, digits) {
  const values = group.map((f) => fmt(f, entry[f], digits[f])).filter((v) => v !== null);
  if (!values.length) return [h('span', { class: 'none' }, '–')];
  return values.flatMap((v, i) => [i ? ' ' : null, h('span', { class: i ? 'v sub' : 'v' }, v)]);
}

function conditionNodes(entry) {
  return [
    h('span', { class: 'emoji', 'aria-hidden': 'true' }, emoji(entry.condition, entry.isNight)),
    h('span', { class: 'txt' }, entry.condition ?? '–'),
  ];
}

// ---------- Einträge auswählen (display.hidePast / horizonHours / limit) ----------

function rowKey(entry) {
  return ['time', 'date', 'location'].find((k) => k in entry);
}

/** Beginn/Ende eines Eintrags in ms (null bei location). */
function bounds(entries) {
  const starts = entries.map((e) => (e.time ? Date.parse(e.time) : e.date ? midnight(e.date) : null));
  return entries.map((e, i) => {
    const start = starts[i];
    if (start === null) return { start: null, end: null };
    if (e.timeEnd) return { start, end: Date.parse(e.timeEnd) };
    if (e.date) return { start, end: midnight(addDays(e.date, 1)) };
    // Punkt-/Intervallwerte ohne Ende: gültig bis zum nächsten Eintrag
    const next = starts[i + 1];
    const prev = starts[i - 1];
    return { start, end: next ?? (prev !== undefined && prev !== null ? start + (start - prev) : start + 3600e3) };
  });
}

function visibleEntries(section, now) {
  const d = section.display ?? {};
  const b = bounds(section.entries);
  let list = section.entries.map((entry, i) => ({ entry, ...b[i] }));
  if (d.hidePast) list = list.filter((x) => x.end === null || x.end > now);
  if (d.horizonHours) list = list.filter((x) => x.start === null || x.start < now + d.horizonHours * 3600e3);
  if (d.limit) list = list.slice(0, d.limit);
  return list;
}

function columns(section) {
  if (section.display?.fields) return section.display.fields.map((f) => (Array.isArray(f) ? f : [f]));
  const present = new Set(section.entries.flatMap(Object.keys));
  return Object.keys(FIELDS).filter((f) => present.has(f) && !NOT_SHOWN.has(f)).map((f) => [f]);
}

// ---------- Rendering ----------

function keyCell(item, now) {
  const e = item.entry;
  if (e.location) return e.location;
  if (e.date) return dayLabel(e.date, now, { short: true });
  const start = hm(item.start).slice(0, 2);
  return e.timeEnd ? `${start}–${hm(item.end).slice(0, 2)}` : hm(item.start);
}

function renderTable(section, items, now) {
  const cols = columns(section);
  const fields = cols.flat();
  const digits = Object.fromEntries(fields.map((f) => [f, digitsFor(f, items.map((x) => x.entry))]));
  const key = rowKey(items[0].entry);

  const head = h('tr', null,
    h('th', { scope: 'col' }, KEY_LABEL[key]),
    cols.map((g) => h('th', { scope: 'col', class: g[0] === 'condition' ? 'cond' : null }, FIELDS[g[0]]?.label ?? g[0])));

  const rows = [];
  let lastDay = dayKey(now);
  for (const item of items) {
    if (key === 'time') {
      const day = dayKey(item.start);
      if (day !== lastDay) rows.push(h('tr', { class: 'day' }, h('td', { colspan: cols.length + 1 }, dayLabel(day, now))));
      lastDay = day;
    }
    rows.push(h('tr', null,
      h('th', { scope: 'row' }, keyCell(item, now)),
      cols.map((g) => (g[0] === 'condition'
        ? h('td', { class: 'cond' }, conditionNodes(item.entry))
        : h('td', null, valueNodes(g, item.entry, digits))))));
  }
  return h('div', { class: 'scroll' }, h('table', null, h('thead', null, head), h('tbody', null, rows)));
}

function renderCards(section, items, now) {
  const cols = columns(section).filter((g) => g[0] !== 'condition');
  const digits = Object.fromEntries(cols.flat().map((f) => [f, digitsFor(f, items.map((x) => x.entry))]));
  return h('div', { class: 'cards' }, items.map((item) => h('article', { class: 'card' },
    h('header', null,
      h('span', { class: 'emoji', 'aria-hidden': 'true' }, emoji(item.entry.condition, item.entry.isNight)),
      h('strong', null, keyCell(item, now)),
      h('span', { class: 'txt' }, item.entry.condition ?? '')),
    h('dl', null, cols.map((g) => h('div', null,
      h('dt', null, FIELDS[g[0]]?.label ?? g[0]),
      h('dd', null, valueNodes(g, item.entry, digits))))))));
}

function renderSection(section, now) {
  const items = visibleEntries(section, now);
  const meta = section.observedAt ? h('span', { class: 'meta' }, ` · Messung ${when(section.observedAt, now)}`) : null;
  const body = !items.length
    ? h('p', { class: 'muted' }, 'Keine aktuellen Einträge (Daten zu alt).')
    : section.display?.layout === 'cards' ? renderCards(section, items, now) : renderTable(section, items, now);
  return h('div', { class: 'section' }, h('h3', null, section.title, meta), body);
}

function renderSource(src, now) {
  let alert = null;
  if (src.status === 'error') {
    alert = h('p', { class: 'alert', role: 'alert' }, src.sections.length && src.lastSuccessAt
      ? `⚠ Veraltet – Stand ${when(src.lastSuccessAt, now)} – Fehler: ${src.error}`
      : `⚠ Keine Daten – Fehler: ${src.error}`);
  }
  const warnings = src.warnings?.length ? h('ul', { class: 'warnings' }, src.warnings.map((w) => h('li', null, w))) : null;
  return h('section', { class: `source${src.status === 'error' ? ' stale' : ''}` },
    h('h2', null, h('a', { href: src.url, target: '_blank', rel: 'noopener noreferrer' }, src.name)),
    alert, warnings,
    h('div', { class: 'sections' }, src.sections.map((s) => renderSection(s, now))));
}

let current = null; // { data, offline }

function render() {
  if (!current) return;
  const { data, offline } = current;
  const now = Date.now();
  tz = data.timezone || tz;
  const generated = Date.parse(data.generatedAt);
  const stale = now - generated > STALE_AFTER_MS;
  const stand = document.getElementById('stand');
  stand.className = `stand${stale ? ' warn' : ''}`;
  stand.textContent = `${stale ? '⚠ ' : ''}Stand ${when(data.generatedAt, now)} (${ago(generated, now)})${offline ? ' · offline' : ''}`;
  document.getElementById('app').replaceChildren(...data.sources.map((s) => renderSource(s, now)));
}

let lastLoad = 0;
async function load() {
  const button = document.getElementById('refresh');
  button.disabled = true;
  try {
    const res = await fetch('data.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    current = { data: await res.json(), offline: res.headers.get('x-offline-cache') === '1' };
    lastLoad = Date.now();
    render();
  } catch (err) {
    if (current) {
      current.offline = true;
      render();
    } else {
      document.getElementById('app').replaceChildren(h('p', { class: 'alert' }, `Daten konnten nicht geladen werden (${err.message}).`));
    }
  } finally {
    button.disabled = false;
  }
}

document.getElementById('refresh').addEventListener('click', load);
// Installierte PWA hat kein Pull-to-Refresh → beim Zurückkehren neu laden.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - lastLoad > 60e3) load();
});
// Relative Zeiten und vergangene Einträge aktuell halten.
setInterval(() => document.visibilityState === 'visible' && render(), 60e3);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
load();
