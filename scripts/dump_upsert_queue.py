"""
dump_upsert_queue.py — emit docs/UPSERT-MIGRATION-QUEUE.md from DATA_SOURCES.

The queue ranks DataSources by how much they'd benefit from moving to
the diff/upsert path. Sources are bucketed:

  done            already on the upsert path (worked example tracking)
  pending         good candidate, not yet migrated
  skipped         deliberately not migrated (static, continuous, multi-
                  table, or upstream_format != 'arcgis')

Run after every commit that adopts an upsert loader so the queue stays
truthful. The skill `.claude/skills/upsert-loader/SKILL.md` reads this
file to find the next pending source.
"""
from __future__ import annotations

import inspect
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))

from app.services.data_loader import DATA_SOURCES, DataSource  # noqa: E402

OUT_PATH = REPO_ROOT / "docs" / "UPSERT-MIGRATION-QUEUE.md"


# Sources known to use the upsert path. Update when a migration completes.
# (We can't auto-detect this — the skill records here as the migration
# completes Phase 5.)
DONE_KEYS = {"auckland_flood"}


# Sources NOT to migrate. Reason captured per-key.
SKIP_REASONS = {
    "auckland_flood_sensitive": (
        "no stable ID — upstream has only OBJECTID (auto-increment, "
        "regenerated on every export) as the unique-per-feature field. "
        "All other fields repeat across rows or are nullable. AC re-runs "
        "the whole model wholesale rather than editing per-feature, so "
        "truncate+insert is the honest pattern. Investigated 2026-05-02 "
        "via the upsert-loader skill."
    ),
}


def _classify(ds: DataSource) -> tuple[str, str]:
    """Return (status, reason)."""
    if ds.key in DONE_KEYS:
        return "done", "already migrated"
    if ds.key in SKIP_REASONS:
        return "skipped", SKIP_REASONS[ds.key]

    # Static sources don't refresh, so upsert offers nothing.
    if ds.cadence_class == "static":
        return "skipped", "static cadence — no refresh, no upsert benefit"

    # Continuous sources are lazy-fetched per-property, not bulk-loaded.
    if ds.cadence_class == "continuous":
        return "skipped", "continuous (lazy-fetch placeholder, not bulk-loaded)"

    # Sources with no upstream URL can't be auto-refreshed at all yet.
    if ds.upstream_url is None:
        return "skipped", "no upstream_url set — populate URL first"

    # Non-ArcGIS sources can't use _load_council_arcgis_upsert.
    if ds.upstream_format != "arcgis":
        return "skipped", f"upstream_format={ds.upstream_format} (upsert helper is ArcGIS-only)"

    # Otherwise: pending.
    return "pending", "good candidate"


def _priority_score(ds: DataSource) -> int:
    """Higher = process sooner. Used to order pending sources."""
    score = 0
    # Monthly/weekly cadence wins over quarterly/yearly — they refresh more
    # often, so the diff/upsert payoff (touching only changed rows) is
    # bigger.
    score += {"weekly": 100, "monthly": 50, "quarterly": 10, "yearly": 5}.get(
        ds.check_interval, 0
    )
    # Live registers (arcgis_lastEditDate) > row_count_diff > none.
    score += {"arcgis_lastEditDate": 30, "http_etag": 20,
              "row_count_diff": 10, "manual": 0, "none": -10}.get(
        ds.change_detection, 0
    )
    # Auckland / Wellington / Christchurch are highest-traffic regions
    # where data freshness matters most.
    if any(ds.key.startswith(p) for p in ("auckland_", "wcc_", "gwrc_",
                                           "chch_", "christchurch_")):
        score += 20
    # Flood-related sources first — most actively republished by councils
    # after rainfall events.
    if "flood" in ds.key:
        score += 15
    return score


HEADER = """\
# UPSERT-MIGRATION-QUEUE.md

> AUTO-GENERATED from `backend/app/services/data_loader.py::DATA_SOURCES`.
> Do NOT hand-edit. Re-run `python scripts/dump_upsert_queue.py` after
> migrating a source. The skill `.claude/skills/upsert-loader/` reads
> this file to find the next pending entry.

The diff/upsert refactor (see `auckland_flood` — the worked example)
brings sources onto the per-row diff path that records changes in
`data_change_log` and avoids the DELETE-then-INSERT inconsistency
window. Each source is migrated independently — small, reviewable,
verifiable on prod before the next.

## Status

| Status | Count | Meaning |
|---|---|---|
| done | {done_count} | Already migrated to upsert |
| pending | {pending_count} | Good candidate; awaiting skill invocation |
| skipped | {skipped_count} | Deliberately NOT migrated (reason in row) |

## How to use

1. Pick the **first pending** row (highest priority — already sorted).
2. Invoke the upsert-loader skill with that source key.
3. Skill walks Phases 1-5; you approve each checkpoint.
4. On Phase 5 success, edit this file's `DONE_KEYS` in
   `scripts/dump_upsert_queue.py` to add the key, then re-run the
   script to refresh the table.

## Pending sources (priority order)

| # | source_key | tables | authority | cadence | check | detection | priority |
|---|---|---|---|---|---|---|---|
"""


def main() -> None:
    rows = []
    for ds in DATA_SOURCES:
        status, reason = _classify(ds)
        rows.append((ds, status, reason, _priority_score(ds)))

    pending = sorted(
        [r for r in rows if r[1] == "pending"],
        key=lambda r: -r[3],  # priority desc
    )
    done = sorted([r for r in rows if r[1] == "done"], key=lambda r: r[0].key)
    skipped = sorted([r for r in rows if r[1] == "skipped"],
                     key=lambda r: r[0].key)

    out = [HEADER.format(
        done_count=len(done),
        pending_count=len(pending),
        skipped_count=len(skipped),
    )]

    for i, (ds, _, _, score) in enumerate(pending, 1):
        out.append("| {} | `{}` | {} | {} | {} | {} | {} | {} |".format(
            i, ds.key, ", ".join(ds.tables), ds.authority or "-",
            ds.cadence_class, ds.check_interval, ds.change_detection,
            score,
        ))

    out.append("\n## Done")
    out.append("\n| source_key | tables | notes |")
    out.append("|---|---|---|")
    for ds, _, reason, _ in done:
        out.append(f"| `{ds.key}` | {', '.join(ds.tables)} | {reason} |")

    out.append("\n## Skipped (with reason)")
    out.append("\n| source_key | reason |")
    out.append("|---|---|")
    for ds, _, reason, _ in skipped:
        out.append(f"| `{ds.key}` | {reason} |")

    OUT_PATH.write_text("\n".join(out), encoding="utf-8")
    print(f"Wrote {OUT_PATH}")
    print(f"  done: {len(done)}")
    print(f"  pending: {len(pending)}")
    print(f"  skipped: {len(skipped)}")
    if pending:
        nxt = pending[0][0]
        print(f"\nNext pending: {nxt.key} (priority {pending[0][3]})")


if __name__ == "__main__":
    main()
