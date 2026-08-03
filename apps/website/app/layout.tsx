import type { Metadata } from 'next';
import { LanguageProvider } from '../lib/LanguageContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'Llogarite — Understand every expense',
  description: 'Llogarite scans and verifies purchase invoices, tracks your budget and monthly payments, and splits shared expenses with friends.',
  icons: { icon: '/favicon.png?v=4' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><LanguageProvider>{children}</LanguageProvider></body></html>;
}
