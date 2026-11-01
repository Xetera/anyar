import { BOOK_OPTIONS, BOOK_TITLES, TIER_LABELS, NATIONS, OCCUPATIONS, SOURCES, MINERAL_SURVEY, bookCover } from "./data.js";
import { currentBook, hasFinished, isRevealed, onBookChange, setBook } from "./spoilers.js";
import { CRS, UNIT, WORLD_W, WORLD_H, toLatLng, fromLatLng, worldBounds, pointInPolygons, wrapX, pxPerWorld } from "./geo.js";

const $ = (s) => document.querySelector(s);
const compact = matchMedia("(max-width: 640px)");
const json = (url) => fetch(url, { cache: "no-cache" }).then((r) => r.json());
const [world, vectors, featureDoc, eventDoc, mineralDoc] = await Promise.all([
  json("src/world.json"),
  json("src/vectors.json"),
  json("src/features.json"),
  json("src/events.json"),
  json("src/minerals.json"),
]);

const PREFS_KEY = "anyar.layers";
const store = {
  get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
};

const prefs = Object.assign(
  { lines: {} },
  store.get(PREFS_KEY, {}),
);
const savePrefs = () => store.set(PREFS_KEY, prefs);
const linesOn = (kind) => prefs.lines[kind] ?? true;
const eventsOn = (book) => prefs.events?.[book] ?? true;
const eventTypeOn = (type) => prefs.eventTypes?.[type] ?? true;
const sideKey = (item) => (item.crew ? `${item.crew}:${item.side}` : item.side);
const sideOn = (item) => !item.side || (prefs.sides?.[sideKey(item)] ?? true);
const fadeOn = () => prefs.fadeEvents ?? true;
const allEventsOn = () => prefs.allEvents ?? false;
const keepIndustryOn = () => prefs.keepIndustry ?? false;
const mineralsOn = () => prefs.minerals === true;
const RECENT_BOOKS = 2;
let selectedEvent = null;
let hoveredEvent = null;
const visibleNow = (f) => isRevealed(f.since) && (f.until == null || currentBook() < f.until);

function nationBounds(ids) {
  const points = vectors.nations.filter((n) => !ids || ids.includes(n.id)).flatMap((n) => n.polygons.flatMap((polygon) => polygon[0]));
  return L.latLngBounds(points.map(([x, y]) => toLatLng(x, y)));
}

const COPIES = [-WORLD_W, 0, WORLD_W];
const fitZoom = () => {
  const { clientWidth, clientHeight } = $("#map");
  return Math.log2(Math.max(clientWidth / WORLD_W, clientHeight / WORLD_H) / UNIT);
};

const map = L.map("map", {
  crs: CRS,
  minZoom: fitZoom(),
  maxZoom: 9,
  zoomSnap: 0.5,
  zoomDelta: 0.5,
  wheelPxPerZoomLevel: 80,
  zoomControl: false,
  scrollWheelZoom: false,
  renderer: L.svg({ padding: 0.5 }),
  attributionControl: false,
  maxBounds: L.latLngBounds(toLatLng(-1e6 * WORLD_W, WORLD_H), toLatLng(1e6 * WORLD_W, 0)),
  maxBoundsViscosity: 1,
});
L.control.zoom({ position: "bottomright" }).addTo(map);
map.on("resize", () => map.setMinZoom(fitZoom()));

const WHEEL_PX_PER_ZOOM = 160;
const WHEEL_EASE = 0.25;
const SmoothWheelZoom = L.Handler.extend({
  addHooks() {
    L.DomEvent.on(this._map.getContainer(), "wheel", this._onWheel, this);
    this._map.on("dragstart", this._finish, this);
  },
  removeHooks() {
    L.DomEvent.off(this._map.getContainer(), "wheel", this._onWheel, this);
    this._map.off("dragstart", this._finish, this);
    this._finish();
  },
  _onWheel(e) {
    L.DomEvent.stop(e);
    const map = this._map;
    if (!this.zooming) {
      map._stop();
      map._moveStart(true, false);
      this.zooming = true;
      this._target = map.getZoom();
      this._frame = L.Util.requestAnimFrame(this._step, this);
    }
    const delta = L.DomEvent.getWheelDelta(e) / WHEEL_PX_PER_ZOOM;
    this._target = Math.min(Math.max(this._target + delta, map.getMinZoom()), map.getMaxZoom());
    this._anchor = map.mouseEventToContainerPoint(e);
  },
  _step() {
    const map = this._map;
    const from = map.getZoom();
    const zoom = Math.abs(this._target - from) < 0.002 ? this._target : from + (this._target - from) * WHEEL_EASE;
    const half = map.getSize().divideBy(2);
    const offset = this._anchor.subtract(half).multiplyBy(1 - 1 / map.getZoomScale(zoom, from));
    const center = map._limitCenter(map.containerPointToLatLng(half.add(offset)), zoom, map.options.maxBounds);
    map._move(center, zoom);
    if (zoom === this._target) return this._finish();
    this._frame = L.Util.requestAnimFrame(this._step, this);
  },
  _finish() {
    if (!this.zooming) return;
    L.Util.cancelAnimFrame(this._frame);
    this.zooming = false;
    this._map._moveEnd(true);
  },
});
map.addHandler("smoothWheelZoom", SmoothWheelZoom);
map.smoothWheelZoom.enable();

const wrapShift = (paneX) => {
  const span = map.getPixelWorldBounds().getSize().x;
  return Math.floor((map.getSize().x / 2 - paneX + map.getPixelOrigin().x) / span) * span;
};

let dragShift = 0;
map.on("dragstart", () => (dragShift = 0));
map.dragging._draggable.on("predrag", function () {
  const shift = wrapShift(this._newPos.x);
  this._newPos.x += shift;
  this._startPos.x += shift;
  dragShift += shift;
  this._absPos = this._newPos.subtract([dragShift, 0]);
});

