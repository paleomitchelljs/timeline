# City Timeline

A timeline of human history told through its cities. Each observation — a founding,
a conquest, a destruction, a population estimate — is one row, tied to a stable city
and a cited source. Empire maps and population curves are *derived* from this data;
they are never stored here.

Coverage grows region by region. First region: **Mesopotamia (Sumerian core)**.

## Layout

```
timeline/
├── data/                 the dataset — the only files you edit by hand
│   ├── cities.csv          one row per place (the dimension table)
│   ├── names.csv           historical names over time
│   └── observations.csv    the long fact table: one row per observation
├── tools/
│   └── validate.py         stdlib integrity checker
├── web/
│   ├── index.html          visualizer page (map time-machine + empires + population)
│   └── model.js            derived-data layer: empires + per-year city state (pure, testable)
└── README.md
```

## Why three files instead of one big CSV

A single flat sheet breaks down fast on real historical data, for three reasons:

1. **Cities outlive their names.** Byzantium → Constantinople → Istanbul is one place.
   A stable `city_id` keeps a city's whole timeline together; `names.csv` records what
   it was called when.
2. **Dates are uncertain and pre-zero.** Years are stored as **signed integers**
   (−3100 = 3100 BCE) so they sort and plot correctly, with a `year_start`/`year_end`
   range and a `date_precision` tag instead of pretending to a false exactness.
3. **Provenance is the credibility.** Conquest dates and populations are contested, so
   every observation carries a `source` and a `confidence`. Without that the dataset is
   just folklore.

So the data is a small star schema, all plain CSV, all hand-editable:

```
cities.csv  ──< observations.csv   (city_id is the join key)
cities.csv  ──< names.csv
```

## The data files (`data/`)

### `cities.csv` — one row per place (rarely edited)
| column | meaning |
|---|---|
| `city_id` | stable lowercase slug, the join key; never reuse or rename |
| `canonical_name` | the name we file it under |
| `modern_name` | modern town or archaeological site name |
| `lat`, `lon` | decimal degrees (N+ / E+); feeds the future map |
| `region` | coarse grouping, e.g. `mesopotamia-sumer` |
| `notes` | free text |

### `names.csv` — historical names over time
| column | meaning |
|---|---|
| `city_id` | references `cities.csv` |
| `name` | the name in use |
| `language` | Sumerian, Akkadian, Greek, … |
| `from_year`, `to_year` | signed-integer span the name was current (approximate) |

### `observations.csv` — the fact table you live in
| column | meaning |
|---|---|
| `obs_id` | unique id, `obs_NNNN` |
| `city_id` | references `cities.csv` |
| `year_start`, `year_end` | signed-integer range; set equal for a point event |
| `date_precision` | `exact` / `decade` / `circa` / `century` / `millennium` |
| `event_type` | controlled vocabulary, see below |
| `value` | meaning depends on `event_type` (see below) |
| `actor` | the agent: conquering ruler/polity, founder, destroyer |
| `source` | citation key (see Sources) — **required** |
| `confidence` | `high` / `medium` / `low` |
| `notes` | free text |

## Event vocabulary and what `value` means

| `event_type` | what `value` holds | what `actor` holds |
|---|---|---|
| `founding` | (empty) | founder, if known |
| `refounding` | period/dynasty label | who rebuilt it |
| `conquest` | resulting polity/era (empty if just "taken") | the conqueror |
| `destruction` | (empty) | who destroyed it |
| `abandonment` | (empty) | (empty) |
| `population_estimate` | the number (integer) | (empty) |
| `capital_status` | the polity/dynasty it is capital or center of | the ruler |
| `attestation` | what shows the city was active (archive, inscription, revival) | named person, if any |

`attestation` carries a timeline *forward* when nothing dramatic happened but there is
dated evidence the city was still alive — a temple archive, a Hellenistic inscription, a
mention in a king's records. It is how a city's bar reaches its true end instead of
stopping at its last conquest.

