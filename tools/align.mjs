import fs from "node:fs";
import path from "node:path";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import { buildLandMask, morph, fillHoles, distanceInside } from "../src/mapProcessing.js";
import { CITIES } from "../src/data.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT_DIR = path.join(ROOT, "assets/layers");
const DEBUG_DIR = process.env.ALIGN_DEBUG;

const WORLD = "assets/Anyar-linear-Trevor-Doolin-scaled.jpg";

const LAYERS = [
  {
    id: "landmasses",
    file: "assets/Anyar-land-masses-scaled.jpg",
    since: 1,
    style: "blue",
    exclude: [
      [0, 0, 1600, 8], [0, 0, 340, 125], [300, 225, 480, 275], [820, 770, 1180, 845], [340, 1180, 520, 1250],
      [1200, 1170, 1380, 1235], [0, 830, 168, 885], [1455, 300, 1600, 350], [0, 535, 170, 572],
    ],
    hint: [32, 52, 763, 588],
    model: "quadratic",
  },
  {
    id: "melosia",
    file: "assets/Melosia-scaled.jpg",
    since: 8,
    style: "blue",
    exclude: [[25, 35, 345, 125], [725, 955, 995, 1022]],
    forceLand: [[990, 552, 1455, 602]],
    hint: [173, 70, 726, 394],
    model: "quadratic",
  },
  {
    id: "narthon",
    file: "assets/Narthon-scaled.jpg",
    since: 1,
    style: "blue",
    exclude: [[0, 85, 115, 170], [0, 210, 150, 270]],
    forceLand: [[0, 1200, 270, 1350]],
    hint: [227, 135, 542, 397],
    model: "quadratic",
  },
  {
    id: "iraquinik",
    file: "assets/Iraquinik-Doolin-scaled.jpg",
    since: 1,
    style: "parchment",
    exclude: [],
    clipColor: [106, 74, 51, 32],
    hint: [181, 164, 313, 394],
    model: "quadratic",
  },
  {
    id: "landolin",
    file: "assets/Landolin-scaled.jpg",
    since: 9,
    style: "blue",
    exclude: [
      [60, 125, 300, 200], [1000, 480, 1240, 545], [1195, 850, 1445, 912],
      [40, 1240, 150, 1490], [440, 1938, 700, 2012], [1385, 1070, 1530, 1295], [1335, 1322, 1560, 1382],
    ],
    hint: [97, 303, 213, 441],
    model: "quadratic",
  },
  {
    id: "caedellium",
    file: "assets/Caedellium-provinces-Trevor-Doolin-scaled.jpg",
    since: 1,
    style: "parchment",
    exclude: [[0, 600, 470, 1200]],
    landDisks: CITIES.filter((c) => c.kind !== "town").map((c) => [...c.pixel, 11]),
    seaRects: [[1188, 255, 1280, 326]],
    hint: [42, 256, 77, 282],
    model: "similarity",
    rotate: false,
  },
];

function load(file) {
  const raw = jpeg.decode(fs.readFileSync(path.join(ROOT, file)), { useTArray: true, maxMemoryUsageInMB: 2048 });
  return { w: raw.width, h: raw.height, px: raw.data };
}

function oceanColor({ w, h, px }) {
  const rs = [], gs = [], bs = [];
  for (let i = 0; i < w * h; i += 7) {
    const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
    if (b > r + 25) { rs.push(r); gs.push(g); bs.push(b); }
  }
  const med = (a) => a.sort((x, y) => x - y)[a.length >> 1];
  return [med(rs), med(gs), med(bs)];
}

const inRects = (x, y, rects) => rects.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);

function dropInkComponents(mask, ink, w, h, maxInkRatio = 0.5) {
  const seen = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || seen[start]) continue;
    let head = 0, tail = 0, inked = 0;
    seen[start] = 1;
    queue[tail++] = start;
    while (head < tail) {
      const i = queue[head++];
      inked += ink[i];
      const x = i % w, y = (i / w) | 0;
      const nbrs = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
      for (const j of nbrs) {
        if (j < 0 || seen[j] || !mask[j]) continue;
        seen[j] = 1;
        queue[tail++] = j;
      }
    }
    if (inked / tail > maxInkRatio) for (let k = 0; k < tail; k++) mask[queue[k]] = 0;
  }
  return mask;
}

