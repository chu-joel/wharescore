// Fixture-based extraction tests for realestate.co.nz.
// JSON-LD is primary; og:title + title are identical fallbacks.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, it, expect } from "vitest";
import { extractRealestate } from "../src/lib/extractors";

function loadDoc(fixture: string): Document {
  const html = readFileSync(
    resolve(__dirname, "fixtures/realestate", fixture),
    "utf-8",
  );
  return new JSDOM(html).window.document;
}

describe("extractRealestate", () => {
  it("returns the JSON-LD address for 90A Bader Street", () => {
    const doc = loadDoc("listing-1.html");
    const out = extractRealestate(doc);
    expect(out).toContain("90A Bader Street");
    expect(out).toContain("Hamilton");
  });

  it("returns the JSON-LD address for 1/31 Wallace Road", () => {
    const doc = loadDoc("listing-2.html");
    const out = extractRealestate(doc);
    expect(out).toContain("1/31 Wallace Road");
    expect(out).toContain("Manukau");
  });

  it("strips the ' - For Sale - realestate.co.nz' suffix when using og:title", () => {
    const dom = new JSDOM(`<!doctype html><html>
      <head>
        <title>5 Kauri Lane, Devonport, North Shore City - For Sale - realestate.co.nz</title>
        <meta property="og:title" content="5 Kauri Lane, Devonport, North Shore City - For Sale - realestate.co.nz" />
      </head><body></body></html>`);
    expect(extractRealestate(dom.window.document)).toBe("5 Kauri Lane, Devonport, North Shore City");
  });

  it("returns null on a non-listing page", () => {
    const dom = new JSDOM("<!doctype html><html><head><title>realestate.co.nz</title></head></html>");
    expect(extractRealestate(dom.window.document)).toBeNull();
  });
});
