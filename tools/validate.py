#!/usr/bin/env python3
"""Integrity checks for the city-timeline dataset.

Run from anywhere:  python3 tools/validate.py
Exits non-zero if any check fails, so it can gate a commit hook or CI.

It only uses the standard library so there is nothing to install.
"""
import csv
import re
import sys
from pathlib import Path

# tools/validate.py -> repo root -> data/
ROOT = Path(__file__).resolve().parent.parent / "data"

EVENT_TYPES = {
    "founding",
    "refounding",
    "conquest",
    "destruction",
    "abandonment",
    "population_estimate",
    "capital_status",
    "attestation",
}
DATE_PRECISION = {"exact", "circa", "century", "decade", "millennium"}
CONFIDENCE = {"high", "medium", "low"}

# Conqueror lifespans for the anachronism check (CE; negative = BCE). An empire
# used as an `actor` outside its [start, end] window is almost always a dating
# or attribution slip — e.g. "Yuan dynasty" in 1234 (proclaimed 1271) or
# "Umayyad Caliphate" in 643 (the dynasty began 661). Windows are the
# *operational* span: they admit a founder's immediate pre-foundation campaigns
# (the Abbasid revolution reached Merv in 748; Batu's Golden Horde campaign hit
# Rus in 1237-40) so the check fires on gross errors, not edge fuzz. A trailing
# "(Ruler)" annotation on the actor is ignored; actors not listed are skipped.
POLITY_LIFESPANS = {
    "Rome": (-509, 480), "Macedon": (-700, -146), "Achaemenid Persia": (-559, -330),
    "Seleucid Empire": (-312, -63), "Ptolemaic Egypt": (-323, -30),
    "Parthian Empire": (-247, 224), "Sasanian Empire": (224, 651),
    "Carthaginian Empire": (-650, -146), "Mauryan Empire": (-322, -185),
    "Gupta Empire": (320, 550), "Kushan Empire": (30, 375),
    "Byzantine Empire": (330, 1453), "Rashidun Caliphate": (629, 661),
    "Umayyad Caliphate": (661, 750), "Abbasid Caliphate": (747, 1258),
    "Fatimid Caliphate": (909, 1171), "Ayyubid Sultanate": (1171, 1260),
    "Mamluk Sultanate": (1250, 1517), "Seljuk Empire": (1037, 1194),
    "Sultanate of Rum": (1077, 1308), "Ghaznavid Empire": (977, 1186),
    "Ghurid Sultanate": (1148, 1215), "Delhi Sultanate": (1206, 1526),
    "Mongol Empire": (1206, 1294), "Yuan dynasty": (1270, 1368),
    "Ilkhanate": (1256, 1357), "Golden Horde": (1236, 1502),
    "Chagatai Khanate": (1226, 1347), "Timurid Empire": (1370, 1507),
    "Ottoman Empire": (1299, 1922), "Mughal Empire": (1526, 1857),
    "Safavid Empire": (1500, 1736), "Pala Empire": (750, 1161),
    "Chola Empire": (848, 1279), "Vijayanagara Empire": (1336, 1646),
    "Bahmani Sultanate": (1347, 1527), "Khmer Empire": (802, 1431),
    "Srivijaya": (671, 1288), "Singhasari": (1222, 1292),
    "Han dynasty": (-206, 220), "Sui dynasty": (580, 618),
    "Tang dynasty": (618, 907), "Song dynasty": (960, 1279),
    "Ming dynasty": (1364, 1644), "Qing dynasty": (1636, 1912),
    "Later Jin": (1616, 1636), "Sokoto Caliphate": (1804, 1903),
    "Empire of Japan": (1868, 1947), "Soviet Union": (1917, 1991),
    "Assyria": (-1400, -609), "Neo-Babylonian Empire": (-626, -539),
    "Akkadian Empire": (-2334, -2154), "Hittite Empire": (-1650, -1180),
    "Median Empire": (-678, -549),
}

# Actor names that normalize alike but are deliberately distinct: a modern state
# vs. an earlier polity of the same name. Keeps the naming warning quiet on these.
DISTINCT_OK = {"brazil", "hungary", "israel", "japan", "mali", "poland"}

_PAREN = re.compile(r"\s*\(.*?\)")
_DESCR = re.compile(
    r"\b(Empire|Caliphate|Dynasty|dynasty|Kingdom|Sultanate|Khanate|"
    r"Republic|Confederacy|Federation|of|the)\b"
)

errors = []
warnings = []


def load(name):
    """Read a CSV into dicts, flagging any row whose field count is off.

    Using csv.reader (not DictReader) so a stray unquoted comma — which would
    silently shift values in DictReader — is caught as a hard error here.
    """
    path = ROOT / name
    with path.open(newline="", encoding="utf-8") as f:
        rows = list(csv.reader(f))
    header = rows[0]
    n = len(header)
    records = []
    for i, r in enumerate(rows[1:], start=2):
        if not r:  # blank line
            continue
        if len(r) != n:
            errors.append(f"{name}: line {i} has {len(r)} fields, expected {n} — likely a stray comma: {r}")
            continue
        records.append(dict(zip(header, r)))
    return records


