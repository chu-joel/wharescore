// Unit tests for src/lib/api.ts. Covers:
//  - token cache read-through (returns cached JWT without a network call)
//  - 401 on /token clears the cache and returns null (Level 0 mode)
//  - 401 on /badge triggers a one-shot refresh-and-retry
//  - /badge body includes source_url (persona hint) when the site has one
//  - status fetch returns the JSON body on success, null on failure
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fetchBadge, fetchJwt, fetchStatus } from "../src/lib/api";

const sessionStore = new Map<string, unknown>();

function mockChrome() {
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      session: {
        get: vi.fn(async (key: string) => ({ [key]: sessionStore.get(key) })),
        set: vi.fn(async (obj: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(obj)) sessionStore.set(k, v);
        }),
        remove: vi.fn(async (key: string) => { sessionStore.delete(key); }),
      },
      local: { get: vi.fn(async () => ({})), set: vi.fn(async () => {}), remove: vi.fn(async () => {}) },
      sync:  { get: vi.fn(async () => ({})), set: vi.fn(async () => {}) },
    },
  };
}

describe("api.ts", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    sessionStore.clear();
    mockChrome();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("fetchJwt caches the token for subsequent calls", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ token: "fresh.jwt" }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const a = await fetchJwt();
    const b = await fetchJwt();
    expect(a).toBe("fresh.jwt");
    expect(b).toBe("fresh.jwt");
    expect(fetchMock).toHaveBeenCalledTimes(1);  // second call hit the cache
  });

  it("fetchJwt returns null on 401 and clears the cache", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;
    expect(await fetchJwt()).toBeNull();
  });

  it("fetchBadge includes source_url (path-only, query stripped)", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({  // /token fetch
        ok: true, status: 200, json: async () => ({ token: "jwt1" }),
      })
      .mockResolvedValueOnce({  // /badge fetch
        ok: true, status: 200,
        json: async () => ({ matched: true, tier: "free", score: 50 }),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await fetchBadge(
      "homes.co.nz",
      "10 Queen Street, Auckland",
      "https://homes.co.nz/address/x/y/?ref=share#map",
    );

    const badgeCall = fetchMock.mock.calls[1];
    const body = JSON.parse(badgeCall[1].body as string);
    expect(body.source_site).toBe("homes.co.nz");
    expect(body.address_text).toBe("10 Queen Street, Auckland");
    // Query + fragment stripped — brief says path-only.
    expect(body.source_url).toBe("https://homes.co.nz/address/x/y/");
  });

  it("fetchBadge refreshes once on 401 and retries", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ token: "stale" }) })   // first /token
      .mockResolvedValueOnce({ ok: false, status: 401 })                                           // /badge 401
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ token: "fresh" }) })   // refresh /token
      .mockResolvedValueOnce({ ok: true, status: 200,
        json: async () => ({ matched: true, tier: "free", score: 50 }) });                         // retried /badge

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await fetchBadge("homes.co.nz", "10 Queen Street, Auckland", null);
    expect(res).toEqual({ matched: true, tier: "free", score: 50 });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("fetchStatus returns the JSON body on success, null on failure", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ min_version: "0.1.0", latest_version: "0.1.0", sites: {}, message: null }),
    }) as unknown as typeof fetch;
    const ok = await fetchStatus();
    expect(ok?.latest_version).toBe("0.1.0");

    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;
    expect(await fetchStatus()).toBeNull();
  });
});
