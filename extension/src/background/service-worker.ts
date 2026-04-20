// MV3 service worker. Runs in the background to:
//   - open the welcome page on first install
//   - poll /api/v1/extension/status every 60 minutes so the kill-switch and
//     per-site enable flags reach the content scripts without a reload
// All network requests go via src/lib/api.ts which handles token cache,
// timeouts, and 401-retry. Content scripts do their own fetching for badge
// lookups. see README for the rationale (cuts one message-hop per page).
import { API_BASE } from "@/lib/constants";
import { fetchStatus } from "@/lib/api";
import { setCachedStatus } from "@/lib/storage";

const STATUS_ALARM = "wharescore-status-poll";

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    await chrome.tabs.create({ url: `${API_BASE}/extension/welcome` });
  }
  // Schedule the recurring status poll. 60 min matches the spec.
  await chrome.alarms.clear(STATUS_ALARM);
  await chrome.alarms.create(STATUS_ALARM, {
    delayInMinutes: 1,
    periodInMinutes: 60,
  });
  // Fire one poll immediately so the first content script load has fresh
  // kill-switch data rather than the hard-coded default from storage.
  await pollStatus();
});

chrome.runtime.onStartup.addListener(async () => {
  await chrome.alarms.create(STATUS_ALARM, {
    delayInMinutes: 1,
    periodInMinutes: 60,
  });
  await pollStatus();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === STATUS_ALARM) {
    await pollStatus();
  }
});

async function pollStatus(): Promise<void> {
  const status = await fetchStatus();
  if (status) {
    await setCachedStatus(status);
  }
}