**Conquered vs. conquering:** an observation hangs on the city it happened *to*.
"Lagash defeats Umma" is a `conquest` row on `umma` with `actor` = Eannatum of Lagash.
A city's career as an aggressor is recovered by querying the `actor` column — no
separate direction field needed.

## Conventions

- **Years:** negative = BCE, positive = CE, no year 0. `-2334` is 2334 BCE.
- **Uncertainty lives in two places:** the date range (`year_start`..`year_end`) for
  *when*, and `confidence` for *whether*. A legendary event gets `confidence=low`, not
  a faked precise date.
- **`city_id` is forever.** Renaming a city changes `canonical_name`, never `city_id`.
- Every observation must cite a `source`. No source, no row.
- **Granularity:** record *changes of sovereign / imperial control* and major
  destructions, refoundings, and population shifts — not every battle, siege, or
  ruler. This keeps cities comparable and the timeline legible across five millennia.
- **Coverage is era-agnostic and runs to the present.** A Roman, Umayyad, Crusader,
  or modern event is as first-class as a Bronze Age one; carry each city forward to
  abandonment or, for living cities, a recent `population_estimate`.
- **Commas:** the free-text `notes`/`value` columns are unquoted, so use semicolons
  instead of commas. `tools/validate.py` rejects any row whose field count is off.

## Sources

Citation keys used in `source`. Expand this list as coverage grows.

