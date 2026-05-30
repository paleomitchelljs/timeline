// Interior-gap finder — the audit that would have caught Datong.
//
// A city that lapses to "Independent / no record" is only suspicious when it is ruled
// BOTH before and after the gap: empires don't leave a city stateless for centuries
// between two of their own conquests. Leading gaps (before the first attested ruler) and
// trailing gaps (after the last) are usually legitimate — pre-state founding eras or
// post-abandonment — so we ignore them. Ranking by "% Independent" or "largest single gap"
// misses these because a city's biggest gap is often a legitimate pre-state span that masks
// a genuine interior hole underneath (exactly how Datong's missing Tang centuries hid behind
// its legitimate Xiongnu-frontier era).
//
// Usage:  node tools/find_gaps.mjs [minYears]      (default 150)
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
const cities = read("cities.csv");
const model = M.build(cities, read("observations.csv"), read("names.csv"));
const region = {}; for (const c of cities) region[c.city_id] = c.region;

const hits = [];
for (const id in model.cityInfo) {
  const segs = M.cityControlTimeline(model, id);
  for (let i = 0; i < segs.length; i++) {
    if (segs[i].polity) continue;                       // only Independent spans
    let before = null, after = null;                    // nearest ruled neighbors (skip slivers)
    for (let j = i - 1; j >= 0; j--) if (segs[j].polity) { before = segs[j]; break; }
    for (let j = i + 1; j < segs.length; j++) if (segs[j].polity) { after = segs[j]; break; }
    if (!before || !after) continue;                    // leading/trailing -> usually legitimate
    const len = segs[i].end - segs[i].start;
    if (len >= MIN) hits.push({ id, region: region[id], start: segs[i].start, end: segs[i].end, len, before: before.polity, after: after.polity });
  }
}
hits.sort((a, b) => b.len - a.len);
console.log(`Interior Independent gaps (ruled before AND after) >= ${MIN}yr : ${hits.length}\n`);
for (const h of hits) {
  console.log(`  ${String(h.len).padStart(5)}yr  ${String(h.start).padStart(6)}..${String(h.end).padEnd(6)}  ${h.id.padEnd(18)}${h.region.padEnd(18)}[${h.before} -> ${h.after}]`);
}
