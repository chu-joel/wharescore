// The (tier × persona × viewport × state) grid this capture walks.
//
// Keep this small + legible — the judge reads the shot IDs to reason about
// what was captured vs what's missing. Numeric explosion hurts both judgement
// cost and debugging time. Tiers × personas that don't need a state are
// skipped (see criteria.md § Cells OK to skip).
import type { FixtureId } from "./fixtures";
import type { InteractionState } from "./mount";

export interface Viewport {
  name: string;
  width: number;
  height: number;
}

export const VIEWPORTS: Viewport[] = [
  { name: "mobile-375",  width: 375,  height: 667  },
  { name: "tablet-768",  width: 768,  height: 1024 },
  { name: "desktop-1440", width: 1440, height: 900 },
];

export interface MatrixCell {
  shotId: string;
  fixture: FixtureId;
  state: InteractionState;
  viewport: Viewport;
}

export function buildMatrix(): MatrixCell[] {
  const cells: MatrixCell[] = [];

  // 1. Default state for every tier × persona × viewport — 5 × 3 = 15
  const tierPersonas: FixtureId[] = ["anon", "free_renter", "free_buyer", "pro_renter", "pro_buyer"];
  for (const fx of tierPersonas) {
    for (const vp of VIEWPORTS) {
      cells.push({ shotId: `${fx}_default_${vp.name}`, fixture: fx, state: "default", viewport: vp });
    }
  }

  // 2. Loading + error: tier-agnostic, capture once per viewport with free_buyer
  for (const vp of VIEWPORTS) {
    cells.push({ shotId: `loading_${vp.name}`, fixture: "free_buyer", state: "loading", viewport: vp });
    cells.push({ shotId: `error_${vp.name}`,   fixture: "free_buyer", state: "error",   viewport: vp });
    cells.push({ shotId: `dismissed_${vp.name}`, fixture: "free_buyer", state: "dismissed", viewport: vp });
  }

  // 3. Focus + hover — spot-check on free_buyer (the most feature-dense free tier)
  for (const vp of VIEWPORTS) {
    cells.push({ shotId: `focus_free_buyer_${vp.name}`, fixture: "free_buyer", state: "focus", viewport: vp });
    cells.push({ shotId: `hover_free_buyer_${vp.name}`, fixture: "free_buyer", state: "hover", viewport: vp });
  }

  // 4. Ambiguous match — only makes sense for a matched-but-uncertain case;
  //    free_buyer fixture variant with ambiguous: true. Desktop + mobile only.
  cells.push({
    shotId: "ambiguous_mobile-375",
    fixture: "ambiguous", state: "default",
    viewport: VIEWPORTS[0],
  });
  cells.push({
    shotId: "ambiguous_desktop-1440",
    fixture: "ambiguous", state: "default",
    viewport: VIEWPORTS[2],
  });

  // 5. Reduced-motion — check animation suppression on the default free_buyer
  for (const vp of VIEWPORTS) {
    cells.push({ shotId: `reduced-motion_free_buyer_${vp.name}`, fixture: "free_buyer", state: "reduced-motion", viewport: vp });
  }

  return cells;
}
