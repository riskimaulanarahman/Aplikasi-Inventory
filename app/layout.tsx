import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aplikasi Inventori Stok",
  description: "Aplikasi manajemen stok pusat dan outlet"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