| key | reference |
|---|---|
| `SKL` | The Sumerian King List (legendary/early dynastic claims) |
| `Chandler1987` | T. Chandler, *Four Thousand Years of Urban Growth* (1987) |
| `Modelski2003` | G. Modelski, *World Cities: −3000 to 2000* (2003) |
| `Reba2016` | Reba, Reitsma & Seto, georeferenced city populations 3700 BCE–2000 CE (2016) |
| `Nissen1988` | H. Nissen, *The Early History of the Ancient Near East* (1988) |
| `Cooper1983` | J. Cooper, *Reconstructing History from Ancient Inscriptions: The Lagash-Umma Border Conflict* (1983) |
| `Woolley1954` | L. Woolley, *Excavations at Ur* (1954) |
| `Sallaberger1999` | W. Sallaberger, *Ur III-Zeit* (1999) |
| `Foster2016` | B. Foster, *The Age of Agade* (2016) |
| `Gibson1993` | M. Gibson, excavations and studies at Nippur |
| `Suter2000` | C. Suter, *Gudea's Temple Building* (2000) |
| `Roaf1990` | M. Roaf, *Cultural Atlas of Mesopotamia* (1990) |
| `VanDeMieroop2004` | M. Van De Mieroop, *A History of the Ancient Near East* (2004) |
| `Beaulieu2018` | P-A. Beaulieu, *A History of Babylon* (2018) |
| `George1992` | A.R. George, *Babylonian Topographical Texts* (1992) |
| `Margueron2004` | J-C. Margueron, *Mari: Métropole de l'Euphrate* (2004) |
| `Moorey1978` | P.R.S. Moorey, *Kish Excavations 1923–1933* (1978) |
| `Boiy2004` | T. Boiy, *Late Achaemenid and Hellenistic Babylon* (2004) |
| `Stolper1985` | M. Stolper, *Entrepreneurs and Empire* (Murashû archive) (1985) |
| `Radner2015` | K. Radner, *Ancient Assyria: A Very Short Introduction* (2015) |
| `Frahm2017` | E. Frahm (ed.), *A Companion to Assyria* (2017) |
| `Reade2000` | J. Reade, studies on Nineveh and Assyrian topography |
| `Green1992` | T. Green, *The City of the Moon God: Religious Traditions of Harran* (1992) |
| `UNESCO2014` | UNESCO World Heritage inscription, Erbil Citadel (2014) |
| `UN2018` | UN World Urbanization Prospects (2018) — modern population figures |
| `Shaw2000` | I. Shaw (ed.), *The Oxford History of Ancient Egypt* (2000) |
| `Fraser1972` | P.M. Fraser, *Ptolemaic Alexandria* (1972) |
| `Bagnall1993` | R. Bagnall, *Egypt in Late Antiquity* (1993) |
| `Porten1996` | B. Porten, *The Elephantine Papyri in English* (1996) |
| `Kenyon1957` | K. Kenyon, *Digging Up Jericho* (1957) |
| `Aubet2001` | M.E. Aubet, *The Phoenicians and the West* (2001) |
| `Yon2006` | M. Yon, *The City of Ugarit at Tell Ras Shamra* (2006) |
| `Pitard1987` | W. Pitard, *Ancient Damascus* (1987) |
| `Finkelstein2001` | I. Finkelstein & N. Silberman, *The Bible Unearthed* (2001) |
| `Magness2012` | J. Magness, *The Archaeology of the Holy Land* (2012) |
| `Kennedy2004` | H. Kennedy, *The Prophet and the Age of the Caliphates* (2004) |
| `Runciman1951` | S. Runciman, *A History of the Crusades* (1951) |
| `Potts1999` | D.T. Potts, *The Archaeology of Elam* (1999) |
| `Briant2002` | P. Briant, *From Cyrus to Alexander: A History of the Persian Empire* (2002) |
| `Hodder2006` | I. Hodder, *The Leopard's Tale: Revealing the Mysteries of Çatalhöyük* (2006) |
| `Bryce2005` | T. Bryce, *The Kingdom of the Hittites* (2005) |
| `Mitchell1993` | S. Mitchell, *Anatolia: Land, Men, and Gods in Asia Minor* (1993) |
| `Roosevelt2009` | C.H. Roosevelt, *The Archaeology of Lydia* (2009) |
| `Mango2002` | C. Mango (ed.), *The Oxford History of Byzantium* (2002) |
| `Runciman1965` | S. Runciman, *The Fall of Constantinople 1453* (1965) |
| `Dickinson1994` | O. Dickinson, *The Aegean Bronze Age* (1994) |
| `Hornblower2011` | S. Hornblower, *The Greek World 479–323 BC* (2011) |
| `Hansen2006` | M.H. Hansen, *Polis: An Introduction to the Ancient Greek City-State* (2006) |
| `Hammond1989` | N.G.L. Hammond, *The Macedonian State* (1989) |
| `Welsby1996` | D. Welsby, *The Kingdom of Kush* (1996) |
| `Welsby2002` | D. Welsby, *The Medieval Kingdoms of Nubia* (2002) |
| `Tsetskhladze2008` | G. Tsetskhladze (ed.), *Greek Colonisation* (2006–2008) |
| `Miles2010` | R. Miles, *Carthage Must Be Destroyed* (2010) |
| `Raven1993` | S. Raven, *Rome in Africa* (1993) |
| `Boardman1999` | J. Boardman, *The Greeks Overseas* (1999) |
| `Cornell1995` | T. Cornell, *The Beginnings of Rome* (1995) |
| `Beard2015` | M. Beard, *SPQR: A History of Ancient Rome* (2015) |
| `Mitchell2007` | S. Mitchell, *A History of the Later Roman Empire* (2007) |
| `Drinkwater1983` | J. Drinkwater, *Roman Gaul* (1983) |
| `Salway1981` | P. Salway, *Roman Britain* (1981) |
| `King1990` | A. King, *Roman Gaul and Germany* (1990) |
| `Richardson1996` | J. Richardson, *The Romans in Spain* (1996) |
| `Kennedy1996` | H. Kennedy, *Muslim Spain and Portugal* (1996) |
| `Collins2004` | R. Collins, *Visigothic Spain 409–711* (2004) |
| `Possehl2002` | G. Possehl, *The Indus Civilization: A Contemporary Perspective* (2002) |
| `Thapar2002` | R. Thapar, *Early India: From the Origins to AD 1300* (2002) |
| `AsherTalbot2006` | C. Asher & C. Talbot, *India before Europe* (2006) |
| `Downey1961` | G. Downey, *A History of Antioch in Syria* (1961) |
| `Kuhrt1995` | A. Kuhrt, *The Ancient Near East c. 3000–330 BC* (1995) |
| `Daryaee2009` | T. Daryaee, *Sasanian Persia* (2009) |
| `Keightley1999` | D. Keightley, on Shang civilization and the oracle bones (1999) |
| `Lewis2007` | M.E. Lewis, *The Early Chinese Empires: Qin and Han* (2007) |
| `Mote1999` | F.W. Mote, *Imperial China 900–1800* (1999) |
| `Coedes1968` | G. Coedès, *The Indianized States of Southeast Asia* (1968) |
| `Lieberman2003` | V. Lieberman, *Strange Parallels: Southeast Asia in Global Context* (2003) |
| `Morgan2007` | D. Morgan, *The Mongols* (2007) |
| `Soucek2000` | S. Soucek, *A History of Inner Asia* (2000) |
| `Totman2000` | C. Totman, *A History of Japan* (2000) |
| `Phillipson2012` | D. Phillipson, *Foundations of an African Civilisation: Aksum* (2012) |
| `Connah2001` | G. Connah, *African Civilizations* (2001) |
| `Shady2008` | R. Shady Solís, on Caral and the Norte Chico (2008) |
| `Coe2011` | M. Coe, *Mexico: From the Olmecs to the Aztecs* / *The Maya* (2011) |
| `DAltroy2014` | T. D'Altroy, *The Incas* (2014) |
| `Pauketat2009` | T. Pauketat, *Cahokia: Ancient America's Great City on the Mississippi* (2009) |
| `Wickham2009` | C. Wickham, *The Inheritance of Rome* (medieval Europe) (2009) |
| `Franklin1996` | S. Franklin & J. Shepard, *The Emergence of Rus 750–1200* (1996) |
| `Abulafia2011` | D. Abulafia, *The Great Sea: A Human History of the Mediterranean* (2011) |
| `Lane1973` | F.C. Lane, *Venice: A Maritime Republic* (1973) |
| `Disney2009` | A.R. Disney, *A History of Portugal and the Portuguese Empire* (2009) |
| `Cahen2001` | C. Cahen, *The Formation of Turkey* (2001) |
| `Stein1989` | B. Stein, *Vijayanagara* (1989) |
| `Darwin2012` | J. Darwin, *Unfinished Empire: The Global Expansion of Britain* (2012) |
| `Beckwith2009` | C. Beckwith, *Empires of the Silk Road* (2009) |
| `Brett2017` | M. Brett, *The Fatimid Empire* (2017) |
| `AbunNasr1987` | J. Abun-Nasr, *A History of the Maghrib in the Islamic Period* (1987) |
| `Henze2000` | P. Henze, *Layers of Time: A History of Ethiopia* (2000) |
| `Taylor2001` | A. Taylor, *American Colonies* (2001) |

