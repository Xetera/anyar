export async function loadImage(url) {
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}

export function readPixels(img) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  return { w, h, px: ctx.getImageData(0, 0, w, h).data };
}

export function morph(mask, w, h, r, dilate) {
  const tmp = new Uint8Array(mask.length);
  const out = new Uint8Array(mask.length);
  const pick = dilate ? 1 : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 1 - pick;
      for (let k = -r; k <= r; k++) {
        const xx = Math.min(w - 1, Math.max(0, x + k));
        if (mask[y * w + xx] === pick) { v = pick; break; }
      }
      tmp[y * w + x] = v;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 1 - pick;
      for (let k = -r; k <= r; k++) {
        const yy = Math.min(h - 1, Math.max(0, y + k));
        if (tmp[yy * w + x] === pick) { v = pick; break; }
      }
      out[y * w + x] = v;
    }
  }
  return out;
}

export function fillHoles(mask, w, h) {
  const reached = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  let head = 0, tail = 0;
  const seed = (i) => {
    if (!mask[i] && !reached[i]) { reached[i] = 1; queue[tail++] = i; }
  };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (head < tail) {
    const i = queue[head++];
    const x = i % w, y = (i / w) | 0;
    if (x > 0) seed(i - 1);
    if (x < w - 1) seed(i + 1);
    if (y > 0) seed(i - w);
    if (y < h - 1) seed(i + w);
  }
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) out[i] = reached[i] ? 0 : 1;
  return out;
}

export function distanceInside(mask, w, h, value) {
  const INF = 1e9;
  const d = new Float32Array(mask.length);
  for (let i = 0; i < mask.length; i++) d[i] = mask[i] === value ? INF : 0;
  const a = 1, b = Math.SQRT2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + a);
      if (y > 0) {
        v = Math.min(v, d[i - w] + a);
        if (x > 0) v = Math.min(v, d[i - w - 1] + b);
        if (x < w - 1) v = Math.min(v, d[i - w + 1] + b);
      }
      d[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      let v = d[i];
      if (x < w - 1) v = Math.min(v, d[i + 1] + a);
      if (y < h - 1) {
        v = Math.min(v, d[i + w] + a);
        if (x < w - 1) v = Math.min(v, d[i + w + 1] + b);
        if (x > 0) v = Math.min(v, d[i + w - 1] + b);
      }
      d[i] = v;
    }
  }
  return d;
}

function hash(x, y, seed) {
  let n = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function valueNoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x, y, octaves = 5, seed = 7) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + o);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function buildLandMask({ w, h, px }, opts = {}) {
  const {
    oceanChroma = [9.5, 10],
    chromaThreshold = 10.5,
    closeRadius = 3,
    exclude = [],
    iceBands = null,
  } = opts;
  let mask = new Uint8Array(w * h);
  const ice = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
      const max = Math.max(r, g, b);
      const cr = r - g - oceanChroma[0], cb = g - b - oceanChroma[1];
      let land = Math.hypot(cr, cb) > chromaThreshold && max > 60;
      if (iceBands && (y < iceBands[0] || y > iceBands[1]) && Math.min(r, g, b) > 205) {
        land = true;
        ice[i] = 1;
      }
      for (const [x0, y0, x1, y1] of exclude) {
        if (x >= x0 && x <= x1 && y >= y0 && y <= y1) land = false;
      }
      mask[i] = land ? 1 : 0;
    }
  }
  mask = morph(mask, w, h, 1, false);
  mask = morph(mask, w, h, 1, true);
  mask = morph(mask, w, h, closeRadius, true);
  mask = fillHoles(mask, w, h);
  mask = morph(mask, w, h, closeRadius, false);
  return { mask, ice };
}

const OCEAN_DEFAULTS = { shallow: [96, 168, 186], deep: [22, 58, 98], oceanFalloff: 40, seed: 3 };

export function shadeOcean(o, k, dist, gx, gy, opts = {}) {
  const { shallow, deep, oceanFalloff, seed } = { ...OCEAN_DEFAULTS, ...opts };
  const t = smoothstep(0, oceanFalloff, dist);
  const grain = 0.92 + 0.16 * fbm(gx * 0.05, gy * 0.05, 3, seed + 5);
  const foam = dist < 2.5 ? 0.25 : 0;
  for (let c = 0; c < 3; c++) {
    const base = shallow[c] + (deep[c] - shallow[c]) * t;
    o[k + c] = Math.min(255, base * grain + foam * (255 - base));
  }
}

