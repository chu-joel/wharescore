'use client';

import { HelpCircle, Moon, Sun, ChevronLeft, MapPin, FileText, LogOut, UserCircle, LogIn } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/search/SearchBar';
import { useSearchStore } from '@/stores/searchStore';
import { useRouter, usePathname } from 'next/navigation';

export function AppHeader() {
  const [isDark, setIsDark] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
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

  // Close account menu on outside click
  useEffect(() => {
    if (!showAccountMenu) return;
    function handleClick(e: MouseEvent) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setShowAccountMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showAccountMenu]);

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

  // Hide header search on the desktop landing page — the panel has its own prominent search.
  // Keep it everywhere else (mobile home, any page with a selection, static pages).
  const isDesktopLanding = isHome && !selectedAddress;
  const showHeaderSearch = true;

  return (
    <header className="fixed top-0 left-0 right-0 z-[60] h-14 border-b border-border bg-background/95 backdrop-blur-sm">
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
                <span className="flex items-center gap-1.5">
                  <img src="/wharescore-logo.png" alt="WhareScore" width={34} height={32} className="shrink-0" />
                  <span className="hidden sm:inline text-lg font-bold text-piq-primary">WhareScore</span>
                </span>
              )}
            </>
          ) : (
            <a href="/" className="flex items-center gap-1.5">
              <img src="/wharescore-logo.png" alt="WhareScore" width={34} height={32} className="shrink-0" />
              <span className="hidden sm:inline text-xl font-bold text-piq-primary">
                Whare<span className="text-foreground">Score</span>
              </span>
            </a>
          )}
        </div>

        {/* Center: Search bar. Hidden on desktop landing (panel has its own search) to avoid duplicates. */}
        {showHeaderSearch && (
          <div className={`flex-1 max-w-lg mx-auto${isDesktopLanding ? ' md:hidden' : ''}`}>
            <SearchBar compact />
          </div>
        )}
        {/* Spacer on desktop landing so right-side buttons keep their position. */}
        {isDesktopLanding && <div className="hidden md:block flex-1" />}

        {/* Spacer when no search */}
        {!showHeaderSearch && <div className="flex-1" />}

        {/* Right: Actions */}
        <div className="flex items-center gap-1 shrink-0">
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
                className="inline-flex items-center justify-center h-9 w-9 rounded-lg hover:bg-muted transition-colors sm:hidden"
                aria-label="My Reports"
                title="My Reports"
              >
                <FileText className="h-4 w-4" />
              </a>
              <a
                href="/account"
                className="hidden sm:inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground px-2.5 py-2 rounded-lg hover:bg-muted transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                My Reports
              </a>
              <div className="relative" ref={accountMenuRef}>
                <button
                  onClick={() => setShowAccountMenu(!showAccountMenu)}
                  className="inline-flex items-center justify-center h-9 w-9 rounded-lg hover:bg-muted transition-colors"
                  aria-label="Account menu"
                >
                  <UserCircle className="h-5 w-5" />
                </button>
                {showAccountMenu && (
                  <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-border bg-background shadow-lg py-1 z-[70]">
                    <div className="px-3 py-2 border-b border-border">
                      <p className="text-sm font-medium truncate">{session.user?.name || 'Account'}</p>
                      {session.user?.email && (
                        <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
                      )}
                    </div>
                    <button
                      onClick={() => { setShowAccountMenu(false); signOut(); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <a
              href="/signin"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground px-2.5 py-2 rounded-lg hover:bg-muted transition-colors"
            >
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">Sign in</span>
            </a>
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
