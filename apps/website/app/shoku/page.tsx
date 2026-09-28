import type { Metadata } from 'next';
import { BuddyInviteContent } from '../../components/BuddyInviteContent';
import { SiteFooter } from '../../components/SiteFooter';
import { SiteHeader } from '../../components/SiteHeader';

export const metadata: Metadata = {
  title: 'Add a buddy — Llogarite',
};

export default function BuddyInvitePage() {
  return (
    <>
      <SiteHeader />
      <BuddyInviteContent />
      <SiteFooter />
    </>
  );
}