{
  const m = location.hash.match(/^#(-?[\d.]+)\/(-?[\d.]+)\/(-?[\d.]+)$/);
  if (m) map.setView(toLatLng(wrapX(+m[2]), +m[3]), +m[1]);
  else if (compact.matches) map.fitBounds(nationBounds(), { paddingTopLeft: [8, 140], paddingBottomRight: [8, 70] });
  else map.fitBounds(worldBounds(), { padding: [20, 20] });
}
const renderer = L.canvas({ padding: 0.5 });
const shape = { renderer, smoothFactor: 0 };

const PALETTE = ["#d9c7a0", "#c9d5b0", "#d8bfc2", "#bccfd6", "#e1cfa8", "#c4c9a6", "#d6c2b0", "#c7cfc0", "#dccab9", "#bfd0c8", "#d9d0b4", "#c6c4e0"];
const FILL_OVERRIDES = { 14: "#e3d5a6" };
const STYLE = {
  land: { color: "#8a7a5e", weight: 1, fillColor: "#ebe4d2", fillOpacity: 1 },
  ice: { color: "#c5d2dc", weight: 0.8, fillColor: "#f3f6f8", fillOpacity: 1 },
  nation: (id) => ({ color: "#6b5a3e", weight: 1.2, fillColor: FILL_OVERRIDES[id] ?? PALETTE[id % PALETTE.length], fillOpacity: 1 }),
  province: { color: "#5a4a30", weight: 0.8, opacity: 0.75, dashArray: "3 3", fillColor: "#ffffff", fillOpacity: 0 },
  tie: { color: "#5a4a30", weight: 1.2, opacity: 0.8, dashArray: "1 4", lineCap: "round", interactive: false },
  hover: { fillColor: "#ffffff", fillOpacity: 0.35 },
};

const nationById = Object.fromEntries(world.nations.map((n) => [n.id, n]));
const nationByKey = Object.fromEntries(world.nations.map((n) => [n.key, n]));
const occupation = (nation) => OCCUPATIONS.find((o) => o.nation === nation.key && isRevealed(o.since));
const nationTip = (nation) => {
  const o = occupation(nation);
  return o ? `${nation.name} · occupied by ${nationByKey[o.by].name}` : nation.name;
};
const provinceById = Object.fromEntries(world.provinces.map((p) => [p.id, p]));
const provinceName = (p) => p.formerNames?.find((f) => currentBook() < f.until)?.name ?? p.name;
const toLatLngs = (polygons) => COPIES.flatMap((dx) => polygons.map((rings) => rings.map((ring) => ring.map(([x, y]) => toLatLng(x + dx, y)))));
const wrappedLine = (points) => COPIES.map((dx) => points.map(([x, y]) => toLatLng(x + dx, y)));
const wrappedMarkers = (x, y, make) => L.featureGroup(COPIES.map((dx) => make(toLatLng(x + dx, y))));

const SEAM = 1;
const onSeam = ([ax], [bx]) => (ax <= SEAM && bx <= SEAM) || (ax >= WORLD_W - SEAM && bx >= WORLD_W - SEAM);
function coastlines(polygon) {
  const runs = [];
  for (const ring of polygon) {
    let run = [];
    ring.forEach((p, i) => {
      const next = ring[(i + 1) % ring.length];
      if (!run.length) run.push(p);
      if (onSeam(p, next)) {
        if (run.length > 1) runs.push(run);
        run = [];
      } else run.push(next);
    });
    if (run.length > 1) runs.push(run);
  }
  return runs;
}

const landGroup = L.layerGroup().addTo(map);
for (const [polygons, style] of [
  [vectors.land, STYLE.land],
  [vectors.ice, STYLE.ice],
]) {
  for (const polygon of polygons) {
    const bled = polygon.map((ring) => ring.map(([x, y]) => [x <= SEAM ? -SEAM : x >= WORLD_W - SEAM ? WORLD_W + SEAM : x, y]));
    for (const dx of COPIES) {
      const rings = bled.map((ring) => ring.map(([x, y]) => toLatLng(x + dx, y)));
      landGroup.addLayer(L.polygon(rings, { ...style, ...shape, stroke: false, interactive: false }));
    }
    landGroup.addLayer(L.polyline(coastlines(polygon).flatMap(wrappedLine), { ...style, ...shape, fill: false, interactive: false }));
  }
}

const nationLayers = vectors.nations.map((n) => {
  const nation = nationById[n.id];
  const layer = L.polygon(toLatLngs(n.polygons), { ...STYLE.nation(n.id), ...shape, bubblingMouseEvents: false });
  layer.bindTooltip(() => nationTip(nation), { sticky: true, className: "region-tip" });
  layer.on("mouseover", () => layer.setStyle(STYLE.hover));
  layer.on("mouseout", () => layer.setStyle(nationStyle(n.id)));
  layer.on("click", () => showNation(nation));
  layer.addTo(map);
  return { layer, nation, polygons: n.polygons };
});

const provinceGroup = L.layerGroup().addTo(map);
const provinceLayers = vectors.provinces.map((p) => {
  const province = provinceById[p.id];
  const nation = nationById[province.nation];
  const layer = L.polygon(toLatLngs(p.polygons), { ...STYLE.province, ...shape, bubblingMouseEvents: false });
  layer.bindTooltip(() => `${provinceName(province)} · ${nation.name}`, { sticky: true, className: "region-tip" });
  layer.on("mouseover", () => layer.setStyle(STYLE.hover));
  layer.on("mouseout", () => layer.setStyle({ fillOpacity: 0 }));
  layer.on("click", () => showProvince(province));
  return { layer, province, polygons: p.polygons };
});

const tieLayers = world.provinces.filter((p) => p.ties).map((province) => ({
  province,
  layer: L.polyline(province.ties.flatMap(wrappedLine), STYLE.tie),
}));

function nationStyle(id) {
  const o = occupation(nationById[id]);
  return STYLE.nation(o ? nationByKey[o.by].id : id);
}

function syncRegions() {
  const z = map.getZoom();
  const scale = Math.min(2.5, Math.max(0.7, 0.9 + z * 0.2));
  for (const n of nationLayers) n.layer.setStyle({ ...nationStyle(n.nation.id), weight: 1.2 * scale });
  for (const p of provinceLayers) {
    const on = isRevealed(p.province.since);
    if (on && !provinceGroup.hasLayer(p.layer)) provinceGroup.addLayer(p.layer);
    if (!on && provinceGroup.hasLayer(p.layer)) provinceGroup.removeLayer(p.layer);
    if (on) p.layer.setStyle({ weight: 0.8 * scale });
  }
  for (const t of tieLayers) {
    const on = isRevealed(t.province.since);
    if (on && !provinceGroup.hasLayer(t.layer)) provinceGroup.addLayer(t.layer);
    if (!on && provinceGroup.hasLayer(t.layer)) provinceGroup.removeLayer(t.layer);
    if (on) t.layer.setStyle({ weight: 1.2 * scale });
  }
}

function regionAt(x, y) {
  const province = provinceLayers.find((p) => isRevealed(p.province.since) && pointInPolygons([x, y], p.polygons))?.province;
  const nation = province ? nationById[province.nation] : nationLayers.find((n) => pointInPolygons([x, y], n.polygons))?.nation;
  return nation ? { nation, province } : null;
}

const panel = $("#panel");
let panelSpec = null;

function renderPanel() {
  if (!panelSpec) return;
  const { title, subtitle, body, maps = [], since, gate = isRevealed } = typeof panelSpec === "function" ? panelSpec() : panelSpec;
  if (!gate(since)) return hidePanel();
  $("#panel-title").textContent = title;
  $("#panel-subtitle").textContent = subtitle ?? "";
  $("#panel-body").textContent = body ?? "";
  const revealed = maps.filter((m) => isRevealed(m.since));
  const locked = maps.length - revealed.length;
  const preview = revealed.filter((m) => !m.pdf).at(-1);
  const fig = $("#panel-figure");
  fig.hidden = !preview;
  if (preview) {
    $("#panel-image").src = preview.url;
    $("#panel-image-link").href = preview.url;
  }
  const list = $("#panel-maps");
  list.replaceChildren(
    ...revealed.map((m) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = m.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = m.title;
      const tag = document.createElement("span");
      tag.textContent = TIER_LABELS[m.since];
      li.append(a, tag);
      return li;
    }),
  );
  list.hidden = revealed.length === 0;
  const lockedEl = $("#panel-locked");
  lockedEl.hidden = locked === 0;
  lockedEl.textContent = `${locked} more map${locked === 1 ? "" : "s"} unlock${locked === 1 ? "s" : ""} in later books.`;
  panel.hidden = false;
}

function showPanel(spec) {
  if (compact.matches) setLegendCollapsed(true);
  const prev = selectedEvent;
  selectedEvent = null;
  panelSpec = spec;
  renderPanel();
  prev ? syncEvents() : fadeEvents();
}

function hidePanel() {
  const prev = selectedEvent;
  panelSpec = null;
  panel.hidden = true;
  selectedEvent = null;
  prev ? syncEvents() : fadeEvents();
}

function showNation(nation) {
  const info = NATIONS.find((n) => n.id === nation.key);
  showPanel(() => {
    const o = occupation(nation);
    const notes = o?.notes.filter((n) => isRevealed(n.since)).map((n) => n.text) ?? [];
    const region = info?.region ?? nation.continent;
    return {
      title: nation.name,
      subtitle: o ? `${region} · occupied by ${nationByKey[o.by].name}` : region,
      body: [info?.text, ...notes].filter(Boolean).join(" "),
      maps: info?.maps ?? [],
    };
  });
}

const continentNations = (name) => world.nations.filter((n) => n.continent === name && vectors.nations.some((v) => v.id === n.id));
const listNames = (names) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0] ?? "");

function showContinent(name) {
  const info = NATIONS.find((n) => n.id === name.toLowerCase());
  const members = continentNations(name).map((n) => n.name);
  showPanel({
    title: name,
    subtitle: "Continent",
    body: info?.text ?? `Home to ${listNames(members)}.`,
    maps: info?.maps ?? [],
  });
}

function showProvince(province) {
  const nation = nationById[province.nation];
  showPanel(() => ({
    title: provinceName(province),
    subtitle: `Province of ${nation.name}`,
    body: province.formerNames?.filter((f) => currentBook() >= f.until && f.note).map((f) => f.note).join(" "),
    since: province.since,
  }));
}

const PLACE_KINDS = { capital: "Capital", city: "City", town: "Town", sea: "Sea", landmark: "Landmark", island: "Island" };
const regionName = (x, y) => {
  const region = regionAt(x, y);
  return region?.province ? `${provinceName(region.province)}, ${region.nation.name}` : region?.nation?.name;
};

function showPlace(place) {
  const kindText = PLACE_KINDS[place.kind] ?? place.kind;
  const where = regionName(place.x, place.y);
  showPanel({ title: place.name, subtitle: where ? `${kindText} · ${where}` : kindText, since: place.since });
}

const sourcesOf = (item) => (item.sources ?? []).map((id) => SOURCES[id]).filter(Boolean);

function showFeature(feature) {
  const kind = featureDoc.kinds[feature.kind];
  const span = feature.until ? `Books ${feature.since}–${feature.until - 1}.` : `From book ${feature.since}.`;
  const wire = carriesTelegraph(feature) && `Telegraph wires run alongside from book ${feature.telegraph}.`;
  showPanel({ title: feature.name ?? feature.id, subtitle: kind?.label ?? feature.kind, body: [feature.text, span, wire].filter(Boolean).join(" "), maps: sourcesOf(feature), since: feature.since });
}

