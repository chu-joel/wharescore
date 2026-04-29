"""
dump_data_loaders.py — emit docs/DATA-LOADERS.md from the DataSource registry.

The registry in `backend/app/services/data_loader.py` is the source of truth
for every bulk loader. This script walks `DATA_SOURCES`, joins the operational
metadata (authority, upstream URL, cadence) attached to each entry, and
generates a single markdown table grouped by region/authority.

Run it after adding or modifying a DataSource:

    python scripts/dump_data_loaders.py

CI will fail if `docs/DATA-LOADERS.md` drifts from the registry.

The doc is intentionally derived, not hand-edited. Update DataSource fields in
`data_loader.py` instead — this script will regenerate the markdown.
"""
from __future__ import annotations

import inspect
import sys
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))

from app.services.data_loader import DATA_SOURCES, DataSource  # noqa: E402


OUT_PATH = REPO_ROOT / "docs" / "DATA-LOADERS.md"


def _loader_location(ds: DataSource) -> str:
    """Return 'data_loader.py:LINE' for the loader callable, or '-' for lambdas
    we can't introspect cleanly."""
    fn = ds.loader
    try:
        # Lambdas show as '<lambda>'; named functions show their __name__.
        name = getattr(fn, "__name__", None)
        if not name or name == "<lambda>":
            return "-"
        src_file, src_line = inspect.getsourcefile(fn), inspect.getsourcelines(fn)[1]
        if not src_file:
            return name
        rel = Path(src_file).relative_to(REPO_ROOT) if Path(src_file).is_relative_to(REPO_ROOT) else Path(src_file).name
        return f"`{str(rel).replace(chr(92), '/')}:{src_line}` `{name}`"
    except (OSError, TypeError):
        return name or "-"


def _classify_region(ds: DataSource) -> str:
    """Group key by the section it lives in. Falls back to authority or 'Other'."""
    k = ds.key.lower()
    # Region prefixes seen in the registry
    prefixes = [
        "auckland", "wellington", "wcc", "gwrc", "hutt", "porirua", "kapiti",
        "christchurch", "chch", "ccc", "ecan", "selwyn", "waimakariri",
        "hamilton", "waikato", "wrc", "thames", "waipa",
        "tauranga", "rotorua", "whakatane", "bopr",
        "napier", "hastings", "hbrc",
        "palmerston", "horowhenua", "manawatu",
        "new_plymouth", "taranaki", "trc", "stratford",
        "nelson", "tasman", "marlborough",
        "dunedin", "queenstown", "qldc", "waitaki", "orc",
        "invercargill", "southland",
        "whangarei", "far_north", "kaipara", "nrc",
        "westport", "grey", "westland", "wcrc",
        "gisborne", "wairoa",
    ]
    for p in prefixes:
        if k.startswith(p):
            return p.title().replace("_", " ")
    # National / multi-region authorities
    nationals = {
        "census": "Stats NZ", "linz": "LINZ", "gns": "GNS Science",
        "mbie": "MBIE", "doc": "DOC", "nzta": "NZTA", "reinz": "REINZ",
        "moe": "MoE", "mfe": "MfE", "osm": "OSM", "fibre": "Commerce Commission",
        "climate": "NIWA", "business": "Stats NZ", "cycleways": "OSM",
        "schools": "MoE / OSM", "epb": "MBIE",
    }
    for prefix, label in nationals.items():
        if k.startswith(prefix):
            return f"National — {label}"
    return ds.authority or "Other"


def _esc(s: str) -> str:
    return (s or "").replace("|", "\\|").replace("\n", " ")


def _row(ds: DataSource) -> str:
    return " | ".join(
        [
            f"`{ds.key}`",
            _esc(ds.label),
            _esc(", ".join(ds.tables)),
            _loader_location(ds),
            _esc(ds.authority) or "-",
            _esc(ds.upstream_format),
            f"[link]({ds.upstream_url})" if ds.upstream_url else "-",
            _esc(ds.cadence_class),
            _esc(ds.check_interval),
            _esc(ds.change_detection),
            _esc(ds.notes) or "-",
        ]
    )


