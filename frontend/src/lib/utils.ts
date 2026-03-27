import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Allowlisted hostnames for external redirects (Stripe, billing portals). */
const ALLOWED_REDIRECT_HOSTS = ['checkout.stripe.com', 'billing.stripe.com'];

/**
 * Validate an external redirect URL before navigating.
 * Blocks javascript: URIs, data: URIs, and unexpected domains.
 */
export function safeRedirect(url: string): void {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      throw new Error(`Unsafe redirect protocol: ${parsed.protocol}`);
    }
    const allowed = ALLOWED_REDIRECT_HOSTS.some(
      (h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`),
    );
    if (!allowed) {
      throw new Error(`Redirect to disallowed host: ${parsed.hostname}`);
    }
    window.location.href = url;
  } catch (e) {
    console.error('Blocked unsafe redirect:', e);
    throw new Error('Invalid checkout URL');
  }
}

/** Strip HTML tags using the browser's built-in parser (safer than regex). */
export function stripHtml(input: string): string {
  if (typeof document === 'undefined') {
    // SSR fallback: strip anything that looks like a tag
    return input.replace(/<[^>]*>/g, '');
  }
  const doc = new DOMParser().parseFromString(input, 'text/html');
  return doc.body.textContent || '';
}