Most early dates are approximate and several follow the contested "middle chronology."
The seed data is deliberately conservative on `confidence`; tighten it as sources firm up.

## Validate before committing

```
python3 tools/validate.py
```

Checks referential integrity (no dangling `city_id`), the controlled vocabularies,
year ordering, required sources, and that population values are numeric. Standard
library only — nothing to install.

## Visualize

`web/index.html` (no libraries) renders three views, top to bottom:

1. **Map — a year machine.** A slider + play button scrub through time; markers appear
   when a city is founded, vanish at abandonment, are sized by population-so-far, and are
   **coloured by the empire that controls them that year**. Wheel to zoom, drag to pan.
2. **Empires & polities.** One bar per polity (not per city), so the panel scales as the
   dataset grows. Hover a bar for its span and member cities.
3. **Population over time** (log scale).

`web/model.js` is the derived-data layer behind all three: pure functions that infer each
city's controlling empire and population at any year, and aggregate the free-text
`actor`/`value` columns into empires. It runs in the browser and under node, so it is
unit-tested directly.

**Empire inference is heuristic.** Polity names are normalized from free text and folded
through a hand-maintained **alias map** (so Rome's eight variants, the Roman provinces,
`Achaemenid Persia`/`Persia`, etc. become one empire each). Extend the `ALIASES` table as
new powers appear.

