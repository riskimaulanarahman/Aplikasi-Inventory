import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Inventory SaaS Multi Outlet/Cabang',
  description: 'Inventory SaaS dengan Laravel API, RBAC Outlet/Cabang, billing subscription, dan admin monitoring.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
