import { PROVINCES as CAEDELLIUM_PROVINCES, CITIES as CAEDELLIUM_CITIES } from "../src/data.js";

export const COAST_ORDER = ["landmasses", "melosia", "narthon", "iraquinik", "landolin", "caedellium"];

export const NATION_SOURCE = {
  layer: "landmasses",
  wallLum: 110,
  wallDilate: 4,
  wallIgnore: [[0, 258, 1600, 284], [0, 1080, 1600, 1102]],
  regions: [
    { key: "caedellium", name: "Caedellium", continent: "Caedellium", seeds: [[52, 590]] },
    { key: "narthon", name: "Narthon Empire", continent: "Melosia", seeds: [[805, 495]] },
    { key: "iraquinik", name: "Iraquinik Confederation", continent: "Melosia", seeds: [[430, 575], [420, 450]] },
    { key: "harrasedic", name: "Harrasedic League", continent: "Melosia", seeds: [[1255, 505]] },
    { key: "fuomon", name: "Fuomon", continent: "Melosia", seeds: [[1030, 648]] },
    { key: "krinolin", name: "Krinolin", continent: "Krinolin", seeds: [[1510, 520]] },
    { key: "naskin", name: "Naskin", continent: "Landolin", seeds: [[215, 640]] },
    { key: "mureet", name: "Mureet", continent: "Landolin", seeds: [[277, 690]] },
    { key: "munjor", name: "Munjor", continent: "Landolin", seeds: [[263, 755]] },
    { key: "panhan", name: "Panhan", continent: "Landolin", seeds: [[187, 802]] },
    { key: "jahmnor", name: "Jahmnor", continent: "Landolin", seeds: [[272, 862]] },
    { key: "amalor", name: "Amalor", continent: "Landolin", seeds: [[350, 795]], searchRadius: 6 },
    { key: "buldor", name: "Buldor", continent: "Ganolar", seeds: [[465, 935]] },
    { key: "ilskin", name: "Ilskin", continent: "Ganolar", seeds: [[372, 1012]] },
    { key: "sulako", name: "Sulako", continent: "Ganolar", seeds: [[548, 983]] },
    { key: "rustal", name: "Rustal", continent: "Ganolar", seeds: [[755, 986]] },
    { key: "rumspas", name: "Rumspas", continent: "Drilmar", seeds: [[1060, 960]] },
    { key: "tekleum", name: "Tekleum", continent: "Drilmar", seeds: [[1140, 965]] },
    { key: "novaryn", name: "Novaryn", continent: "Drilmar", seeds: [[1208, 935]] },
    { key: "frangel", name: "Frangel", continent: "Drilmar", seeds: [[1355, 935]] },
    { key: "madyrna", name: "Madyrna", continent: "Drilmar", seeds: [[1460, 952]] },
    { key: "surikor", name: "Surikor", continent: "Throat", seeds: [[915, 858]] },
  ],
};

const named = (list, extra = {}, ties = {}) =>
  list.map(([name, x, y]) => ({ name, seeds: [[x, y], ...(extra[name] ?? [])], ...(ties[name] && { ties: ties[name] }) }));

