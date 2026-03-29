import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to WhareScore to access your saved reports and credits.',
};

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children;
}
