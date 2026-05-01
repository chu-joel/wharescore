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
    auto = "yes" if getattr(ds, "auto_load_enabled", True) else "**no**"
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
            auto,
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

## auto_load_enabled flag

Each DataSource has an `auto_load_enabled` boolean (default `True`). When
set to `False`, the source is **registered for inventory** but **excluded
from all bulk automation**:

- `POST /admin/data-sources/load-new` skips it.
- `POST /admin/data-sources/reload-all` (without explicit `keys=`) skips it.
- `is_due_for_check` returns False, so the cron's
  `POST /admin/data-sources/refresh-due` skips it.

The single-source endpoint `POST /admin/data-sources/{key}/load` still
runs it — operators can fire it explicitly. Use `auto_load_enabled=False`
for newly-migrated script-based loaders that need verification on prod
before they're trusted to run unattended. Flip to `True` once the loader
has been confirmed end-to-end.

## Loaders

Columns: `key` (DataSource identifier) · `label` (human description) · `tables` (DB targets) · `loader` (function or lambda location) · `authority` · `format` · `upstream URL` · `cadence_class` · `check_interval` · `change_detection` · `notes`.

"""


TABLE_HDR = (
    "| key | label | tables | loader | authority | format | upstream | cadence | check | detection | auto | notes |\n"
    "|---|---|---|---|---|---|---|---|---|---|---|---|"
)


# Script-only loaders: scripts/load_*.py that populate tables the report
# actively queries but are NOT registered in DATA_SOURCES. They run only
# when an operator manually executes the script on the prod VM. Outside
# the cron + validation gate. Each row should eventually become a real
# DataSource — until then, these are tracked here for inventory.
#
# Schema: (script_path, [tables], authority, intended_cadence_class,
#          intended_check_interval, intended_change_detection, notes)
_SCRIPT_ONLY_LOADERS: list[tuple] = [
    ("scripts/load_osm_amenities.py", ["osm_amenities"],
     "OpenStreetMap", "periodic", "quarterly", "row_count_diff",
     "Overpass API per city. Rate-limited; bulk reload only."),
    ("scripts/load_all_datasets.py", ["crashes", "earthquakes", "schools"],
     "NZTA CAS / GeoNet / MoE", "periodic", "yearly", "row_count_diff",
     "Multi-table CSV ingest. Should be split into 3 separate DataSources before migration."),
    ("scripts/load_tier3_datasets.py",
     ["air_quality_sites", "water_quality_sites", "wildfire_risk", "heritage_sites"],
     "LAWA / FENZ / NZHPT", "revisable", "monthly", "row_count_diff",
     "LAWA monitoring + FENZ fire risk + NZHPT heritage. Split per source on migration."),
    ("scripts/load_tier4_datasets.py",
     ["contaminated_land", "district_plan_zones", "earthquake_prone_buildings",
      "height_controls", "resource_consents"],
     "Multi-source national bulk", "revisable", "quarterly", "row_count_diff",
     "Mostly redundant with per-council DataSources — verify before migrating; may be deletable."),
    ("scripts/load_doc_conservation.py", ["conservation_land"],
     "DOC", "revisable", "quarterly", "row_count_diff",
     "DOC public conservation land. Used in nearby.py + report."),
    ("scripts/load_landslides.py", ["landslide_areas", "landslide_events"],
     "GNS Science", "revisable", "quarterly", "row_count_diff",
     "Possibly overlaps with the registered `gns_landslides` DataSource — verify."),
    ("scripts/load_nzdep.py", ["nzdep"],
     "Stats NZ / University of Otago", "static", "never", "none",
     "NZ Deprivation Index. Census-aligned, every 5 years (next ~2028)."),
    ("scripts/load_climate_projections.py", ["climate_projections"],
     "NIWA / MfE", "static", "never", "none",
     "NIWA climate projection report data. One-off ingest per IPCC report cycle."),
    ("scripts/load_bonds_detailed.py", ["bonds_detailed"],
     "MBIE Tenancy", "periodic", "monthly", "http_etag",
     "MBIE rental bond lodgements. Published monthly."),
    ("scripts/load_rbnz_housing.py", ["rbnz_housing"],
     "Reserve Bank of NZ", "periodic", "quarterly", "http_etag",
     "RBNZ housing data. Quarterly publication."),
    ("scripts/load_wcc_valuations.py", ["council_valuations"],
     "Wellington City Council", "periodic", "yearly", "row_count_diff",
     "WCC property valuations. Annual revaluation cycle."),
    ("scripts/load_infrastructure.py", ["infrastructure_projects"],
     "Manual research", "revisable", "quarterly", "manual",
     "Hand-curated infrastructure project register. Update when new major projects announced."),
    ("scripts/load_wellington_data.py",
     ["gwrc_earthquake_hazard", "gwrc_ground_shaking", "gwrc_liquefaction",
      "gwrc_slope_failure", "mbie_epb_history"],
     "GWRC / MBIE", "revisable", "quarterly", "row_count_diff",
     "Mostly redundant with `wcc_hazards` + `gwrc_earthquake` registered DataSources — verify before migrating."),
    ("backend/scripts/load_christchurch_hazards.py + load_regional_hazards.py",
     ["flood_zones", "liquefaction_zones", "tsunami_zones"],
     "Multi-council national base layers", "revisable", "quarterly", "row_count_diff",
     "National base hazard layers — flood_zones, liquefaction_zones, tsunami_zones — populated per-region. Mostly Wellington-only in current data; report SQL queries these as fallback alongside per-council overlays."),
]


# Seed-only tables: populated once on initial deploy via pg_dump restore or
# inline migration INSERTs. They are NOT loaders — they don't have an
# upstream that needs polling. Documented here so future agents don't try
# to "fix" the missing loader.
_SEED_ONLY_TABLES: list[tuple[str, str, str]] = [
    ("addresses", "Bulk pg_dump restore on initial deploy",
     "NZ Post / LINZ address dataset. ~2M rows. Restored from a seed package, not loaded."),
    ("meshblocks", "Bulk pg_dump restore on initial deploy",
     "Stats NZ Census 2023 meshblock geographies. Restored from seed."),
    ("sa2_boundaries", "Bulk pg_dump restore on initial deploy",
     "Stats NZ Statistical Area 2 boundaries. Restored from seed."),
    ("cbd_points", "Hardcoded INSERT in migration 0023_universal_transit.sql",
     "City CBD coordinates for distance calculations. Static — only changes if we add a new city."),
    ("hpi_national", "Hardcoded INSERT in migration 0023",
     "National HPI seed. Superseded by reinz_hpi_ta (per-TA) — see admin REINZ HPI upload endpoint."),
    ("reinz_hpi_ta", "Operator-uploaded via POST /admin/reinz-hpi/upload",
     "Per-territorial-authority HPI from REINZ. Uploaded monthly by an operator pulling REINZ's published Excel; not auto-fetched (REINZ has no public API for this)."),
]


# Genuinely missing — no writer in code, no seed, but the report queries it.
# These are real gaps to fix.
_MISSING_LOADERS: list[tuple[str, str, str]] = [
    # (intentionally empty — every table the audit flagged as "missing"
    #  turned out to have either a script-based loader or a seed path.
    #  Keep this list as the place to record a real gap when one appears.)
]


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

    # ─── Script-only loaders ─────────────────────────────────────────────
    out.append(
        "\n\n---\n\n## Script-only loaders (NOT in DATA_SOURCES registry)\n\n"
        "These scripts in `scripts/` populate tables the report actively\n"
        "queries, but are **not registered** in `DATA_SOURCES`. They run\n"
        "only when an operator manually executes the script on the prod\n"
        "VM — they are outside the cron, outside the validation gate, and\n"
        "outside the health table. Each row should eventually be migrated\n"
        "into a real DataSource entry; until then they're tracked here so\n"
        "the inventory is complete.\n\n"
        "When migrating: open the script, extract its `main()` /\n"
        "ingest function, wrap it in a `def load_X(conn, log)` matching\n"
        "the DataSource loader signature, then add a `DataSource(...)`\n"
        "entry to `DATA_SOURCES` with the cadence fields shown below.\n\n"
        "| script | tables | authority | cadence_class | check_interval | change_detection | notes |\n"
        "|---|---|---|---|---|---|---|"
    )
    for script, tables, authority, cadence, check, detection, notes in _SCRIPT_ONLY_LOADERS:
        out.append(
            f"| `{script}` | {', '.join(tables)} | {authority} | "
            f"{cadence} | {check} | {detection} | {_esc(notes)} |"
        )

    # ─── Seed-only tables ────────────────────────────────────────────────
    out.append(
        "\n\n## Seed-only tables (no loader, populated once at deploy)\n\n"
        "These tables are populated by initial `pg_dump` restore, by\n"
        "hardcoded `INSERT` statements in migrations, or by operator\n"
        "uploads. They have **no upstream feed** that needs polling and\n"
        "do **not** require a DataSource entry. Documented here so future\n"
        "agents don't try to build a loader for them.\n\n"
        "| table | populated by | notes |\n"
        "|---|---|---|"
    )
    for table, populated_by, notes in _SEED_ONLY_TABLES:
        out.append(f"| `{table}` | {populated_by} | {_esc(notes)} |")

    # ─── Genuinely missing ───────────────────────────────────────────────
    if _MISSING_LOADERS:
        out.append(
            "\n\n## Missing loaders (real gaps — table queried, no writer)\n\n"
            "These tables are queried by the production code path but no\n"
            "loader (DataSource OR script) writes to them. Each is a real\n"
            "gap that should be filled with a new DataSource.\n\n"
            "| table | queried by | suggested upstream | notes |\n"
            "|---|---|---|---|"
        )
        for table, queried_by, suggested in _MISSING_LOADERS:
            out.append(f"| `{table}` | {queried_by} | {suggested} | - |")
    else:
        out.append(
            "\n\n## Missing loaders (real gaps — table queried, no writer)\n\n"
            "_None as of last audit. Every table the report queries has at\n"
            "least a script-based or seed-based writer._\n"
        )

    # ─── Summary footer ──────────────────────────────────────────────────
    total = len(DATA_SOURCES)
    classified = sum(1 for d in DATA_SOURCES if d.cadence_class != "unknown")
    out.append(
        f"\n\n---\n\n"
        f"**Coverage summary:**\n\n"
        f"- DataSource registry: **{total} loaders, {classified} classified "
        f"({classified * 100 // total}%)**\n"
        f"- Script-only loaders not yet migrated: **{len(_SCRIPT_ONLY_LOADERS)}**\n"
        f"- Seed-only tables (intentional, no loader): **{len(_SEED_ONLY_TABLES)}**\n"
        f"- Genuinely-missing loaders: **{len(_MISSING_LOADERS)}**\n"
    )

    OUT_PATH.write_text("\n".join(out), encoding="utf-8")
    print(f"Wrote {OUT_PATH} ({total} loaders, {classified} classified)")


if __name__ == "__main__":
    main()