export function computeHeights(mask, ice, w, h, opts = {}) {
  const { landRelief = 30, oceanFalloff = 40, noiseScale = 0.012, seed = 3, unit = 1 } = opts;
  const dLand = distanceInside(mask, w, h, 1);
  const dOcean = distanceInside(mask, w, h, 0);
  const height = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const gx = x / unit, gy = y / unit;
      if (mask[i]) {
        const inland = 1 - Math.exp(-dLand[i] / unit / landRelief);
        const n = fbm(gx * noiseScale, gy * noiseScale, 5, seed);
        const ridge = 1 - Math.abs(fbm(gx * noiseScale * 2.3, gy * noiseScale * 2.3, 4, seed + 11) * 2 - 1);
        let hgt = 0.04 + inland * (0.35 + 0.65 * n * n) + inland * inland * ridge * ridge * 0.35;
        if (ice?.[i]) hgt = 0.05 + inland * 0.3;
        height[i] = Math.min(1, hgt);
      } else {
        const t = smoothstep(0, oceanFalloff, dOcean[i] / unit);
        height[i] = -(0.05 + 0.95 * t) * (0.7 + 0.3 * fbm(gx * 0.02, gy * 0.02, 3, seed + 9));
      }
    }
  }
  return height;
}

export function processMap(img, opts = {}) {
  const src = readPixels(img);
  const { w, h, px } = src;
  const { mask, ice } = buildLandMask(src, opts);
  const height = computeHeights(mask, ice, w, h, opts);
  const dOcean = distanceInside(mask, w, h, 0);
  const out = new ImageData(w, h);
  const o = out.data;
  for (let i = 0; i < w * h; i++) {
    if (mask[i]) {
      o[i * 4] = px[i * 4];
      o[i * 4 + 1] = px[i * 4 + 1];
      o[i * 4 + 2] = px[i * 4 + 2];
    } else {
      shadeOcean(o, i * 4, dOcean[i], i % w, (i / w) | 0, opts);
    }
    o[i * 4 + 3] = 255;
  }

  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = w;
  colorCanvas.height = h;
  colorCanvas.getContext("2d").putImageData(out, 0, 0);

  return { w, h, mask, ice, height, colorCanvas, src };
}

export function heightCanvas({ w, h, height }, landOnly = true) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = landOnly ? Math.max(0, height[i]) : (height[i] + 1) / 2;
    const c = Math.round(v * 255);
    img.data[i * 4] = c;
    img.data[i * 4 + 1] = c;
    img.data[i * 4 + 2] = c;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export function roughnessCanvas({ w, h, mask }, land = 230, ocean = 70) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const c = mask[i] ? land : ocean;
    img.data[i * 4] = c;
    img.data[i * 4 + 1] = c;
    img.data[i * 4 + 2] = c;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export function segmentRegions({ w, h, px }, mask, regions, darkness = 95, searchRadius = 40) {
  const ids = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let wall = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const lum = 0.3 * px[i * 4] + 0.59 * px[i * 4 + 1] + 0.11 * px[i * 4 + 2];
    wall[i] = lum < darkness ? 1 : 0;
  }
  wall = morph(wall, w, h, 1, true);

  const open = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) open[i] = mask[i] && !wall[i] ? 1 : 0;
  const clearance = distanceInside(open, w, h, 1);

  let qh = 0, qt = 0;
  regions.forEach((region, idx) => {
    for (const [sx, sy] of region.seeds) {
      let best = -1, bestC = 0;
      for (let dy = -searchRadius; dy <= searchRadius; dy++) {
        for (let dx = -searchRadius; dx <= searchRadius; dx++) {
          if (dx * dx + dy * dy > searchRadius * searchRadius) continue;
          const x = sx + dx, y = sy + dy;
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const i = y * w + x;
          if (!ids[i] && clearance[i] > bestC) { bestC = clearance[i]; best = i; }
        }
      }
      if (best < 0) continue;
      ids[best] = idx + 1;
      queue[qt++] = best;
    }
  });
  while (qh < qt) {
    const i = queue[qh++];
    const x = i % w, y = (i / w) | 0;
    const nbrs = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
    for (const j of nbrs) {
      if (j < 0 || ids[j] || !mask[j] || wall[j]) continue;
      ids[j] = ids[i];
      queue[qt++] = j;
    }
  }

  let head = 0, tail = 0;
  for (let i = 0; i < ids.length; i++) if (ids[i]) queue[tail++] = i;
  while (head < tail) {
    const i = queue[head++];
    const x = i % w, y = (i / w) | 0;
    const nbrs = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
    for (const j of nbrs) {
      if (j < 0 || ids[j] || !mask[j]) continue;
      ids[j] = ids[i];
      queue[tail++] = j;
    }
  }
  return ids;
}