**Control is modeled as intervals, not a forever-persisting last conqueror.** A city's
controller in a year is the most recent takeover, but it **lapses to "Independent / no
record"** once that empire is past its last attested capital year (a pure conqueror with
no recorded capital is trusted until the next recorded takeover). So Rome holds Athens from
146 BCE only to ~476 CE, not to the next stray event in 1458. The honest cost: where we
have not yet recorded the intervening powers (the Hellenistic successor states, the
Abbasids, medieval kingdoms…), cities show as Independent — the chart's grey band is a
direct readout of where the dataset is still thin.

Browsers block `fetch` from `file://`, so serve the repo root over HTTP:

```
python3 -m http.server 8000
```

then open <http://localhost:8000/web/>. Hover any marker for date, source, and confidence.

### Basemap (optional)

The map draws coastline, rivers, and lakes from `web/basemap.geojson` if present, and
falls back to a plain point scatter if not. That file is generated with R (Natural Earth
physical layers, clipped and simplified — no political borders):

```
Rscript tools/make_basemap.R      # needs: install.packages(c("sf","rnaturalearth","rnaturalearthdata"))
```

The script now renders the **whole world** (coverage runs from the Americas to Japan).
The geometry is **modern**: in antiquity the Persian Gulf reached further north, so Ur and
Eridu — coastal then — render inland.

## Roadmap

- [x] Schema + Sumerian core seed (Eridu, Uruk, Ur, Nippur, Lagash, Kish, Umma)
- [x] Deepen Sumer: Akkad, Mari, Adab, Larsa, Isin, Shuruppak, Girsu, Sippar, Babylon
- [x] Forward-extend each city's timeline to its true end (abandonment / last attestation)
- [x] First-pass visualizer: timeline + population + map
- [x] Assyria: Assur, Nineveh, Kalhu (Nimrud), Dur-Sharrukin, Arbela (Erbil), Harran
- [x] Egypt: Memphis, Heliopolis, Thebes (Luxor), Akhetaten, Avaris, Tanis, Alexandria, Elephantine (Aswan)
- [x] Levant: Jericho, Byblos, Ugarit, Megiddo, Damascus, Tyre, Sidon, Jerusalem
- [x] Basemap pipeline: `tools/make_basemap.R` → `web/basemap.geojson`, drawn as SVG (run locally to populate)
- [x] Derived-data layer (`web/model.js`): empire inference + per-year city state, unit-tested
- [x] Visualizer v2: map time-slider/play + zoom/pan; empire-centric lifespan panel
- [x] Polity alias map in `model.js` to de-duplicate empires (Rome, Achaemenid Persia, Macedon, …)
- [x] Minor cities hover-only; star icons for capitals; control-share stacked chart
- [x] Control modeled as intervals that lapse to "Independent / no record" past an empire's window
- [x] Intervening powers: anchor capitals (Antioch, Seleucia, Ctesiphon, Baghdad) + Seleucid/Ptolemaic/Parthian/Sasanian/Byzantine/Rashidun/Abbasid/Ottoman chains
- [ ] Deepen remaining gaps (Umayyad→Abbasid→Mamluk Levant, medieval Europe, Central Asia)
- [ ] GIF/video export of the map animation (frame = `stateAt(year)`; encode via a small R/Python step)
- [ ] Replace placeholder population figures with the Reba2016 georeferenced series

Expansion sequence (region by region):

