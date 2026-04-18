// MV3 manifest — consumed by @crxjs/vite-plugin at build time.
// Host permissions are narrowed to the four supported property sites plus
// wharescore.co.nz for the JWT mint + badge endpoint. No cookies permission:
// the extension reads no cookies; `credentials: 'include'` lets the browser
// attach wharescore.co.nz session cookies automatically.
/** @type {import("@crxjs/vite-plugin").ManifestV3Export} */
export default {
  manifest_version: 3,
  name: "WhareScore Badge",
  description: "Instant WhareScore risk score on any NZ property listing.",
  version: "0.1.0",
  permissions: ["storage", "alarms"],
  host_permissions: [
    "https://wharescore.co.nz/*",
    "https://*.wharescore.co.nz/*",
    "https://homes.co.nz/*",
    "https://www.oneroof.co.nz/*",
    "https://www.realestate.co.nz/*",
  ],
  background: { service_worker: "src/background/service-worker.ts", type: "module" },
  action: {
    default_popup: "src/popup/popup.html",
    default_title: "WhareScore Badge",
  },
  icons: {
    16: "icons/icon-16.png",
    48: "icons/icon-48.png",
    128: "icons/icon-128.png",
  },
  content_scripts: [
    {
      matches: ["https://homes.co.nz/address/*"],
      js: ["src/content/homes.ts"],
      run_at: "document_idle",
    },
    {
      matches: ["https://www.oneroof.co.nz/property/*"],
      js: ["src/content/oneroof.ts"],
      run_at: "document_idle",
    },
    {
      matches: ["https://www.realestate.co.nz/*/residential/sale/*"],
      js: ["src/content/realestate.ts"],
      run_at: "document_idle",
    },
  ],
  // Badge CSS is inlined as a TS constant (see src/badge/styles.ts) and
  // adopted into the shadow root at mount time, so there are no external
  // web-accessible resources to expose.
};
