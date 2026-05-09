'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { Sun, Moon, LogIn, LogOut, UserCircle } from 'lucide-react';
import { UIToggle } from './UIToggle';

const THEME_KEY = 'ws-theme-new';

export function AppHeaderNew({ rightSlot }: { rightSlot?: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const { data: session } = useSession();
  const isSignedIn = !!session?.user;

  useEffect(() => {
    const stored = (typeof window !== 'undefined' ? localStorage.getItem(THEME_KEY) : null) as 'light' | 'dark' | null;
    if (stored === 'light' || stored === 'dark') {
      setTheme(stored);
      document.querySelector('.ws-new')?.setAttribute('data-theme', stored);
    }
  }, []);

  const switchTheme = (t: 'light' | 'dark') => {
    setTheme(t);
    document.querySelector('.ws-new')?.setAttribute('data-theme', t);
    try { localStorage.setItem(THEME_KEY, t); } catch {}
  };

  return (
    <header className="ws-app-header">
      <Link href="/new" className="ws-brand" style={{ textDecoration: 'none' }}>
        <span className="ws-brand-mark" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 11l9-8 9 8v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V11z" />
          </svg>
        </span>
        <span className="ws-brand-word">
          Whare<span className="accent">Score</span>
        </span>
      </Link>

      <nav style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--ws-ink-soft)', alignItems: 'center', overflow: 'hidden', whiteSpace: 'nowrap' }}>
        <Link href="/new" style={{ color: 'inherit', textDecoration: 'none' }}>Map</Link>
        <Link href="/new/compare" style={{ color: 'inherit', textDecoration: 'none' }}>Compare</Link>
        <Link href="/new/suburbs" style={{ color: 'inherit', textDecoration: 'none' }}>Suburbs</Link>
        {isSignedIn && <Link href="/new/account" style={{ color: 'inherit', textDecoration: 'none' }}>My reports</Link>}
        {rightSlot}
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div className="ws-pill-toggle" role="group" aria-label="Theme">
          <button onClick={() => switchTheme('light')} aria-pressed={theme === 'light'} aria-label="Light theme" title="Light"><Sun size={14} /></button>
          <button onClick={() => switchTheme('dark')} aria-pressed={theme === 'dark'} aria-label="Dark theme" title="Dark"><Moon size={14} /></button>
        </div>
        <UIToggle here="new" />
        {isSignedIn ? (
          <button onClick={() => signOut()} className="ws-btn ws-btn-ghost" title="Sign out"><LogOut size={14} /></button>
        ) : (
          <button onClick={() => signIn('google')} className="ws-btn ws-btn-outline"><LogIn size={14} /> Sign in</button>
        )}
      </div>
    </header>
  );
}
