export const MAP_SOURCE = "https://olanthorensen.com/free-stuff/";

export const BOOK_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export const BOOK_TITLES = {
  1: "Cast Under an Alien Sun",
  2: "The Pen and the Sword",
  3: "Heavier Than a Mountain",
  4: "Forged in Fire",
  5: "Tales of Anyar",
  6: "Passages",
  7: "A Dubious Peace",
  8: "A Fearful Symmetry",
  9: "A Many-Threaded Tapestry",
};

export const bookCover = (n) => `assets/covers/book-${Math.max(n, 1)}.webp`;

export const TIER_LABELS = { 1: "Books 1–4", 5: "Books 5–7", 7: "Book 7", 8: "Book 8", 9: "Book 9" };

const REMOTE = "https://olanthorensen.com/wp-content/uploads/2024/12/";

const M = {
  caedelliumProvinces: { title: "Caedellium provinces", url: "assets/Caedellium-provinces-Trevor-Doolin-scaled.jpg", since: 1 },
  narthon: { title: "Narthon", url: "assets/Narthon-scaled.jpg", since: 1 },
  iraquinik: { title: "Iraquinik Confederation", url: "assets/Iraquinik-Doolin-scaled.jpg", since: 1 },
  southernCaedellium: { title: "Southern Caedellium", url: "assets/Southern-Caedellium-Trevor-Doolin.jpg", since: 5 },
  caedelliumPdf: { title: "Caedellium map (PDF)", url: REMOTE + "Caedellium-map-5May2021-c.pdf", since: 5, pdf: true },
  caedelliumMineral: { title: "Caedellium mineral map (PDF)", url: REMOTE + "Caedellium-mineral-Map-3May2021.pdf", since: 5, pdf: true },
  narthonExpansion: { title: "Narthon expansion (PDF)", url: REMOTE + "Narthon-expansion-4May2021.pdf", since: 7, pdf: true },
  seabornIslands: { title: "Seaborn Islands (PDF)", url: REMOTE + "Seaborn-Islands-3May2021-2-1.pdf", since: 5, pdf: true },
  seabornSouth: { title: "Seaborn South Island (PDF)", url: REMOTE + "Seaborn-South-Island-7-1.pdf", since: 5, pdf: true },
  melosia: { title: "Melosia", url: "assets/Melosia-scaled.jpg", since: 8 },
  caedelliumBook8: { title: "Caedellium (PDF)", url: REMOTE + "Caedellium.pdf", since: 8, pdf: true },
  melosiaBorders: { title: "Melosia with borders", url: "assets/Melosia-with-borders-scaled.jpg", since: 9 },
  landolin: { title: "Landolin", url: "assets/Landolin-scaled.jpg", since: 9 },
  caedelliumBook9: { title: "Caedellium", url: "assets/Caedellium-scaled.jpg", since: 9 },
  invasion: { title: "Invasion", url: "assets/Invasion-scaled.jpg", since: 9 },
};

export const MINERAL_SURVEY = M.caedelliumMineral;

const b8 = (file, title) => ({ title, url: `assets/books/b8/${file}.jpg`, since: 8 });
const b9 = (file, title) => ({ title, url: `assets/books/b9/${file}.jpg`, since: 9 });

export const SOURCES = {
  "b8-anyar-castaways": b8("anyar-castaways", "Anyar, castaway landings"),
  "b8-caedellium-rail-telegraph": b8("caedellium-rail-telegraph", "Caedellium rail and telegraph"),
  "b8-melosia": b8("melosia", "Melosia"),
  "b8-northern-iraquiniks": b8("northern-iraquiniks", "Northern Iraquiniks"),
  "b8-harrasedic-attack": b8("harrasedic-attack", "Harrasedic attack and counterattack"),
  "b8-alliance-division": b8("alliance-division", "Alliance 1st Division"),
  "b8-great-ocean": b8("great-ocean", "Great Ocean"),
  "b8-murvor-islands": b8("murvor-islands", "Murvor Islands"),
  "b8-penabak-council": b8("penabak-council", "Penabak council seating"),
  "b8-kolinka-campaign-plan": b8("kolinka-campaign-plan", "Kolinka campaign plan"),
  "b8-alliance-flag": b8("alliance-flag", "Alliance war flag"),
  "b8-march-column": b8("march-column", "Alliance march column"),
  "b8-badlands-deployment": b8("badlands-deployment", "Badlands battle, deployment"),
  "b8-badlands-result": b8("badlands-result", "Badlands battle, outcome"),
  "b8-badlands-approach": b8("badlands-approach", "Approach through the badlands"),
  "b8-chikok-defenses": b8("chikok-defenses", "Chikok River defences"),
  "b8-chikok-assault": b8("chikok-assault", "Chikok River assault"),
  "b9-senate-votes": b9("senate-votes", "Senate votes by province"),
};

