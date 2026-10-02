import type { Metadata } from 'next';
import { LoginLinkContent } from '../../components/LoginLinkContent';
import { SiteFooter } from '../../components/SiteFooter';
import { SiteHeader } from '../../components/SiteHeader';

export const metadata: Metadata = {
  title: 'Kodi i kyçjes — Llogarite',
  // Opened from a private email; there is nothing here for a search engine.
  robots: { index: false, follow: false },
};

export default function LoginLinkPage() {
  return (
    <>
      <SiteHeader />
      <LoginLinkContent />
      <SiteFooter />
    </>
  );
}
