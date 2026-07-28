import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Llogarite — Scan invoices, track budget, split expenses',
  description:
    'Llogarite scans and verifies your purchase invoices, tracks your budget and monthly payments, and splits shared expenses with friends.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
