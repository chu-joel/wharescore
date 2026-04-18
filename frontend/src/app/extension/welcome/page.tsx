import { StaticPageLayout } from '@/components/layout/StaticPageLayout';
import { Chrome, MousePointerClick, Search } from 'lucide-react';

export const metadata = {
  title: 'WhareScore Badge — Welcome',
  description:
    'You have installed the WhareScore Badge. Here is how it works on homes.co.nz, OneRoof, and realestate.co.nz, and what controls you have over it.',
  alternates: { canonical: 'https://wharescore.co.nz/extension/welcome' },
};

const STEPS = [
  {
    icon: Chrome,
    title: 'Pin the badge to your toolbar',
    body:
      'Open the puzzle-piece extension menu in Chrome and pin "WhareScore Badge". The popup gives you per-site toggles and a 24-hour pause.',
  },
  {
    icon: Search,
    title: 'Visit any supported NZ listing',
    body:
      'We currently support homes.co.nz, OneRoof, and realestate.co.nz. A floating badge slides in at the bottom-right of the page with your WhareScore for that address.',
  },
  {
    icon: MousePointerClick,
    title: 'Dig deeper',
    body:
      'Click "View full report" to see the complete risk analysis. Sign in to save the property to your watchlist. Upgrade to Pro for price + rent estimates, walk score, and PDF export.',
  },
];

export default function ExtensionWelcomePage() {
  return (
    <StaticPageLayout title="Welcome to WhareScore Badge">
      <p className="text-sm text-muted-foreground">
        Thanks for installing the WhareScore Badge. It annotates the listings you
        are already viewing with the same risk analysis that powers{' '}
        <a href="https://wharescore.co.nz">wharescore.co.nz</a>. Nothing from the
        listing page is copied or stored — only the address is sent to WhareScore.
      </p>

      <section className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold">Getting started</h2>
        <ol className="space-y-4">
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              className="flex gap-3 rounded-xl border border-border p-4"
            >
              <div className="shrink-0">
                <s.icon className="h-5 w-5 text-piq-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">
                  {i + 1}. {s.title}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-lg font-semibold">Supported sites</h2>
        <ul className="list-disc pl-6 text-sm space-y-1">
          <li>homes.co.nz — listing pages under <code>/address/*</code></li>
          <li>OneRoof — listing pages under <code>/property/*</code></li>
          <li>realestate.co.nz — listing pages under <code>/residential/sale/*</code></li>
          <li>
            Trade Me — <em>temporarily disabled</em> while we verify the badge
            mounts correctly against the Angular-rendered page.
          </li>
        </ul>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-lg font-semibold">Your controls</h2>
        <ul className="list-disc pl-6 text-sm space-y-1">
          <li>Click the toolbar icon to pause the badge for 24 hours.</li>
          <li>Toggle any site off in the popup — the badge stops appearing there.</li>
          <li>Click <strong>×</strong> on the badge to dismiss it for that specific address (remembered for 7 days).</li>
          <li>Drag the badge by its header to reposition it — we remember where you put it per site.</li>
          <li>Uninstall via Chrome&rsquo;s standard extension manager. All extension state is discarded on uninstall.</li>
        </ul>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-lg font-semibold">What we do not collect</h2>
        <p className="text-sm">
          We do not collect listing content (bedrooms, photos, descriptions,
          prices, agent info), host-site cookies, browsing history, or device
          fingerprints. See the{' '}
          <a href="/extension/privacy">Privacy Policy</a> and{' '}
          <a href="/extension/transparency">Transparency page</a> for the full
          data practices rundown.
        </p>
      </section>
    </StaticPageLayout>
  );
}
