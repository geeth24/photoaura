import Header from '@/components/Header';

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="min-h-screen">{children}</main>
    </>
  );
}