export const PROVINCE_SOURCES = [
  {
    layer: "melosia",
    nation: "harrasedic",
    since: 8,
    wallLum: 110,
    wallDilate: 1,
    regions: named([
      ["Voljunda", 1043, 510], ["Kuresin", 1163, 497], ["Javarkandi", 1425, 521], ["Pultsoma", 1278, 546],
      ["Polva", 1095, 598], ["Astonin", 1155, 609], ["Parnum", 1418, 609], ["Tursala", 1268, 647],
      ["Rakinin", 1365, 663], ["Jovni", 1127, 697], ["Koresar", 1205, 692], ["Torva", 1500, 698],
      ["Karasar", 1315, 742], ["Sondinin", 1505, 741], ["Untsla", 1315, 774], ["Luvalsar", 1394, 788],
      ["Jojovan", 1478, 788], ["Lomaskal", 1480, 884],
    ]),
  },
  {
    layer: "narthon",
    nation: "narthon",
    since: 1,
    wallLum: 110,
    wallDilate: 3,
    regions: named([
      ["Territory West", 320, 140], ["Territory North", 790, 355], ["Territory East", 1195, 460],
      ["Usak", 400, 672], ["Akatir", 775, 705], ["Dunzali", 575, 920], ["Ezirlufa", 357, 972],
      ["Morzin", 412, 1165], ["Udaban", 610, 1070], ["Edana", 828, 1088], ["Sirnik", 935, 903],
      ["Osmuya", 1005, 1015], ["Harket", 1178, 830], ["Korinshir", 1348, 793], ["Azmir", 1360, 585],
      ["Bineltep", 868, 1295],
    ]),
  },
  {
    layer: "iraquinik",
    nation: "iraquinik",
    since: 1,
    wallLum: 90,
    wallDilate: 1,
    wallLines: [
      [[616, 866], [636, 867], [646, 871], [653, 876], [659, 880], [663, 885]],
      [[642, 911], [635, 917], [629, 927]],
      [[604, 983], [596, 988], [588, 991], [579, 992]],
      [[460, 1281], [472, 1294], [482, 1304], [493, 1316]],
      [[503, 1333], [508, 1343], [509, 1360], [504, 1377], [493, 1386], [477, 1384], [465, 1379]],
      [[458, 1539], [468, 1547], [477, 1555], [490, 1570], [502, 1577]],
      [[528, 1794], [551, 1791], [573, 1792], [594, 1793], [614, 1791]],
      [[616, 1868], [613, 1885], [612, 1900], [614, 1918], [617, 1945]],
    ],
    regions: named([
      ["Abaton", 868, 381], ["Kolinka", 550, 608], ["Ponomyna", 412, 870], ["Mukamon", 781, 960],
      ["Waswagon", 804, 1187], ["Aro", 407, 1308], ["Gympo", 538, 1357], ["Onkermino", 819, 1408],
      ["Sensarsha", 579, 1514], ["Tasawak", 512, 1713], ["Kiker", 855, 1764], ["Sonet", 461, 1933],
      ["Monikan", 576, 1997], ["Nashton", 435, 2099], ["Powantik", 870, 2140], ["Irapah", 621, 2332],
      ["Hawsa", 783, 2368], ["Agala", 957, 2391], ["Wokryn", 1229, 2278],
    ], {
      Ponomyna: [[220, 1053, 6]],
      Aro: [[173, 1180, 6], [223, 1233, 6], [127, 1300, 6]],
      Gympo: [[117, 1360, 6], [70, 1473, 6]],
    }, {
      Ponomyna: [[[250, 1027], [293, 990]]],
      Aro: [[[200, 1161], [287, 1195]], [[240, 1233], [287, 1237]], [[153, 1317], [287, 1288]]],
      Gympo: [[[150, 1370], [327, 1417]], [[107, 1459], [333, 1453]]],
    }),
  },
  {
    layer: "caedellium",
    nation: "caedellium",
    since: 1,
    complete: true,
    fillAll: true,
    wallLum: 95,
    wallDilate: 1,
    regions: CAEDELLIUM_PROVINCES.map((p) => ({ name: p.name, seeds: p.seeds, formerNames: p.formerNames })),
  },
];

const pts = (layer, since, kind, list) => list.map(([name, x, y]) => ({ layer, since, kind, name, x, y }));

export const CITIES = [
  ...pts("landmasses", 1, "city", [
    ["Ezarkin", 519, 321], ["Usmaya", 800, 676], ["Kahmo", 1102, 707], ["Bandapara", 553, 862],
    ["Iskadon", 636, 950], ["Orano", 805, 1017], ["Kruplin", 1132, 878], ["Heliom", 1051, 978],
    ["Baernton", 1258, 880], ["Dawlber", 1225, 951], ["Tregallon", 1350, 870], ["Caledon", 1336, 886],
    ["Landylbury", 1407, 915], ["Brawsea", 1403, 856], ["Nurburt", 1356, 958], ["White Mountain", 1377, 1007],
  ]),
  ...pts("melosia", 8, "city", [
    ["Onunza", 68, 474], ["Chikawan", 196, 509], ["Shistar", 233, 545], ["Penabak", 154, 567],
    ["Kweslon", 106, 642], ["Pulamur", 511, 806], ["Kustal", 603, 792], ["Balaseer", 606, 848],
    ["Esrohir", 779, 749], ["Ordum", 846, 720], ["Gupidir", 916, 684], ["Dinzlon", 976, 598],
  ]),
  ...pts("landolin", 9, "city", [
    ["Silata", 606, 179], ["Gordapad", 870, 643], ["Samlor", 881, 1004], ["Nandapura", 137, 1177],
    ["Morzipor", 822, 1470], ["Kolchuree", 995, 1806], ["Purdom", 1304, 1348],
  ]),
  ...CAEDELLIUM_CITIES.map((c) => ({
    layer: "caedellium",
    since: c.since ?? 1,
    kind: c.kind === "national" ? "capital" : c.kind === "capital" ? "city" : "town",
    name: c.name,
    x: c.pixel[0],
    y: c.pixel[1],
  })),
];

export const WORLD_PLACES = [
  { layer: "melosia", since: 8, kind: "town", name: "Tormkee", x: 513.0, y: 240.5 },
  { layer: "landolin", since: 9, kind: "city", name: "Bawfa", x: 180.3, y: 350.6 },
  { layer: "landolin", since: 9, kind: "town", name: "Balabad", x: 185.2, y: 375.0 },
  { layer: "landolin", since: 9, kind: "town", name: "Ruvati", x: 190.1, y: 374.2 },
];

