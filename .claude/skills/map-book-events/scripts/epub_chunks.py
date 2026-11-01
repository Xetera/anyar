import argparse
import html.parser
import pathlib
import posixpath
import re
import xml.etree.ElementTree as ET
import zipfile

WORDS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12}
BLOCKS = {"p", "div", "br", "h1", "h2", "h3", "h4", "h5", "h6", "li", "tr", "blockquote", "section"}


class Text(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.skip += 1
        if tag in BLOCKS:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skip -= 1
        if tag in BLOCKS:
            self.parts.append("\n")

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)


def spine_text(epub):
    z = zipfile.ZipFile(epub)
    container = ET.fromstring(z.read("META-INF/container.xml"))
    opf_path = next(e.get("full-path") for e in container.iter() if e.tag.endswith("rootfile"))
    opf = ET.fromstring(z.read(opf_path))
    base = posixpath.dirname(opf_path)
    manifest = {e.get("id"): e.get("href") for e in opf.iter() if e.tag.endswith("item")}
    out = []
    for ref in (e for e in opf.iter() if e.tag.endswith("itemref")):
        href = manifest.get(ref.get("idref"))
        if not href or not re.search(r"\.x?html?$", href):
            continue
        p = Text()
        p.feed(z.read(posixpath.normpath(posixpath.join(base, href))).decode("utf-8", "replace"))
        out.append("".join(p.parts))
    text = "\n".join(out)
    text = re.sub(r"[ \t\xa0]+", " ", text)
    return re.sub(r"\n\s*\n+", "\n\n", text).strip()


def book_number(text):
    m = re.search(r"\bbook\s+(\d+|" + "|".join(WORDS) + r")\b", text[:30000], re.I)
    if not m:
        return None
    v = m.group(1).lower()
    return int(v) if v.isdigit() else WORDS[v]


def chunk(text, n):
    paras = text.split("\n\n")
    total = sum(len(p.split()) for p in paras)
    target = total / n
    chunks, cur, count = [], [], 0
    for p in paras:
        cur.append(p)
        count += len(p.split())
        if count >= target and len(chunks) < n - 1:
            chunks.append("\n\n".join(cur))
            cur, count = [], 0
    chunks.append("\n\n".join(cur))
    return chunks, total


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("epub")
    ap.add_argument("outdir")
    ap.add_argument("--words-per-chunk", type=int, default=32000)
    args = ap.parse_args()
    text = spine_text(args.epub)
    out = pathlib.Path(args.outdir)
    out.mkdir(parents=True, exist_ok=True)
    (out / "full.txt").write_text(text)
    n = max(1, round(len(text.split()) / args.words_per_chunk))
    chunks, total = chunk(text, n)
    print(f"book: {book_number(text)}")
    print(f"words: {total}")
    for i, c in enumerate(chunks):
        path = out / f"chunk_{i:02d}.txt"
        path.write_text(c)
        print(f"{path} {len(c.split())} words")


main()
