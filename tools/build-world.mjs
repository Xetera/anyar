import fs from "node:fs";
import path from "node:path";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import { buildLandMask, morph, fillHoles, distanceInside } from "../src/mapProcessing.js";
import { COAST_ORDER, NATION_SOURCE, PROVINCE_SOURCES, CITIES, SEAS, LAKES, LAND_FILLS, OCEAN_ISLANDS, ISLANDS, WORLD_PLACES } from "./world-sources.mjs";
import { traceArcs, smoothArcs, assembleRings, toPolygons } from "./trace.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "assets/world");
const SCALE = 4;
const TIERS = [1, 8];
const WORLD_FILE = "assets/Anyar-linear-Trevor-Doolin-scaled.jpg";

const rel = (p) => path.join(ROOT, p);
const layers = JSON.parse(fs.readFileSync(rel("src/layers.json"), "utf8"));
const layerById = Object.fromEntries(layers.map((l) => [l.id, l]));

function loadJpeg(file) {
  const raw = jpeg.decode(fs.readFileSync(rel(file)), { useTArray: true, maxMemoryUsageInMB: 2048 });
  return { w: raw.width, h: raw.height, px: raw.data };
}

function loadMask(file) {
  const png = PNG.sync.read(fs.readFileSync(rel(file)));
  const v = new Uint8Array(png.width * png.height);
  for (let i = 0; i < v.length; i++) v[i] = png.data[i * 4];
  return { w: png.width, h: png.height, v };
}

function toWorld(layer, x, y) {
  if (!layer) return [x, y];
  const nx = (x / layer.width) * 2 - 1, ny = (y / layer.height) * 2 - 1;
  const b = [1, nx, ny, nx * nx, nx * ny, ny * ny];
  let X = 0, Y = 0;
  for (let k = 0; k < 6; k++) {
    X += layer.x[k] * b[k];
    Y += layer.y[k] * b[k];
  }
  return [X, Y];
}

function rasterize(layer, W, H, cb) {
  const G = 96;
  const { width: w, height: h } = layer;
  const verts = [];
  for (let j = 0; j <= G; j++) {
    for (let i = 0; i <= G; i++) {
      const sx = (i / G) * w, sy = (j / G) * h;
      const [X, Y] = toWorld(layer, sx, sy);
      verts.push([sx, sy, X * SCALE, Y * SCALE]);
    }
  }
  const at = (i, j) => verts[j * (G + 1) + i];
  const tri = (a, b, c) => {
    const minX = Math.max(0, Math.floor(Math.min(a[2], b[2], c[2])));
    const maxX = Math.min(W - 1, Math.ceil(Math.max(a[2], b[2], c[2])));
    const minY = Math.max(0, Math.floor(Math.min(a[3], b[3], c[3])));
    const maxY = Math.min(H - 1, Math.ceil(Math.max(a[3], b[3], c[3])));
    const den = (b[3] - c[3]) * (a[2] - c[2]) + (c[2] - b[2]) * (a[3] - c[3]);
    if (Math.abs(den) < 1e-9) return;
    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const x = px + 0.5, y = py + 0.5;
        const l0 = ((b[3] - c[3]) * (x - c[2]) + (c[2] - b[2]) * (y - c[3])) / den;
        const l1 = ((c[3] - a[3]) * (x - c[2]) + (a[2] - c[2]) * (y - c[3])) / den;
        const l2 = 1 - l0 - l1;
        if (l0 < -1e-6 || l1 < -1e-6 || l2 < -1e-6) continue;
        cb(py * W + px, l0 * a[0] + l1 * b[0] + l2 * c[0], l0 * a[1] + l1 * b[1] + l2 * c[1]);
      }
    }
  };
  for (let j = 0; j < G; j++) {
    for (let i = 0; i < G; i++) {
      tri(at(i, j), at(i + 1, j), at(i + 1, j + 1));
      tri(at(i, j), at(i + 1, j + 1), at(i, j + 1));
    }
  }
}

