// Lightweight event tracking — no third-party scripts, no dependencies.
// Events are sent via navigator.sendBeacon (fire-and-forget, works on page unload).

const ENDPOINT = '/api/v1/events';

let sessionId: string | null = null;

function getSessionId(): string {
  if (!sessionId) {
    if (typeof sessionStorage !== 'undefined') {
      sessionId = sessionStorage.getItem('ws_sid') ?? crypto.randomUUID();
      sessionStorage.setItem('ws_sid', sessionId);
    } else {
      sessionId = crypto.randomUUID();
    }
  }
  return sessionId;
}

export function trackEvent(
  eventType: string,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === 'undefined') return;

  const payload = JSON.stringify({
    event_type: eventType,
    session_id: getSessionId(),
    properties: properties ?? {},
  });

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: 'application/json' }));
    } else {
      fetch(ENDPOINT, {
        method: 'POST',
        body: payload,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Silently ignore — analytics should never break the app
  }
}