const labelGroup = L.layerGroup().addTo(map);
const labels = [];
const PLACE_MIN_ZOOM = { capital: 0, city: 1, town: 2, sea: 0, landmark: 1, island: 1 };
const LAYER_ZOOM_BOOST = { landmasses: 0, melosia: 0, narthon: 1, iraquinik: 1, landolin: 1, caedellium: 3, murvor: 2, world: 0 };

const CONTINENTS = ["Caedellium", "Melosia", "Landolin", "Ganolar", "Drilmar"];
const CONTINENT_OFFSET = { Melosia: [-20, 0] };
const CONTINENT_MAX_ZOOM = 0.5;

function continentAnchors() {
  const bounds = {};
  for (const { id, polygons } of vectors.nations) {
    const name = nationById[id].continent;
    if (!CONTINENTS.includes(name)) continue;
    const b = (bounds[name] ??= { x0: Infinity, x1: -Infinity, y1: -Infinity });
    for (const [x, y] of polygons.flatMap((polygon) => polygon[0])) {
      b.x0 = Math.min(b.x0, x);
      b.x1 = Math.max(b.x1, x);
      b.y1 = Math.max(b.y1, y);
    }
  }
  return CONTINENTS.map((name) => {
    const { x0, x1, y1 } = bounds[name];
    const [dx, dy] = CONTINENT_OFFSET[name] ?? [0, 0];
    return { name, x: (x0 + x1) / 2 + dx, y: y1 + dy };
  });
}

function makeLabel(x, y, className, text, onClick, minZoom, since = 1, maxZoom = Infinity) {
  const icon = L.divIcon({ className: `lbl ${className}`, html: `<span>${text}</span>`, iconSize: null });
  const marker = wrappedMarkers(x, y, (latlng) => L.marker(latlng, { icon, keyboard: false, bubblingMouseEvents: false }));
  marker.on("click", () => onClick?.());
  labels.push({ marker, minZoom, maxZoom, since });
}

function buildLabels() {
  labelGroup.clearLayers();
  labels.length = 0;
  for (const place of world.places) {
    const minZoom = PLACE_MIN_ZOOM[place.kind] + (LAYER_ZOOM_BOOST[place.layer] ?? 0);
    makeLabel(place.x, place.y, `lbl-${place.kind}`, place.name, () => showPlace(place), minZoom, place.since);
  }
  const tier = world.tiers.filter((t) => isRevealed(t.since)).at(-1);
  for (const [id, [x, y, , depth]] of Object.entries(tier.nationAnchors)) {
    const nation = nationById[id];
    makeLabel(x, y, "lbl-nation", nation.name, () => showNation(nation), Math.log2(16 / (depth * UNIT)));
  }
  for (const [id, [x, y, , depth]] of Object.entries(tier.provinceAnchors)) {
    const province = provinceById[id];
    makeLabel(x, y, "lbl-province", provinceName(province), () => showProvince(province), Math.log2(22 / (depth * UNIT)) + (compact.matches ? 0.5 : 0), province.since);
  }
  for (const { name, x, y } of continentAnchors()) {
    makeLabel(x, y, "lbl-continent", name, null, -Infinity, 1, CONTINENT_MAX_ZOOM);
  }
  syncLabels();
}

function syncLabels() {
  const z = map.getZoom();
  for (const l of labels) {
    const on = isRevealed(l.since) && z >= l.minZoom && z <= map.getMinZoom() + l.maxZoom;
    if (on && !labelGroup.hasLayer(l.marker)) labelGroup.addLayer(l.marker);
    if (!on && labelGroup.hasLayer(l.marker)) labelGroup.removeLayer(l.marker);
  }
}

const lineGroup = L.layerGroup().addTo(map);
const lines = [];
const lineWeight = (kind, z) => kind.weight * (1 + Math.max(0, z - 2) * 0.3);

const telegraphKind = () => featureDoc.kinds.telegraph;
const carriesTelegraph = (f) => f.telegraph != null && linesOn("telegraph") && isRevealed(f.telegraph);

function lineTip(feature) {
  const kind = featureDoc.kinds[feature.kind];
  const label = carriesTelegraph(feature) ? `${kind?.label ?? feature.kind} + telegraph` : kind?.label ?? feature.kind;
  return `${feature.name ?? feature.id}<span class="tip-book">${label} · ${bookLabel(feature.since)}</span>`;
}

function makeLine(feature) {
  const kind = featureDoc.kinds[feature.kind] ?? { color: "#ff00aa", weight: 2 };
  const latlngs = wrappedLine(feature.points);
  const casing = kind.casing ? L.polyline(latlngs, { color: kind.casing, opacity: 0.9, interactive: false, lineCap: "round" }) : null;
  const wire = feature.telegraph != null ? L.polyline(latlngs, { color: telegraphKind().color, opacity: 1, interactive: false, lineCap: "round" }) : null;
  const main = L.polyline(latlngs, { color: kind.color, opacity: 1, interactive: false, lineCap: "round" });
  const ties = kind.ties ? L.polyline(latlngs, { color: kind.ties, opacity: 1, interactive: false, lineCap: "butt" }) : null;
  const hit = L.polyline(latlngs, { color: "#000", opacity: 0, weight: 16, bubblingMouseEvents: false, lineCap: "round" });
  hit.on("click", () => showFeature(feature));
  hit.bindTooltip(() => lineTip(feature), { sticky: true, className: "region-tip" });
  const parts = [casing, wire, main, ties, hit].filter(Boolean);
  const entry = { feature, kind, casing, wire, main, ties, group: L.layerGroup(parts) };
  lines.push(entry);
  return entry;
}

function buildLines() {
  lineGroup.clearLayers();
  lines.length = 0;
  for (const f of featureDoc.features) makeLine(f);
  syncLines();
}

function syncLines() {
  const z = map.getZoom();
  for (const l of lines) {
    const self = linesOn(l.feature.kind) && visibleNow(l.feature);
    const wired = l.wire != null && visibleNow(l.feature) && carriesTelegraph(l.feature);
    const on = self || wired;
    if (on && !lineGroup.hasLayer(l.group)) lineGroup.addLayer(l.group);
    if (!on && lineGroup.hasLayer(l.group)) lineGroup.removeLayer(l.group);
    if (!on) continue;
    const w = lineWeight(l.kind, z);
    const scale = (pattern) => pattern.split(" ").map((v) => +v * Math.max(1, w / l.kind.weight)).join(" ");
    const dash = l.kind.dash ? scale(l.kind.dash) : null;
    l.main.setStyle({ weight: w, dashArray: dash, opacity: self ? l.kind.opacity ?? 1 : 0 });
    if (l.ties) l.ties.setStyle({ weight: Math.max(0.8, w - 1.4), dashArray: scale("3 4"), opacity: self ? 1 : 0 });
    const tk = telegraphKind();
    if (l.wire) l.wire.setStyle({ weight: lineWeight(tk, z), opacity: wired && !self ? tk.opacity ?? 1 : 0 });
    if (l.casing) l.casing.setStyle({ weight: w + 2.5 });
  }
}

const mineralGroup = L.layerGroup().addTo(map);
const MINERAL_MIN_ZOOM = 4;
const mineralMark = (key, className = "min-mark") => `<span class="${className}" style="--c:${mineralDoc.minerals[key].color}">${key}</span>`;

function showDeposit(deposit) {
  const { label } = mineralDoc.minerals[deposit.mineral];
  const region = regionAt(...deposit.at);
  const where = region?.province ? `${provinceName(region.province)}, ${region.nation.name}` : deposit.province;
  showPanel({
    title: `${label} deposit`,
    subtitle: `Mineral survey · ${where}`,
    maps: [MINERAL_SURVEY],
    since: mineralDoc.since,
  });
}

const MINERAL_FONT = 'italic 700 12.5px "Cormorant Garamond", Georgia, serif';
const MineralMark = L.CircleMarker.extend({
  _updatePath() {
    const r = this._renderer;
    if (!r._drawing || this._empty()) return;
    const ctx = r._ctx;
    const { x, y } = this._point;
    const { text, color } = this.options;
    ctx.save();
    ctx.globalAlpha = this._lit ? 1 : 0.85;
    ctx.font = MINERAL_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(243, 234, 214, 0.7)";
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  },
});

const mineralLayers = mineralDoc.deposits.map((deposit) => {
  const { label, color } = mineralDoc.minerals[deposit.mineral];
  const layer = wrappedMarkers(...deposit.at, (latlng) => {
    const mark = new MineralMark(latlng, { renderer, radius: 9, text: deposit.mineral, color, bubblingMouseEvents: false });
    mark.on("mouseover", () => ((mark._lit = true), mark.redraw()));
    mark.on("mouseout", () => ((mark._lit = false), mark.redraw()));
    return mark.bindTooltip(`${label}<span class="tip-book">${deposit.province}</span>`, { direction: "top", offset: [0, -8], className: "region-tip" });
  });
  layer.on("click", () => showDeposit(deposit));
  return { deposit, layer };
});
document.fonts.load(MINERAL_FONT).then(() => mineralGroup.eachLayer((g) => g.eachLayer((m) => m.redraw())));

