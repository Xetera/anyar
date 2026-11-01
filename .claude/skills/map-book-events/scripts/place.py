import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[4]
_cache = {}


def _load(name):
    if name not in _cache:
        _cache[name] = json.loads((ROOT / "src" / name).read_text())
    return _cache[name]


def to_world(layer, px, py):
    l = next((l for l in _load("layers.json") if l["id"] == layer), None)
    if l is None:
        raise SystemExit(f"unknown layer {layer!r}; choose from {[l['id'] for l in _load('layers.json')]}")
    nx, ny = px / l["width"] * 2 - 1, py / l["height"] * 2 - 1
    b = [1, nx, ny, nx * nx, nx * ny, ny * ny]
    return [round(sum(c * v for c, v in zip(l["x"], b)), 2), round(sum(c * v for c, v in zip(l["y"], b)), 2)]


def _in_ring(px, py, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > py) != (yj > py) and px < (xj - xi) * (py - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def _in_polygons(px, py, polygons):
    return any(_in_ring(px, py, outer) and not any(_in_ring(px, py, h) for h in holes) for outer, *holes in polygons)


def region_at(x, y):
    world, vectors = _load("world.json"), _load("vectors.json")
    provinces = {p["id"]: p for p in world["provinces"]}
    nations = {n["id"]: n for n in world["nations"]}
    for v in vectors["provinces"]:
        if _in_polygons(x, y, v["polygons"]):
            p = provinces[v["id"]]
            return f"{p['name']} ({nations[p['nation']]['name']})"
    for v in vectors["nations"]:
        if _in_polygons(x, y, v["polygons"]):
            return nations[v["id"]]["name"]
    return "sea"


def _region_polygons(name):
    world, vectors = _load("world.json"), _load("vectors.json")
    for kind in ("provinces", "nations"):
        ids = {r["id"] for r in world[kind] if r["name"].lower() == name.lower()}
        polys = [p for v in vectors[kind] if v["id"] in ids for p in v["polygons"]]
        if polys:
            return polys
    raise SystemExit(f"no province or nation named {name!r}")


def snap(x, y, name, step=None, inset=None, radius=60):
    polys = _region_polygons(name)
    span = max(max(px for ring in p for px, _ in ring) - min(px for ring in p for px, _ in ring) for p in polys)
    step = step or span / 400
    inset = inset or step * 2
    offsets = sorted(((dx, dy) for dx in range(-radius, radius + 1) for dy in range(-radius, radius + 1)), key=lambda d: d[0] ** 2 + d[1] ** 2)
    for dx, dy in offsets:
        px, py = x + dx * step, y + dy * step
        if all(_in_polygons(px + a, py + b, polys) for a, b in ((0, 0), (inset, 0), (-inset, 0), (0, inset), (0, -inset))):
            return [round(px, 2), round(py, 2)]
    return None


def resolve(point):
    if isinstance(point, dict):
        return to_world(point["layer"], *point["px"])
    return [round(point[0], 2), round(point[1], 2)]


if __name__ == "__main__":
    cmd, *rest = sys.argv[1:] or ["help"]
    if cmd == "world":
        x, y = to_world(rest[0], float(rest[1]), float(rest[2]))
        print(json.dumps([x, y]), region_at(x, y))
    elif cmd == "where":
        print(region_at(float(rest[0]), float(rest[1])))
    elif cmd == "snap":
        p = snap(float(rest[0]), float(rest[1]), " ".join(rest[2:]))
        print(json.dumps(p), region_at(*p) if p else "no point found within search radius")
    else:
        print("usage: place.py world <layer> <px> <py> | place.py where <x> <y> | place.py snap <x> <y> <province or nation>")