export const LAND_FILLS = [{ name: "Ezarkin bay remnant", seeds: [[272.5, 150]], maxCells: 400 }];

export const LAKES = [
  { name: "Shawsoon Sea", layer: "iraquinik", seeds: [[987, 621]], wallLum: 85, maxSat: 26 },
  { name: "Bumtee Sea", layer: "iraquinik", seeds: [[987, 1021]], wallLum: 85, maxSat: 26 },
];

export const SEAS = [
  ...pts("landmasses", 1, "sea", [
    ["The Throat", 1000, 812], ["Analian Sea", 855, 705], ["Gulf of Numara", 915, 645], ["Timbar Sea", 1280, 915],
  ]),
  ...pts("melosia", 8, "sea", [
    ["Hilmamin Sea", 970, 293], ["Rudipar Sea", 50, 810], ["Nohwark Sea", 120, 607], ["Gulf of Selucian", 1080, 715],
  ]),
  ...pts("iraquinik", 8, "sea", [["Shawsoon Sea", 987, 621], ["Bumtee Sea", 987, 1021]]),
  ...pts("world", 1, "sea", [["Great Ocean", 1250, 295]]),
  ...pts("caedellium", 1, "sea", [["Gulf of Normot", 1215, 540], ["Gulf of Witlow", 885, 870]]),
  ...pts("caedellium", 4, "sea", [["Normot Gap", 1285, 600]]),
  ...pts("caedellium", 5, "sea", [["Gulf of Beedo", 1215, 300], ["Gulf of Kurvak", 1395, 345]]),
  ...pts("caedellium", 7, "sea", [["Seaborn Strait", 393, 330]]),
  ...pts("caedellium", 4, "landmark", [["Klinwyn Island", 640, 828], ["East Head Point", 1440, 965]]),
];

const GREAT_OCEAN_SCALE = 1600 / 1186;
const MURVOR_SCALE = 0.0232 * GREAT_OCEAN_SCALE;
const MURVOR_ANCHOR = { image: [330, 260], world: [915 * GREAT_OCEAN_SCALE, 278 * GREAT_OCEAN_SCALE] };
const murvorToWorld = ([x, y]) => [
  MURVOR_ANCHOR.world[0] + (x - MURVOR_ANCHOR.image[0]) * MURVOR_SCALE,
  MURVOR_ANCHOR.world[1] + (y - MURVOR_ANCHOR.image[1]) * MURVOR_SCALE,
];

export const OCEAN_ISLANDS = {
  clear: [790, 60, 1600, 590],
  sources: [
    {
      file: "assets/books/b8/great-ocean.jpg",
      upsample: 8,
      isLand: (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b < 130,
      fillHoles: true,
      close: 3,
      boxes: [
        [828, 69, 842, 82], [940, 48, 956, 70], [975, 84, 985, 94], [686, 155, 705, 190],
        [1068, 260, 1078, 274], [1030, 378, 1046, 396], [728, 406, 746, 424],
      ],
      toWorld: ([x, y]) => [x * GREAT_OCEAN_SCALE, y * GREAT_OCEAN_SCALE],
      smooth: { radius: 4, passes: 2, tol: 1, minArea: 40 },
    },
    {
      file: "assets/books/b8/murvor-islands.jpg",
      upsample: 1,
      isLand: (r, g, b) => (r - b > 40 && r > g + 15) || (r > 180 && g > 150 && b < 90),
      forceLand: [[340, 222, 470, 262]],
      close: 4,
      boxes: [[150, 140, 1400, 1020]],
      toWorld: murvorToWorld,
      smooth: { radius: 3, passes: 2, tol: 1.5, minArea: 80 },
    },
  ],
};

const murvorPts = (since, kind, list) =>
  list.map(([name, x, y]) => {
    const [wx, wy] = murvorToWorld([x, y]);
    return { layer: "murvor", since, kind, name, x: wx, y: wy };
  });

export const ISLANDS = [
  ...pts("world", 8, "landmark", [
    ["Pugila Islands", 1302, 98], ["Araucana Islands", 940, 261], ["Murvor Islands", 1232, 399], ["Forntak Islands", 1448.5, 373],
  ]),
  ...pts("murvor", 8, "landmark", [["Brunda", 1234.5, 379.5]]),
  ...pts("murvor", 8, "island", [
    ["Pumra", 1241.3, 374], ["Jiskel", 1243.1, 379.2], ["Lomaa", 1252.6, 385.6],
    ["Torkur", 1251.5, 389], ["Muselako", 1260.4, 393.1], ["Ramsula", 1266.8, 396.8],
  ]),
  ...murvorPts(8, "town", [["Eurako", 368, 265]]),
];
