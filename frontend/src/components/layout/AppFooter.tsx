import Link from 'next/link';
import { Separator } from '@/components/ui/separator';

const FOOTER_LINKS = [
  { label: 'About', href: '/about' },
  { label: 'Help', href: '/help' },
  { label: 'Suburb Guides', href: '/suburbs' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Contact', href: '/contact' },
] as const;

export function AppFooter() {
  return (
    <footer className="bg-muted/50 px-4 py-6 text-sm text-muted-foreground">
      <p className="text-center">
        WhareScore combines data from 40+ official NZ government sources.
      </p>
      <Separator className="my-4" />
      <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
        {FOOTER_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="hover:text-foreground transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <p className="mt-4 text-center text-xs">
        &copy; 2026 WhareScore. Not financial or legal advice. Data is indicative only.
      </p>
    </footer>
  );
}
