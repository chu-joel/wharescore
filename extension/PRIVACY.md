# WhareScore Badge — Privacy Policy

Effective date: 2026-04-19

The WhareScore Badge is a browser extension that displays the WhareScore risk
score and a short list of persona-tailored findings on New Zealand property
listing pages. It is intentionally narrow in scope: the extension annotates
the page the user is already viewing. It does not scrape, store, or forward
content from those pages.

## Limited Use affirmation

The use of information received from WhareScore APIs will adhere to the
Chrome Web Store User Data Policy, including the Limited Use requirements.
WhareScore does NOT collect, store, or transmit any content from the
third-party property listing sites on which the badge is displayed. The
extension only sends the address shown on the page to WhareScore in order to
compute the risk score.

## What the extension does when you browse a listing

When you land on a supported listing page (homes.co.nz, OneRoof,
realestate.co.nz — Trade Me is temporarily disabled pending selector
verification), the extension reads the street address from the page DOM
and sends it — and only it — to `https://wharescore.co.nz/api/v1/extension/badge`.
The URL path of the listing is also sent so that WhareScore can tell whether
you are looking at a sale listing or a rental listing; query strings and URL
fragments are stripped before the request is made.

The address text and the resolved WhareScore `address_id` are used solely to
look up a risk score and the two highest-ranked findings. The request is
also logged as a telemetry event containing the `address_id`, the source
site name, the user tier (anon / free / pro), and the detected persona. No
other page content is captured.

## Data collected

| Data | Collected? | How it is used | Retention |
|---|---|---|---|
| Listing address text (from page) | Yes, transiently | Sent to WhareScore `/api/v1/extension/badge` for lookup. Logged as `app_events` row with `address_id`, never stored as raw text. | Not stored separately — discarded after the badge response is returned. |
| Listing URL path (no query/fragment) | Yes, transiently | Used for persona detection (`/rent/` → renter, `/sale/` → buyer). | Not stored; used once per request. |
| Your WhareScore email / JWT | For authed users only | Authorisation. | In-memory 5-minute JWT cached in `chrome.storage.session`. |
| Browsing history | No | — | — |
| Host page content (bedrooms, photos, descriptions, prices, agent info) | **No** | — | — |
| Cookies from host sites | No | — | — |
| Screen or device fingerprint | No | — | — |

## What is sent to WhareScore

Per badge request, the body is:

```json
{
  "source_site": "homes.co.nz",
  "address_text": "42 Queen Street, Auckland Central",
  "source_url":   "https://homes.co.nz/address/..."   // path-only, optional
}
```

Headers include the extension version, a `X-WhareScore-Extension: 1`
identifier, and a short-lived JWT Bearer token (minted by
`/api/auth/token` from your wharescore.co.nz session) if you are signed in.

## User controls

- Pause the extension for 24 hours from the toolbar popup.
- Toggle the badge off per-site.
- Dismiss the badge for a specific address (7-day memory).
- Uninstall the extension via Chrome's standard mechanism. All extension
  state is stored in Chrome storage and is discarded on uninstall.

## Data retention on the WhareScore side

Telemetry events (`extension_badge_rendered`) live in the `app_events`
table with the user id (if signed in), the source site, the address id,
the tier, and the persona. Raw address text is not stored in these events.

## Contact

For privacy questions, email `privacy@wharescore.co.nz`.