export const WORLD_MAP = {
  url: "assets/Anyar-linear-Trevor-Doolin-scaled.jpg",
  width: 1600,
  height: 671,
};

export const NATIONS = [
  {
    id: "caedellium",
    name: "Caedellium",
    region: "Island nation, far west of Melosia",
    pixel: [62, 268],
    text: "A lone island nation in the western ocean, divided into clan provinces. Its national capital is Orosz City.",
    maps: [M.caedelliumProvinces, M.southernCaedellium, M.caedelliumPdf, M.caedelliumMineral, M.seabornIslands, M.seabornSouth, M.caedelliumBook8, M.caedelliumBook9, SOURCES["b9-senate-votes"]],
    descend: true,
  },
  {
    id: "narthon",
    name: "Narthon Empire",
    region: "Melosia",
    pixel: [380, 222],
    text: "The largest realm on the map, it covers the heart of the continent of Melosia from its icy north down to the Analian Sea.",
    maps: [M.narthon, M.narthonExpansion, M.melosia, SOURCES["b8-melosia"], M.melosiaBorders],
  },
  {
    id: "iraquinik",
    name: "Iraquinik Confederation",
    region: "Melosia",
    pixel: [245, 270],
    text: "A long western strip of Melosia that runs along the Narthon frontier and its chain of northern lakes.",
    maps: [M.iraquinik, M.melosia, SOURCES["b8-melosia"], SOURCES["b8-northern-iraquiniks"], M.melosiaBorders],
  },
  {
    id: "harrasedic",
    name: "Harrasedic League",
    region: "Melosia",
    pixel: [610, 232],
    text: "The eastern lobe of Melosia, east of the Narthon Empire, dotted with inland lakes.",
    maps: [M.melosia, SOURCES["b8-melosia"], SOURCES["b8-harrasedic-attack"], M.melosiaBorders],
  },
  {
    id: "fuomon",
    name: "Fuomon",
    region: "Melosia",
    pixel: [505, 300],
    text: "A southern peninsula of Melosia across the Gulf of Numara from Usmaya. It sits on the equator.",
    maps: [M.melosia, M.melosiaBorders],
  },
  {
    id: "krinolin",
    name: "Krinolin",
    region: "Islands east of Melosia",
    pixel: [722, 240],
    text: "A long, narrow island on the far eastern edge of the known continents.",
    maps: [M.melosia, M.melosiaBorders],
  },
  {
    id: "landolin",
    name: "Landolin",
    region: "Continent",
    pixel: [150, 350],
    text: "A continent that straddles the equator, made up of Naskin, Mureet, Munjor, Panhan, Jahmnor and the island of Amalor.",
    maps: [M.landolin, M.invasion],
  },
  {
    id: "sulako",
    name: "Sulako",
    region: "Ganolar",
    pixel: [285, 458],
    text: "The central nation of Ganolar, the southern continent. It borders Ilskin, Buldor and Rustal.",
  },
  {
    id: "rustal",
    name: "Rustal",
    region: "Ganolar",
    pixel: [385, 452],
    text: "The eastern part of Ganolar, a kingdom about the size of Canada.",
  },
  {
    id: "amalor",
    name: "Amalor",
    region: "Landolin",
    pixel: [352, 417],
    text: "An island kingdom off eastern Landolin, culturally related to the continent's five kingdoms. It kept only a small military because of its separation from the rest of Landolin.",
    maps: [M.landolin, M.invasion],
  },
  {
    id: "ilskin",
    name: "Ilskin",
    region: "Ganolar",
    pixel: [185, 485],
    text: "The western tip of Ganolar.",
  },
  {
    id: "drilmar",
    name: "Drilmar",
    region: "Continent",
    pixel: [620, 470],
    text: "A southeastern continent with the Timbar Sea at its centre. It is home to Rumspas, Tekleum, Novaryn, Frangel and Madyrna.",
  },
  {
    id: "surikor",
    name: "Surikor",
    region: "Throat",
    pixel: [462, 396],
    text: "Small islands in the Throat, the strait between Melosia and the southern continents.",
  },
  {
    id: "great-ocean",
    name: "Great Ocean",
    region: "Ocean",
    pixel: [1250, 295],
    text: "The vast ocean that covers the other half of Anyar. Only a few scattered island chains break its surface.",
    kind: "ocean",
  },
];