function syncMinerals() {
  const show = mineralsOn() && isRevealed(mineralDoc.since) && map.getZoom() >= MINERAL_MIN_ZOOM;
  for (const m of mineralLayers) {
    if (show && !mineralGroup.hasLayer(m.layer)) mineralGroup.addLayer(m.layer);
    if (!show && mineralGroup.hasLayer(m.layer)) mineralGroup.removeLayer(m.layer);
  }
}

const bookLabel = (n) => (n === 0 ? "Opening chapters" : `Book ${n}`);
const eventGroup = L.layerGroup().addTo(map);
const EVENT_MIN_ZOOM = { world: -Infinity, island: 3 };
const CREW_BAND = 8;
const ROUTE_STYLE = { color: "#8f2b2b", weight: 2, lineCap: "round", bubblingMouseEvents: false };
const EVENT_FADE = [1, 0.7, 0.45];
const eventAge = (item) => currentBook() - Math.max(item.since, 1);
const persistentEvent = (item) => eventDoc.categories[item.category]?.persistent === true;
const pinnedEvent = (item) => persistentEvent(item) || (item.category === "industry" && keepIndustryOn());
const eventInWindow = (item) => pinnedEvent(item) || (allEventsOn() ? eventsOn(item.since) : eventAge(item) < RECENT_BOOKS);
const EVENT_NAME_ZOOM = 8;
const powers = eventDoc.powers;
const sideLabel = (item) => (item.crew ? `${powers[item.crew].adj} for ${powers[item.side].label}` : powers[item.side]?.adj);
const sideTip = (item) => (item.side ? `<span class="tip-side" style="--c:${powers[item.side].color}">${sideLabel(item)}</span>` : "");
const eventTip = (item) => `${item.name}<span class="tip-book">${bookLabel(item.since)}</span>${sideTip(item)}`;
const EVENT_GLYPHS = {
  swords: '<path d="M3 3l9 9M13 3l-9 9M10 13l3-3M3 10l3 3"/>',
  flame: '<path d="M8 1.5c2.2 3 4.3 4.6 4.3 7.8a4.3 4.3 0 0 1-8.6 0c0-1.9 1-3.2 2-4.2 0 1.6.6 2.6 1.6 3.1C7.3 6.2 6.9 4 8 1.5z" fill="#fff" stroke="none"/>',
  flag: '<path d="M4 14.5V1.5M4 2.5h8.5l-2 3.2 2 3.3H4"/>',
  hall: '<path d="M2 6l6-3.5L14 6M3 6.5h10M4.5 8v4.5M8 8v4.5M11.5 8v4.5M2.5 14h11"/>',
  hammer: '<path d="M3 13.5l6-6M6.5 4.5l3-2.5 4 4-2.5 3z"/>',
  star: '<path d="M8 1.5l1.9 4 4.4.5-3.2 3 .9 4.4L8 11.2l-4 2.2.9-4.4-3.2-3 4.4-.5z" fill="#fff" stroke="none"/>',
  mountain: '<path d="M1 13.5l4.8-8.5 2.7 4.3 2-3 4.5 7.2z" fill="#fff" stroke="none"/>',
  anchor: '<path d="M8 4.5v9.5M5 7h6M2.8 10c.2 2.6 2.5 4 5.2 4s5-1.4 5.2-4"/><circle cx="8" cy="3" r="1.4"/>',
  route: '<path d="M2 12c3 0 3-8 6-8s3 8 6 8" stroke-dasharray="2.2 2"/>',
  march: '<path d="M2 8h10M8.5 4.5L12 8l-3.5 3.5"/>',
  person: '<circle cx="8" cy="4" r="2.1" fill="#fff" stroke="none"/><path d="M4 14.5c0-3.4 1.8-6 4-6s4 2.6 4 6z" fill="#fff" stroke="none"/>',
  egg: '<path d="M8 1.8c2.5 0 4.4 4 4.4 7.1a4.4 4.4 0 0 1-8.8 0C3.6 5.8 5.5 1.8 8 1.8z" fill="#fff" stroke="none"/>',
};
const eventTypes = eventDoc.categories;
const ARROW_SPACING_PX = 260;
const arrowPane = map.createPane("arrows");
arrowPane.style.zIndex = 450;
arrowPane.style.pointerEvents = "none";
const arrowRenderer = L.canvas({ padding: 0.5, pane: "arrows" });
const RouteArrow = L.CircleMarker.extend({
  _updatePath() {
    const r = this._renderer;
    if (!r._drawing || this._empty()) return;
    const ctx = r._ctx;
    const { x, y } = this._point;
    const { angle, color, opacity } = this.options;
    const k = 14 / 12;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(k, k);
    ctx.beginPath();
    ctx.moveTo(-3, -4);
    ctx.lineTo(2, 0);
    ctx.lineTo(-3, 4);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = "rgba(250, 244, 230, 0.9)";
    ctx.shadowBlur = 1;
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.restore();
  },
});
function routeArrows(points, color, spacing, opacity) {
  const segs = points.slice(1).map((p, i) => [points[i], p, Math.hypot(p[0] - points[i][0], p[1] - points[i][1])]);
  const total = segs.reduce((sum, [, , len]) => sum + len, 0);
  const n = Math.min(Math.max(Math.round(total / spacing), 1), 40);
  const arrows = [];
  for (let i = 0; i < n; i++) {
    let d = (total * (i + 0.5)) / n;
    const [[ax, ay], [bx, by], len] = segs.find(([, , len]) => (d -= len) <= 0) ?? segs.at(-1);
    const t = 1 + d / len;
    const angle = Math.atan2(by - ay, bx - ax);
    arrows.push(...COPIES.map((dx) => new RouteArrow(toLatLng(ax + (bx - ax) * t + dx, ay + (by - ay) * t), { renderer: arrowRenderer, radius: 7, angle, color, opacity, interactive: false })));
  }
  return arrows;
}

const LANE_GAP_PX = 6;
const LANE_NEAR_PX = 3;
const LANE_TAPER_PX = 16;
const LANE_PARALLEL = 0.8;
const LANE_SHIFTS = [0, WORLD_W, -WORLD_W];

function routePath(points) {
  const segs = [];
  let s = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1], [bx, by] = points[i];
    const len = Math.hypot(bx - ax, by - ay);
    if (len === 0) continue;
    segs.push({ ax, ay, bx, by, len, s, tx: (bx - ax) / len, ty: (by - ay) / len });
    s += len;
  }
  const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
  return { segs, length: s, points, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
}

function nearestOnPath(path, x, y, tol, skip) {
  let best = null;
  for (const dx of LANE_SHIFTS) {
    const px = x - dx;
    const [x0, y0, x1, y1] = path.box;
    if (px < x0 - tol || px > x1 + tol || y < y0 - tol || y > y1 + tol) continue;
    for (const g of path.segs) {
      const spans = skip ? [[g.s, Math.min(g.s + g.len, skip[0])], [Math.max(g.s, skip[1]), g.s + g.len]] : [[g.s, g.s + g.len]];
      for (const [lo, hi] of spans) {
        if (hi < lo) continue;
        const s = Math.min(Math.max(g.s + (px - g.ax) * g.tx + (y - g.ay) * g.ty, lo), hi);
        const d = Math.hypot(g.ax + g.tx * (s - g.s) - px, g.ay + g.ty * (s - g.s) - y);
        if (!best || d < best.d) best = { d, s, tx: g.tx, ty: g.ty };
      }
    }
  }
  return best;
}

function laneOffset(route, path, g, s, others, tol) {
  const mx = g.ax + g.tx * (s - g.s), my = g.ay + g.ty * (s - g.s);
  const entries = [{ key: [route.since, route.id, s], dir: 1, self: true }];
  const consider = (other, hit) => {
    if (!hit || hit.d > tol) return;
    const dot = hit.tx * g.tx + hit.ty * g.ty;
    if (Math.abs(dot) >= LANE_PARALLEL) entries.push({ key: [other.item.since, other.item.id, hit.s], dir: Math.sign(dot) });
  };
  for (const o of others) if (o.item !== route) consider(o, nearestOnPath(o.path, mx, my, tol));
  consider({ item: route }, nearestOnPath(path, mx, my, tol, [s - tol * 3, s + tol * 3]));
  const cmp = (a, b) => a.key[0] - b.key[0] || (a.key[1] < b.key[1] ? -1 : a.key[1] > b.key[1] ? 1 : a.key[2] - b.key[2]);
  const same = entries.filter((e) => e.dir > 0).sort(cmp);
  const rank = same.findIndex((e) => e.self);
  return entries.some((e) => e.dir < 0) ? rank + 0.5 : rank - (same.length - 1) / 2;
}