- [x] Mesopotamia (Sumer, Akkad, Assyria) · Egypt · Levant
- [x] **Iran / Zagros** (Susa, Anshan, Ecbatana, Pasargadae, Persepolis)
- [x] **Anatolia** (Çatalhöyük, Troy, Hattusa, Gordion, Sardis, Ephesus, Byzantium)
- [x] **Greece** (Knossos, Mycenae, Athens, Sparta, Corinth, Thebes, Argos)
- [x] **Macedon** (Pella, Aigai, Thessalonica, Philippi)
- [x] **Nubia / Kush** (Kerma, Napata, Meroë, Old Dongola, Soba) — filling the upper Nile
- [x] **Pontic steppe** (Panticapaeum, Olbia, Chersonesus, Tanais)
- [x] **North Africa** (Carthage, Cyrene, Utica, Leptis Magna)
- [x] **Italy** (Rome, Syracuse, Tarentum, Neapolis, Mediolanum, Ravenna)
- [x] **Gaul** (Massalia, Lugdunum, Lutetia, Narbo, Burdigala)
- [x] **Iberia** (Gades, Carthago Nova, Tarraco, Corduba, Emerita, Toletum)
- [x] **Britannia** (Londinium, Camulodunum, Eboracum)
- [x] **Germania** (Colonia Agrippina, Augusta Treverorum, Mogontiacum)
- [x] **India** (Mohenjo-daro, Harappa, Taxila, Pataliputra, Varanasi, Ujjain, Madurai, Delhi)
- [x] **China** (Anyang, Chang'an, Luoyang, Kaifeng, Hangzhou, Nanjing, Beijing, Guangzhou)
- [x] **Southeast Asia** (Angkor, Bagan, Ayutthaya, Palembang, Thang Long, Malacca)
- [x] **Steppe / Central Asia** (Karakorum, Samarkand, Bukhara, Merv, Sarai) — the Mongol thread
- [x] **Japan** (Nara, Kyoto, Kamakura, Edo/Tokyo, Osaka)
- [x] **Sub-Saharan Africa** (Aksum, Djenné, Timbuktu, Gao, Ife, Benin, Great Zimbabwe, Kilwa, Mbanza Kongo)
- [x] **The Americas** (Caral, Teotihuacan, Tikal, Monte Albán, Chichén Itzá, Tenochtitlan, Cusco, Cahokia)
- [x] **Europe deepened** (Russia: Kiev/Novgorod/Moscow; Central Europe: Prague/Vienna/Kraków/Buda; medieval Italy & Iberia)
- [x] Reaches nailed down: capitals recorded for the Ottoman, British, Spanish empires so their control lapses correctly (no more empires "holding" cities in 2020)
- [x] North Africa & the Maghreb (Cairo, Fez, Marrakesh, Kairouan, Tunis, Algiers, Tripoli, Volubilis, Cirta, Tlemcen, Sijilmasa) + Sahel capitals (Niani/Mali, Koumbi Saleh/Ghana)
- [x] Swahili coast & Horn (Mombasa, Zanzibar, Sofala, Gondar, Harar, Lalibela, Luanda); Greece deepened (Delphi, Olympia, Pylos, Larissa, Eretria)
- [x] Empire-tag audit: HRE made a real controller; British East India Company → British Empire; Neo-Assyrian → Assyria; First Crusade → Crusaders; revolts (Iceni) no longer confer control
- [x] Founding-control fix: a city founded by a recognized empire is controlled by it from its founding (auto-fixed Philippi, Nishapur); plus the Carthaginian network (Oea/Tripoli, Leptis, Utica, Gades, Carthago Nova, Palermo) so Carthage is a real 7-city empire
- [x] China dynastic coherence: Northern/Southern Song merged into one "Song dynasty"; Tang/Song/Yuan/Ming/Qing extended across the major cities so the succession is continuous (no more Nanjing-shaped gaps)
- [x] North America into the modern era (New York, Washington, Boston, Quebec, Havana) — the United States is now a real polity
- [x] Time-aware map labels: cities are labelled by their period name from `names.csv` (Lutetia in antiquity, Paris today)
- [x] Share chart starts at the first empire; Sankey shows the top 26 empires (mid-size ones like Carthage are now clickable)
- [ ] Ongoing: more cities per region; deepen the Umayyad→Abbasid→Mamluk and medieval-European successions
```
