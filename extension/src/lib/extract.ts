// Shared address-extraction helpers used by each site-specific content script.
//
// Selector verification notes (see extension/tests/fixtures for the raw HTML
// that these were derived from):
//
//   homes.co.nz:       no JSON-LD. <title> = "Free property data for {address} - homes.co.nz";
//                      <h1 class="summary_address"> carries the same address.
//   oneroof.co.nz:     JSON-LD SingleFamilyResidence.address is a full PostalAddress
//                      with streetAddress / addressLocality / addressRegion. og:title is
//                      marketing copy (unusable). h1 text is a safe fallback.
//   realestate.co.nz:  JSON-LD SingleFamilyResidence.address + og:title both carry the
//                      address. <title> has a trailing " - For Sale - realestate.co.nz"
//                      that we strip.

export interface ExtractResult {
  address: string;   // human-formatted address: "42 Queen Street, Auckland Central, Auckland"
  source: string;    // debug tag — which strategy won (jsonld | h1 | title | og-title | url)
}

/**
 * Scan every <script type="application/ld+json"> tag, return the first parsed
 * object (flattening @graph) that exposes a PostalAddress. Returns the
 * formatted address string ready for the badge payload.
 */
export function parseJsonLdAddress(doc: Document): string | null {
  const scripts = doc.querySelectorAll<HTMLScriptElement>(
    'script[type="application/ld+json"]',
  );
  for (const script of Array.from(scripts)) {
    const raw = (script.textContent || "").trim();
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const nodes = flattenLdGraph(parsed);
    for (const node of nodes) {
      const addr = pickAddressFromNode(node);
      if (addr) return addr;
    }
  }
  return null;
}

function flattenLdGraph(root: unknown): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const push = (val: unknown) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      out.push(val as Record<string, unknown>);
      const graph = (val as Record<string, unknown>)["@graph"];
      if (Array.isArray(graph)) graph.forEach(push);
    }
  };
  if (Array.isArray(root)) root.forEach(push);
  else push(root);
  return out;
}

function pickAddressFromNode(node: Record<string, unknown>): string | null {
  const addr = node["address"];
  if (typeof addr === "string") return addr.trim() || null;
  if (addr && typeof addr === "object" && !Array.isArray(addr)) {
    const a = addr as Record<string, unknown>;
    const parts = [
      stringOrNull(a["streetAddress"]),
      stringOrNull(a["addressLocality"]),
      stringOrNull(a["addressRegion"]),
    ].filter(Boolean);
    if (parts.length >= 2) return parts.join(", ");
  }
  return null;
}

function stringOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed ? trimmed : null;
}

/**
 * Read og:title. Returns raw content, caller strips site-specific suffixes.
 */
export function readMeta(doc: Document, property: string): string | null {
  const sel = `meta[property="${property}"], meta[name="${property}"]`;
  const el = doc.querySelector<HTMLMetaElement>(sel);
  if (!el) return null;
  const content = (el.getAttribute("content") || "").trim();
  return content || null;
}

/**
 * Apply a sequence of regex replacements to a source string; the first match
 * whose result is non-empty is returned. Used for stripping known "- For Sale
 * - realestate.co.nz" chrome from document titles.
 */
export function stripTitleSuffix(title: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = title.match(re);
    if (m && m[1]) {
      const cleaned = m[1].trim();
      if (cleaned.length >= 5) return cleaned;
    }
  }
  return null;
}

/**
 * Light sanity check — a valid address must contain at least one digit
 * (street number) and at least one alphabetic word (street name). Rejects
 * things like "For Sale" or "123".
 */
export function looksLikeAddress(value: string | null): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed.length < 6 || trimmed.length > 250) return false;
  if (!/\d/.test(trimmed)) return false;
  if (!/[A-Za-z]{3,}/.test(trimmed)) return false;
  return true;
}

/**
 * Picks the first H1 on the page whose class or text matches a predicate.
 * Returns trimmed text content or null.
 */
export function readH1(
  doc: Document,
  match?: (el: HTMLHeadingElement) => boolean,
): string | null {
  const h1s = doc.querySelectorAll<HTMLHeadingElement>("h1");
  for (const h1 of Array.from(h1s)) {
    if (match && !match(h1)) continue;
    const text = (h1.textContent || "").trim();
    if (text) return text;
  }
  return null;
}
