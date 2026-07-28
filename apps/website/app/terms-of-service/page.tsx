import type { Metadata } from 'next';
import { LegalPage } from '../../components/LegalPage';
import { SiteFooter } from '../../components/SiteFooter';
import { SiteHeader } from '../../components/SiteHeader';

export const metadata: Metadata = {
  title: 'Terms of Service — Llogarite',
};

export default function TermsOfServicePage() {
  return (
    <>
      <SiteHeader />
      <LegalPage type="terms" />
      <SiteFooter />
    </>
  );
}
