// Erzeugt die PWA-Icons in docs/ (icon.svg, icon-192.png, icon-512.png) ohne
// Abhängigkeiten: Formen als Signed-Distance-Functions (kantengeglättet),
// PNG-Kodierung über node:zlib. Motiv: Sonne hinter Wolke auf Blau.
//   node tools/make-icons.js

import { writeFile } from 'node:fs/promises';
import { crc32, deflateSync } from 'node:zlib';

const out = (name) => new URL(`../../docs/${name}`, import.meta.url);

const COLORS = { bg: '#1d6fa5', sun: '#ffc83d', cloud: '#ffffff' };
// Koordinaten in Einheiten des Quadrats (0..1). Alles liegt innerhalb der
// Maskable-Safe-Zone (Kreis r = 0.4 um die Mitte), daher taugt dasselbe
// Bild für purpose "any" und "maskable".
const SUN = { cx: 0.40, cy: 0.40, r: 0.17 };
const CLOUD = [
  { cx: 0.45, cy: 0.64, r: 0.11 },
  { cx: 0.60, cy: 0.56, r: 0.15 },
  { cx: 0.73, cy: 0.65, r: 0.10 },
];
const CLOUD_BASE = { x0: 0.45, x1: 0.73, y0: 0.62, y1: 0.75 };

const circle = (c) => (x, y) => Math.hypot(x - c.cx, y - c.cy) - c.r;
const box = (b) => (x, y) => {
  const dx = Math.max(b.x0 - x, 0, x - b.x1);
  const dy = Math.max(b.y0 - y, 0, y - b.y1);
  return Math.hypot(dx, dy) + Math.min(0, Math.max(b.x0 - x, x - b.x1, b.y0 - y, y - b.y1));
};
const union = (...fs) => (x, y) => Math.min(...fs.map((f) => f(x, y)));

const sunSdf = circle(SUN);
const cloudSdf = union(...CLOUD.map(circle), box(CLOUD_BASE));
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function render(size) {
  const [bg, sun, cloud] = [COLORS.bg, COLORS.sun, COLORS.cloud].map(rgb);
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(stride * size); // pro Zeile: Filterbyte 0 + RGB
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = (px + 0.5) / size;
      const y = (py + 0.5) / size;
      let c = bg;
      for (const [sdf, color] of [[sunSdf, sun], [cloudSdf, cloud]]) {
        const a = Math.min(1, Math.max(0, 0.5 - sdf(x, y) * size));
        c = c.map((v, i) => v + (color[i] - v) * a);
      }
      raw.set(c.map(Math.round), py * stride + 1 + px * 3);
    }
  }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8 bit, RGB, deflate, Standardfilter, kein Interlace
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const u = (v) => +(v * 100).toFixed(2);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="18" fill="${COLORS.bg}"/>
  <circle cx="${u(SUN.cx)}" cy="${u(SUN.cy)}" r="${u(SUN.r)}" fill="${COLORS.sun}"/>
  <g fill="${COLORS.cloud}">
${CLOUD.map((c) => `    <circle cx="${u(c.cx)}" cy="${u(c.cy)}" r="${u(c.r)}"/>`).join('\n')}
    <rect x="${u(CLOUD_BASE.x0)}" y="${u(CLOUD_BASE.y0)}" width="${u(CLOUD_BASE.x1 - CLOUD_BASE.x0)}" height="${u(CLOUD_BASE.y1 - CLOUD_BASE.y0)}"/>
  </g>
</svg>
`;

await writeFile(out('icon.svg'), svg);
for (const size of [192, 512]) await writeFile(out(`icon-${size}.png`), render(size));
console.log('docs/icon.svg, docs/icon-192.png, docs/icon-512.png geschrieben');
