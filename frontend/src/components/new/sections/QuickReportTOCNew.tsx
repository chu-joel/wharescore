'use client';

import { Lock } from 'lucide-react';

export interface TOCItem {
  id: string;       // anchor id (without #) for free rows; ignored when locked
  label: string;
  locked?: boolean;
}

interface Props {
  items: TOCItem[];
  /** Anchor scrolled to when a locked row is clicked. Defaults to upgrade-banner. */
  upgradeAnchor?: string;
}

export function QuickReportTOCNew({ items, upgradeAnchor = 'upgrade-banner' }: Props) {
  const scrollTo = (id: string) => {
    if (typeof document === 'undefined') return;
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav className="ws-toc" aria-label="Sections">
      <h3>Contents</h3>
      <ol>
        {items.map((item) => (
          <li key={item.label}>
            {item.locked ? (
              <button
                type="button"
                className="locked"
                onClick={() => scrollTo(upgradeAnchor)}
                aria-label={`${item.label}. Locked. Upgrade to unlock.`}
              >
                <span>{item.label}</span>
                <span className="lock-icon" aria-hidden="true">
                  <Lock size={11} />
                </span>
              </button>
            ) : (
              <a
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo(item.id);
                }}
              >
                <span>{item.label}</span>
                <span />
              </a>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
