import { Separator } from '@/components/ui/separator';

const FOOTER_LINKS = [
  { label: 'About', href: '/about' },
  { label: 'Help', href: '/help' },
  { label: 'Methodology', href: '/about#methodology' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Contact', href: '/contact' },
] as const;

export function AppFooter() {
  return (
    <footer className="bg-muted/50 px-4 py-6 text-sm text-muted-foreground">
      <p className="text-center">
        WhareScore combines data from 12+ NZ government sources.
      </p>
      <Separator className="my-4" />
      <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
        {FOOTER_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="hover:text-foreground transition-colors"
          >
            {link.label}
          </a>
        ))}
      </nav>
      <p className="mt-4 text-center text-xs">
        &copy; 2026 WhareScore. Not financial or legal advice. Data is indicative only.
      </p>
    </footer>
  );
}