function laneRuns(route, path, others, tol) {
  const runs = [];
  for (const g of path.segs) {
    const cuts = new Set([0, g.len]);
    for (const o of [...others.filter((o) => o.item !== route).map((o) => o.path), path]) {
      for (const [vx, vy] of o.points) {
        for (const dx of LANE_SHIFTS) {
          const t = (vx - dx - g.ax) * g.tx + (vy - g.ay) * g.ty;
          if (t <= 0 || t >= g.len) continue;
          if (Math.abs((vx - dx - g.ax) * -g.ty + (vy - g.ay) * g.tx) <= tol) cuts.add(t);
        }
      }
    }
    const ts = [...cuts].sort((a, b) => a - b);
    for (let i = 1; i < ts.length; i++) {
      if (ts[i] - ts[i - 1] < tol * 1e-3) continue;
      runs.push({ s0: g.s + ts[i - 1], s1: g.s + ts[i], lane: laneOffset(route, path, g, g.s + (ts[i - 1] + ts[i]) / 2, others, tol) });
    }
  }
  return runs;
}

function laneAt(runs, s, half, length) {
  const lo = Math.max(s - half, 0), hi = Math.min(s + half, length);
  if (hi <= lo) return runs.find((r) => s >= r.s0 && s <= r.s1)?.lane ?? 0;
  let sum = 0;
  for (const r of runs) sum += Math.max(Math.min(r.s1, hi) - Math.max(r.s0, lo), 0) * r.lane;
  return sum / (hi - lo);
}

const LANE_END_PX = 24;
const LANE_LAND_DEPTH = 6;
const LAND_SHAPES = [...vectors.land, ...vectors.ice, ...vectors.nations.flatMap((n) => n.polygons)].map((polygon) => {
  const xs = polygon[0].map(([x]) => x), ys = polygon[0].map(([, y]) => y);
  return { polygon, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
});
const LAND_CELL = 1;
const landCell = (x, y) => Math.floor(x / LAND_CELL) * 8192 + Math.floor(y / LAND_CELL);
const COAST_CELLS = new Map();
LAND_SHAPES.forEach(({ polygon }, shape) => {
  for (const ring of polygon) {
    ring.forEach(([ax, ay], i) => {
      const [bx, by] = ring[(i + 1) % ring.length];
      const n = Math.max(Math.ceil(Math.hypot(bx - ax, by - ay) / (LAND_CELL / 2)), 1);
      const cells = new Set();
      for (let k = 0; k <= n; k++) {
        const x = ax + ((bx - ax) * k) / n, y = ay + ((by - ay) * k) / n;
        for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) cells.add(landCell(x + dx * LAND_CELL, y + dy * LAND_CELL));
      }
      for (const key of cells) {
        if (!COAST_CELLS.has(key)) COAST_CELLS.set(key, { edges: [], shapes: new Set() });
        const cell = COAST_CELLS.get(key);
        cell.edges.push([ax, ay, bx, by, shape]);
        cell.shapes.add(shape);
      }
    });
  }
});
const inShape = (p, shape) => {
  const { polygon, box: [x0, y0, x1, y1] } = LAND_SHAPES[shape];
  return p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1 && pointInPolygons(p, [polygon]);
};
const testLand = (p, skip) => LAND_SHAPES.some((_, shape) => !skip?.has(shape) && inShape(p, shape));
const crosses = ([px, py], [qx, qy], [ax, ay, bx, by]) => {
  const d1 = (bx - ax) * (py - ay) - (by - ay) * (px - ax), d2 = (bx - ax) * (qy - ay) - (by - ay) * (qx - ax);
  const d3 = (qx - px) * (ay - py) - (qy - py) * (ax - px), d4 = (qx - px) * (by - py) - (qy - py) * (bx - px);
  return d1 > 0 !== d2 > 0 && d3 > 0 !== d4 > 0;
};
const landCache = new Map();
const onLand = ([x, y]) => {
  const p = [wrapX(x), y];
  const key = landCell(...p);
  const cell = COAST_CELLS.get(key);
  if (!cell) {
    if (!landCache.has(key)) landCache.set(key, testLand(p));
    return landCache.get(key);
  }
  if (!cell.ref) {
    const c = [(Math.floor(p[0] / LAND_CELL) + 0.5) * LAND_CELL, (Math.floor(p[1] / LAND_CELL) + 0.5) * LAND_CELL];
    cell.ref = { c, other: testLand(c, cell.shapes), inside: new Map([...cell.shapes].map((shape) => [shape, inShape(c, shape)])) };
  }
  if (cell.ref.other) return true;
  const parity = new Map(cell.ref.inside);
  for (const e of cell.edges) if (crosses(p, cell.ref.c, e)) parity.set(e[4], !parity.get(e[4]));
  return [...parity.values()].some(Boolean);
};

function laneLine(route, path, others, z) {
  const unit = 1 / pxPerWorld(z);
  const tol = LANE_NEAR_PX * unit;
  const runs = laneRuns(route, path, others, tol);
  if (runs.every((r) => r.lane === 0)) return route.points;
  const half = (LANE_TAPER_PX * unit) / 2;
  const end = Math.min(LANE_END_PX * unit, path.length / 2);
  const ramp = (s) => Math.max(Math.min(1, s / end, (path.length - s) / end), 0);
  const marks = [end, path.length - end, ...runs.slice(1).flatMap((r, i) => (r.lane === runs[i].lane ? [] : [r.s0 - half, r.s0 + half]))];
  const samples = [];
  path.segs.forEach((g, i) => {
    samples.push({ s: g.s, g, prev: path.segs[i - 1] });
    for (const m of marks.filter((m) => m > g.s && m < g.s + g.len).sort((a, b) => a - b)) samples.push({ s: m, g });
  });
  const last = path.segs.at(-1);
  samples.push({ s: path.length, g: last });
  const base = ({ s, g }) => [g.ax + g.tx * (s - g.s), g.ay + g.ty * (s - g.s)];
  const normal = ({ g, prev }) => {
    if (!prev) return [-g.ty, g.tx];
    const ax = -prev.ty - g.ty, ay = prev.tx + g.tx, al = Math.hypot(ax, ay);
    if (al < 1e-6) return [-g.ty, g.tx];
    const k = Math.min(1 / Math.max((ax / al) * -g.ty + (ay / al) * g.tx, 0.5), 2);
    return [(ax / al) * k, (ay / al) * k];
  };
  const shift = (q, scale) => {
    const [bx, by] = base(q), [nx, ny] = normal(q);
    const o = laneAt(runs, q.s, half, path.length) * ramp(q.s) * LANE_GAP_PX * unit * scale;
    return [bx + nx * o, by + ny * o];
  };
  const sea = route.category === "voyage";
  const place = (q) => {
    const full = shift(q, 1);
    if (!sea || !onLand(full) || onLand(base(q))) return full;
    let lo = 0, hi = 1;
    for (let i = 0; i < 6; i++) {
      const mid = (lo + hi) / 2;
      if (onLand(shift(q, mid))) hi = mid;
      else lo = mid;
    }
    return shift(q, lo);
  };
  const out = [];
  const refine = (a, pa, b, pb, depth) => {
    if (depth > 0 && sea) {
      const g = b.prev || b.s <= b.g.s ? a.g : b.g;
      const crosses = [0.25, 0.5, 0.75].some((t) => {
        const q = { s: a.s + (b.s - a.s) * t, g };
        return onLand([pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t]) && !onLand(base(q));
      });
      if (crosses) {
        const m = { s: (a.s + b.s) / 2, g };
        const pm = place(m);
        refine(a, pa, m, pm, depth - 1);
        refine(m, pm, b, pb, depth - 1);
        return;
      }
    }
    out.push(pb);
  };
  let prevSample = samples[0], prevPoint = place(samples[0]);
  out.push(prevPoint);
  for (const q of samples.slice(1)) {
    const p = place(q);
    refine(prevSample, prevPoint, q, p, LANE_LAND_DEPTH);
    prevSample = q;
    prevPoint = p;
  }
  return out;
}
const eventPin = (type, className = "evt-pin") => {
  const cat = eventTypes[type] ?? { color: "#555", icon: "star" };
  return `<span class="${className}" style="--c:${cat.color}"><svg viewBox="0 0 16 16">${EVENT_GLYPHS[cat.icon] ?? ""}</svg></span>`;
};

function showEvent(item) {
  const label = [eventTypes[item.category]?.label, item.side && sideLabel(item), item.inferred && "inferred"].filter(Boolean).join(" · ");
  showPanel({ title: item.name, subtitle: `${bookLabel(item.since)} · ${label}`, body: item.text, maps: sourcesOf(item), since: item.since, gate: hasFinished });
  selectedEvent = item;
  syncEvents();
}