function segment(src, land, regions, { wallLum, wallDilate, wallIgnore = [], wallLines = [], fillLimit = 14, fillAll = false, searchRadius = 40 }) {
  const { w, h, px } = src;
  let wall = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const x = i % w, y = (i / w) | 0;
    if (wallIgnore.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1)) continue;
    wall[i] = 0.3 * px[i * 4] + 0.59 * px[i * 4 + 1] + 0.11 * px[i * 4 + 2] < wallLum ? 1 : 0;
  }
  for (const line of wallLines) {
    for (let k = 1; k < line.length; k++) {
      const [x0, y0] = line[k - 1], [x1, y1] = line[k];
      const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
      for (let s = 0; s <= steps; s++) {
        const cx = Math.round(x0 + ((x1 - x0) * s) / steps), cy = Math.round(y0 + ((y1 - y0) * s) / steps);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const x = cx + dx, y = cy + dy;
          if (x >= 0 && y >= 0 && x < w && y < h) wall[y * w + x] = 1;
        }
      }
    }
  }
  if (wallDilate) wall = morph(wall, w, h, wallDilate, true);
  const open = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) open[i] = land[i] && !wall[i] ? 1 : 0;
  const clearance = distanceInside(open, w, h, 1);

  const ids = new Uint16Array(w * h);
  const queue = new Int32Array(w * h);
  let qh = 0, qt = 0;
  const seedReport = [];
  regions.forEach((region, idx) => {
    for (const [sx, sy, seedRadius] of region.seeds) {
      const radius = seedRadius ?? region.searchRadius ?? searchRadius;
      let best = -1, bestC = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy > radius * radius) continue;
          const x = sx + dx, y = sy + dy;
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const i = y * w + x;
          if (!ids[i] && clearance[i] > bestC) { bestC = clearance[i]; best = i; }
        }
      }
      seedReport.push({ region: region.name ?? region.key, seed: [sx, sy], found: best >= 0, clearance: +bestC.toFixed(1) });
      if (best < 0) continue;
      ids[best] = idx + 1;
      queue[qt++] = best;
    }
  });
  const neighbours = (i) => {
    const x = i % w, y = (i / w) | 0;
    return [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
  };
  while (qh < qt) {
    const i = queue[qh++];
    for (const j of neighbours(i)) {
      if (j < 0 || ids[j] || !open[j]) continue;
      ids[j] = ids[i];
      queue[qt++] = j;
    }
  }
  const dist = new Uint8Array(w * h);
  qh = 0; qt = 0;
  for (let i = 0; i < w * h; i++) if (ids[i]) queue[qt++] = i;
  while (qh < qt) {
    const i = queue[qh++];
    if (dist[i] >= fillLimit) continue;
    for (const j of neighbours(i)) {
      if (j < 0 || ids[j] || !land[j]) continue;
      ids[j] = ids[i];
      dist[j] = dist[i] + 1;
      queue[qt++] = j;
    }
  }
  if (fillAll) {
    const coloured = (i) => {
      const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
      const lum = 0.3 * r + 0.59 * g + 0.11 * b;
      return lum > 60 && lum < 215 && Math.hypot(r - g - 9.5, g - b - 10) > 15;
    };
    const pocket = new Uint8Array(w * h);
    const seen = new Uint8Array(w * h);
    for (let s = 0; s < w * h; s++) {
      if (seen[s] || ids[s] || !land[s]) continue;
      const comp = [s];
      seen[s] = 1;
      let tinted = 0;
      for (let k = 0; k < comp.length; k++) {
        const i = comp[k];
        if (coloured(i)) tinted++;
        for (const j of neighbours(i)) {
          if (j < 0 || seen[j] || ids[j] || !land[j]) continue;
          seen[j] = 1;
          comp.push(j);
        }
      }
      if (comp.length >= 40 && tinted / comp.length >= 0.4) for (const i of comp) pocket[i] = 1;
    }
    const reach = ids.slice();
    qh = 0; qt = 0;
    for (let i = 0; i < w * h; i++) if (reach[i]) queue[qt++] = i;
    while (qh < qt) {
      const i = queue[qh++];
      for (const j of neighbours(i)) {
        if (j < 0 || reach[j]) continue;
        reach[j] = reach[i];
        queue[qt++] = j;
      }
    }
    for (let i = 0; i < w * h; i++) if (pocket[i]) ids[i] = reach[i];
  }
  return { ids, seedReport };
}

