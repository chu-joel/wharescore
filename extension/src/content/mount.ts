// Shared mount logic for every content script. Each site file does three
// things: declare the site name, declare the extractor function, and call
// mountBadge(). Nothing else.
//
// The flow:
//   1. Check the shared pause-all + per-site toggle + kill-switch status.
//   2. Wait for the host page to render the listing address (SPAs may hydrate
//      asynchronously, so we retry up to 3s before giving up silently).
//   3. Extract the address using the site-specific extractor.
//   4. Check address-level dismissal (7-day memory).
//   5. Mount the badge, fetch data, render.
//
// Everything is silent-on-failure per the brief. no console spam, no alert,
// no visual error if the host page simply doesn't have an address yet.
import { API_BASE, type BadgeResponse, type SourceSite } from "@/lib/constants";
import { fetchBadge, fetchJwt } from "@/lib/api";
import {
  getCachedStatus, getPauseUntil, getSiteToggles, isDismissed,
} from "@/lib/storage";
import type { Extractor } from "@/lib/extractors";
import { Badge, shouldSkipForDismissal } from "@/badge/Badge";

interface MountOpts {
  site: SourceSite;
  extractor: Extractor;
}

const EXTRACT_MAX_WAIT_MS = 3000;
const EXTRACT_INTERVAL_MS = 250;

export async function mountBadge(opts: MountOpts): Promise<void> {
  // 1. Gate checks. silent return if the user paused or toggled off.
  const pausedUntil = await getPauseUntil();
  if (pausedUntil && pausedUntil > Date.now()) return;

  const toggles = await getSiteToggles();
  if (toggles[opts.site] === false) return;

  const status = await getCachedStatus();
  if (status?.payload) {
    const sites = (status.payload as { sites?: Record<string, { badge_enabled?: boolean }> }).sites;
    if (sites?.[opts.site]?.badge_enabled === false) return;
  }

  // 2. Extract. poll the DOM until the address appears or we time out.
  const address = await waitForAddress(opts.extractor);
  if (!address) return;

  // 3. Mount skeleton first so the user gets instant feedback.
  const handlers = {
    site: opts.site,
    onSave: async (addressId: number, fullAddress: string) => {
      await saveProperty(addressId, fullAddress);
    },
    onRetry: async () => {
      badge.renderLoading();
      await fetchAndRender(badge, opts.site, address);
    },
  };
  const badge = new Badge(handlers);
  badge.renderLoading();

  await fetchAndRender(badge, opts.site, address);
}

async function waitForAddress(extractor: Extractor): Promise<string | null> {
  const deadline = Date.now() + EXTRACT_MAX_WAIT_MS;
  let address: string | null = null;
  while (Date.now() < deadline) {
    try {
      address = extractor(document);
    } catch {
      address = null;
    }
    if (address) return address;
    await sleep(EXTRACT_INTERVAL_MS);
  }
  return null;
}

async function fetchAndRender(badge: Badge, site: SourceSite, address: string): Promise<void> {
  const sourceUrl = window.location.href;
  const data = await fetchBadge(site, address, sourceUrl);
  if (!data) {
    badge.renderError("WhareScore unavailable. try again.");
    return;
  }
  if (!data.matched) {
    // Spec: silent. the listing address couldn't be resolved against LINZ.
    badge.remove();
    return;
  }
  if (data.address_id != null && await isDismissed(data.address_id)) {
    badge.remove();
    return;
  }
  // Second dismissal check post-render in case the address resolved to an
  // already-dismissed id between mount and render.
  if (await shouldSkipForDismissal(data.address_id ?? null)) {
    badge.remove();
    return;
  }
  badge.renderData(data);
}

async function saveProperty(addressId: number, fullAddress: string): Promise<void> {
  const token = await fetchJwt();
  if (!token) throw new Error("not signed in");
  const res = await fetch(`${API_BASE}/api/v1/account/saved-properties`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ address_id: addressId, full_address: fullAddress }),
  });
  if (!res.ok) throw new Error(`save failed ${res.status}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type { BadgeResponse };
