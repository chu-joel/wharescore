import '@/styles/tokens-new.css';

export const metadata = {
  title: 'WhareScore — new UI',
  description: 'WhareScore property intelligence for Aotearoa New Zealand. New UI preview.',
};

export default function NewLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ws-new" data-theme="light">
      {children}
    </div>
  );
}