const canHover = matchMedia("(hover: hover)");
const coarsePointer = matchMedia("(pointer: coarse)");
const watchHover = (layer, item) =>
  canHover.matches &&
  layer.on({
    mouseover: () => {
      hoveredEvent = item;
      fadeEvents();
    },
    mouseout: () => {
      hoveredEvent = null;
      fadeEvents();
    },
  });

const eventLayers = [
  ...eventDoc.items.map((item) => {
    const icon = L.divIcon({ className: "evt", html: `${eventPin(item.category)}<span class="evt-name">${item.name}</span>`, iconSize: null });
    const layer = wrappedMarkers(...item.at, (latlng) =>
      L.marker(latlng, { icon, keyboard: false, bubblingMouseEvents: false, zIndexOffset: 500, riseOnHover: true }).bindTooltip(eventTip(item), {
        direction: "top",
        offset: [0, -12],
        className: "region-tip",
      }),
    );
    layer.on("click", () => showEvent(item));
    watchHover(layer, item);
    return { item, layer, minZoom: EVENT_MIN_ZOOM[item.scale] ?? -Infinity };
  }),
  ...eventDoc.routes.map((route) => {
    const sideColor = powers[route.side]?.color;
    const base = { ...ROUTE_STYLE, color: sideColor ?? eventTypes[route.category]?.color ?? ROUTE_STYLE.color };
    const style = route.inferred ? { ...base, opacity: 0.55, dashArray: "2 6" } : { ...base, opacity: 0.9, dashArray: "8 5" };
    const latlngs = wrappedLine(route.points);
    const halo = L.polyline(latlngs, { color: sideColor ?? base.color, opacity: 0, weight: 10, lineCap: "round", interactive: false });
    const under = route.crew ? L.polyline(latlngs, { color: powers[route.crew].color, weight: CREW_BAND, opacity: 0.35, lineCap: "round", interactive: false }) : null;
    const line = L.polyline(latlngs, { ...style, interactive: false });
    const arrows = L.layerGroup();
    const hit = L.polyline(latlngs, { color: "#000", opacity: 0, weight: coarsePointer.matches ? 28 : 16, bubblingMouseEvents: false, lineCap: "round" });
    hit.bindTooltip(eventTip(route), { sticky: true, className: "region-tip" });
    hit.on("click", () => showEvent(route));
    watchHover(hit, route);
    return { item: route, path: routePath(route.points), layer: L.layerGroup([halo, under, line, arrows, hit].filter(Boolean)), arrows, arrowColor: base.color, halo, under, line, hit, minZoom: EVENT_MIN_ZOOM[route.scale] ?? -Infinity, opacity: style.opacity };
  }),
];

let laneKey = null;
const laneCache = new Map();
function layoutRoutes(zoom) {
  const z = Math.round(zoom * 4) / 4;
  const shown = eventLayers.filter((e) => e.path && eventGroup.hasLayer(e.layer));
  const key = `${z}|${shown.map((e) => e.item.id).join(",")}`;
  if (key === laneKey) return;
  laneKey = key;
  if (!laneCache.has(key)) laneCache.set(key, new Map());
  const cached = laneCache.get(key);
  const spacing = ARROW_SPACING_PX / pxPerWorld(z);
  for (const e of shown) {
    if (!cached.has(e)) {
      const points = laneLine(e.item, e.path, shown, z);
      cached.set(e, { latlngs: wrappedLine(points), arrows: e.arrows && routeArrows(points, e.arrowColor, spacing, arrowOpacity(e)) });
    }
    const { latlngs, arrows } = cached.get(e);
    for (const l of [e.halo, e.under, e.line, e.hit]) l?.setLatLngs(latlngs);
    if (!e.arrows) continue;
    e.arrows.clearLayers();
    const opacity = arrowOpacity(e);
    for (const a of arrows) e.arrows.addLayer(a.setStyle({ opacity }));
  }
}

const eventRevealed = (item) => hasFinished(item.since) && (item.until == null || currentBook() < item.until);

function syncEvents() {
  const z = map.getZoom();
  map.getContainer().classList.toggle("evt-names", z >= EVENT_NAME_ZOOM);
  for (const e of eventLayers) {
    const shown = e.item === selectedEvent || (eventInWindow(e.item) && eventTypeOn(e.item.category) && sideOn(e.item) && z >= e.minZoom);
    const on = shown && eventRevealed(e.item);
    if (on && !eventGroup.hasLayer(e.layer)) eventGroup.addLayer(e.layer);
    if (!on && eventGroup.hasLayer(e.layer)) eventGroup.removeLayer(e.layer);
  }
  layoutRoutes(z);
  fadeEvents();
}

function eventFade(item) {
  if ((allEventsOn() && !fadeOn()) || pinnedEvent(item) || item === selectedEvent || item === hoveredEvent) return 1;
  return EVENT_FADE[Math.min(Math.max(eventAge(item), 0), EVENT_FADE.length - 1)];
}

function arrowOpacity(e) {
  const lit = e.item === selectedEvent || e.item === hoveredEvent;
  return lit ? 1 : Math.min(e.opacity * eventFade(e.item) * 1.7, 1);
}

function fadeEvents() {
  for (const e of eventLayers) {
    const f = eventFade(e.item);
    if (e.opacity == null) {
      e.layer.eachLayer((m) => m.setOpacity(f));
      continue;
    }
    const lit = e.item === selectedEvent || e.item === hoveredEvent;
    const routeStyle = { opacity: lit ? 1 : e.opacity * f, weight: lit ? ROUTE_STYLE.weight * 1.75 : ROUTE_STYLE.weight };
    e.line.setStyle(routeStyle);
    e.under?.setStyle({ opacity: lit ? 0.55 : 0.35 * f, weight: lit ? CREW_BAND * 1.4 : CREW_BAND });
    e.arrows?.eachLayer((a) => a.setStyle({ opacity: arrowOpacity(e) }));
    e.halo.setStyle({ opacity: lit ? 0.3 : 0 });
    if (lit && eventGroup.hasLayer(e.layer)) {
      e.halo.bringToFront();
      e.under?.bringToFront();
      e.line.bringToFront();
    }
  }
}

map.on("click", () => {
  hidePanel();
  if (compact.matches) setLegendCollapsed(true);
});

map.on("move", () => {
  const anim = map._panAnim;
  if (anim?._inProgress) {
    const pos = map._getMapPanePos();
    const shift = wrapShift(pos.x);
    if (shift) {
      anim._startPos.x += shift;
      L.DomUtil.setPosition(map._mapPane, pos.add([shift, 0]));
    }
  }
  if (map.smoothWheelZoom.zooming) return;
  const size = map.getSize();
  const view = L.bounds(map.containerPointToLayerPoint(size.multiplyBy(-0.25)), map.containerPointToLayerPoint(size.multiplyBy(1.25)));
  map.eachLayer((layer) => {
    if (layer instanceof L.Renderer && layer._bounds && !layer._bounds.contains(view)) layer._update();
  });
});

function writeHash() {
  const [x, y] = fromLatLng(map.getCenter());
  if (x < 0 || x >= WORLD_W) return map.setView(toLatLng(wrapX(x), y), map.getZoom(), { animate: false });
  history.replaceState(null, "", `#${map.getZoom().toFixed(2)}/${x.toFixed(1)}/${y.toFixed(1)}`);
}

map.on("moveend", writeHash);
map.on("zoomend", () => {
  syncLabels();
  syncLines();
  syncEvents();
  syncRegions();
  syncMinerals();
  $("#zoom").textContent = map.getZoom().toFixed(1);
});

const kindRevealed = (kind) =>
  featureDoc.features.some(
    (f) => visibleNow(f) && (f.kind === kind || (kind === "telegraph" && f.telegraph != null && isRevealed(f.telegraph))),
  );
const revealedSides = () => [
  ...new Map(eventLayers.filter((e) => e.item.side && hasFinished(e.item.since)).map((e) => [sideKey(e.item), e.item])).values(),
].sort((a, b) => !!a.crew - !!b.crew || Object.keys(powers).indexOf(a.side) - Object.keys(powers).indexOf(b.side));
const categoryRevealed = (type) => eventLayers.some((e) => e.item.category === type && hasFinished(e.item.since));