function blueMask(src, { exclude = [], forceLand = [], tolerance = 55 }, openRadius = 2) {
  const { w, h, px } = src;
  const [or, og, ob] = oceanColor(src);
  const oceanLum = 0.3 * or + 0.59 * og + 0.11 * ob;
  let m = new Uint8Array(w * h);
  const ink = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
      const lum = 0.3 * r + 0.59 * g + 0.11 * b;
      ink[i] = lum < oceanLum * 0.6 ? 1 : 0;
      let land = Math.hypot(r - or, g - og, b - ob) >= tolerance;
      if (inRects(x, y, exclude)) land = false;
      if (inRects(x, y, forceLand)) land = true;
      m[i] = land ? 1 : 0;
    }
  }
  m = morph(m, w, h, openRadius, false);
  m = morph(m, w, h, openRadius, true);
  m = dropInkComponents(m, ink, w, h);
  return fillHoles(m, w, h);
}

function layerMask(src, layer) {
  if (layer.style === "blue") return blueMask(src, layer);
  const mask = buildLandMask(src, { exclude: layer.exclude, closeRadius: 3 }).mask;
  for (const [cx, cy, r] of layer.landDisks ?? []) {
    for (let y = Math.max(0, cy - r); y <= Math.min(src.h - 1, cy + r); y++) {
      for (let x = Math.max(0, cx - r); x <= Math.min(src.w - 1, cx + r); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) mask[y * src.w + x] = 1;
      }
    }
  }
  for (const [x0, y0, x1, y1] of layer.seaRects ?? []) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * src.w + x;
        const r = src.px[i * 4], g = src.px[i * 4 + 1], b = src.px[i * 4 + 2];
        if (Math.hypot(r - g - 9.5, g - b - 10) <= 15) mask[i] = 0;
      }
    }
  }
  return mask;
}

function signedDistance(mask, w, h) {
  const dl = distanceInside(mask, w, h, 1);
  const dc = distanceInside(mask, w, h, 0);
  const sdf = new Float32Array(w * h);
  for (let i = 0; i < sdf.length; i++) sdf[i] = mask[i] ? dl[i] : -dc[i];
  return sdf;
}

const basis = (nx, ny) => [1, nx, ny, nx * nx, nx * ny, ny * ny];

function apply(params, nx, ny) {
  const b = basis(nx, ny);
  let X = 0, Y = 0;
  for (let k = 0; k < 6; k++) {
    X += params[k] * b[k];
    Y += params[6 + k] * b[k];
  }
  return [X, Y];
}

function makeSamples(mask, w, h, count) {
  const out = [];
  const step = Math.max(1, Math.sqrt((w * h) / count));
  for (let y = step / 2; y < h; y += step) {
    for (let x = step / 2; x < w; x += step) {
      const i = (y | 0) * w + (x | 0);
      out.push([(x / w) * 2 - 1, (y / h) * 2 - 1, mask[i]]);
    }
  }
  const edges = [];
  for (let y = 1; y < h - 1; y += 2) {
    for (let x = 1; x < w - 1; x += 2) {
      const i = y * w + x;
      if (mask[i] !== mask[i + 1] || mask[i] !== mask[i + w]) {
        edges.push([(x / w) * 2 - 1, (y / h) * 2 - 1, mask[i]]);
      }
    }
  }
  const stride = Math.max(1, Math.floor(edges.length / count));
  for (let k = 0; k < edges.length; k += stride) out.push(edges[k]);
  return out;
}

function makeCost(world, samples, cap = 15) {
  const { w, h, sdf } = world;
  return (params) => {
    let total = 0;
    for (const [nx, ny, land] of samples) {
      const [X, Y] = apply(params, nx, ny);
      if (X < 0 || Y < 0 || X >= w - 1 || Y >= h - 1) {
        total += cap * 0.5;
        continue;
      }
      const x0 = X | 0, y0 = Y | 0, tx = X - x0, ty = Y - y0;
      const i = y0 * w + x0;
      const d = (sdf[i] * (1 - tx) + sdf[i + 1] * tx) * (1 - ty) + (sdf[i + w] * (1 - tx) + sdf[i + w + 1] * tx) * ty;
      const wrong = land ? -d : d;
      total += Math.min(cap, Math.max(0, wrong + 0.5));
    }
    return total / samples.length;
  };
}

