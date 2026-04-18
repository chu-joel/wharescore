import { StaticPageLayout } from '@/components/layout/StaticPageLayout';

export const metadata = {
  title: 'WhareScore Badge — Privacy Policy',
  description:
    'Full privacy policy for the WhareScore Badge Chrome extension. Limited Use affirmation per Chrome Web Store User Data Policy.',
  alternates: { canonical: 'https://wharescore.co.nz/extension/privacy' },
};

export default function ExtensionPrivacyPage() {
  return (
    <StaticPageLayout title="WhareScore Badge — Privacy Policy">
      <p className="text-sm text-muted-foreground">Effective date: 19 April 2026</p>

      <section className="mt-6 space-y-3">
        <h2 className="text-lg font-semibold">Limited Use affirmation</h2>
        <blockquote className="border-l-4 border-piq-primary pl-4 text-sm italic">
          The use of information received from WhareScore APIs will adhere to
          the Chrome Web Store User Data Policy, including the Limited Use
          requirements. WhareScore does NOT collect, store, or transmit any
          content from the third-party property listing sites on which the
          badge is displayed. The extension only sends the address shown on the
          page to WhareScore in order to compute the risk score.
        </blockquote>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold">About this extension</h2>
        <p className="text-sm">
          The WhareScore Badge is a browser extension that displays the
          WhareScore risk score and up to two persona-tailored findings on New
          Zealand property listing pages. It is intentionally narrow in scope:
          the extension annotates the page you are already viewing. It does not
          scrape, store, or forward content from those pages.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold">What the extension does on a listing page</h2>
        <p className="text-sm">
          When you land on a supported listing page (homes.co.nz, OneRoof,
          realestate.co.nz — Trade Me is temporarily disabled pending selector
          verification), the extension reads the street address from the page
          DOM and sends it — and only it — to{' '}
          <code>https://wharescore.com/api/v1/extension/badge</code>. The URL
          path of the listing is also sent so we can tell whether you are
          looking at a sale listing or a rental listing; query strings and URL
          fragments are stripped before the request is made.
        </p>
        <p className="text-sm">
          The address text and the resolved WhareScore <code>address_id</code>{' '}
          are used solely to look up a risk score and the two
          highest-ranked findings. The request is also logged as a telemetry
          event containing the <code>address_id</code>, the source site name,
          the user tier (anon / free / pro), and the detected persona. No other
          page content is captured.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold">Data collected</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-2">Data</th>
                <th className="py-2 pr-2">Collected?</th>
                <th className="py-2 pr-2">How it is used</th>
                <th className="py-2">Retention</th>
              </tr>
            </thead>
            <tbody className="align-top">
              <tr className="border-b">
                <td className="py-2 pr-2">Listing address text (from page)</td>
                <td className="py-2 pr-2">Yes, transiently</td>
                <td className="py-2 pr-2">
                  Sent to WhareScore for address lookup. Logged as an{' '}
                  <code>app_events</code> row with{' '}
                  <code>address_id</code> (numeric), never stored as raw text.
                </td>
                <td className="py-2">Discarded after the badge response is returned.</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 pr-2">Listing URL path (no query/fragment)</td>
                <td className="py-2 pr-2">Yes, transiently</td>
                <td className="py-2 pr-2">
                  Persona detection (<code>/rent/</code> → renter,{' '}
                  <code>/sale/</code> → buyer).
                </td>
                <td className="py-2">Not stored; used once per request.</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 pr-2">Your WhareScore email / JWT</td>
                <td className="py-2 pr-2">For signed-in users only</td>
                <td className="py-2 pr-2">Authorisation only.</td>
                <td className="py-2">In-memory 5-minute JWT cached in <code>chrome.storage.session</code>.</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 pr-2">Browsing history</td>
                <td className="py-2 pr-2">No</td>
                <td className="py-2 pr-2">—</td>
                <td className="py-2">—</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 pr-2">
                  Host page content (bedrooms, photos, descriptions, prices,
                  agent info)
                </td>
                <td className="py-2 pr-2"><strong>No</strong></td>
                <td className="py-2 pr-2">—</td>
                <td className="py-2">—</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 pr-2">Cookies from host sites</td>
                <td className="py-2 pr-2">No</td>
                <td className="py-2 pr-2">—</td>
                <td className="py-2">—</td>
              </tr>
              <tr>
                <td className="py-2 pr-2">Screen or device fingerprint</td>
                <td className="py-2 pr-2">No</td>
                <td className="py-2 pr-2">—</td>
                <td className="py-2">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold">What is sent to WhareScore</h2>
        <p className="text-sm">Per badge request, the body is:</p>
        <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto">
{`{
  "source_site": "homes.co.nz",
  "address_text": "42 Queen Street, Auckland Central",
  "source_url":   "https://homes.co.nz/address/..."   // path-only, optional
}`}
        </pre>
        <p className="text-sm">
          Headers include the extension version, a{' '}
          <code>X-WhareScore-Extension: 1</code> identifier, and a short-lived
          JWT Bearer token (minted by <code>/api/auth/token</code> from your
          wharescore.co.nz session) if you are signed in.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold">User controls</h2>
        <ul className="list-disc pl-6 text-sm space-y-1">
          <li>Pause the extension for 24 hours from the toolbar popup.</li>
          <li>Toggle the badge off per-site.</li>
          <li>Dismiss the badge for a specific address (7-day memory).</li>
          <li>
            Uninstall the extension via Chrome&rsquo;s standard mechanism. All
            extension state is stored in Chrome storage and is discarded on
            uninstall.
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold">Data retention on the WhareScore side</h2>
        <p className="text-sm">
          Telemetry events (<code>extension_badge_rendered</code>) live in the{' '}
          <code>app_events</code> table with the user id (if signed in), the
          source site, the address id, the tier, and the persona. Raw address
          text is not stored in these events.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold">Contact</h2>
        <p className="text-sm">
          For privacy questions, email{' '}
          <a href="mailto:privacy@wharescore.co.nz">privacy@wharescore.co.nz</a>.
        </p>
      </section>
    </StaticPageLayout>
  );
}
