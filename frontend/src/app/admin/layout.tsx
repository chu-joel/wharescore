'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AdminAuthGate } from '@/components/admin/AdminAuthGate';

const TABS = [
  { label: 'Dashboard', href: '/admin' },
  { label: 'Data Health', href: '/admin/data-health' },
  { label: 'Feedback', href: '/admin/feedback' },
  { label: 'Emails', href: '/admin/emails' },
  { label: 'Content', href: '/admin/content' },
  { label: 'Recommendations', href: '/admin/recommendations' },
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AdminAuthGate>
      <div className="min-h-screen bg-background">
        {/* Top bar */}
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <h1 className="text-lg font-semibold">WhareScore Admin</h1>
          </div>
        </header>

        {/* Tab navigation */}
        <nav className="border-b">
          <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
            {TABS.map((tab) => {
              const isActive =
                tab.href === '/admin'
                  ? pathname === '/admin'
                  : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`shrink-0 border-b-2 px-4 py-2.5 text-sm transition-colors ${
                    isActive
                      ? 'border-primary font-semibold text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Page content */}
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </div>
    </AdminAuthGate>
  );
}
