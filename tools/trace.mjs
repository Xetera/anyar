export function traceArcs(values, w, h) {
  const W1 = w + 1;
  const from = [], to = [], la = [], lb = [];
  const push = (f, t, a, b) => {
    from.push(f);
    to.push(t);
    la.push(a);
    lb.push(b);
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x, v = values[i], k = y * W1 + x;
      const right = x < w - 1 ? values[i + 1] : 0;
      if (right !== v) {
        if (v > right) push(k + 1, k + 1 + W1, v, right);
        else push(k + 1 + W1, k + 1, right, v);
      }
      const down = y < h - 1 ? values[i + w] : 0;
      if (down !== v) {
        if (v > down) push(k + 1 + W1, k + W1, v, down);
        else push(k + W1, k + 1 + W1, down, v);
      }
      if (x === 0 && v) push(k + W1, k, v, 0);
      if (y === 0 && v) push(k, k + 1, v, 0);
    }
  }
  const n = from.length;
  const deg = new Uint8Array(W1 * (h + 1));
  for (let e = 0; e < n; e++) {
    deg[from[e]]++;
    deg[to[e]]++;
  }
  const byStart = new Map();
  for (let e = 0; e < n; e++) {
    const arr = byStart.get(from[e]);
    if (arr) arr.push(e);
    else byStart.set(from[e], [e]);
  }
  const used = new Uint8Array(n);
  const pt = (k) => [k % W1, Math.floor(k / W1)];
  const arcs = [];
  const walk = (e0) => {
    const a = la[e0], b = lb[e0];
    const points = [pt(from[e0])];
    let cur = e0;
    for (;;) {
      used[cur] = 1;
      const t = to[cur];
      points.push(pt(t));
      if (deg[t] !== 2 || t === from[e0]) break;
      const next = byStart.get(t)?.find((c) => !used[c] && la[c] === a && lb[c] === b);
      if (next == null) break;
      cur = next;
    }
    const last = points.length - 1;
    arcs.push({
      a,
      b,
      from: from[e0],
      to: to[cur],
      closed: to[cur] === from[e0] && deg[from[e0]] === 2,
      startDir: [points[1][0] - points[0][0], points[1][1] - points[0][1]],
      endDir: [points[last][0] - points[last - 1][0], points[last][1] - points[last - 1][1]],
      points,
    });
  };
  for (let e = 0; e < n; e++) if (!used[e] && deg[from[e]] !== 2) walk(e);
  for (let e = 0; e < n; e++) if (!used[e]) walk(e);
  return arcs;
}

function smoothPoints(points, radius, passes, closed) {
  let pts = points;
  for (let p = 0; p < passes; p++) {
    const n = pts.length, out = new Array(n);
    if (closed) {
      const m = n - 1;
      const r = Math.min(radius, Math.floor(m / 8));
      for (let i = 0; i < m; i++) {
        let sx = 0, sy = 0;
        for (let j = -r; j <= r; j++) {
          const q = pts[(((i + j) % m) + m) % m];
          sx += q[0];
          sy += q[1];
        }
        out[i] = [sx / (2 * r + 1), sy / (2 * r + 1)];
      }
      out[m] = out[0];
    } else {
      out[0] = pts[0];
      out[n - 1] = pts[n - 1];
      for (let i = 1; i < n - 1; i++) {
        const r = Math.min(radius, i, n - 1 - i);
        let sx = 0, sy = 0;
        for (let j = -r; j <= r; j++) {
          sx += pts[i + j][0];
          sy += pts[i + j][1];
        }
        out[i] = [sx / (2 * r + 1), sy / (2 * r + 1)];
      }
    }
    pts = out;
  }
  return pts;
}

