// Per-site extractors. Each one is a pure function (Document) => string | null
// so the fixture-based tests can pass in a jsdom-parsed document and assert
// the exact address string that will be sent to WhareScore.
//
// Order of fallbacks reflects what was observed in the captured fixtures for
// each site. Never guess. every fallback is keyed to something present in
// the actual HTML checked into extension/tests/fixtures.
import {
  looksLikeAddress, parseJsonLdAddress, readH1, readMeta, stripTitleSuffix,
} from "./extract";

export type Extractor = (doc: Document) => string | null;

// ─── homes.co.nz ────────────────────────────────────────────────────────────
// Fixture evidence:
//   <h1 class="summary_address ...">28 Given Grove, Pauanui</h1>
//   <title>Free property data for 28 Given Grove, Pauanui - homes.co.nz</title>
//   og:title content matches the <title>.
// There is no JSON-LD on homes.co.nz listing pages.
export const extractHomes: Extractor = (doc) => {
  // H1 with a class that contains "summary_address". Angular adds extra
  // _ngcontent suffixes, so use an attribute-contains selector for safety.
  const h1 = doc.querySelector<HTMLHeadingElement>('h1[class*="summary_address"]');
  if (h1 && h1.textContent) {
    const text = h1.textContent.trim();
    if (looksLikeAddress(text)) return text;
  }
  // <title> fallback. Pattern: "Free property data for {ADDRESS} - homes.co.nz"
  const titleFromDoc = doc.title || "";
  const fromTitle = stripTitleSuffix(titleFromDoc, [
    /^Free property data for (.+?) - homes\.co\.nz$/i,
  ]);
  if (looksLikeAddress(fromTitle)) return fromTitle;
  // og:title has the same shape when <title> isn't populated yet.
  const og = readMeta(doc, "og:title") || "";
  const fromOg = stripTitleSuffix(og, [
    /^Free property data for (.+?) - homes\.co\.nz$/i,
  ]);
  return looksLikeAddress(fromOg) ? fromOg : null;
};

// ─── oneroof.co.nz ──────────────────────────────────────────────────────────
// Fixture evidence:
//   JSON-LD {"@type":"SingleFamilyResidence","address":{"streetAddress":"10 Lorne Street",
//            "addressLocality":"Wellington City","addressRegion":"Wellington"}}
//   <h1 class="text-font text-3xl font-bold not-italic text-black">10 Lorne Street, Te Aro, Wellington City</h1>
// og:title is marketing copy ("PREMIUM CAR PARKS HIT THE MARKET"). do not use.
export const extractOneRoof: Extractor = (doc) => {
  const fromLd = parseJsonLdAddress(doc);
  if (looksLikeAddress(fromLd)) return fromLd;
  // H1 fallback. We pick the first h1 containing a digit (the address) rather
  // than the site chrome h1 (which doesn't appear on oneroof listing pages
  // but could be added in future redesigns).
  const h1 = readH1(doc, (el) => /\d/.test(el.textContent || ""));
  return looksLikeAddress(h1) ? h1 : null;
};

// ─── realestate.co.nz ───────────────────────────────────────────────────────
// Fixture evidence:
//   JSON-LD {"@type":"SingleFamilyResidence","address":{...}}  (same shape as OneRoof)
//   og:title "90A Bader Street, Bader, Hamilton City - For Sale - realestate.co.nz"
//   <title> same content as og:title
//   <h1>90A Bader Street, Bader, Hamilton City</h1>
export const extractRealestate: Extractor = (doc) => {
  const fromLd = parseJsonLdAddress(doc);
  if (looksLikeAddress(fromLd)) return fromLd;

  const og = readMeta(doc, "og:title") || doc.title || "";
  const fromTitle = stripTitleSuffix(og, [
    /^(.+?) - For Sale - realestate\.co\.nz$/i,
    /^(.+?) - For Lease - realestate\.co\.nz$/i,
    /^(.+?) - realestate\.co\.nz$/i,
  ]);
  if (looksLikeAddress(fromTitle)) return fromTitle;

  const h1 = readH1(doc, (el) => /\d/.test(el.textContent || ""));
  return looksLikeAddress(h1) ? h1 : null;
};
