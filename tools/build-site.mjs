import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "dist");
const PAGES = ["index.html", "src/main.js", "src/data.js", "src/spoilers.js", "src/geo.js", "src/landing.js"];
const DATA = ["src/world.json", "src/vectors.json", "src/features.json", "src/events.json", "src/minerals.json"];
const DIRS = ["assets/covers", "assets/books", "assets/icons", "assets/fonts"];
const STATIC = ["_headers"];
const ROOT_FILES = ["favicon.ico"];

fs.rmSync(OUT, { recursive: true, force: true });
const copy = (rel) => {
  const from = path.join(ROOT, rel);
  if (!fs.existsSync(from)) throw new Error(`missing ${rel}`);
  fs.cpSync(from, path.join(OUT, rel), { recursive: true });
};

const referenced = new Set();
for (const file of PAGES) {
  for (const [ref] of fs.readFileSync(path.join(ROOT, file), "utf8").matchAll(/assets\/[\w./+-]+\.(?:jpe?g|png|webp|svg|ico|pdf)/g)) {
    if (!DIRS.some((d) => ref.startsWith(`${d}/`))) referenced.add(ref);
  }
}

for (const rel of [...PAGES, ...DATA, ...DIRS, ...ROOT_FILES, ...referenced]) copy(rel);
for (const rel of STATIC) fs.cpSync(path.join(ROOT, "deploy", rel), path.join(OUT, rel));

let bytes = 0, files = 0;
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else {
      bytes += fs.statSync(p).size;
      files++;
    }
  }
};
walk(OUT);
console.log(`dist: ${files} files, ${(bytes / 1048576).toFixed(1)} MB`);
