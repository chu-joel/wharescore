import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Reports',
  description: 'View your saved WhareScore property reports, credits, and account settings.',
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
