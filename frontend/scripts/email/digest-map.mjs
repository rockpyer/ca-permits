// Static map for the weekly email: the week's approved permits, colored by work activity, over county lines and oil
// and gas field boundaries. Email clients don't show SVG, so the snapshot renders it to PNG (resvg) as
// public/data/digest-map.png; the Worker stores each week's copy so old emails keep their own map.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { workGroup } from '../digest.mjs';

const here = dirname(fileURLToPath(import.meta.url));
// Same values as src/lib/palette.ts.
const WORK = { new_drills: '#15803d', existing: '#1e3a8a', abandonment: '#8b5e34' };
const FONT = 'IBM Plex Sans Condensed';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

let counties;
const loadCounties = () => (counties ??= JSON.parse(readFileSync(resolve(here, 'ca-counties.json'), 'utf8')).counties);

// Map extent around the points: padded, at least `minSpan` degrees tall, widened or heightened to the image's aspect.
export function extent(points, aspect, { pad = 0.25, minSpan = 1.1 } = {}) {
  const lons = points.map((p) => p.lon), lats = points.map((p) => p.lat);
  let [x0, x1, y0, y1] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
  const midLat = (y0 + y1) / 2, k = Math.cos((midLat * Math.PI) / 180);
  let h = Math.max(minSpan, (y1 - y0) * (1 + 2 * pad)), w = Math.max((x1 - x0) * (1 + 2 * pad), 0.01);
  // Compare in projected units (longitude shrinks by cos(lat)).
  if ((w * k) / h > aspect) h = (w * k) / aspect; else w = (h * aspect) / k;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return { west: cx - w / 2, east: cx + w / 2, south: cy - h / 2, north: cy + h / 2 };
}

function centroid(ring) {
  let a = 0, x = 0, y = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    a += f; x += (ring[j][0] + ring[i][0]) * f; y += (ring[j][1] + ring[i][1]) * f;
  }
  return a ? [x / (3 * a), y / (3 * a), Math.abs(a / 2)] : [ring[0][0], ring[0][1], 0];
}