function bfsFill(values, allowed, W, H, limit = Infinity) {
  const queue = new Int32Array(W * H);
  const dist = limit === Infinity ? null : new Uint16Array(W * H);
  let qh = 0, qt = 0;
  for (let i = 0; i < W * H; i++) if (values[i]) queue[qt++] = i;
  while (qh < qt) {
    const i = queue[qh++];
    if (dist && dist[i] >= limit) continue;
    const x = i % W, y = (i / W) | 0;
    const nb = [x > 0 ? i - 1 : i + W - 1, x < W - 1 ? i + 1 : i - W + 1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
    for (const j of nb) {
      if (j < 0 || values[j] || !allowed(j, values[i])) continue;
      values[j] = values[i];
      if (dist) dist[j] = dist[i] + 1;
      queue[qt++] = j;
    }
  }
}

function despeckle(values, W, H, minSize) {
  const seen = new Uint8Array(W * H);
  const stack = [];
  const nb = (i) => {
    const x = i % W, y = (i / W) | 0;
    return [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
  };
  for (let s = 0; s < W * H; s++) {
    if (seen[s] || !values[s]) continue;
    const v = values[s];
    const comp = [];
    stack.push(s);
    seen[s] = 1;
    while (stack.length) {
      const i = stack.pop();
      comp.push(i);
      for (const j of nb(i)) {
        if (j >= 0 && !seen[j] && values[j] === v) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    if (comp.length >= minSize) continue;
    const votes = new Map();
    for (const i of comp) for (const j of nb(i)) if (j >= 0 && values[j] && values[j] !== v) votes.set(values[j], (votes.get(values[j]) ?? 0) + 1);
    if (!votes.size) continue;
    const best = [...votes].sort((a, b) => b[1] - a[1])[0][0];
    for (const i of comp) values[i] = best;
  }
}

function anchors(ids, land, W, H, factor = 2) {
  const w = Math.floor(W / factor), h = Math.floor(H / factor);
  const small = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * factor * W + x * factor;
    small[y * w + x] = land[i] ? ids[i] : 0;
  }
  const inner = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, v = small[i];
    if (!v) continue;
    const same = (j) => j >= 0 && j < w * h && small[j] === v;
    inner[i] = x > 0 && x < w - 1 && same(i - 1) && same(i + 1) && same(i - w) && same(i + w) ? 1 : 0;
  }
  const d = distanceInside(inner, w, h, 1);
  const best = new Map();
  for (let i = 0; i < w * h; i++) {
    const v = small[i];
    if (!v) continue;
    const cur = best.get(v) ?? { d: -1, i: 0, area: 0 };
    cur.area += factor * factor;
    if (d[i] > cur.d) { cur.d = d[i]; cur.i = i; }
    best.set(v, cur);
  }
  const out = {};
  for (const [v, { i, area, d: depth }] of best) {
    const x = ((i % w) + 0.5) * factor / SCALE, y = (Math.floor(i / w) + 0.5) * factor / SCALE;
    out[v] = [+x.toFixed(2), +y.toFixed(2), area, +(depth * factor / SCALE).toFixed(2)];
  }
  return out;
}

function writeGray(values, W, H, file) {
  const png = new PNG({ width: W, height: H, colorType: 0, inputColorType: 0, bitDepth: 8 });
  png.data = Buffer.from(values.buffer, values.byteOffset, values.byteLength);
  fs.writeFileSync(file, PNG.sync.write(png, { colorType: 0, inputColorType: 0 }));
}

function writeRegions(prov, nation, W, H, file) {
  const png = new PNG({ width: W, height: H });
  for (let i = 0; i < W * H; i++) {
    png.data[i * 4] = prov[i] >> 8;
    png.data[i * 4 + 1] = prov[i] & 255;
    png.data[i * 4 + 2] = nation[i];
    png.data[i * 4 + 3] = 255;
  }
  fs.writeFileSync(file, PNG.sync.write(png));
}

const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
fs.mkdirSync(OUT, { recursive: true });

const worldSrc = loadJpeg(WORLD_FILE);
const base = buildLandMask(worldSrc, { iceBands: [115, 560], closeRadius: 2 });
const W = worldSrc.w * SCALE, H = worldSrc.h * SCALE;
let ice = morph(base.ice, worldSrc.w, worldSrc.h, 6, true);
ice = morph(ice, worldSrc.w, worldSrc.h, 6, false);
for (let i = 0; i < ice.length; i++) {
  const y = (i / worldSrc.w) | 0;
  if (y >= 115 && y <= 560) ice[i] = 0;
}
const land = new Uint8Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const bi = ((y / SCALE) | 0) * worldSrc.w + ((x / SCALE) | 0);
  land[y * W + x] = ice[bi] ? 2 : base.mask[bi];
}

const report = { coast: [], nations: {}, provinces: [], warnings: [] };
const sourceCache = {};
const sourceOf = (id) => (sourceCache[id] ??= { src: loadJpeg(layerById[id].image), mask: loadMask(layerById[id].mask) });

for (const id of COAST_ORDER) {
  const layer = layerById[id];
  const { mask } = sourceOf(id);
  let covered = 0, agree = 0;
  rasterize(layer, W, H, (i, sx, sy) => {
    const x = sx | 0, y = sy | 0;
    if (x < 6 || y < 6 || x >= mask.w - 6 || y >= mask.h - 6) return;
    const v = mask.v[y * mask.w + x];
    if (v > 64 && v < 192) return;
    if (land[i] === 2) return;
    const isLand = v >= 192;
    covered++;
    if (isLand === land[i] > 0) agree++;
    land[i] = isLand ? 1 : 0;
  });
  const entry = { layer: id, alignCost: layer.cost, agreement: +(agree / covered).toFixed(3) };
  report.coast.push(entry);
  if (entry.agreement < 0.9) report.warnings.push(`coast: ${id} agrees with previous coastline on only ${(entry.agreement * 100).toFixed(1)}% of its area`);
  log(`coast ${id}: ${(entry.agreement * 100).toFixed(1)}% agreement`);
}

for (const lake of LAKES) {
  const layer = layerById[lake.layer];
  const { src } = sourceOf(lake.layer);
  const { w, h, px } = src;
  const water = new Uint8Array(w * h);
  const passable = (i) => {
    const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
    return 0.3 * r + 0.59 * g + 0.11 * b >= lake.wallLum && Math.max(r, g, b) - Math.min(r, g, b) <= lake.maxSat;
  };
  const queue = [];
  for (const [sx, sy] of lake.seeds) {
    const s = sy * w + sx;
    if (!passable(s)) report.warnings.push(`lake seed not passable: ${lake.name} ${sx},${sy}`);
    water[s] = 1;
    queue.push(s);
  }
  for (let k = 0; k < queue.length; k++) {
    const i = queue[k];
    const x = i % w;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
      if (j < 0 || j >= w * h || water[j] || !passable(j)) continue;
      water[j] = 1;
      queue.push(j);
    }
  }
  const filled = morph(water, w, h, lake.close ?? 2, true);
  let cells = 0;
  rasterize(layer, W, H, (i, sx, sy) => {
    if (filled[(sy | 0) * w + (sx | 0)] && land[i] !== 2) {
      land[i] = 0;
      cells++;
    }
  });
  log(`lake ${lake.name}: ${queue.length} source px, ${cells} cells`);
}

