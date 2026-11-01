---
name: map-book-events
description: Read one Destiny's Crucible book from books/ and add its map-worthy events to the Anyar map (src/events.json), plus fix any spoiler gating the book changes (renames, new infrastructure). Use when the user asks to process, peruse, or add events for a specific book.
---

# Map events for one book

Scripts live in `.claude/skills/map-book-events/scripts/`. Run them from the project root. Use the session scratchpad for working files.

## 1. Extract the book

```
python3 .claude/skills/map-book-events/scripts/epub_chunks.py books/<file>.epub <scratch>/b<N>
```

The script prints the series number it found (title pages say "Book N"), the word count, and roughly 32k-word chunk files. Confirm the number against the user's request. Series order: 1 Cast Under an Alien Sun, 2 The Pen and the Sword, 3 Heavier Than a Mountain, 4 Forged in Fire, 5 Tales of Anyar, 6 Passages, 7 A Dubious Peace, 8 A Fearful Symmetry, 9 A Many-Threaded Tapestry. Book 10 is not in `books/` because the user is still reading it. Never add anything from it.

## 2. Read every chunk in parallel

Launch one general-purpose agent per chunk in a single message. Pass `model: "sonnet"` on each Agent call. Each must read its whole chunk with Read, not grep. Prompt:

> Read all of `<chunk path>` (part K of M of Destiny's Crucible book N). It feeds a fantasy map. List:
> 1. Events: each notable thing that happens at an identifiable place (battles, raids, landings, conquests, sieges, treaties, conclaves, founding or destruction of towns, abbeys, mines, factories, discoveries, deaths of major figures, voyages). For each: what happened, where, when in the story (chapter), and every spatial clue quoted in short phrases (distances, directions, travel times, adjacency, coast/inland).
> 2. Map-state changes: places renamed, clans or provinces merged, created or destroyed, new towns, borders moved, infrastructure begun or completed (roads, rail, telegraph, semaphore, ports, mills), with the quote that dates it.
> 3. New world-scale facts about other continents and nations (who conquered whom, routes between continents).
> Mark anything inferred as inferred. Be compact.

Do not read the chunks yourself while agents run.

## 3. Choose entries with the user

Merge the reports into one chronological list. Show it to the user as: name, category, place, one-line summary, and how confident the location is. Ask which to keep before writing anything. Keep only events tied to a place; skip character moments with no geography.

Categories come from `categories` in `src/events.json`:
battle, raid, base, politics, industry, story, geography, sea, voyage (routes only). A new category needs an entry there and a glyph in `EVENT_GLYPHS` in `src/main.js`. Propose it to the user first.

## 4. Place each entry

Coordinates are world units (1600 x 671). Place entries relative to existing cities in `src/world.json` `places` and check them with `where`/`snap` first. Look at a source map image only when that can't resolve a spot, and crop it to the area first instead of viewing the whole image:

```
sips -c <h> <w> --cropOffset <y> <x> <image> --out <scratch>/crop.jpg
```

Add the crop offset back to positions read from the crop, then convert them:

- Caedellium: `assets/Caedellium-provinces-Trevor-Doolin-scaled.jpg` (layer `caedellium`, 1600 x 1200). Scale is about 300 px per 100 miles.
- World: `assets/Anyar-land-masses-scaled.jpg` (layer `landmasses`, 1600 x 1286).
- Other layers are in `src/layers.json`. Check each layer's `since` so you don't use a map from a later book.

```
python3 .claude/skills/map-book-events/scripts/place.py world <layer> <px> <py>
python3 .claude/skills/map-book-events/scripts/place.py where <x> <y>
python3 .claude/skills/map-book-events/scripts/place.py snap <x> <y> <province or nation>
```

`where` returns the province or nation at a point, or `sea`. `snap` moves a point to the nearest spot well inside the named region. Use it for coastal places, which otherwise land in the water. Existing city coordinates are in `src/world.json` under `places`. Offset new markers slightly from a city label rather than stacking on it.

Routes must stay at sea. Check every waypoint with `where`, and end at a port.

## 5. Write the entries

Put the new entries in `<scratch>/b<N>-events.json` as a list:

```json
{"id": "b2-slug", "name": "Short name", "since": 2, "category": "raid", "scale": "island",
 "at": {"layer": "caedellium", "px": [1114, 869]}, "snap": "Keelan",
 "text": "What happened, in 2-4 plain sentences."}
```

- `at` is a world `[x, y]` or `{"layer", "px"}`. `snap` and `expect` (a region name prefix) are checked, then dropped.
- `scale`: `island` for Caedellium (shown from zoom 3), `world` for everything else.
- Routes use `points` (same point forms) and optional `"inferred": true` instead of `at` and `scale`.
- ids are `b<N>-<slug>`. `since` is the book whose reading reveals the entry. Book 0 is reserved for book 1's opening chapters.
- Text must not reveal anything past book N. If a location is a guess, say "Location is approximate." in the text.

```
python3 .claude/skills/map-book-events/scripts/merge_events.py <scratch>/b<N>-events.json --dry-run
python3 .claude/skills/map-book-events/scripts/merge_events.py <scratch>/b<N>-events.json
```

It refuses to write on an unknown category, a duplicate id (`--replace` updates an entry), or a point outside its `snap`/`expect` region. Fix the cause; use `--force` only for points that really belong at sea.

## 6. Apply map-state changes

Use the agents' map-state list:

- A rename: add `formerNames: [{ name, until: N, note }]` to the province in `src/data.js` `PROVINCES` and in `src/world.json` (compact JSON, patch the string). `note` is shown on the province panel from book N onward. Brell/Eywell is the example.
- New infrastructure in `src/features.json`: set `since` to the first book where it exists (or is shown complete, if the user prefers), and `until` if it is later removed.
- A place, label or map that appears too early: fix its `since` in `src/world.json` / `src/data.js`.


## 7. Verify

Run `node --check src/main.js` if code changed. Then open the dev server (`npm run serve`, port 8642) in the browser. Hard-reload (cmd+shift+r), because the server lets the browser cache JSON. Check:

- at book N-1 the new entries are hidden, and at book N they show
- every new marker is on the intended spot (check island markers at zoom 6 or higher). Take one screenshot per area with new markers rather than one per marker.
- the event panels open with the right subtitle

Afterwards, put the user's book setting back the way it was.
