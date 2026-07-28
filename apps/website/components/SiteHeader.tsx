'use client';

import Link from 'next/link';
import { useLanguage } from '../lib/LanguageContext';

const NAV_LABELS = {
  en: { privacy: 'Privacy Policy', terms: 'Terms of Service' },
  sq: { privacy: 'Politika e Privatësisë', terms: 'Kushtet e Përdorimit' },
};

export function SiteHeader() {
  const { language, setLanguage } = useLanguage();
  const labels = NAV_LABELS[language];

  return (
    <header className="site-header">
      <div className="wrapper site-header-inner">
        <Link href="/" className="brand">
          Llogarite
        </Link>
        <div className="site-header-right">
          <nav className="site-nav">
            <Link href="/privacy-policy">{labels.privacy}</Link>
            <Link href="/terms-of-service">{labels.terms}</Link>
          </nav>
          <div className="lang-switch">
            <button className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>
              EN
            </button>
            <button className={language === 'sq' ? 'active' : ''} onClick={() => setLanguage('sq')}>
              SQ
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