function nelderMead(f, x0, steps, iterations) {
  const n = x0.length;
  let simplex = [x0.slice()];
  for (let i = 0; i < n; i++) {
    const p = x0.slice();
    p[i] += steps[i];
    simplex.push(p);
  }
  let values = simplex.map(f);
  for (let it = 0; it < iterations; it++) {
    const order = values.map((v, i) => i).sort((a, b) => values[a] - values[b]);
    simplex = order.map((i) => simplex[i]);
    values = order.map((i) => values[i]);
    const centroid = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) centroid[j] += simplex[i][j] / n;
    const worst = simplex[n];
    const at = (t) => centroid.map((c, j) => c + t * (worst[j] - c));
    const xr = at(-1), fr = f(xr);
    if (fr < values[0]) {
      const xe = at(-2), fe = f(xe);
      if (fe < fr) { simplex[n] = xe; values[n] = fe; } else { simplex[n] = xr; values[n] = fr; }
    } else if (fr < values[n - 1]) {
      simplex[n] = xr; values[n] = fr;
    } else {
      const xc = at(0.5), fc = f(xc);
      if (fc < values[n]) {
        simplex[n] = xc; values[n] = fc;
      } else {
        for (let i = 1; i <= n; i++) {
          simplex[i] = simplex[i].map((v, j) => simplex[0][j] + 0.5 * (v - simplex[0][j]));
          values[i] = f(simplex[i]);
        }
      }
    }
  }
  const best = values.indexOf(Math.min(...values));
  return { x: simplex[best], value: values[best] };
}

function fromBox(cx, cy, sx, sy) {
  return [cx, sx, 0, 0, 0, 0, cy, 0, sy, 0, 0, 0];
}

function align(world, layer, src, mask) {
  const [x0, y0, x1, y1] = layer.hint;
  const coarse = makeCost(world, makeSamples(mask, src.w, src.h, 1200));
  const fine = makeCost(world, makeSamples(mask, src.w, src.h, 5000));
  const cx0 = (x0 + x1) / 2, cy0 = (y0 + y1) / 2;
  const sx0 = (x1 - x0) / 2, sy0 = (y1 - y0) / 2;
  const span = Math.max(8, Math.max(sx0, sy0) * 0.3);

  let best = { value: Infinity };
  const scan = (cxC, cyC, sxC, syC, tStep, tRange, sStep, sRange) => {
    let local = { value: Infinity };
    for (let sx = sxC * (1 - sRange); sx <= sxC * (1 + sRange) + 1e-9; sx += sxC * sStep) {
      for (let sy = syC * (1 - sRange); sy <= syC * (1 + sRange) + 1e-9; sy += syC * sStep) {
        for (let dx = -tRange; dx <= tRange + 1e-9; dx += tStep) {
          for (let dy = -tRange; dy <= tRange + 1e-9; dy += tStep) {
            const p = fromBox(cxC + dx, cyC + dy, sx, sy);
            const v = coarse(p);
            if (v < local.value) local = { value: v, p, box: [cxC + dx, cyC + dy, sx, sy] };
          }
        }
      }
    }
    return local;
  };
  if (layer.model === "similarity") {
    const hw = src.w / 2, hh = src.h / 2;
    const toParams = ([cx, cy, k, t]) => [cx, k * hw * Math.cos(t), -k * hh * Math.sin(t), 0, 0, 0, cy, k * hw * Math.sin(t), k * hh * Math.cos(t), 0, 0, 0];
    const k0 = (x1 - x0 + y1 - y0) / (src.w + src.h);
    let start = { value: Infinity };
    for (let k = k0 * 0.6; k <= k0 * 1.4; k += k0 * 0.02) {
      for (let dx = -span; dx <= span + 1e-9; dx += span / 10) {
        for (let dy = -span; dy <= span + 1e-9; dy += span / 10) {
          const v = [cx0 + dx, cy0 + dy, k, 0];
          const c = coarse(toParams(v));
          if (c < start.value) start = { value: c, v };
        }
      }
    }
    let fit = start.v;
    const free = layer.rotate === false ? 3 : 4;
    const full = (v) => [...v, 0, 0, 0, 0].slice(0, 4);
    for (let round = 0; round < 3; round++) fit = full(nelderMead((v) => fine(toParams(full(v))), fit.slice(0, free), [span / 20, span / 20, k0 * 0.02, 0.02].slice(0, free), 1500).x);
    const params = toParams(fit);
    return { params, cost: fine(params), coarseCost: start.value };
  }

  best = scan(cx0, cy0, sx0, sy0, span / 10, span, 0.04, 0.24);
  best = scan(...best.box, span / 40, span / 8, 0.01, 0.05);

  const affineIdx = [0, 1, 2, 6, 7, 8];
  const pack = (full) => affineIdx.map((k) => full[k]);
  const unpack = (v, base) => {
    const full = base.slice();
    affineIdx.forEach((k, j) => (full[k] = v[j]));
    return full;
  };
  const tStep = Math.max(0.5, sx0 * 0.01);
  let result = nelderMead(
    (v) => fine(unpack(v, best.p)),
    pack(best.p),
    [tStep, sx0 * 0.02, sx0 * 0.02, tStep, sy0 * 0.02, sy0 * 0.02],
    1500,
  );
  let params = unpack(result.x, best.p);

  if (layer.model === "quadratic") {
    const steps = params.map((v, k) => ([0, 6].includes(k) ? tStep : [1, 2, 7, 8].includes(k) ? sx0 * 0.02 : sx0 * 0.01));
    for (let round = 0; round < 3; round++) {
      result = nelderMead(fine, params, steps, 4000);
      params = result.x;
    }
  }
  return { params, cost: fine(params), coarseCost: best.value };
}