export function smoothArcs(arcs, { radius, passes = 2, tol = 1 }) {
  for (const arc of arcs) {
    const r = typeof radius === "function" ? radius(arc.a, arc.b) : radius;
    const pts = smoothPoints(arc.points, r, passes, arc.closed);
    if (arc.closed) {
      const ring = simplifyRing(pts.slice(0, -1), tol);
      arc.points = [...ring, ring[0]];
    } else {
      arc.points = dp(pts, tol);
    }
  }
  return arcs;
}

export function assembleRings(arcs, owner) {
  const views = [];
  for (const arc of arcs) {
    const oa = owner(arc.a), ob = owner(arc.b);
    if (oa && !ob) views.push({ from: arc.from, to: arc.to, points: arc.points, out: arc.startDir, in: arc.endDir });
    else if (ob && !oa) {
      views.push({
        from: arc.to,
        to: arc.from,
        points: arc.points.slice().reverse(),
        out: [-arc.endDir[0], -arc.endDir[1]],
        in: [-arc.startDir[0], -arc.startDir[1]],
      });
    }
  }
  const byStart = new Map();
  views.forEach((v, i) => {
    const arr = byStart.get(v.from);
    if (arr) arr.push(i);
    else byStart.set(v.from, [i]);
  });
  const used = new Uint8Array(views.length);
  const rings = [];
  for (let i = 0; i < views.length; i++) {
    if (used[i]) continue;
    const ring = [];
    let cur = i;
    for (;;) {
      used[cur] = 1;
      const v = views[cur];
      for (let k = 0; k < v.points.length - 1; k++) ring.push(v.points[k]);
      if (v.to === views[i].from) break;
      const cands = (byStart.get(v.to) ?? []).filter((c) => !used[c]);
      if (!cands.length) break;
      let next = cands[0];
      if (cands.length > 1) {
        let best = -Infinity;
        for (const c of cands) {
          const cross = v.in[0] * views[c].out[1] - v.in[1] * views[c].out[0];
          if (cross > best) {
            best = cross;
            next = c;
          }
        }
      }
      cur = next;
    }
    if (ring.length >= 3) rings.push(ring);
  }
  return rings;
}

function perpDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function dp(points, tol) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let maxD = 0, idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDist(points[i], points[s], points[e]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

export function simplifyRing(ring, tol) {
  let far = 0, farD = -1;
  for (let i = 1; i < ring.length; i++) {
    const d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]);
    if (d > farD) { farD = d; far = i; }
  }
  const a = dp(ring.slice(0, far + 1), tol);
  const b = dp([...ring.slice(far), ring[0]], tol);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

export function signedArea(ring) {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i], [x1, y1] = ring[(i + 1) % ring.length];
    s += x0 * y1 - x1 * y0;
  }
  return s / 2;
}

export function pointInRing([px, py], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function toPolygons(rings, { minArea = 4, transform = (p) => p } = {}) {
  const outers = [], holes = [];
  for (const ring of rings) {
    if (ring.length < 3) continue;
    const area = signedArea(ring);
    if (Math.abs(area) < minArea) continue;
    (area > 0 ? outers : holes).push(ring);
  }
  const polys = outers.map((outer) => ({ outer, holes: [] }));
  for (const hole of holes) {
    const p = hole[0];
    const host = polys.find((poly) => pointInRing(p, poly.outer)) ?? polys.find((poly) => pointInRing(hole[Math.floor(hole.length / 2)], poly.outer));
    if (host) host.holes.push(hole);
  }
  const round = ([x, y]) => transform([x, y]).map((v) => +v.toFixed(2));
  const clean = (ring) => {
    const out = [];
    for (const p of ring.map(round)) {
      const prev = out.at(-1);
      if (!prev || prev[0] !== p[0] || prev[1] !== p[1]) out.push(p);
    }
    while (out.length > 1 && out[0][0] === out.at(-1)[0] && out[0][1] === out.at(-1)[1]) out.pop();
    return out;
  };
  return polys.map(({ outer, holes }) => [clean(outer), ...holes.map(clean)]);
}
