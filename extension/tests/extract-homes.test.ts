// Fixture-based extraction tests for homes.co.nz. Two real listing HTML
// files were captured via curl from the public homes.co.nz sitemap and
// checked in at extension/tests/fixtures/homes/. If homes.co.nz restructures
// the listing page, these tests fail and the extractor must be re-verified
// against fresh HTML.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, it, expect } from "vitest";
import { extractHomes } from "../src/lib/extractors";

function loadDoc(fixture: string): Document {
  const html = readFileSync(
    resolve(__dirname, "fixtures/homes", fixture),
    "utf-8",
  );
  return new JSDOM(html).window.document;
}

describe("extractHomes", () => {
  it("pulls the address from h1.summary_address on a Pauanui listing", () => {
    const doc = loadDoc("listing-1.html");
    expect(extractHomes(doc)).toBe("28 Given Grove, Pauanui");
  });

  it("pulls the address from h1.summary_address on a Christchurch listing", () => {
    const doc = loadDoc("listing-2.html");
    expect(extractHomes(doc)).toBe("343 Waterholes Road, Christchurch");
  });

  it("falls back to <title> when the h1 is absent", () => {
    const dom = new JSDOM(`<!doctype html><html>
      <head><title>Free property data for 12 Test Street, Wellington - homes.co.nz</title></head>
      <body></body></html>`);
    expect(extractHomes(dom.window.document)).toBe("12 Test Street, Wellington");
  });

  it("returns null when nothing parseable is present", () => {
    const dom = new JSDOM("<!doctype html><html><head><title>homes.co.nz</title></head></html>");
    expect(extractHomes(dom.window.document)).toBeNull();
  });
});
