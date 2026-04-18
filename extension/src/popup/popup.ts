// Popup controller. Reads + writes the same chrome.storage keys the content
// scripts check, so a toggle here takes effect on the next page load.
import type { SourceSite } from "@/lib/constants";
import {
  getPauseUntil, getSiteToggles, setPauseUntil, setSiteToggle,
} from "@/lib/storage";

const SITES: SourceSite[] = ["homes.co.nz", "oneroof.co.nz", "trademe.co.nz", "realestate.co.nz"];

async function refreshPauseState() {
  const until = await getPauseUntil();
  const now = Date.now();
  const state = document.getElementById("pauseState");
  if (!state) return;
  if (until > now) {
    const hours = Math.max(1, Math.round((until - now) / 3600000));
    state.textContent = `Badge paused for ~${hours} more hour${hours === 1 ? "" : "s"}.`;
  } else {
    state.textContent = "Badge active on supported sites.";
  }
}

async function refreshSiteToggles() {
  const toggles = await getSiteToggles();
  for (const site of SITES) {
    const id = `toggle-${site.split(".")[0]}`;
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el) continue;
    el.checked = toggles[site] !== false;
    // Trade Me kill-switch: the extension ships with trademe off until
    // verified selectors land. The checkbox is disabled so the user can't
    // accidentally flip it on.
    if (site === "trademe.co.nz") {
      el.disabled = true;
      el.checked = false;
    }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await refreshPauseState();
  await refreshSiteToggles();

  document.getElementById("pauseBtn")?.addEventListener("click", async () => {
    await setPauseUntil(Date.now() + 24 * 60 * 60 * 1000);
    await refreshPauseState();
  });

  document.getElementById("resumeBtn")?.addEventListener("click", async () => {
    await setPauseUntil(0);
    await refreshPauseState();
  });

  for (const site of SITES) {
    const id = `toggle-${site.split(".")[0]}`;
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el) continue;
    el.addEventListener("change", async () => {
      if (site === "trademe.co.nz") return;  // disabled, see above
      await setSiteToggle(site, el.checked);
    });
  }
});