HEADER = """\
# DATA-LOADERS.md — operational catalogue of bulk loaders

> AUTO-GENERATED from `backend/app/services/data_loader.py::DATA_SOURCES`.
> Do NOT hand-edit. To update a row, change the DataSource entry in code and
> re-run `python scripts/dump_data_loaders.py`.

This is the operational view of every dataset we bulk-load: where it comes
from, who the authority is, how often it changes, and how the scheduler
(future) decides whether to refresh it. Companion docs:

- `DATA-CATALOG.md` — what tables exist and what they store
- `DATA-PROVENANCE.md` — which user-facing field comes from which authority
- `DATA-LAYERS.md` — coverage matrix per council
- `RECIPES.md` — how to add a new loader

## Scheduled refresh

The daily GH Actions cron (`.github/workflows/data-refresh.yml`) hits
`POST /admin/data-sources/refresh-due`. That endpoint walks every
DataSource that's "due" per its `cadence_class` + `check_interval` (using
`is_due_for_check()` in `backend/app/services/loader_freshness.py`), polls
the upstream metadata via the source's `change_detection` method, and
triggers a full reload only when the upstream marker has changed.

Two safety mechanisms protect production data:

1. **Validation gate** (`validate_row_count`). A reload is rejected if the
   new row count is below 50% of the previous successful load — prevents
   the catastrophic case where ArcGIS returns 0 features due to a
   transient error and DELETE-then-INSERT wipes good data. Static and
   continuous sources opt out (legitimate row-count fluctuations).

2. **`data_source_health` table** (migration 0061). Records every
   attempt: `last_attempt_at`, `last_success_at`, `last_row_count`,
   `last_error`, `consecutive_failures`, `last_blocked_by_gate`. The
   admin dashboard (`GET /admin/data-sources/health`) sorts by problems
   first.

The cron processes at most `limit=10` due sources per run (default) so a
backlog can't run away. `dry_run=true` performs the cheap freshness check
but skips reloads — useful for verifying classifications before enabling
auto-refresh.

## Cadence classes

| Class | Meaning | Refresh policy |
|---|---|---|
| `static` | Never changes after initial load (historical catalogues, frozen census tabulations) | Do not auto-refresh |
| `revisable` | Changes only when the authority republishes (district plans, hazard maps) | Cheap freshness check; full reload only on diff |
| `periodic` | Publishes on a known cadence (GTFS weekly, REINZ HPI monthly) | Schedule matches publication cadence |
| `continuous` | Changes any time | Lazy-fetch or short-TTL cache, not bulk reload |
| `unknown` | Not yet classified | Treat as `revisable` until classified |

## Change-detection methods

| Method | Cost | Notes |
|---|---|---|
| `arcgis_lastEditDate` | 1 HTTP request, ~1KB | ArcGIS metadata endpoint (`?f=pjson` → `editingInfo.lastEditDate`) |
| `http_etag` | 1 HEAD request | Plain HTTP ETag / Last-Modified header (GTFS zips, plain GeoJSON) |
| `row_count_diff` | Full download | Count rows after fetch, compare to last successful row count |
| `manual` | - | Operator-triggered; no automatic check |
| `none` | - | No upstream poll possible (e.g. one-shot CSV imports) |
| `unknown` | - | Not yet classified |

## Loaders

Columns: `key` (DataSource identifier) · `label` (human description) · `tables` (DB targets) · `loader` (function or lambda location) · `authority` · `format` · `upstream URL` · `cadence_class` · `check_interval` · `change_detection` · `notes`.

"""


TABLE_HDR = (
    "| key | label | tables | loader | authority | format | upstream | cadence | check | detection | notes |\n"
    "|---|---|---|---|---|---|---|---|---|---|---|"
)


def main() -> None:
    grouped: dict[str, list[DataSource]] = defaultdict(list)
    for ds in DATA_SOURCES:
        grouped[_classify_region(ds)].append(ds)

    out = [HEADER]

    # National sections first, then alphabetical regions
    nat_keys = sorted(k for k in grouped if k.startswith("National"))
    other_keys = sorted(k for k in grouped if not k.startswith("National") and k != "Other")
    if "Other" in grouped:
        other_keys.append("Other")

    for section in nat_keys + other_keys:
        rows = grouped[section]
        out.append(f"\n### {section} ({len(rows)} loaders)\n")
        out.append(TABLE_HDR)
        for ds in sorted(rows, key=lambda d: d.key):
            out.append("| " + _row(ds) + " |")

    # Summary footer
    total = len(DATA_SOURCES)
    classified = sum(1 for d in DATA_SOURCES if d.cadence_class != "unknown")
    out.append(
        f"\n\n---\n\n"
        f"**Summary:** {total} DataSources total, {classified} classified "
        f"({classified * 100 // total}%). Backfill the rest by adding "
        f"`upstream_url`, `cadence_class`, `check_interval`, and "
        f"`change_detection` to each DataSource registration in "
        f"`data_loader.py`, then re-run this script.\n"
    )

    OUT_PATH.write_text("\n".join(out), encoding="utf-8")
    print(f"Wrote {OUT_PATH} ({total} loaders, {classified} classified)")


if __name__ == "__main__":
    main()