// rows: permit rows (latitude, longitude, notice_type, field_name, determination date) for the digest's week.
// fields: compact field records with geometry.rings. Returns { svg, width, height } or null without mappable points.
export function digestMapSvg(rows, fields, { width = 1200, height = 720 } = {}) {
  const points = rows.filter((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude))
    .map((r) => ({ lon: r.longitude, lat: r.latitude, group: workGroup(r), field: r.field_name || '' }));
  if (!points.length) return null;
  const e = extent(points, width / height);
  const px = (lon) => ((lon - e.west) / (e.east - e.west)) * width;
  const py = (lat) => ((e.north - lat) / (e.north - e.south)) * height;
  const path = (rings) => rings.map((r) => `M${r.map(([x, y]) => `${px(x).toFixed(1)},${py(y).toFixed(1)}`).join('L')}Z`).join('');
  const inView = (rings) => rings.some((r) => r.some(([x, y]) => x > e.west && x < e.east && y > e.south && y < e.north));
  const scale = width / 600; // drawn for a 600px-wide email, rendered at 2x

  const cs = loadCounties().filter((c) => inView(c.rings));
  const counts = new Map();
  for (const p of points) counts.set(p.field, (counts.get(p.field) || 0) + 1);
  const fs = fields.filter((f) => f.geometry?.rings && inView(f.geometry.rings));

  // County names, where the county is large enough in view to hold one.
  const countyLabels = cs.map((c) => {
    const [x, y, area] = c.rings.map(centroid).sort((a, b) => b[2] - a[2])[0];
    return { x: px(x), y: py(y), area, name: c.name };
  }).filter((l) => l.x > 30 * scale && l.x < width - 30 * scale && l.y > 15 * scale && l.y < height - 15 * scale && l.area * (width / (e.east - e.west)) ** 2 > 4500 * scale * scale);
  // Permits within a few pixels of each other merge into one ring, sized by count, split by work activity and labeled
  // with the total, so a New Drill share stays visible next to abandonments at the same field.
  const clusters = [];
  for (const p of points) {
    const x = px(p.lon), y = py(p.lat);
    const c = clusters.find((k) => Math.hypot(k.x - x, k.y - y) < 14 * scale);
    if (c) { c.x = (c.x * c.n + x) / (c.n + 1); c.y = (c.y * c.n + y) / (c.n + 1); c.n += 1; c.by[p.group] += 1; c.fields.push(p.field); }
    else clusters.push({ x, y, n: 1, by: { new_drills: 0, existing: 0, abandonment: 0, [p.group]: 1 }, fields: [p.field] });
  }
  for (const c of clusters) c.r = (c.n > 1 ? 8.5 + 2 * Math.sqrt(c.n - 1) : 5) * scale;
  clusters.sort((a, b) => b.n - a.n); // big circles underneath, small ones stay visible
  // Nudge overlapping rings apart (a few pixels each) so every count stays readable; bigger rings move less.
  for (let it = 0; it < 60; it++) {
    let moved = false;
    for (let i = 0; i < clusters.length; i++) for (let j = i + 1; j < clusters.length; j++) {
      const a = clusters[i], b = clusters[j], gap = a.r + b.r + 1.5 * scale;
      let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d >= gap) continue;
      if (d < 0.01) { dx = 1; dy = 0; d = 1; }
      const push = (gap - d) / 2, wa = b.r / (a.r + b.r), wb = a.r / (a.r + b.r);
      a.x -= (dx / d) * push * 2 * wa; a.y -= (dy / d) * push * 2 * wa;
      b.x += (dx / d) * push * 2 * wb; b.y += (dy / d) * push * 2 * wb;
      moved = true;
    }
    if (!moved) break;
  }

  // Field labels for the five fields with the most permits, beside that field's largest circle, skipping any that
  // would overlap a label already placed or run off the image.
  const placed = [];
  const fieldLabels = [];
  for (const [name] of [...counts].filter(([n]) => n).sort((a, b) => b[1] - a[1]).slice(0, 5)) {
    const c = clusters.filter((k) => k.fields.includes(name)).sort((a, b) => b.n - a.n)[0];
    const w = name.length * 6.4 * scale, h = 14 * scale;
    // Right, left, above, below the ring.
    const spots = [[c.x + c.r + 3 * scale, c.y + 4.5 * scale, 'start'], [c.x - c.r - 3 * scale, c.y + 4.5 * scale, 'end'],
      [c.x, c.y - c.r - 4 * scale, 'middle'], [c.x, c.y + c.r + 12 * scale, 'middle']];
    for (const [x, y, anchor] of spots) {
      const x0 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
      const box = { x0, x1: x0 + w, y0: y - h + 3 * scale, y1: y + 3 * scale };
      if (box.x0 < 4 || box.x1 > width - 4 || box.y0 < 4 || box.y1 > height - 4) continue;
      if (placed.some((b) => b.x0 < box.x1 && box.x0 < b.x1 && b.y0 < box.y1 && box.y0 < b.y1)) continue;
      if (clusters.some((k) => k !== c && k.x + k.r > box.x0 && k.x - k.r < box.x1 && k.y + k.r > box.y0 && k.y - k.r < box.y1)) continue;
      placed.push(box); fieldLabels.push({ name, x, y, anchor }); break;
    }
  }
  const halo = `stroke="#ffffff" stroke-width="${2.6 * scale}" stroke-linejoin="round" paint-order="stroke"`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="${width}" height="${height}" fill="#e4e9ee"/>
