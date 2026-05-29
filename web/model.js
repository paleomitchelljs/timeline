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
    // Roman provinces are part of the empire for the control layer
    "Western Roman Empire": "Rome",
    "Roman Britain": "Rome",
    "Three Gauls": "Rome",
    "Gallia Narbonensis": "Rome",
    "Hispania Tarraconensis": "Rome",
    "Lusitania": "Rome",
    "Germania Inferior": "Rome",
    "Germania Superior": "Rome",
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
    const winMap = {};   // polity -> activity window aggregated across all cities
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

      // build polity windows: start year, overall extent, and last capital year
      for (const e of evs) {
        const p = polityOf(e);
        if (!p) continue;
        const isCap = e.event_type === "capital_status";
        const endYr = isCap ? e.ye : e.ys;
        const w = winMap[p] || (winMap[p] = { name: p, start: e.ys, end: endYr, capitalEnd: null, cities: new Set() });
        if (e.ys < w.start) w.start = e.ys;
        if (endYr > w.end) w.end = endYr;
        if (isCap) w.capitalEnd = w.capitalEnd == null ? e.ye : Math.max(w.capitalEnd, e.ye);
        w.cities.add(id);
      }
    }

    const empires = Object.values(winMap)
      .sort((a, b) => a.start - b.start || a.name.localeCompare(b.name));
    empires.forEach((e, i) => { e.color = PALETTE[i % PALETTE.length]; });
    const empColor = {}, polityWindow = {};
    empires.forEach(e => {
      empColor[e.name] = e.color;
      polityWindow[e.name] = { start: e.start, end: e.end, capitalEnd: e.capitalEnd };
    });

    const years = rows.flatMap(r => [r.ys, r.ye]);
    const domain = { min: Math.min(...years), max: Math.max(...years) };

    return { cities, cityById, cityInfo, empires, empColor, polityWindow, domain };
  }

  // Who controls a city in a given year, as a bounded interval rather than a
  // forever-persisting last conqueror. A polity that ever held a capital lapses to
  // "Independent / no record" (null) once past its last attested capital year; a pure
  // conqueror (no capital recorded) is trusted until the next recorded takeover.
  function controllerAt(model, info, year) {
    let cur = null;
    for (const c of info.control) {
      if (c.year <= year) cur = c.polity; else break;
    }
    if (!cur) return null;
    const w = model.polityWindow[cur];
    if (w && w.capitalEnd != null) return year <= w.capitalEnd ? cur : null;
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
      const polity = controllerAt(model, info, year);
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

  // Is the city the seat of a polity (a capital_status span) in this year?
  function isCapitalAt(info, year) {
    for (const s of info.capitalSpans) if (s.start <= year && year <= s.end) return true;
    return false;
  }

  // A city earns a permanent map label if it is sizable or a capital that year;
  // everything else is hover-only. Keeps a crowded map legible.
  const MAJOR_POP = 60000;
  function isMajorAt(info, year) {
    return (popAt(info, year) || 0) >= MAJOR_POP || isCapitalAt(info, year);
  }

  // Proportion of the cities present in a year that each polity controls (sums to 1
  // with the "Independent" remainder). Drives the control-share chart.
  function shareAt(model, year) {
    const counts = {};
    let total = 0;
    for (const id in model.cityInfo) {
      const info = model.cityInfo[id];
      if (year < info.start || year > info.end) continue;
      total++;
      const p = controllerAt(model, info, year) || "Independent";
      counts[p] = (counts[p] || 0) + 1;
    }
    const share = {};
    if (total) for (const p in counts) share[p] = counts[p] / total;
    return { share, total };
  }

  return { build, stateAt, controllerAt, popAt, empiresActiveAt, isMajorAt, isCapitalAt, shareAt, normalizePolity, polityOf };
});