export const OCCUPATIONS = [
  {
    nation: "rustal",
    by: "narthon",
    since: 1,
    notes: [
      { since: 1, text: "The Narthani built a fleet and conquered Rustal in less than two years. Resistance holds out in the mountains and the colder southern parts of the kingdom." },
      { since: 7, text: "Mark wonders whether Narthon only ever wanted Rustal's coasts and harbors, to close the western Throat." },
    ],
  },
  {
    nation: "amalor",
    by: "narthon",
    since: 6,
    notes: [
      { since: 6, text: "After failing on Caedellium, Narthon landed armies on Amalor. The unprepared Amalorese fell easily, and Narthani troops have since begun moving into allied Jahmnor." },
      { since: 9, text: "The Narthani hold only the center of the island, from the capital Purdom across to the port of Ruvati and perhaps a hundred miles north and south. Amalorese forces withdrew into the mountains that run the length of the island." },
    ],
  },
];

export const CAEDELLIUM_MAP = {
  url: "assets/Caedellium-provinces-Trevor-Doolin-scaled.jpg",
  width: 1600,
  height: 1200,
  exclude: [[0, 600, 470, 1200]],
};

export const PROVINCES = [
  { name: "Swavebroke", capital: "Shullick", seeds: [[625, 272]] },
  { name: "Farkesh", capital: "Devanyo", seeds: [[805, 167]] },
  { name: "Skouks", capital: "Morstryd", seeds: [[1000, 270]] },
  { name: "Nyvaks", capital: "Montron", seeds: [[1323, 235]] },
  { name: "Pewitt", capital: "Penmawr", seeds: [[548, 378]] },
  { name: "Vandinke", capital: "Vandork", seeds: [[773, 340]] },
  { name: "Bultecki", capital: "Cherona", seeds: [[950, 365]] },
  { name: "Pawell", capital: "Hartreth", seeds: [[1230, 369]] },
  { name: "Stent", capital: "Clitwyth", seeds: [[742, 454]] },
  { name: "Adris", capital: "Adris City", seeds: [[1143, 438]] },
  { name: "Orosz", capital: "Orosz City", seeds: [[1030, 523]] },
  { name: "Bevans", capital: "Seapont", seeds: [[1397, 537]] },
  { name: "Moreland", capital: "Moreland City", seeds: [[910, 578]] },
  { name: "Selfcell", capital: "Sellmor", seeds: [[693, 669]] },
  { name: "Brell", capital: "Hanslow", seeds: [[826, 703]], formerNames: [{ name: "Eywell", until: 4, note: "Known as Eywell until Book 4. Eywell sided with the Narthani, and many prominent Eywellese fled when the Narthani withdrew. Afterward the All-Clan Conclave chose Owill Brell, an Adrisian who headed the Military Intelligence Unit, as hetman to rebuild the clan, and it became Clan Brell." }] },
  { name: "Hewell", capital: "Norwyt", seeds: [[1120, 648]] },
  { name: "Keelan", capital: "Caernford", seeds: [[1080, 782]] },
  { name: "Mittack", capital: "Kilporth", seeds: [[1290, 842]] },
  { name: "Preddi", capital: "Preddi City", seeds: [[765, 846]] },
  { name: "Gwillamer", capital: "Strindmar", seeds: [[1000, 960]] },
  { name: "Seaborn", capital: "Brudermyn", seeds: [[210, 220], [300, 320], [260, 420]] },
];

