import argparse
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from place import ROOT, region_at, resolve, snap

EVENTS = ROOT / "src" / "events.json"
ITEM_KEYS = ["id", "name", "scale", "at", "text", "since", "category"]
ROUTE_KEYS = ["id", "name", "since", "inferred", "points", "text", "category"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("entries")
    ap.add_argument("--replace", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    doc = json.loads(EVENTS.read_text())
    new = json.loads(pathlib.Path(args.entries).read_text())
    known = {e["id"] for e in doc["items"] + doc["routes"]}
    problems = []

    for e in new:
        tag = e.get("id", "?")
        for key in ("id", "name", "since", "category", "text"):
            if e.get(key) in (None, ""):
                problems.append(f"{tag}: missing {key}")
        if e.get("category") not in doc["categories"]:
            problems.append(f"{tag}: unknown category {e.get('category')!r}")
        if e.get("id") in known and not args.replace:
            problems.append(f"{tag}: id already exists (use --replace)")
        if "points" in e:
            e["points"] = [resolve(p) for p in e["points"]]
            e.setdefault("inferred", False)
            print(f"route {tag}: {len(e['points'])} points, {region_at(*e['points'][0])} -> {region_at(*e['points'][-1])}")
        else:
            if "at" not in e:
                problems.append(f"{tag}: needs at or points")
                continue
            e["at"] = resolve(e["at"])
            target = e.pop("snap", None)
            if target:
                snapped = snap(*e["at"], target)
                if snapped is None:
                    problems.append(f"{tag}: could not snap into {target}")
                else:
                    e["at"] = snapped
                    e.setdefault("expect", target)
            if e.get("scale") not in ("island", "world"):
                problems.append(f"{tag}: scale must be island or world")
            where = region_at(*e["at"])
            expect = e.pop("expect", None)
            flag = ""
            if expect and not where.lower().startswith(expect.lower()):
                flag = f"  <-- expected {expect}"
                problems.append(f"{tag}: lands in {where}, expected {expect}")
            print(f"item {tag}: {e['at']} {where}{flag}")

    if problems and not args.force:
        print("\n".join(["", "not written:"] + problems))
        sys.exit(1)
    if args.dry_run:
        print("dry run, nothing written")
        return

    for e in new:
        e.pop("expect", None)
        e.pop("snap", None)
        bucket = doc["routes"] if "points" in e else doc["items"]
        keys = ROUTE_KEYS if "points" in e else ITEM_KEYS
        entry = {k: e[k] for k in keys if k in e} | {k: v for k, v in e.items() if k not in keys}
        existing = next((i for i, x in enumerate(bucket) if x["id"] == e["id"]), None)
        if existing is None:
            bucket.append(entry)
        else:
            bucket[existing] = entry
    for bucket in (doc["items"], doc["routes"]):
        bucket.sort(key=lambda x: x["since"])
    EVENTS.write_text(json.dumps(doc, indent=2) + "\n")
    print(f"wrote {len(new)} entries to {EVENTS}")


main()