{
  const [x0, y0, x1, y1] = OCEAN_ISLANDS.clear.map((v) => v * SCALE);
  let cells = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < Math.min(x1, W); x++) {
    const i = y * W + x;
    if (land[i] === 1) {
      land[i] = 0;
      cells++;
    }
  }
  log(`ocean islands cleared: ${cells} cells`);
}

for (const fill of LAND_FILLS) {
  const queue = fill.seeds.map(([x, y]) => Math.round(y * SCALE) * W + Math.round(x * SCALE)).filter((i) => land[i] === 0);
  const seen = new Set(queue);
  for (let k = 0; k < queue.length && queue.length <= fill.maxCells; k++) {
    const i = queue[k];
    const x = i % W;
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
      if (j < 0 || j >= W * H || seen.has(j) || land[j] !== 0) continue;
      seen.add(j);
      queue.push(j);
    }
  }
  if (!queue.length || queue.length > fill.maxCells) {
    report.warnings.push(`land fill skipped: ${fill.name} (${queue.length} cells)`);
    continue;
  }
  for (const i of queue) land[i] = 1;
  log(`land fill ${fill.name}: ${queue.length} cells`);
}

const nationList = NATION_SOURCE.regions.map((r, i) => ({ id: i + 1, key: r.key, name: r.name, continent: r.continent }));
const nationByKey = Object.fromEntries(nationList.map((n) => [n.key, n]));
const nations = new Uint8Array(W * H);
{
  const layer = layerById[NATION_SOURCE.layer];
  const { src, mask } = sourceOf(NATION_SOURCE.layer);
  const landMask = mask.v.map((v) => (v >= 192 ? 1 : 0));
  const { ids, seedReport } = segment(src, landMask, NATION_SOURCE.regions, NATION_SOURCE);
  for (const s of seedReport) if (!s.found) report.warnings.push(`nation seed not found: ${s.region}`);
  rasterize(layer, W, H, (i, sx, sy) => {
    if (!land[i]) return;
    const v = ids[(sy | 0) * src.w + (sx | 0)];
    if (!v) return;
    nations[i] = v;
    land[i] = 1;
  });
  bfsFill(nations, (j) => land[j] === 1, W, H);
  despeckle(nations, W, H, 400);
  log("nations segmented");
}

