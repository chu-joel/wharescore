// Playwright capture for the WhareScore Badge.
//
// Flow per shot:
//   1. Bundle tests/visual/mount.ts into an IIFE via esbuild (one-time, beforeAll)
//   2. Launch Chromium at the viewport for this shot
//   3. page.setContent() with a minimal harness HTML
//   4. Inject the IIFE bundle
//   5. page.evaluate(() => window.mountBadge(fixtureId, state))
//   6. Wait 400ms for animations to settle (or synchronous for reduced-motion)
//   7. Write four sidecars: .png, .state.json, .fixture.json, .dom.html
//
// Output dir: extension/tests/visual/out/{UTC timestamp}/
// A symlink (or .txt fallback on Windows) `out/latest/` points at the most recent run.
import { test, chromium, type BrowserContext } from "@playwright/test";
import { build } from "esbuild";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { buildMatrix, VIEWPORTS as _VIEWPORTS } from "./matrix";
import { FIXTURES } from "./fixtures";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- paths ----------
const OUT_ROOT = path.join(__dirname, "out");
const BUNDLE_PATH = path.join(__dirname, "out/_harness.iife.js");
const STAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16); // e.g. 2026-04-19T10-23
const RUN_DIR = path.join(OUT_ROOT, STAMP);

// ---------- harness HTML (deterministic) ----------
const HARNESS_HTML = `<!doctype html>
<html lang="en-NZ">
  <head>
    <meta charset="utf-8">
    <title>WhareScore Badge — /verify harness</title>
    <style>
      html, body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; background: #e5e7eb; }
      body { min-height: 100vh; }
      .ws-harness-host-mock {
        position: absolute; top: 24px; left: 24px; right: 24px;
        background: white; padding: 24px; border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        color: #111;
      }
      .ws-harness-host-mock h1 { font-size: 22px; margin: 0 0 8px; }
      .ws-harness-host-mock p  { margin: 0; color: #555; }
    </style>
  </head>
  <body>
    <div class="ws-harness-host-mock">
      <h1>Simulated host page</h1>
      <p>42 Queen Street, Auckland Central · Asking $890,000</p>
    </div>
  </body>
</html>`;

// ---------- global setup — bundle once ----------
test.beforeAll(async () => {
  await fs.mkdir(RUN_DIR, { recursive: true });

  await build({
    entryPoints: [path.join(__dirname, "mount.ts")],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2022",
    outfile: BUNDLE_PATH,
    logLevel: "warning",
    alias: {
      "@": path.resolve(__dirname, "..", "..", "src"),
    },
    define: {
      "process.env.NODE_ENV": JSON.stringify("test"),
    },
  });

  // Write a run manifest so the judge can index
  await fs.writeFile(
    path.join(RUN_DIR, "MANIFEST.md"),
    `# /verify capture run\n\nTimestamp: ${STAMP}\nShots: ${buildMatrix().length}\nBundle: ${BUNDLE_PATH}\n`,
  );

  // Update the "latest" pointer — symlink on POSIX, text file on Windows
  const latestPointer = path.join(OUT_ROOT, "latest.txt");
  await fs.writeFile(latestPointer, path.basename(RUN_DIR));
});

// ---------- per-shot test ----------
for (const cell of buildMatrix()) {
  test(cell.shotId, async ({ browser }) => {
    const context: BrowserContext = await browser.newContext({
      viewport: { width: cell.viewport.width, height: cell.viewport.height },
      reducedMotion: cell.state === "reduced-motion" ? "reduce" : "no-preference",
      locale: "en-NZ",
      timezoneId: "Pacific/Auckland",
    });

    const page = await context.newPage();
    page.on("pageerror", (err) => console.error(`[${cell.shotId}] page error:`, err.message));

    await page.setContent(HARNESS_HTML, { waitUntil: "domcontentloaded" });
    await page.addScriptTag({ path: BUNDLE_PATH });

    // Trigger the mount. The harness exposes window.mountBadge.
    await page.evaluate(
      async ({ fixture, state }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (window as any).mountBadge(fixture, state);
      },
      { fixture: cell.fixture, state: cell.state },
    );

    // Let the slide-in animation settle (240ms) unless reduced-motion
    const settleMs = cell.state === "reduced-motion" ? 50 : 500;
    await page.waitForTimeout(settleMs);

    const shotBase = path.join(RUN_DIR, cell.shotId);
    await page.screenshot({ path: `${shotBase}.png`, fullPage: false });

    await fs.writeFile(`${shotBase}.state.json`, JSON.stringify({
      tier_persona: cell.fixture,
      interaction_state: cell.state,
      viewport: cell.viewport,
      captured_at: new Date().toISOString(),
    }, null, 2));

    await fs.writeFile(`${shotBase}.fixture.json`, JSON.stringify(FIXTURES[cell.fixture], null, 2));

    // Extract the shadow-root DOM so the judge can check copy, aria, tab order
    const shadowHtml = await page.evaluate(() => {
      const host = document.querySelector("[data-wharescore-badge]");
      return host?.shadowRoot?.innerHTML ?? "";
    });
    const fullDom = await page.content();
    await fs.writeFile(`${shotBase}.dom.html`,
      `<!-- full page DOM -->\n${fullDom}\n\n<!-- shadow root (badge internals) -->\n${shadowHtml}\n`,
    );

    await context.close();
  });
}
