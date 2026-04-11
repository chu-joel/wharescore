'use client';

import Link from 'next/link';
import { ArrowLeft, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const STATIC_PAGES = [
  { href: '/about', label: 'About' },
  { href: '/help', label: 'Help & FAQ' },
  { href: '/contact', label: 'Contact' },
  { href: '/changelog', label: "What's New" },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/suburbs', label: 'Suburb Guides' },
] as const;

interface StaticPageLayoutProps {
  title: string;
  children: React.ReactNode;
}

export function StaticPageLayout({ title, children }: StaticPageLayoutProps) {
  const [isDark, setIsDark] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="flex items-center justify-between mb-6 gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to map
          </Link>
          {/* Inline nav to other static pages so visitors who land here
              directly (e.g. from search) can reach the rest of the site
              without bouncing back through the map. */}
          <nav className="hidden sm:flex items-center gap-4 text-sm text-muted-foreground flex-1 justify-center">
            {STATIC_PAGES.filter((p) => p.href !== pathname).slice(0, 4).map((p) => (
              <Link
                key={p.href}
                href={p.href}
                className="hover:text-foreground transition-colors whitespace-nowrap"
              >
                {p.label}
              </Link>
            ))}
          </nav>
          <button
            onClick={toggleDark}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
        <h1 className="mb-6 text-2xl font-bold">{title}</h1>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {children}
        </div>

        {/* Cross-linking footer for SEO internal linking */}
        <nav className="mt-12 pt-6 border-t border-border">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {STATIC_PAGES.filter((p) => p.href !== pathname).map((p) => (
              <Link
                key={p.href}
                href={p.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {p.label}
              </Link>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} WhareScore. Not financial or legal advice.
          </p>
        </nav>
      </div>
    </div>
  );
}