const provinceList = [];
const provinceSources = PROVINCE_SOURCES.map((source) => {
  const { src, mask } = sourceOf(source.layer);
  const landMask = mask.v.map((v) => (v >= 192 ? 1 : 0));
  const { ids, seedReport } = segment(src, landMask, source.regions, source);
  const nation = nationByKey[source.nation];
  const globalIds = source.regions.map((r) => {
    const id = provinceList.length + 1;
    const ties = r.ties?.map((line) => line.map(([x, y]) => toWorld(layerById[source.layer], x, y).map((v) => +v.toFixed(2))));
    provinceList.push({ id, name: r.name, formerNames: r.formerNames, nation: nation.id, since: source.since, source: source.layer, ...(ties && { ties }) });
    return id;
  });
  for (const s of seedReport) if (!s.found) report.warnings.push(`province seed not found: ${s.region} (${source.layer})`);
  log(`provinces segmented: ${source.layer}`);
  return { ...source, ids, globalIds, nationId: nation.id, src };
});
const completeSources = provinceSources.filter((s) => s.complete);
const completeNations = new Set(completeSources.map((s) => s.nationId));
const completeProvinces = new Set(completeSources.flatMap((s) => s.globalIds));

const tiers = [];
let lastProv = null, lastNat = null;
for (const tier of TIERS) {
  const prov = new Uint16Array(W * H);
  lastProv = prov;
  const nat = nations.slice();
  lastNat = nat;
  const direct = new Map();
  for (const ps of provinceSources) {
    if (ps.since > tier) continue;
    const layer = layerById[ps.layer];
    let total = 0, inNation = 0;
    rasterize(layer, W, H, (i, sx, sy) => {
      if (!land[i]) return;
      const local = ps.ids[(sy | 0) * ps.src.w + (sx | 0)];
      if (!local) return;
      total++;
      if (nations[i] === ps.nationId) inNation++;
      const gid = ps.globalIds[local - 1];
      prov[i] = gid;
      nat[i] = ps.nationId;
      direct.set(gid, (direct.get(gid) ?? 0) + 1);
    });
    const agreement = total ? inNation / total : 0;
    report.nations[`${ps.nation}@${tier}:${ps.layer}`] = { agreement: +agreement.toFixed(3) };
    if (agreement < 0.85) report.warnings.push(`tier ${tier}: ${ps.layer} provinces sit inside ${ps.nation} for only ${(agreement * 100).toFixed(1)}% of their area`);
  }
  const provNation = (gid) => provinceList[gid - 1].nation;
  bfsFill(prov, (j, gid) => land[j] === 1 && nat[j] === provNation(gid), W, H);
  const filled = new Set(provinceList.filter((p) => p.since <= tier && !completeProvinces.has(p.id)).map((p) => p.nation));
  for (const nid of filled) {
    const reach = new Uint16Array(W * H);
    for (let i = 0; i < W * H; i++) if (prov[i] && provNation(prov[i]) === nid) reach[i] = prov[i];
    bfsFill(reach, (j) => land[j] !== 1 || nat[j] === nid, W, H);
    for (let i = 0; i < W * H; i++) if (!prov[i] && land[i] === 1 && nat[i] === nid) prov[i] = reach[i];
  }

  const finalArea = new Map();
  for (let i = 0; i < W * H; i++) if (prov[i]) finalArea.set(prov[i], (finalArea.get(prov[i]) ?? 0) + 1);
  for (const p of provinceList) {
    if (p.since > tier) continue;
    const d = direct.get(p.id) ?? 0, f = finalArea.get(p.id) ?? 0;
    report.provinces.push({ tier, name: p.name, source: p.source, directArea: d, finalArea: f, directShare: f ? +(d / f).toFixed(2) : 0 });
    if (!f) report.warnings.push(`tier ${tier}: province ${p.name} has no area`);
    else if (d / f < 0.5) report.warnings.push(`tier ${tier}: province ${p.name} got ${((1 - d / f) * 100).toFixed(0)}% of its area from gap filling`);
  }

  const file = `assets/world/regions-t${tier}.png`;
  writeRegions(prov, nat, W, H, rel(file));
  tiers.push({
    since: tier,
    regions: file,
    nationAnchors: anchors(nat, land, W, H),
    provinceAnchors: anchors(prov, land, W, H),
  });
  log(`tier ${tier} written`);
}

