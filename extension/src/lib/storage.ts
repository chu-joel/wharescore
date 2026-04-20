// Thin wrappers over chrome.storage. Three scopes are used:
//   session. JWT cache (cleared when the browser restarts)
//   sync   . user preferences (per-site toggles, pause-all, drag position)
//   local  . per-address dismissals (7-day TTL)
import type { SourceSite } from "./constants";

interface CachedJwt { token: string; expiresAt: number; }

const JWT_KEY = "jwt";
const PAUSE_KEY = "pauseUntil";
const SITE_TOGGLE_KEY = "siteToggles";
const DISMISS_PREFIX = "dismiss:";
const STATUS_KEY = "statusPayload";
const STATUS_AT_KEY = "statusFetchedAt";

const DEFAULT_SITE_TOGGLES: Record<SourceSite, boolean> = {
  "homes.co.nz": true,
  "oneroof.co.nz": true,
  "trademe.co.nz": true,
  "realestate.co.nz": true,
};

export async function getCachedJwt(): Promise<CachedJwt | null> {
  const res = await chrome.storage.session.get(JWT_KEY);
  const cached = res[JWT_KEY] as CachedJwt | undefined;
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) return null;
  return cached;
}

export async function setCachedJwt(token: string, ttlMs: number): Promise<void> {
  const record: CachedJwt = { token, expiresAt: Date.now() + ttlMs };
  await chrome.storage.session.set({ [JWT_KEY]: record });
}

export async function clearJwt(): Promise<void> {
  await chrome.storage.session.remove(JWT_KEY);
}

export async function getPauseUntil(): Promise<number> {
  const res = await chrome.storage.sync.get(PAUSE_KEY);
  return (res[PAUSE_KEY] as number | undefined) ?? 0;
}

export async function setPauseUntil(epochMs: number): Promise<void> {
  await chrome.storage.sync.set({ [PAUSE_KEY]: epochMs });
}

export async function getSiteToggles(): Promise<Record<SourceSite, boolean>> {
  const res = await chrome.storage.sync.get(SITE_TOGGLE_KEY);
  const stored = res[SITE_TOGGLE_KEY] as Record<string, boolean> | undefined;
  return { ...DEFAULT_SITE_TOGGLES, ...(stored ?? {}) };
}

export async function setSiteToggle(site: SourceSite, enabled: boolean): Promise<void> {
  const current = await getSiteToggles();
  current[site] = enabled;
  await chrome.storage.sync.set({ [SITE_TOGGLE_KEY]: current });
}

export async function dismissAddress(addressId: number): Promise<void> {
  const key = `${DISMISS_PREFIX}${addressId}`;
  await chrome.storage.local.set({ [key]: Date.now() + 7 * 24 * 60 * 60 * 1000 });
}

export async function isDismissed(addressId: number): Promise<boolean> {
  const key = `${DISMISS_PREFIX}${addressId}`;
  const res = await chrome.storage.local.get(key);
  const expiresAt = res[key] as number | undefined;
  if (!expiresAt) return false;
  if (expiresAt <= Date.now()) {
    await chrome.storage.local.remove(key);
    return false;
  }
  return true;
}

export async function getCachedStatus(): Promise<{ payload: unknown; fetchedAt: number } | null> {
  const res = await chrome.storage.local.get([STATUS_KEY, STATUS_AT_KEY]);
  const payload = res[STATUS_KEY];
  const fetchedAt = res[STATUS_AT_KEY] as number | undefined;
  if (!payload || !fetchedAt) return null;
  return { payload, fetchedAt };
}

export async function setCachedStatus(payload: unknown): Promise<void> {
  await chrome.storage.local.set({
    [STATUS_KEY]: payload,
    [STATUS_AT_KEY]: Date.now(),
  });
}
