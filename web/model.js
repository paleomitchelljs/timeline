// Derived-data layer for the City Timeline.
//
// Pure functions, no DOM — so the same code runs in the browser (window.TimelineModel)
// and under node (require), and can be unit-tested without a page.
//
// What it does:
//   build(cities, obs)      -> a model: per-city lifespan + control/population timelines,
//                              plus empires aggregated from the raw observations.
//   stateAt(model, year)    -> the located cities present that year, each with its
//                              controlling empire (inferred) and population-so-far.
//   empiresActiveAt(m, year)-> empires whose span covers that year.
//
// Empire inference is HEURISTIC: polity names are normalized from the free-text
// `actor`/`value` columns. A controlled vocabulary (a polities table or alias map)
// would make it exact; until then expect a few near-duplicates (e.g. "Persia" vs
// "Achaemenid Persia") and persons leaking in from messy rows.
(function (root, factory) {
  const mod = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  else root.TimelineModel = mod;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";

  // capital_status values that name a function, not a polity, so don't imply control.
  const NON_EMPIRE = /cult center|religious center|frontier|garrison|administrative|temple economy|trade/i;

  // Alias map: collapse the free-text variants of one polity to a canonical name.
  // This is the hand-maintained vocabulary; extend it as new regions add new powers.
  const ALIASES = {
    "Achaemenid Empire": "Achaemenid Persia",
    "Persia": "Achaemenid Persia",
    "Kingdom of Macedon": "Macedon",
    "Roman Empire": "Rome",
    "Roman Republic": "Rome",
    "Royal city of Elam": "Elam",
    "Assyrian kingdom": "Assyria",
    "Hittites": "Hittite Empire",
    "Medes": "Median Empire",
  };
  const canon = p => (p ? (ALIASES[p] || p) : null);

  function normalizePolity(raw) {
    if (!raw) return null;
    let s = String(raw).trim();
    s = s.replace(/\s*\([^)]*\)\s*$/, "");        // drop trailing "(Ruler)"
    s = s.replace(/.*\bcapital of (the )?/i, "");  // "Capital of the Old Kingdom" -> "Old Kingdom"
    s = s.trim();
    return s || null;
  }

  // The controlling polity implied by one observation, or null if it implies none.
  function polityOf(o) {
    let p = null;
    switch (o.event_type) {
      case "conquest":
        p = (o.value && o.value.trim()) ? o.value.trim() : normalizePolity(o.actor); break;
      case "destruction":          // the destroyer typically takes control
        p = normalizePolity(o.actor); break;
      case "capital_status":
        p = NON_EMPIRE.test(o.value || "") ? null : normalizePolity(o.value); break;
      // founding / refounding / abandonment / attestation / population imply no control
    }
    return canon(p);
  }

  const PALETTE = [
    "#e57373", "#f06292", "#ba68c8", "#9575cd", "#7986cb", "#64b5f6", "#4fc3f7",
    "#4dd0e1", "#4db6ac", "#81c784", "#aed581", "#dce775", "#ffd54f", "#ffb74d",
    "#ff8a65", "#a1887f", "#90a4ae", "#f48fb1", "#ce93d8", "#80cbc4",
  ];

  function build(cities, obs) {
    const rows = obs.map(r => ({ ...r, ys: +r.year_start, ye: +r.year_end }));
    const byCity = {};
    for (const r of rows) (byCity[r.city_id] || (byCity[r.city_id] = [])).push(r);

    const cityById = {};
    for (const c of cities) cityById[c.city_id] = c;

    const cityInfo = {};
    for (const id in byCity) {
      const evs = byCity[id].slice().sort((a, b) => a.ys - b.ys);
      const founding = evs.find(e => e.event_type === "founding");
      const start = founding ? founding.ys : Math.min(...evs.map(e => e.ys));
      const aband = evs.find(e => e.event_type === "abandonment");
      const end = aband ? aband.ye : Math.max(...evs.map(e => e.ye));
      const control = evs
        .map(e => ({ year: e.ys, polity: polityOf(e) }))
        .filter(e => e.polity)
        .sort((a, b) => a.year - b.year);
      const pops = evs
        .filter(e => e.event_type === "population_estimate" && +e.value > 0)
        .map(e => ({ year: e.ys, val: +e.value }))
        .sort((a, b) => a.year - b.year);
      const capitalSpans = evs
        .filter(e => e.event_type === "capital_status")
        .map(e => ({ start: e.ys, end: e.ye }));
      const peakPop = pops.length ? Math.max(...pops.map(p => p.val)) : 0;
      cityInfo[id] = { id, start, end, control, pops, capitalSpans, peakPop };
    }

    // aggregate empires across all cities
    const empMap = {};
    for (const id in cityInfo) {
      for (const c of cityInfo[id].control) {
        const e = empMap[c.polity] || (empMap[c.polity] = { name: c.polity, start: c.year, end: c.year, cities: new Set() });
        if (c.year < e.start) e.start = c.year;
        if (c.year > e.end) e.end = c.year;
        e.cities.add(id);
      }
    }
    const empires = Object.values(empMap)
      .sort((a, b) => a.start - b.start || a.name.localeCompare(b.name));
    empires.forEach((e, i) => { e.color = PALETTE[i % PALETTE.length]; });
    const empColor = {};
    empires.forEach(e => { empColor[e.name] = e.color; });

    const years = rows.flatMap(r => [r.ys, r.ye]);
    const domain = { min: Math.min(...years), max: Math.max(...years) };

    return { cities, cityById, cityInfo, empires, empColor, domain };
  }

  function controllerAt(info, year) {
    let cur = null;
    for (const c of info.control) {
      if (c.year <= year) cur = c.polity; else break;
    }
    return cur;
  }

  function popAt(info, year) {
    let cur = null;
    for (const p of info.pops) {
      if (p.year <= year) cur = p.val; else break;
    }
    return cur;
  }

  function stateAt(model, year) {
    const out = [];
    for (const id in model.cityInfo) {
      const info = model.cityInfo[id];
      if (year < info.start || year > info.end) continue;
      const c = model.cityById[id];
      if (!c || c.lat === "" || c.lon === "") continue;
      const polity = controllerAt(info, year);
      out.push({
        id, city: c, polity,
        color: polity ? model.empColor[polity] : "#7a8290",
        pop: popAt(info, year),
      });
    }
    return out;
  }

  function empiresActiveAt(model, year) {
    return model.empires.filter(e => e.start <= year && year <= e.end);
  }

  // A city earns a permanent map label if it is sizable or a capital that year;
  // everything else is hover-only. Keeps a crowded map legible.
  const MAJOR_POP = 60000;
  function isMajorAt(info, year) {
    if ((popAt(info, year) || 0) >= MAJOR_POP) return true;
    for (const s of info.capitalSpans) if (s.start <= year && year <= s.end) return true;
    return false;
  }

  return { build, stateAt, controllerAt, popAt, empiresActiveAt, isMajorAt, normalizePolity, polityOf };
});
