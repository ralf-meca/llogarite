import type { Metadata } from 'next';
import { DeleteAccountContent } from '../../components/DeleteAccountContent';
import { SiteFooter } from '../../components/SiteFooter';
import { SiteHeader } from '../../components/SiteHeader';

export const metadata: Metadata = {
  title: 'Delete Account — Llogarite',
};

export default function DeleteAccountPage() {
  return (
    <>
      <SiteHeader />
      <DeleteAccountContent />
      <SiteFooter />
    </>
  );
}
