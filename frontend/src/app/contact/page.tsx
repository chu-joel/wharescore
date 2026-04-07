import { StaticPageLayout } from '@/components/layout/StaticPageLayout';
import { MessageSquare, Mail } from 'lucide-react';

export const metadata = {
  title: 'Contact',
  description: 'Get in touch with the WhareScore team.',
};

export default function ContactPage() {
  return (
    <StaticPageLayout title="Contact Us">
      <section className="space-y-4">
        <p>
          We&rsquo;d love to hear from you. Whether you&rsquo;ve found a bug, have a feature
          idea, or just want to say hello — reach out.
        </p>

        <div className="rounded-lg border p-4">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-5 w-5 text-piq-primary" />
            <div>
              <p className="font-medium">Email</p>
              <a
                href="mailto:hello@wharescore.co.nz"
                className="text-sm text-primary hover:underline"
              >
                hello@wharescore.co.nz
              </a>
              <p className="text-sm text-muted-foreground mt-1">
                For general enquiries, partnerships, media, or anything else.
                We aim to respond within 24 hours.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-start gap-3">
            <MessageSquare className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">In-App Feedback</p>
              <p className="text-sm text-muted-foreground">
                The fastest way to report bugs or suggest features. Click the feedback button
                (bottom-right corner) on any page.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <p className="font-medium">Data Corrections</p>
          <p className="mt-1 text-sm text-muted-foreground">
            If you notice incorrect data in a report, please email us or submit feedback with the property
            address and the specific data point that seems wrong. Our data comes from government
            sources, so corrections may need to be made upstream.
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <p className="font-medium">Coverage Requests</p>
          <p className="mt-1 text-sm text-muted-foreground">
            WhareScore currently has the best coverage for Wellington, Auckland, and Christchurch.
            If you search for an address outside our coverage area, you can sign up to be notified
            when we expand to your region.
          </p>
        </div>
      </section>
    </StaticPageLayout>
  );
}
