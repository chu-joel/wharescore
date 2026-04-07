import { StaticPageLayout } from '@/components/layout/StaticPageLayout';

export const metadata = {
  title: 'Terms of Use',
  description: 'WhareScore terms of use — disclaimers, data accuracy, risk score limitations, and usage conditions for New Zealand property reports.',
  alternates: { canonical: 'https://wharescore.co.nz/terms' },
};

export default function TermsPage() {
  return (
    <StaticPageLayout title="Terms of Use">
      <p className="text-sm text-muted-foreground">Last updated: March 2026</p>

      <section className="mt-6 space-y-4">
        <h2 className="text-lg font-semibold">Disclaimer</h2>
        <p className="text-sm">
          WhareScore reports are provided for <strong>informational purposes only</strong>.
          The data, scores, and analysis presented should not be considered professional advice
          and must not be relied upon for property purchase, sale, rental, legal, financial,
          or insurance decisions.
        </p>
        <p className="text-sm">
          While we source data from official government providers, we make no guarantees about
          the accuracy, completeness, or timeliness of the information presented. Data may be
          outdated, incomplete, or contain errors from the original source.
        </p>
      </section>

      <section className="mt-6 space-y-4">
        <h2 className="text-lg font-semibold">Risk Scores</h2>
        <p className="text-sm">
          Risk scores are algorithmically generated from publicly available data and represent
          a relative comparison tool, not an absolute safety assessment. A low risk score does
          not guarantee safety, and a high risk score does not mean a property is unsafe.
          Always consult qualified professionals (engineers, valuers, solicitors) before making
          property decisions.
        </p>
      </section>

      <section className="mt-6 space-y-4">
        <h2 className="text-lg font-semibold">Fair Rent Estimates</h2>
        <p className="text-sm">
          Rent estimates are based on MBIE Tenancy Services bond lodgement data aggregated
          at the Statistical Area 2 (suburb) level. They reflect market rents for similar
          properties in the area and are not formal valuations. Individual property conditions,
          features, and market dynamics may result in actual rents differing significantly
          from our estimates.
        </p>
      </section>

      <section className="mt-6 space-y-4">
        <h2 className="text-lg font-semibold">Usage Limits</h2>
        <p className="text-sm">
          To ensure fair access, WhareScore applies rate limits to API requests. Automated
          scraping, bulk data extraction, or commercial redistribution of our reports is
          prohibited. We reserve the right to block access for users who violate these limits
          or use the service in ways that degrade the experience for others.
        </p>
      </section>

      <section className="mt-6 space-y-4">
        <h2 className="text-lg font-semibold">Data Attribution</h2>
        <p className="text-sm">
          WhareScore uses data from multiple government sources under Creative Commons licences.
          Source attribution is provided on each data point in our reports. See our{' '}
          <a href="/about" className="text-primary hover:underline">About page</a> for a
          complete list of data sources.
        </p>
      </section>

      <section className="mt-6 space-y-4">
        <h2 className="text-lg font-semibold">Limitation of Liability</h2>
        <p className="text-sm">
          WhareScore, its creators, and contributors shall not be liable for any loss, damage,
          or expense arising from the use of or reliance on information provided by this service,
          whether direct, indirect, consequential, or incidental.
        </p>
      </section>
    </StaticPageLayout>
  );
}