writeGray(land.map((v) => (v === 2 ? 200 : v ? 255 : 0)), W, H, rel("assets/world/land.png"));

const vectors = { nations: [], provinces: [], land: [], ice: [] };
const coastal = (k) => k === 0 || k >>> 16 === 254;
const COMPOSITE = {
  radius: (a, b) => (coastal(a) || coastal(b) ? 5 : 9),
  passes: 3,
  tol: 1.2,
  minArea: 6,
  transform: ([x, y]) => [x / SCALE, y / SCALE],
};

const keys = new Uint32Array(W * H);
for (let i = 0; i < W * H; i++) {
  const n = lastNat[i] ? lastNat[i] : land[i] === 2 ? 254 : land[i] ? 255 : 0;
  keys[i] = n * 65536 + lastProv[i];
}
{
  const arcs = smoothArcs(traceArcs(keys, W, H), COMPOSITE);
  log(`composite arcs: ${arcs.length}`);
  const polygonsOf = (owner) => toPolygons(assembleRings(arcs, owner), COMPOSITE);
  vectors.land.push(...polygonsOf((k) => k >>> 16 === 255));
  vectors.ice.push(...polygonsOf((k) => k >>> 16 === 254));
  for (const n of nationList) {
    if (completeNations.has(n.id)) continue;
    const polygons = polygonsOf((k) => k >>> 16 === n.id);
    if (polygons.length) vectors.nations.push({ id: n.id, polygons });
  }
  for (const p of provinceList) {
    if (completeProvinces.has(p.id)) continue;
    const polygons = polygonsOf((k) => (k & 65535) === p.id);
    if (polygons.length) vectors.provinces.push({ id: p.id, polygons });
  }
}
for (const ps of completeSources) {
  const layer = layerById[ps.layer];
  const opts = { radius: 3, passes: 2, tol: 1.5, minArea: 16, transform: ([x, y]) => toWorld(layer, x, y) };
  const arcs = smoothArcs(traceArcs(ps.ids, ps.src.w, ps.src.h), opts);
  vectors.nations.push({ id: ps.nationId, polygons: toPolygons(assembleRings(arcs, (k) => k > 0), opts) });
  ps.globalIds.forEach((gid, idx) => {
    vectors.provinces.push({ id: gid, polygons: toPolygons(assembleRings(arcs, (k) => k === idx + 1), opts) });
  });
}
for (const source of OCEAN_ISLANDS.sources) {
  const { w, h, px } = loadJpeg(source.file);
  const K = source.upsample;
  for (const [bx0, by0, bx1, by1] of source.boxes) {
    const mw = (bx1 - bx0) * K, mh = (by1 - by0) * K;
    const sample = (x, y, c) => px[(Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4 + c];
    let mask = new Uint8Array(mw * mh);
    for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) {
      const fx = bx0 + (i + 0.5) / K - 0.5, fy = by0 + (j + 0.5) / K - 0.5;
      const x = Math.floor(fx), y = Math.floor(fy), tx = fx - x, ty = fy - y;
      const rgb = [0, 1, 2].map((c) =>
        sample(x, y, c) * (1 - tx) * (1 - ty) + sample(x + 1, y, c) * tx * (1 - ty) + sample(x, y + 1, c) * (1 - tx) * ty + sample(x + 1, y + 1, c) * tx * ty);
      const sx = bx0 + i / K, sy = by0 + j / K;
      const forced = source.forceLand?.some(([fx0, fy0, fx1, fy1]) => sx >= fx0 && sx <= fx1 && sy >= fy0 && sy <= fy1);
      mask[j * mw + i] = forced || source.isLand(...rgb) ? 1 : 0;
    }
    if (source.close) mask = morph(morph(mask, mw, mh, source.close, true), mw, mh, source.close, false);
    if (source.fillHoles) mask = fillHoles(mask, mw, mh);
    const opts = { ...source.smooth, transform: ([x, y]) => source.toWorld([bx0 + x / K, by0 + y / K]) };
    const polygons = toPolygons(assembleRings(smoothArcs(traceArcs(mask, mw, mh), opts), (k) => k > 0), opts);
    vectors.land.push(...polygons);
    log(`ocean islands ${path.basename(source.file)} [${bx0},${by0}]: ${polygons.length} polygons`);
  }
}
fs.writeFileSync(rel("src/vectors.json"), JSON.stringify(vectors) + "\n");
log(`vectors: ${vectors.nations.length} nations, ${vectors.provinces.length} provinces, ${vectors.land.length} land, ${vectors.ice.length} ice`);

const place = (p) => {
  const [x, y] = WORLD_PLACES.includes(p) ? [p.x, p.y] : toWorld(layerById[p.layer], p.x, p.y);
  return { name: p.name, kind: p.kind, since: p.since, layer: p.layer, x: +x.toFixed(2), y: +y.toFixed(2) };
};

const cities = [...CITIES];
for (const p of WORLD_PLACES) cities.splice(cities.findLastIndex((c) => c.layer === p.layer) + 1, 0, p);

const world = {
  size: [W, H],
  world: [worldSrc.w, worldSrc.h],
  land: "assets/world/land.png",
  tiers,
  nations: nationList,
  provinces: provinceList,
  places: [...cities, ...SEAS, ...ISLANDS].map(place),
};
fs.writeFileSync(rel("src/world.json"), JSON.stringify(world) + "\n");
fs.writeFileSync(rel("src/world-report.json"), JSON.stringify(report, null, 2) + "\n");
log(`done: ${report.warnings.length} warnings`);
for (const w of report.warnings) console.log("  -", w);
