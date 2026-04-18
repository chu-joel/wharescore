// Test harness entry — compiled to an IIFE by esbuild and loaded into
// a Playwright page. Exposes `window.mountBadge(fixtureId, state)` so
// the capture script can drive the badge without running the full
// content-script / auth / fetch chain.
//
// Chrome APIs the Badge class touches (chrome.storage.sync) are stubbed
// with in-memory fakes so the drag-offset persistence code paths don't
// throw. The stubs never cross the test boundary — no persistence.

import { Badge } from "../../src/badge/Badge";
import { FIXTURES, type FixtureId } from "./fixtures";
import type { BadgeResponse, SourceSite } from "../../src/lib/constants";

interface StorageArea {
  get: (key?: string) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
  remove: (keys: string | string[]) => Promise<void>;
  clear: () => Promise<void>;
}

function makeMemoryStorage(): StorageArea {
  const mem = new Map<string, unknown>();
  return {
    async get(key?: string) {
      if (!key) return Object.fromEntries(mem.entries());
      return key in Object.fromEntries(mem.entries()) ? { [key]: mem.get(key) } : {};
    },
    async set(items: Record<string, unknown>) {
      for (const [k, v] of Object.entries(items)) mem.set(k, v);
    },
    async remove(keys: string | string[]) {
      const arr = Array.isArray(keys) ? keys : [keys];
      for (const k of arr) mem.delete(k);
    },
    async clear() { mem.clear(); },
  };
}

(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: {
    sync: makeMemoryStorage(),
    local: makeMemoryStorage(),
    session: makeMemoryStorage(),
  },
};

export type InteractionState =
  | "default"
  | "loading"
  | "error"
  | "focus"
  | "hover"
  | "dismissed"
  | "reduced-motion";

async function mountBadge(fixtureId: FixtureId, state: InteractionState): Promise<void> {
  // Clear any prior badge (e.g. if Playwright reuses page)
  document.querySelectorAll("[data-wharescore-badge]").forEach((el) => el.remove());

  const fixture: BadgeResponse = FIXTURES[fixtureId];
  const site: SourceSite = "homes.co.nz";

  const badge = new Badge({
    site,
    onSave: async () => { /* no-op in harness */ },
    onRetry: async () => { /* no-op in harness */ },
  });

  switch (state) {
    case "loading":
      badge.renderLoading();
      break;

    case "error":
      badge.renderError("WhareScore unavailable — try again");
      break;

    case "dismissed": {
      badge.renderData(fixture);
      // Click the dismiss button after a tick
      await new Promise((r) => setTimeout(r, 50));
      const dismissBtn = document
        .querySelector("[data-wharescore-badge]")
        ?.shadowRoot?.querySelector<HTMLButtonElement>(".ws-dismiss");
      dismissBtn?.click();
      // Let the 240ms dismiss animation complete
      await new Promise((r) => setTimeout(r, 300));
      break;
    }

    case "focus": {
      badge.renderData(fixture);
      await new Promise((r) => setTimeout(r, 50));
      const focusable = document
        .querySelector("[data-wharescore-badge]")
        ?.shadowRoot?.querySelector<HTMLElement>(".ws-save:not([disabled]), .ws-open, .ws-dismiss");
      focusable?.focus();
      break;
    }

    case "hover": {
      badge.renderData(fixture);
      await new Promise((r) => setTimeout(r, 50));
      const btn = document
        .querySelector("[data-wharescore-badge]")
        ?.shadowRoot?.querySelector<HTMLElement>(".ws-save");
      // Synthesise hover — Playwright also provides page.hover(), but we
      // need the event to fire inside the shadow root.
      btn?.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      btn?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      break;
    }

    case "reduced-motion":
    case "default":
    default:
      badge.renderData(fixture);
      break;
  }
}

// Expose to the Playwright page. Types are informational only — the page
// context sees a loose global.
(window as unknown as { mountBadge: typeof mountBadge }).mountBadge = mountBadge;
