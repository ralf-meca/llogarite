import type { Metadata } from 'next';
import { SiteFooter } from '../../components/SiteFooter';
import { SiteHeader } from '../../components/SiteHeader';

export const metadata: Metadata = {
  title: 'Delete Account — Llogarite',
};

export default function DeleteAccountPage() {
  return (
    <>
      <SiteHeader />

      <div className="wrapper legal-page">
        <div className="legal-header">
          <div>
            <h1>Delete your account</h1>
            <div className="legal-updated">Last updated: July 2026</div>
          </div>
        </div>

        <section className="legal-section">
          <h2>In the app (recommended)</h2>
          <p>
            Open Llogarite, tap your profile icon in the top corner, then <strong>Delete account</strong>. Confirm
            the warning and your account is deleted immediately.
          </p>
        </section>
        <section className="legal-section">
          <h2>What gets deleted</h2>
          <p>
            Your account, all saved invoices, budget and monthly payment settings, projects, and expense-buddy
            connections. This is permanent and cannot be undone.
          </p>
        </section>
        <section className="legal-section">
          <h2>No longer have access to the app?</h2>
          <p>
            Email <a href="mailto:support@llogarite.site">support@llogarite.site</a> from the address registered to
            your account and ask us to delete it. We'll process the request and confirm once it's done.
          </p>
        </section>
      </div>

      <SiteFooter />
    </>
  );
}
