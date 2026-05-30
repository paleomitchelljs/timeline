// Gap finder — the audits that would have caught Datong (interior) and Seville (leading).
//
// A city lapses to "Independent / no record" wherever its conquest chain is sparse. Two shapes
// of lapse usually mean a MISSING LABEL rather than real independence:
//
//   interior  — an Independent span with recorded rule on BOTH sides. Empires don't leave a city
//               stateless for centuries between two of their own conquests. (Datong: missing Tang
//               centuries hid between Northern Wei and the Liao.) High-confidence.
//
//   leading   — a long span between a city's FOUNDING and its FIRST recorded ruler. Often genuine
//               (Greek poleis, Phoenician city-states, pre-state Neolithic towns), but often a hole:
//               a city founded under an empire yet first-labeled at a much later conquest. (Seville:
//               Roman/Visigothic, blank until the Umayyads.) Needs triage — the founding note helps.
//
// Ranking by "% Independent" or "largest single gap" misses both, because a legitimate pre-state or
// frontier span dominates and hides the genuine hole underneath.
//
// Usage:  node tools/find_gaps.mjs [minYears] [interior|leading|both]   (defaults: 150 interior)
// Run from the repo root. Reuses web/model.js so the answer matches the map exactly.

import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const ROOT = new URL("..", import.meta.url).pathname;
const M = require(ROOT + "web/model.js");

function parseCSV(text) {
  const rows = []; let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(field); field = ""; if (row.length > 1 || row[0].length) rows.push(row); row = []; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const h = rows.shift();
  return rows.map(r => Object.fromEntries(h.map((k, i) => [k, (r[i] ?? "").trim()])));
}
const read = f => parseCSV(fs.readFileSync(ROOT + "data/" + f, "utf8"));

const MIN = +(process.argv[2] || 150);
const MODE = process.argv[3] || "interior";
const cities = read("cities.csv");
const obs = read("observations.csv");
const model = M.build(cities, obs, read("names.csv"));
const region = {}; for (const c of cities) region[c.city_id] = c.region;
const foundNote = {}; for (const o of obs) if (o.event_type === "founding") foundNote[o.city_id] = (o.notes || "").slice(0, 44);

function interior() {
  const hits = [];
  for (const id in model.cityInfo) {
    const segs = M.cityControlTimeline(model, id);
    for (let i = 0; i < segs.length; i++) {
      if (segs[i].polity) continue;
      let before = null, after = null;
      for (let j = i - 1; j >= 0; j--) if (segs[j].polity) { before = segs[j]; break; }
      for (let j = i + 1; j < segs.length; j++) if (segs[j].polity) { after = segs[j]; break; }
      if (!before || !after) continue;
      const len = segs[i].end - segs[i].start;
      if (len >= MIN) hits.push({ id, len, start: segs[i].start, end: segs[i].end, before: before.polity, after: after.polity });
    }
  }
  hits.sort((a, b) => b.len - a.len);
  console.log(`\nINTERIOR gaps (ruled before AND after) >= ${MIN}yr : ${hits.length}\n`);
  for (const h of hits) console.log(`  ${String(h.len).padStart(5)}yr  ${String(h.start).padStart(6)}..${String(h.end).padEnd(6)}  ${h.id.padEnd(16)}${region[h.id].padEnd(16)}[${h.before} -> ${h.after}]`);
}

function leading() {
  const hits = [];
  for (const id in model.cityInfo) {
    const info = model.cityInfo[id];
    const first = M.cityControlTimeline(model, id).find(s => s.polity);
    if (!first) continue;
    const len = first.start - info.start;
    if (len >= MIN) hits.push({ id, len, founded: info.start, firstYr: first.start, first: first.polity });
  }
  hits.sort((a, b) => b.len - a.len);
  console.log(`\nLEADING gaps (founding -> first ruler) >= ${MIN}yr : ${hits.length}  [triage: founding note signals real independence]\n`);
  for (const h of hits) console.log(`  ${String(h.len).padStart(5)}yr  ${String(h.founded).padStart(6)} -> ${String(h.firstYr).padStart(6)} ${h.first.padEnd(20)} ${h.id.padEnd(15)}${region[h.id].padEnd(15)}| ${foundNote[h.id] || ""}`);
}

if (MODE === "interior" || MODE === "both") interior();
if (MODE === "leading" || MODE === "both") leading();
