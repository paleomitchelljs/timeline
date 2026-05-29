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
│   └── index.html          first-pass visualizer (timeline + population + map)
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

Most early dates are approximate and several follow the contested "middle chronology."
The seed data is deliberately conservative on `confidence`; tighten it as sources firm up.

## Validate before committing

```
python3 tools/validate.py
```

Checks referential integrity (no dangling `city_id`), the controlled vocabularies,
year ordering, required sources, and that population values are numeric. Standard
library only — nothing to install.

## Visualize (first pass)

`web/index.html` renders three live views from the CSVs: a **lifespan/empire timeline**
(each city's bar from founding to abandonment, with a gold band for periods as a
capital and a glyph per event), a **population-over-time** chart (log scale), and a
**map** of site locations. It uses no libraries.

Browsers block `fetch` from `file://`, so serve the repo root over HTTP:

```
python3 -m http.server 8000
```

then open <http://localhost:8000/web/>. Hover any marker for date, source, and confidence.

## Roadmap

- [x] Schema + Sumerian core seed (Eridu, Uruk, Ur, Nippur, Lagash, Kish, Umma)
- [x] Deepen Sumer: Akkad, Mari, Adab, Larsa, Isin, Shuruppak, Girsu, Sippar, Babylon
- [x] Forward-extend each city's timeline to its true end (abandonment / last attestation)
- [x] First-pass visualizer: timeline + population + map
- [ ] Assyria proper: Assur, Nineveh, Nimrud, Dur-Sharrukin
- [ ] Expand regions: Egypt → Levant → Anatolia → Greece → Italy → Iberia → India → China → SE Asia
- [ ] Visualizer v2: time-slider that animates the map as empires rise and fall
- [ ] Replace placeholder population figures with the Reba2016 georeferenced series
```
