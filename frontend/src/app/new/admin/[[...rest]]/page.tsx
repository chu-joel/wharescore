import { redirect } from 'next/navigation';

// Admin keeps classic UI. Catch-all so any /new/admin/* URL redirects to the
// matching /admin/* path.
export default async function R({ params }: { params: Promise<{ rest?: string[] }> }) {
  const { rest } = await params;
  const path = rest && rest.length > 0 ? `/admin/${rest.join('/')}` : '/admin';
  redirect(path);
}
