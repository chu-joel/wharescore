// Network layer. All fetch calls go through here so retry + 401 refresh +
// timeout handling stay in one place.
import {
  API_BASE, BADGE_PATH, EXTENSION_VERSION, STATUS_PATH, TOKEN_PATH,
} from "./constants";
import type { BadgeResponse, SourceSite, StatusResponse } from "./constants";
import { clearJwt, getCachedJwt, setCachedJwt } from "./storage";

const DEFAULT_TIMEOUT_MS = 6000;
// The server mints a 5-minute JWT; we treat it as valid for 4 minutes so a
// slow network round-trip doesn't let us hit the server with an expired token.
const JWT_TTL_MS = 4 * 60 * 1000;

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function fetchJwt(): Promise<string | null> {
  const cached = await getCachedJwt();
  if (cached) return cached.token;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${TOKEN_PATH}`, {
      method: "GET",
      credentials: "include",
      signal: controller.signal,
    });
    if (res.status === 401) {
      await clearJwt();
      return null;
    }
    if (!res.ok) {
      return null;
    }
    const body = (await res.json()) as { token?: string };
    if (!body?.token) return null;
    await setCachedJwt(body.token, JWT_TTL_MS);
    return body.token;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchBadge(
  site: SourceSite,
  addressText: string,
  sourceUrl: string | null,
): Promise<BadgeResponse | null> {
  const attempt = async (token: string | null): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-WhareScore-Extension": "1",
        "X-WhareScore-Extension-Version": EXTENSION_VERSION,
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      // source_url: path-only hint for persona detection (/rent/, /sale/).
      // We strip query + fragment so nothing identifying travels with it.
      const pathOnly = sourceUrl ? stripQueryAndFragment(sourceUrl) : null;
      return await fetch(`${API_BASE}${BADGE_PATH}`, {
        method: "POST",
        headers,
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify({
          source_site: site,
          address_text: addressText,
          source_url: pathOnly,
        }),
      });
    } finally {
      clearTimeout(timer);
    }
  };

  function stripQueryAndFragment(url: string): string {
    const q = url.indexOf("?");
    const h = url.indexOf("#");
    const end = Math.min(
      q === -1 ? url.length : q,
      h === -1 ? url.length : h,
    );
    return url.slice(0, end);
  }

  try {
    let token = await fetchJwt();
    let res = await attempt(token);

    // 401 on an authed call: clear, refresh once, retry.
    if (res.status === 401 && token) {
      await clearJwt();
      token = await fetchJwt();
      res = await attempt(token);
    }

    if (!res.ok) {
      throw new HttpError(res.status, `badge ${res.status}`);
    }
    return (await res.json()) as BadgeResponse;
  } catch {
    return null;
  }
}

export async function fetchStatus(): Promise<StatusResponse | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${STATUS_PATH}`, {
      method: "GET",
      credentials: "omit",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as StatusResponse;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
