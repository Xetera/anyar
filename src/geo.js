export const WORLD_W = 1600;
export const WORLD_H = 671;
export const UNIT = 2048 / WORLD_W;

export const toLatLng = (x, y) => L.latLng(-y * UNIT, x * UNIT);
export const fromLatLng = (ll) => [ll.lng / UNIT, -ll.lat / UNIT];
export const pxPerWorld = (zoom) => UNIT * 2 ** zoom;

export const CRS = L.extend({}, L.CRS.Simple, {
  infinite: false,
  wrapLng: [0, WORLD_W * UNIT],
  projection: L.extend({}, L.Projection.LonLat, { bounds: L.bounds([0, -WORLD_H * UNIT], [WORLD_W * UNIT, 0]) }),
});

export const worldBounds = () => L.latLngBounds(toLatLng(0, WORLD_H), toLatLng(WORLD_W, 0));

export function pointInRing([px, py], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInPolygons(p, polygons) {
  return polygons.some(([outer, ...holes]) => pointInRing(p, outer) && !holes.some((h) => pointInRing(p, h)));
}

export function wrapX(x) {
  const w = WORLD_W;
  return ((x % w) + w) % w;
}
