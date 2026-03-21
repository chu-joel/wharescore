'use client';

import { HelpCircle, Moon, Sun, ChevronLeft, MapPin, FileText, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/search/SearchBar';
import { useSearchStore } from '@/stores/searchStore';
import { useRouter, usePathname } from 'next/navigation';

export function AppHeader() {
  const [isDark, setIsDark] = useState(false);
  const selectedAddress = useSearchStore((s) => s.selectedAddress);
  const clearSelection = useSearchStore((s) => s.clearSelection);
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const isSignedIn = !!session?.user;
  const isPropertyPage = pathname?.startsWith('/property/');
  const isHome = pathname === '/';

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  }

  function handleBack() {
    clearSelection();
    router.push('/');
  }

  // Always show search bar in header
  const showHeaderSearch = true;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="flex h-full items-center gap-2 px-3 sm:px-4">
        {/* Left: Logo or Back button */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isPropertyPage || selectedAddress ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="h-9 w-9 shrink-0"
                aria-label="Back to map"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              {selectedAddress && (
                <div className="hidden sm:flex items-center gap-1.5 min-w-0">
                  <MapPin className="h-3.5 w-3.5 text-piq-primary shrink-0" />
                  <span className="text-sm font-medium truncate max-w-[180px] lg:max-w-[280px]">
                    {selectedAddress.fullAddress}
                  </span>
                </div>
              )}
              {!selectedAddress && (
                <span className="text-lg font-bold text-piq-primary">
                  WhareScore
                </span>
              )}
            </>
          ) : (
            <a href="/" className="flex items-center gap-1.5">
              <span className="text-xl font-bold text-piq-primary">
                Whare<span className="text-foreground">Score</span>
              </span>
              <span className="hidden sm:inline text-[10px] font-semibold text-piq-primary bg-piq-primary/10 px-1.5 py-0.5 rounded">
                BETA
              </span>
            </a>
          )}
        </div>

        {/* Center: Search bar (visible on home page when no selection) */}
        {showHeaderSearch && (
          <div className="flex-1 max-w-lg mx-auto">
            <SearchBar compact />
          </div>
        )}

        {/* Spacer when no search */}
        {!showHeaderSearch && <div className="flex-1" />}

        {/* Right: Actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          <a
            href="/about"
            className="hidden sm:inline-flex text-sm text-muted-foreground hover:text-foreground px-2.5 py-2 rounded-lg hover:bg-muted transition-colors"
          >
            About
          </a>

          {isSignedIn ? (
            <>
              <a
                href="/account"
                className="hidden sm:inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground px-2.5 py-2 rounded-lg hover:bg-muted transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                My Reports
              </a>
              <span className="hidden sm:inline text-xs text-muted-foreground px-1.5 truncate max-w-[120px]">
                {session.user?.name?.split(' ')[0]}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => signOut()}
                className="h-9 w-9"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-sm"
              onClick={() => signIn('google')}
            >
              Sign in
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-9 w-9"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <a href="/help" aria-label="Help">
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Help">
              <HelpCircle className="h-4 w-4" />
            </Button>
          </a>
        </div>
      </div>
    </header>
  );
}