function clipRegion({ w, h, px }, [cr, cg, cb, tolerance]) {
  let clip = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    clip[i] = Math.hypot(px[i * 4] - cr, px[i * 4 + 1] - cg, px[i * 4 + 2] - cb) < tolerance ? 1 : 0;
  }
  clip = morph(clip, w, h, 2, false);
  clip = morph(clip, w, h, 10, true);
  return morph(clip, w, h, 8, false);
}

function writeMaskPng(mask, clip, w, h, file) {
  const png = new PNG({ width: w, height: h, colorType: 0, inputColorType: 0, bitDepth: 8 });
  const gray = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) gray[i] = clip?.[i] ? 128 : mask[i] ? 255 : 0;
  png.data = gray;
  fs.writeFileSync(file, PNG.sync.write(png, { colorType: 0, inputColorType: 0 }));
}

function writeDebug(world, layer, src, mask, params) {
  const { w, h } = world;
  const scale = 3;
  const W = w * scale, H = h * scale;
  const png = new PNG({ width: W, height: H });
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = ((y / scale) | 0) * w + ((x / scale) | 0);
      const o = (y * W + x) * 4;
      const v = world.mask[i] ? 150 : 30;
      png.data[o] = v; png.data[o + 1] = v; png.data[o + 2] = v + 20; png.data[o + 3] = 255;
    }
  }
  for (let y = 0; y < src.h; y += 1) {
    for (let x = 0; x < src.w; x += 1) {
      const [X, Y] = apply(params, (x / src.w) * 2 - 1, (y / src.h) * 2 - 1);
      const px = Math.round(X * scale), py = Math.round(Y * scale);
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      const o = (py * W + px) * 4;
      const i = y * src.w + x;
      const edge = x > 0 && y > 0 && (mask[i] !== mask[i - 1] || mask[i] !== mask[i - src.w]);
      if (edge) { png.data[o] = 255; png.data[o + 1] = 40; png.data[o + 2] = 40; }
      else if (mask[i]) png.data[o + 1] = Math.min(255, png.data[o + 1] + 6);
    }
  }
  fs.writeFileSync(path.join(DEBUG_DIR, `${layer.id}.png`), PNG.sync.write(png));
}

const only = process.argv.slice(2);
const worldSrc = load(WORLD);
const worldMask = buildLandMask(worldSrc, { closeRadius: 2 }).mask;
const world = { w: worldSrc.w, h: worldSrc.h, mask: worldMask, sdf: signedDistance(worldMask, worldSrc.w, worldSrc.h) };

fs.mkdirSync(OUT_DIR, { recursive: true });
const outFile = path.join(ROOT, "src/layers.json");
const existing = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, "utf8")) : [];
const results = [];

for (const layer of LAYERS) {
  if (only.length && !only.includes(layer.id)) {
    const prev = existing.find((e) => e.id === layer.id);
    if (prev) results.push(prev);
    continue;
  }
  const t = Date.now();
  const src = load(layer.file);
  const mask = layerMask(src, layer);
  const { params, cost, coarseCost } = align(world, layer, src, mask);
  const maskFile = `assets/layers/${layer.id}-mask.png`;
  const clip = layer.clipColor ? clipRegion(src, layer.clipColor) : null;
  writeMaskPng(mask, clip, src.w, src.h, path.join(ROOT, maskFile));
  if (DEBUG_DIR) writeDebug(world, layer, src, mask, params);
  console.log(`${layer.id}: cost ${cost.toFixed(3)} (coarse ${coarseCost.toFixed(3)}) in ${Date.now() - t}ms`);
  results.push({
    id: layer.id,
    since: layer.since,
    image: layer.file,
    mask: maskFile,
    width: src.w,
    height: src.h,
    world: [world.w, world.h],
    x: params.slice(0, 6).map((v) => +v.toFixed(5)),
    y: params.slice(6).map((v) => +v.toFixed(5)),
    cost: +cost.toFixed(4),
  });
}

results.sort((a, b) => LAYERS.findIndex((l) => l.id === a.id) - LAYERS.findIndex((l) => l.id === b.id));
fs.writeFileSync(outFile, JSON.stringify(results, null, 2) + "\n");
