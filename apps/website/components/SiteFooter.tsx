'use client';

import Link from 'next/link';
import { useLanguage } from '../lib/LanguageContext';

const FOOTER_LABELS = {
  en: { privacy: 'Privacy Policy', terms: 'Terms of Service', deleteAccount: 'Delete Account' },
  sq: { privacy: 'Politika e Privatësisë', terms: 'Kushtet e Përdorimit', deleteAccount: 'Fshi Llogarinë' },
};

export function SiteFooter() {
  const { language } = useLanguage();
  const labels = FOOTER_LABELS[language];

  return (
    <footer className="site-footer">
      <div className="wrapper site-footer-inner">
        <span>© {new Date().getFullYear()} RM Tech</span>
        <div className="site-footer-links">
          <Link href="/privacy-policy">{labels.privacy}</Link>
          <Link href="/terms-of-service">{labels.terms}</Link>
          <Link href="/delete-account">{labels.deleteAccount}</Link>
          <a href="mailto:support@llogarite.site">support@llogarite.site</a>
        </div>
      </div>
    </footer>
  );
}
