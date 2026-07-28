import type { Metadata } from 'next';
import { LegalPage } from '../../components/LegalPage';
import { SiteFooter } from '../../components/SiteFooter';
import { SiteHeader } from '../../components/SiteHeader';

export const metadata: Metadata = {
  title: 'Privacy Policy — Llogarite',
};

export default function PrivacyPolicyPage() {
  return (
    <>
      <SiteHeader />
      <LegalPage type="privacy" />
      <SiteFooter />
    </>
  );
}
