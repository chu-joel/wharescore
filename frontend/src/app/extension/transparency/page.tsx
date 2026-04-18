import { StaticPageLayout } from '@/components/layout/StaticPageLayout';

export const metadata = {
  title: 'WhareScore Badge — Transparency',
  description:
    'Plain-language summary of what the WhareScore Badge browser extension sees, sends, and stores. No listing content is captured.',
  alternates: { canonical: 'https://wharescore.co.nz/extension/transparency' },
};

export default function ExtensionTransparencyPage() {
  return (
    <StaticPageLayout title="WhareScore Badge — Transparency">
      <p className="text-sm text-muted-foreground">
        Plain-language summary of what the extension sees and sends. For the
        formal policy, see <a href="/extension/privacy">/extension/privacy</a>.
      </p>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold">What is sent to WhareScore</h2>
        <ul className="list-disc pl-6 text-sm space-y-1">
          <li>
            The <strong>address text</strong> visible on the listing page
            (e.g.&nbsp;<em>42 Queen Street, Auckland Central</em>).
          </li>
          <li>
            The <strong>URL path</strong> of the listing, with query string and
            fragment stripped — we use this only to detect whether you are on a
            sale or rental listing so we can tailor the findings.
          </li>
          <li>
            A <strong>short-lived JWT</strong> if you are signed in to
            wharescore.co.nz, so you get your plan&rsquo;s features (save,
            watchlist, Pro advisor data).
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold">What is NOT sent</h2>
        <ul className="list-disc pl-6 text-sm space-y-1">
          <li>No bedrooms, bathrooms, floor area, land area.</li>
          <li>No price, rent, or any monetary figure from the listing.</li>
          <li>No photos, descriptions, agent info, or contact details.</li>
          <li>No cookies from the host site.</li>
          <li>No browsing history, no page-content fingerprint.</li>
          <li>No screen dimensions, device model, or advertising identifier.</li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold">What is stored server-side</h2>
        <p className="text-sm">
          Each rendered badge creates one row in our <code>app_events</code>{' '}
          table recording the WhareScore <code>address_id</code>, the source
          site (e.g. <code>homes.co.nz</code>), your tier (anon / free / pro),
          and the detected persona (renter / buyer). Raw address text is not
          stored — only the resolved LINZ address id.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold">Why so little?</h2>
        <p className="text-sm">
          Phase 1 is deliberately a pure annotation tool — it augments the page
          you are already viewing, it does not copy content off it. We reviewed
          each host site&rsquo;s terms of service before shipping; they
          explicitly restrict copying listing content for commercial use, so we
          simply do not.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold">Delete your data</h2>
        <p className="text-sm">
          Uninstall the extension via Chrome&rsquo;s extension manager — every
          per-browser setting (dismissals, pause state, site toggles, cached
          JWT) is discarded on uninstall. To remove your server-side telemetry
          events, contact <a href="mailto:privacy@wharescore.co.nz">privacy@wharescore.co.nz</a>.
        </p>
      </section>
    </StaticPageLayout>
  );
}
