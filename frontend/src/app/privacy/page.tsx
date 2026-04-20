import { StaticPageLayout } from '@/components/layout/StaticPageLayout';

export const metadata = {
  title: 'Privacy Policy. No Tracking, No Cookies, No Third-Party Analytics',
  description: 'WhareScore privacy policy: no Google Analytics, no tracking cookies, no advertising identifiers. We collect only anonymous search queries and hashed IPs (purged after 7 days).',
  alternates: { canonical: 'https://wharescore.co.nz/privacy' },
};

export default function PrivacyPage() {
  return (
    <StaticPageLayout title="Privacy Policy">
      <p className="text-sm text-muted-foreground">Last updated: March 2026</p>

      <section className="mt-6 space-y-4">
        <h2 className="text-lg font-semibold">What We Collect</h2>
        <ul className="list-disc space-y-2 pl-6 text-sm">
          <li>
            <strong>Search queries:</strong> We log which addresses are searched to understand
            usage patterns and improve coverage. Searches are not linked to user accounts
            (we don&rsquo;t have accounts).
          </li>
          <li>
            <strong>IP addresses:</strong> Used for rate limiting and abuse prevention only.
            IPs are hashed before storage and automatically purged after 7 days.
          </li>
          <li>
            <strong>Feedback submissions:</strong> If you submit feedback (bug reports, feature
            requests), we store the content you provide, your email (if given), and the page
            you were viewing.
          </li>
          <li>
            <strong>Email signups:</strong> If you sign up for coverage expansion notifications,
            we store your email and requested region.
          </li>
          <li>
            <strong>Rent contributions:</strong> If you contribute your rent data, we store the
            amount, dwelling type, bedrooms, and SA2 area. This data is anonymous and cannot be
            linked back to you.
          </li>
        </ul>
      </section>

      <section className="mt-6 space-y-4">
        <h2 className="text-lg font-semibold">What We Don&rsquo;t Collect</h2>
        <ul className="list-disc space-y-2 pl-6 text-sm">
          <li>No user accounts or passwords (except the admin portal)</li>
          <li>No tracking cookies or advertising identifiers</li>
          <li>No third-party analytics (no Google Analytics, no Meta Pixel)</li>
          <li>No personal property ownership data</li>
          <li>No location tracking beyond what you explicitly search</li>
        </ul>
      </section>

      <section className="mt-6 space-y-4">
        <h2 className="text-lg font-semibold">Cookies</h2>
        <p className="text-sm">
          WhareScore uses minimal cookies. We may use a session cookie for the admin portal
          (httpOnly, secure, sameSite strict). No analytics or advertising cookies are used.
          Your recent searches and saved properties are stored in your browser&rsquo;s
          localStorage. this data never leaves your device.
        </p>
      </section>

      <section className="mt-6 space-y-4">
        <h2 className="text-lg font-semibold">Data Retention</h2>
        <p className="text-sm">
          Hashed IP addresses: 7 days. Feedback and email signups: retained until manually
          deleted. Rent contributions: retained indefinitely (anonymous aggregate data).
          Search logs: 90 days.
        </p>
      </section>

      <section className="mt-6 space-y-4">
        <h2 className="text-lg font-semibold">Contact</h2>
        <p className="text-sm">
          For privacy inquiries, use the feedback form or visit our{' '}
          <a href="/contact" className="text-primary hover:underline">Contact page</a>.
        </p>
      </section>
    </StaticPageLayout>
  );
}