<path d="${path(cs.flatMap((c) => c.rings))}" fill="#f8f9fa" stroke="#c3ccd5" stroke-width="${0.7 * scale}"/>
<path d="${path(fs.flatMap((f) => f.geometry.rings))}" fill="#e3e7eb" stroke="#aab4be" stroke-width="${0.5 * scale}"/>
<path d="${path(fs.filter((f) => counts.has(f.field_name)).flatMap((f) => f.geometry.rings))}" fill="#d3dae1" stroke="#8d99a6" stroke-width="${0.6 * scale}"/>
${countyLabels.filter((l) => {
    const w = l.name.length * 7 * scale, box = { x0: l.x - w / 2, x1: l.x + w / 2, y0: l.y - 9 * scale, y1: l.y + 2 * scale };
    return !clusters.some((c) => c.x + c.r > box.x0 && c.x - c.r < box.x1 && c.y + c.r > box.y0 && c.y - c.r < box.y1)
      && !placed.some((b) => b.x0 < box.x1 && box.x0 < b.x1 && b.y0 < box.y1 && box.y0 < b.y1);
  }).map((l) => `<text x="${l.x.toFixed(1)}" y="${l.y.toFixed(1)}" text-anchor="middle" font-family="${FONT}" font-weight="500" font-size="${9.5 * scale}" letter-spacing="${1.2 * scale}" fill="#93a0ad" ${halo}>${esc(l.name.toUpperCase())}</text>`).join('\n')}
${clusters.map((c) => ring(c, scale)).join('\n')}
${fieldLabels.map((l) => `<text x="${l.x.toFixed(1)}" y="${l.y.toFixed(1)}" text-anchor="${l.anchor}" font-family="${FONT}" font-weight="600" font-size="${12.5 * scale}" fill="#172029" ${halo}>${esc(l.name)}</text>`).join('\n')}
<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="none" stroke="#d5dbe2"/>
</svg>`;
  return { svg, width, height };
}

// One cluster: a single dot, or a ring split by work activity (New Drill first, clockwise from 12 o'clock) around a
// white center holding the count.
function ring(c, scale) {
  const f = (v) => v.toFixed(1);
  if (c.n === 1) {
    const g = Object.keys(c.by).find((k) => c.by[k]);
    return `<circle cx="${f(c.x)}" cy="${f(c.y)}" r="${f(c.r)}" fill="${WORK[g]}" stroke="#ffffff" stroke-width="${1.2 * scale}"/>`;
  }
  const inner = c.r * 0.56, parts = ['new_drills', 'existing', 'abandonment'].filter((g) => c.by[g]);
  let a0 = -Math.PI / 2;
  const slices = parts.map((g) => {
    if (parts.length === 1) return `<circle cx="${f(c.x)}" cy="${f(c.y)}" r="${f(c.r)}" fill="${WORK[g]}"/>`;
    const a1 = a0 + (2 * Math.PI * c.by[g]) / c.n, large = a1 - a0 > Math.PI ? 1 : 0;
    const d = `M${f(c.x)},${f(c.y)}L${f(c.x + c.r * Math.cos(a0))},${f(c.y + c.r * Math.sin(a0))}A${f(c.r)},${f(c.r)} 0 ${large} 1 ${f(c.x + c.r * Math.cos(a1))},${f(c.y + c.r * Math.sin(a1))}Z`;
    a0 = a1;
    return `<path d="${d}" fill="${WORK[g]}"/>`;
  }).join('');
  return `<g>${slices}<circle cx="${f(c.x)}" cy="${f(c.y)}" r="${f(c.r)}" fill="none" stroke="#ffffff" stroke-width="${1.2 * scale}"/>`
    + `<circle cx="${f(c.x)}" cy="${f(c.y)}" r="${f(inner)}" fill="#ffffff"/>`
    + `<text x="${f(c.x)}" y="${f(c.y + 3.6 * scale)}" text-anchor="middle" font-family="${FONT}" font-weight="600" font-size="${(c.n > 9 ? 9.5 : 10.5) * scale}" fill="#172029">${c.n}</text></g>`;
}

export function svgToPng(svg) {
  return new Resvg(svg, {
    font: { fontFiles: ['Medium', 'SemiBold'].map((w) => resolve(here, `fonts/IBMPlexSansCondensed-${w}.ttf`)), loadSystemFonts: false, defaultFontFamily: FONT }
  }).render().asPng();
}