function buildLayerPanel() {
  const lineIcon = (k) => {
    const dash = k.dash ? `stroke-dasharray="${k.dash.split(" ").map((v) => +v * 1.4).join(" ")}"` : "";
    const ties = k.ties ? `<path d="M3 6h18" stroke="${k.ties}" stroke-width="${k.weight * 1.4 - 1.4}" stroke-dasharray="3 3"/>` : "";
    const under = k.under ? `<path d="M3 6h18" stroke="${k.under}" stroke-opacity="0.45" stroke-width="7" stroke-linecap="round"/>` : "";
    return `<svg class="line-swatch" viewBox="0 0 24 12"><rect x="0.5" y="0.5" width="23" height="11" rx="1.5" fill="${STYLE.land.fillColor}" stroke="rgba(105,76,40,0.35)"/>${under}<path d="M3 6h18" stroke="${k.color}" stroke-opacity="${k.opacity ?? 1}" stroke-width="${k.weight * 1.4}" stroke-linecap="round" ${dash}/>${ties}</svg>`;
  };
  const group = (title, items) => {
    if (!items.length) return "";
    const section = document.createElement("section");
    const h = document.createElement("h3");
    h.textContent = title;
    section.append(h);
    for (const { label, checked, onChange, swatch, icon } of items) {
      const row = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = checked;
      input.addEventListener("change", () => onChange(input.checked));
      row.append(input);
      if (swatch) {
        const s = document.createElement("i");
        s.style.background = swatch;
        row.append(s);
      }
      if (icon) row.insertAdjacentHTML("beforeend", icon);
      const text = document.createElement("span");
      text.textContent = label;
      row.append(text);
      section.append(row);
    }
    return section;
  };
  const lineKeys = (natural) =>
    Object.entries(featureDoc.kinds).filter(([k, v]) => !v.natural === !natural && kindRevealed(k)).map(([k, v]) => ({
      label: v.label,
      icon: lineIcon(v),
      checked: linesOn(k),
      onChange: (on) => {
        prefs.lines[k] = on;
        savePrefs();
        syncLines();
      },
    }));
  $("#legend-keys").replaceChildren(
    group("Waterways", lineKeys(true)),
    group("Infrastructure", lineKeys(false)),
    group(
      "Events",
      Object.entries(eventTypes).filter(([type]) => categoryRevealed(type)).map(([type, cat]) => ({
        label: cat.label,
        icon: eventPin(type, "evt-pin legend-pin"),
        checked: eventTypeOn(type),
        onChange: (on) => {
          prefs.eventTypes = { ...prefs.eventTypes, [type]: on };
          savePrefs();
          syncEvents();
        },
      })),
    ),
    group(
      "Voyages by power",
      revealedSides().map((item) => ({
        label: item.crew ? sideLabel(item) : powers[item.side].label,
        icon: lineIcon({ color: powers[item.side].color, under: item.crew && powers[item.crew].color, weight: 2, dash: "3 2" }),
        checked: sideOn(item),
        onChange: (on) => {
          prefs.sides = { ...prefs.sides, [sideKey(item)]: on };
          savePrefs();
          syncEvents();
        },
      })),
    ),
    group(
      "Overlays",
      isRevealed(mineralDoc.since)
        ? [
            {
              label: "Mineral deposits",
              icon: mineralMark("Fe", "min-mark legend-min"),
              checked: mineralsOn(),
              onChange: (on) => {
                prefs.minerals = on;
                savePrefs();
                syncMinerals();
              },
            },
          ]
        : [],
    ),
  );
  $("#options-body").replaceChildren(
    group("Book events", [
      {
        label: "Show all books",
        checked: allEventsOn(),
        onChange: (on) => {
          prefs.allEvents = on;
          savePrefs();
          syncEvents();
          buildLayerPanel();
        },
      },
      {
        label: "Keep industry & resources visible",
        checked: keepIndustryOn(),
        onChange: (on) => {
          prefs.keepIndustry = on;
          savePrefs();
          syncEvents();
        },
      },
      ...(allEventsOn() ? [...new Set(eventLayers.filter((e) => !persistentEvent(e.item)).map((e) => e.item.since))].filter(hasFinished).sort((a, b) => a - b).map((book) => ({
        label: bookLabel(book),
        checked: eventsOn(book),
        onChange: (on) => {
          prefs.events = { ...prefs.events, [book]: on };
          savePrefs();
          syncEvents();
        },
      })).concat({
        label: "Fade older books",
        checked: fadeOn(),
        onChange: (on) => {
          prefs.fadeEvents = on;
          savePrefs();
          fadeEvents();
        },
      }) : []),
    ]),
  );
}

function setLegendCollapsed(collapsed) {
  const button = $("#legend-collapse");
  $("#legend").classList.toggle("collapsed", collapsed);
  button.textContent = collapsed ? "+" : "\u2212";
  button.setAttribute("aria-expanded", String(!collapsed));
  button.setAttribute("aria-label", collapsed ? "Expand legend" : "Collapse legend");
}
$("#legend-collapse").addEventListener("click", () => {
  const collapsed = !$("#legend").classList.contains("collapsed");
  setLegendCollapsed(collapsed);
  if (!collapsed && compact.matches) hidePanel();
});
setLegendCollapsed(compact.matches);
$("#panel-close").addEventListener("click", hidePanel);

addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target.closest?.(".book-picker")) return;
  if (e.key === "Escape") hidePanel();
  if (e.key === "/" && !e.metaKey && !e.ctrlKey && $("#landing").hidden) {
    e.preventDefault();
    searchInput.focus();
  }
});

const pickerLabel = (n) => (n === 0 ? "Reading book 1" : n === BOOK_OPTIONS.at(-1) ? `Book ${n}+` : `Book ${n}`);
const bookTitle = (n) => BOOK_TITLES[Math.max(n, 1)] ?? "";
const bookButton = $("#book");
const bookList = $("#book-list");
let activeBook = currentBook();

const bookOptions = BOOK_OPTIONS.map((n) => {
  const li = document.createElement("li");
  li.role = "option";
  li.id = `book-opt-${n}`;
  li.classList.toggle("unread", n === 0);
  const img = new Image();
  img.src = bookCover(n);
  img.alt = "";
  img.loading = "lazy";
  const text = document.createElement("span");
  const small = document.createElement("small");
  small.textContent = pickerLabel(n);
  text.append(small, bookTitle(n));
  li.append(img, text);
  li.addEventListener("click", () => chooseBook(n));
  li.addEventListener("pointermove", () => setActiveBook(n));
  return { n, li };
});
bookList.replaceChildren(...bookOptions.map((o) => o.li));

function syncBookPicker(n) {
  $("#book-cover").src = bookCover(n);
  $("#book-label").textContent = n === 0 ? "Haven't started reading" : `Read up to ${pickerLabel(n)}`;
  $("#book-title").textContent = bookTitle(n);
  bookButton.classList.toggle("unread", n === 0);
  for (const o of bookOptions) o.li.setAttribute("aria-selected", String(o.n === n));
}

function setActiveBook(n, scroll = false) {
  activeBook = n;
  for (const o of bookOptions) o.li.classList.toggle("active", o.n === n);
  const li = $(`#book-opt-${n}`);
  bookList.setAttribute("aria-activedescendant", li.id);
  if (scroll) li.scrollIntoView({ block: "nearest" });
}

function openBookList() {
  bookList.hidden = false;
  bookButton.setAttribute("aria-expanded", "true");
  setActiveBook(currentBook(), true);
  bookList.focus();
}

function closeBookList(refocus = true) {
  if (bookList.hidden) return;
  bookList.hidden = true;
  bookButton.setAttribute("aria-expanded", "false");
  if (refocus) bookButton.focus();
}

function chooseBook(n) {
  setBook(n);
  closeBookList();
}

bookButton.addEventListener("click", () => (bookList.hidden ? openBookList() : closeBookList()));
bookButton.addEventListener("keydown", (e) => {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  e.preventDefault();
  openBookList();
});
bookList.addEventListener("keydown", (e) => {
  const i = BOOK_OPTIONS.indexOf(activeBook);
  const moves = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: BOOK_OPTIONS.length - 1 };
  if (e.key in moves) {
    e.preventDefault();
    setActiveBook(BOOK_OPTIONS[Math.min(Math.max(moves[e.key], 0), BOOK_OPTIONS.length - 1)], true);
  } else if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    chooseBook(activeBook);
  } else if (e.key === "Escape") {
    e.preventDefault();
    closeBookList();
  } else if (e.key === "Tab") {
    closeBookList(false);
  }
});
addEventListener("pointerdown", (e) => {
  if (!e.target.closest(".book-picker")) closeBookList(false);
});
syncBookPicker(currentBook());

const landing = $("#landing");
if (!landing.hidden) {
  const { center, zoom } = { center: map.getCenter(), zoom: map.getZoom() };
  map.fitBounds(nationBounds([nationByKey.caedellium.id]), { animate: false });
  landing.addEventListener("close", () => map.setView(center, zoom, { animate: false }), { once: true });
}

function refresh() {
  syncRegions();
  buildLabels();
  syncLines();
  syncEvents();
  syncMinerals();
  renderPanel();
}

const searchInput = $("#search");
const searchList = $("#search-results");
const SEARCH_LIMIT = 8;
const FOCUS_PADDING = () =>
  compact.matches ? { paddingTopLeft: [16, 160], paddingBottomRight: [16, innerHeight * 0.5] } : { paddingTopLeft: [300, 60], paddingBottomRight: [420, 60] };
