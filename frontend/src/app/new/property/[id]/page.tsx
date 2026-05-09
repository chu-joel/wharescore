import { redirect } from 'next/navigation';
export default async function R({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/new?address=${id}`);
}