export const CITIES = [
  { name: "Orosz City", pixel: [1018, 487], kind: "national" },
  { name: "Shullick", pixel: [592, 217], kind: "capital" },
  { name: "Devanyo", pixel: [868, 201], kind: "capital" },
  { name: "Morstryd", pixel: [985, 213], kind: "capital" },
  { name: "Montron", pixel: [1294, 271], kind: "capital" },
  { name: "Hartreth", pixel: [1320, 363], kind: "capital" },
  { name: "Vandork", pixel: [842, 360], kind: "capital" },
  { name: "Cherona", pixel: [957, 397], kind: "capital" },
  { name: "Penmawr", pixel: [505, 473], kind: "capital" },
  { name: "Clitwyth", pixel: [750, 488], kind: "capital" },
  { name: "Adris City", pixel: [1175, 480], kind: "capital" },
  { name: "Seapont", pixel: [1409, 491], kind: "capital" },
  { name: "Brudermyn", pixel: [245, 375], kind: "capital" },
  { name: "Norwyt", pixel: [1166, 577], kind: "capital" },
  { name: "Moreland City", pixel: [910, 606], kind: "capital" },
  { name: "Hanslow", pixel: [818, 648], kind: "capital" },
  { name: "Sellmor", pixel: [620, 706], kind: "capital" },
  { name: "Preddi City", pixel: [787, 817], kind: "capital" },
  { name: "Caernford", pixel: [1154, 792], kind: "capital" },
  { name: "Strindmar", pixel: [1052, 919], kind: "capital" },
  { name: "Kilporth", pixel: [1246, 920], kind: "capital" },
  { name: "Abersford", pixel: [1114, 869], kind: "town" },
  { name: "Salford", pixel: [1163, 874], kind: "town" },
  { name: "Dornfeld", pixel: [878, 801], kind: "town" },
  { name: "Hilstrom", pixel: [692, 574], kind: "town", since: 7 },
  { name: "Amurth", pixel: [1044, 731], kind: "town", since: 3 },
  { name: "Clengoth", pixel: [1122, 831], kind: "town", since: 1 },
  { name: "Neath", pixel: [799, 752], kind: "town", since: 3 },
  { name: "Burnym", pixel: [928, 719], kind: "town", since: 4 },
  { name: "Nystil", pixel: [853, 630], kind: "town", since: 5 },
  { name: "Blenmyr", pixel: [703, 677], kind: "town", since: 5 },
  { name: "Nollagen", pixel: [280, 459], kind: "town", since: 1 },
  { name: "Grastor", pixel: [303, 408], kind: "town", since: 7 },
  { name: "Wungford", pixel: [530, 400], kind: "town", since: 7 },
  { name: "Elmor", pixel: [572, 262], kind: "town", since: 7 },
  { name: "Arglar", pixel: [215, 298], kind: "town", since: 7 },
  { name: "Dabus", pixel: [1350, 308], kind: "town", since: 7 },
  { name: "Allenford", pixel: [861, 608], kind: "town", since: 2 },
  { name: "Parthmal", pixel: [855, 633], kind: "town", since: 2 },
  { name: "Lanwith", pixel: [884, 627], kind: "town", since: 2 },
  { name: "Anglin", pixel: [906, 648], kind: "town", since: 2 },
  { name: "Wrexton", pixel: [886, 751], kind: "town", since: 3 },
  { name: "Ponth", pixel: [794, 776], kind: "town", since: 3 },
  { name: "Rummeln", pixel: [1242, 701], kind: "town", since: 3 },
  { name: "Morthmin", pixel: [790, 704], kind: "town", since: 4 },
  { name: "Wynmor", pixel: [708, 609], kind: "town", since: 4 },
  { name: "Swythton", pixel: [676, 805], kind: "town", since: 4 },
  { name: "Tymdel", pixel: [1081, 765], kind: "town", since: 5 },
];