def as_int(row, field, where):
    raw = (row.get(field) or "").strip()
    if raw == "":
        return None
    try:
        return int(raw)
    except ValueError:
        errors.append(f"{where}: {field}={raw!r} is not an integer")
        return None


def _base_actor(a):
    """Strip a trailing '(Ruler)' annotation: 'Rome (Caesar)' -> 'Rome'."""
    return _PAREN.sub("", a).strip()


def _actor_root(a):
    """Collapse an actor to a comparison root for the naming check."""
    return re.sub(r"\s+", " ", _DESCR.sub("", _base_actor(a))).strip().lower()


def audit_history(obs):
    """Editorial cross-checks over the actor field.

    Anachronism (hard error): an empire used as an actor outside the window it
    could have existed in. Actor naming (warning): two surface forms sharing a
    normalized root, flagging inconsistent naming; deliberate same-name pairs
    are allowlisted in DISTINCT_OK.
    """
    roots = {}
    for r in obs:
        actor = (r.get("actor") or "").strip()
        if not actor:
            continue
        base = _base_actor(actor)
        span = POLITY_LIFESPANS.get(base)
        if span is not None:
            raw = (r.get("year_start") or "").strip()
            try:
                y = int(raw)
            except ValueError:
                y = None
            lo, hi = span
            if y is not None and not (lo <= y <= hi):
                errors.append(
                    f"observations.csv[{r['obs_id'].strip()}]: actor {base!r} at "
                    f"year {y} is outside its {lo}..{hi} lifespan "
                    f"(city {r['city_id'].strip()})"
                )
        roots.setdefault(_actor_root(actor), set()).add(base)
    for root, forms in sorted(roots.items()):
        if len(forms) > 1 and root not in DISTINCT_OK:
            warnings.append(
                f"actor naming: {sorted(forms)} share root {root!r} — "
                "unify unless deliberately distinct"
            )


def main():
    cities = load("cities.csv")
    names = load("names.csv")
    obs = load("observations.csv")

    city_ids = set()
    for r in cities:
        cid = r["city_id"].strip()
        if cid in city_ids:
            errors.append(f"cities.csv: duplicate city_id {cid!r}")
        city_ids.add(cid)
        lat = as_int_or_float(r, "lat", f"cities.csv[{cid}]")
        lon = as_int_or_float(r, "lon", f"cities.csv[{cid}]")
        if lat is not None and not -90 <= lat <= 90:
            errors.append(f"cities.csv[{cid}]: lat {lat} out of range")
        if lon is not None and not -180 <= lon <= 180:
            errors.append(f"cities.csv[{cid}]: lon {lon} out of range")

    # names.csv references a real city and has ordered years
    for r in names:
        cid = r["city_id"].strip()
        if cid not in city_ids:
            errors.append(f"names.csv: unknown city_id {cid!r} for name {r['name']!r}")
        fy = as_int(r, "from_year", f"names.csv[{cid}/{r['name']}]")
        ty = as_int(r, "to_year", f"names.csv[{cid}/{r['name']}]")
        if fy is not None and ty is not None and fy > ty:
            errors.append(f"names.csv[{cid}/{r['name']}]: from_year {fy} > to_year {ty}")

    # observations.csv: the heart of the dataset
    obs_ids = set()
    for r in obs:
        oid = r["obs_id"].strip()
        where = f"observations.csv[{oid}]"
        if oid in obs_ids:
            errors.append(f"{where}: duplicate obs_id")
        obs_ids.add(oid)
        if r["city_id"].strip() not in city_ids:
            errors.append(f"{where}: unknown city_id {r['city_id']!r}")
        if r["event_type"].strip() not in EVENT_TYPES:
            errors.append(f"{where}: unknown event_type {r['event_type']!r}")
        if r["date_precision"].strip() not in DATE_PRECISION:
            errors.append(f"{where}: unknown date_precision {r['date_precision']!r}")
        if r["confidence"].strip() not in CONFIDENCE:
            errors.append(f"{where}: unknown confidence {r['confidence']!r}")
        if not r["source"].strip():
            errors.append(f"{where}: missing source")
        ys = as_int(r, "year_start", where)
        ye = as_int(r, "year_end", where)
        if ys is not None and ye is not None and ys > ye:
            errors.append(f"{where}: year_start {ys} > year_end {ye}")
        if r["event_type"].strip() == "population_estimate":
            val = (r.get("value") or "").strip()
            if not val.isdigit():
                errors.append(f"{where}: population_estimate value {val!r} is not a number")

    audit_history(obs)

    if warnings:
        print(f"{len(warnings)} naming warning(s) — review, non-blocking:")
        for w in warnings:
            print(f"  ~ {w}")
        print()

    if errors:
        print(f"FAIL: {len(errors)} problem(s) found\n")
        for e in errors:
            print(f"  - {e}")
        return 1
    print(
        f"OK: {len(cities)} cities, {len(names)} name records, "
        f"{len(obs)} observations — all checks passed"
    )
    return 0


def as_int_or_float(row, field, where):
    raw = (row.get(field) or "").strip()
    if raw == "":
        return None
    try:
        return float(raw)
    except ValueError:
        errors.append(f"{where}: {field}={raw!r} is not a number")
        return None


if __name__ == "__main__":
    sys.exit(main())
