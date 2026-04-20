import Link from 'next/link';
import { Home, Search } from 'lucide-react';

export const metadata = {
  title: 'Page not found | WhareScore',
  description: 'The page you are looking for does not exist or has been moved.',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md space-y-6">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-2xl bg-piq-primary/10 flex items-center justify-center">
            <Search className="h-8 w-8 text-piq-primary" />
          </div>
        </div>
        <div>
          <h1 className="text-4xl font-bold">404</h1>
          <p className="text-muted-foreground mt-2">
            This page doesn&rsquo;t exist or has been moved.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-piq-primary text-white px-5 py-2.5 text-sm font-medium hover:bg-piq-primary-dark transition-colors"
          >
            <Home className="h-4 w-4" />
            Back to map
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          WhareScore. property intelligence for New Zealand
        </p>
      </div>
    </div>
  );
}
