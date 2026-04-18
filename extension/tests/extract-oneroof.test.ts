// Fixture-based extraction tests for oneroof.co.nz.
// Primary signal is JSON-LD SingleFamilyResidence.address; H1 fallback.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, it, expect } from "vitest";
import { extractOneRoof } from "../src/lib/extractors";

function loadDoc(fixture: string): Document {
  const html = readFileSync(
    resolve(__dirname, "fixtures/oneroof", fixture),
    "utf-8",
  );
  return new JSDOM(html).window.document;
}

describe("extractOneRoof", () => {
  it("returns the JSON-LD address for 10 Lorne Street", () => {
    const doc = loadDoc("listing-1.html");
    // Fixture has streetAddress "10 Lorne Street", locality "Wellington City",
    // region "Wellington". Extractor joins the first two matching parts.
    expect(extractOneRoof(doc)).toContain("10 Lorne Street");
    expect(extractOneRoof(doc)).toContain("Wellington");
  });

  it("returns the JSON-LD address for 16 Telford Terrace", () => {
    const doc = loadDoc("listing-2.html");
    expect(extractOneRoof(doc)).toContain("16 Telford Terrace");
    expect(extractOneRoof(doc)).toContain("Wellington");
  });

  it("falls back to H1 when JSON-LD is missing", () => {
    const dom = new JSDOM(`<!doctype html><html>
      <head><title>OneRoof</title></head>
      <body><h1>22 Sample Road, Ponsonby, Auckland</h1></body></html>`);
    expect(extractOneRoof(dom.window.document)).toBe("22 Sample Road, Ponsonby, Auckland");
  });

  it("ignores H1s with no digits (site chrome)", () => {
    const dom = new JSDOM(`<!doctype html><html>
      <body><h1>Properties for sale in Auckland</h1></body></html>`);
    expect(extractOneRoof(dom.window.document)).toBeNull();
  });
});