const EVENT_FOCUS_ZOOM = { island: 5 };
const fold = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const pointsBounds = (points) => L.latLngBounds(points.map(([x, y]) => toLatLng(x, y)));
const polygonsBounds = (polygons) => pointsBounds(polygons.flatMap((polygon) => polygon[0]));
let searchResults = [];
let searchActive = 0;
let pulseLayer = null;

function focusOn({ bounds, at, zoom }, open) {
  open();
  if (bounds) return map.flyToBounds(bounds, { ...FOCUS_PADDING(), maxZoom: 7, duration: 0.8 });
  const latlng = toLatLng(...at);
  map.flyToBounds(L.latLngBounds(latlng, latlng), { ...FOCUS_PADDING(), maxZoom: Math.min(Math.max(map.getZoom(), zoom), map.getMaxZoom()), duration: 0.8 });
  pulseLayer?.remove();
  pulseLayer = L.marker(latlng, { icon: L.divIcon({ className: "search-pulse", iconSize: null }), interactive: false, keyboard: false, zIndexOffset: 1000 }).addTo(map);
  const layer = pulseLayer;
  setTimeout(() => layer.remove(), 3500);
}

function searchEntries() {
  const placeZoom = (p) => Math.max(PLACE_MIN_ZOOM[p.kind] + (LAYER_ZOOM_BOOST[p.layer] ?? 0) + 0.5, 2);
  return [
    ...world.places.filter((p) => isRevealed(p.since)).map((p) => ({
      name: p.name,
      sub: () => [PLACE_KINDS[p.kind] ?? p.kind, regionName(p.x, p.y)].filter(Boolean).join(" · "),
      go: () => focusOn({ at: [p.x, p.y], zoom: placeZoom(p) }, () => showPlace(p)),
    })),
    ...nationLayers.map(({ nation }) => ({
      name: nation.name,
      sub: () => `Nation · ${NATIONS.find((n) => n.id === nation.key)?.region ?? nation.continent}`,
      go: () => focusOn({ bounds: nationBounds([nation.id]) }, () => showNation(nation)),
    })),
    ...CONTINENTS.filter((name) => !world.nations.some((n) => n.name === name)).map((name) => ({
      name,
      sub: () => `Continent · ${continentNations(name).length} nations`,
      go: () => focusOn({ bounds: nationBounds(continentNations(name).map((n) => n.id)) }, () => showContinent(name)),
    })),
    ...provinceLayers.filter((p) => isRevealed(p.province.since)).map(({ province, polygons }) => ({
      name: provinceName(province),
      aliases: province.formerNames?.filter((f) => currentBook() >= f.until).map((f) => f.name),
      sub: () => `Province · ${nationById[province.nation].name}`,
      go: () => focusOn({ bounds: polygonsBounds(polygons) }, () => showProvince(province)),
    })),
    ...lines.filter((l) => l.feature.name && visibleNow(l.feature)).map(({ feature }) => ({
      name: feature.name,
      sub: () => `${featureDoc.kinds[feature.kind]?.label ?? feature.kind} · ${bookLabel(feature.since)}`,
      go: () => focusOn({ bounds: pointsBounds(feature.points) }, () => showFeature(feature)),
    })),
    ...eventLayers.filter((e) => eventRevealed(e.item)).map(({ item }) => ({
      name: item.name,
      text: item.text,
      sub: () => `${eventTypes[item.category]?.label ?? item.category} · ${bookLabel(item.since)}`,
      go: () => focusOn(item.points ? { bounds: pointsBounds(item.points) } : { at: item.at, zoom: EVENT_FOCUS_ZOOM[item.scale] ?? 3 }, () => showEvent(item)),
    })),
  ];
}

function rankEntry(entry, q) {
  let rank = Infinity;
  for (const name of [entry.name, ...(entry.aliases ?? [])].map(fold)) {
    if (name === q) rank = Math.min(rank, 0);
    else if (name.startsWith(q)) rank = Math.min(rank, 1);
    else if (` ${name}`.includes(` ${q}`)) rank = Math.min(rank, 2);
    else if (name.includes(q)) rank = Math.min(rank, 3);
  }
  if (rank === Infinity && entry.text && q.length >= 3 && ` ${fold(entry.text)}`.includes(` ${q}`)) rank = 4;
  return rank;
}

function highlighted(el, text, raw) {
  const i = raw ? text.toLowerCase().indexOf(raw.toLowerCase()) : -1;
  if (i < 0) return el.append(text);
  const mark = document.createElement("mark");
  mark.textContent = text.slice(i, i + raw.length);
  el.append(text.slice(0, i), mark, text.slice(i + raw.length));
}

function snippet(text, raw) {
  const i = text.toLowerCase().indexOf(raw.toLowerCase());
  if (i < 0) return null;
  const start = Math.max(text.lastIndexOf(" ", Math.max(i - 50, 0)) + 1, 0);
  const end = text.indexOf(" ", i + raw.length + 60);
  return `${start > 0 ? "\u2026" : ""}${text.slice(start, end < 0 ? undefined : end)}${end < 0 ? "" : "\u2026"}`;
}

function setSearchActive(i, scroll = false) {
  searchActive = i;
  searchList.querySelectorAll("li[role=option]").forEach((li, j) => {
    li.classList.toggle("active", j === i);
    li.setAttribute("aria-selected", String(j === i));
    if (j === i) {
      searchInput.setAttribute("aria-activedescendant", li.id);
      if (scroll) li.scrollIntoView({ block: "nearest" });
    }
  });
}

function closeSearch() {
  searchList.hidden = true;
  searchInput.setAttribute("aria-expanded", "false");
  searchInput.removeAttribute("aria-activedescendant");
}

function runSearch() {
  const raw = searchInput.value.trim();
  const q = fold(raw);
  if (!q) return closeSearch();
  const seen = new Set();
  searchResults = searchEntries()
    .map((entry) => ({ entry, rank: rankEntry(entry, q) }))
    .filter((r) => r.rank < Infinity)
    .sort((a, b) => a.rank - b.rank || a.entry.name.length - b.entry.name.length || a.entry.name.localeCompare(b.entry.name))
    .filter(({ entry }) => {
      const key = `${entry.name}|${entry.sub()}`;
      return !seen.has(key) && seen.add(key);
    })
    .slice(0, SEARCH_LIMIT);
  const items = searchResults.map(({ entry, rank }, i) => {
    const li = document.createElement("li");
    li.id = `search-opt-${i}`;
    li.role = "option";
    const name = document.createElement("strong");
    highlighted(name, entry.name, raw);
    const sub = document.createElement("small");
    sub.textContent = entry.sub();
    li.append(name, sub);
    const excerpt = rank === 4 && snippet(entry.text, raw);
    if (excerpt) {
      const p = document.createElement("p");
      highlighted(p, excerpt, raw);
      li.append(p);
    }
    li.addEventListener("pointerdown", (e) => e.preventDefault());
    li.addEventListener("click", () => chooseSearch(i));
    li.addEventListener("pointermove", () => searchActive !== i && setSearchActive(i));
    return li;
  });
  if (!items.length) {
    const li = document.createElement("li");
    li.className = "search-empty";
    li.textContent = "Nothing found";
    items.push(li);
  }
  searchList.replaceChildren(...items);
  searchList.scrollTop = 0;
  searchList.hidden = false;
  searchInput.setAttribute("aria-expanded", "true");
  setSearchActive(0);
}

function chooseSearch(i) {
  const result = searchResults[i];
  if (!result) return;
  closeSearch();
  searchInput.blur();
  result.entry.go();
}

searchInput.addEventListener("input", runSearch);
searchInput.addEventListener("focus", () => searchInput.value.trim() && runSearch());
searchInput.addEventListener("blur", closeSearch);
searchInput.addEventListener("keydown", (e) => {
  const moves = { ArrowDown: searchActive + 1, ArrowUp: searchActive - 1 };
  if (e.key in moves && !searchList.hidden && searchResults.length) {
    e.preventDefault();
    setSearchActive((moves[e.key] + searchResults.length) % searchResults.length, true);
  } else if (e.key === "Enter") {
    e.preventDefault();
    chooseSearch(searchActive);
  } else if (e.key === "Escape") {
    e.preventDefault();
    if (!searchList.hidden) closeSearch();
    else {
      searchInput.value = "";
      searchInput.blur();
    }
  }
});

onBookChange((n) => {
  closeSearch();
  syncBookPicker(n);
  buildLayerPanel();
  refresh();
});

buildLayerPanel();
buildLines();
refresh();
$("#zoom").textContent = map.getZoom().toFixed(1);
$("#loading").hidden = true;

window.anyar = { map, world, vectors, featureDoc, regionAt, toLatLng, fromLatLng };
