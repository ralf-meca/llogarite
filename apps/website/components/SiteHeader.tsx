'use client';

import Link from 'next/link';
import { useLanguage } from '../lib/LanguageContext';

const NAV_LABELS = { en: { features: 'Features', privacy: 'Privacy', terms: 'Terms' }, sq: { features: 'Veçoritë', privacy: 'Privatësia', terms: 'Kushtet' } };

export function SiteHeader() {
  const { language, setLanguage } = useLanguage();
  const labels = NAV_LABELS[language];
  return <header className="site-header"><div className="wrapper site-header-inner"><Link href="/" className="brand" aria-label="Llogarite home"><img className="brand-logo" src="/favicon.png" alt="" />Llogarite<span className="brand-dot">.</span></Link><div className="site-header-right"><nav className="site-nav"><a href="/#features">{labels.features}</a><Link href="/privacy-policy">{labels.privacy}</Link><Link href="/terms-of-service">{labels.terms}</Link></nav><div className="lang-switch"><button className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>EN</button><button className={language === 'sq' ? 'active' : ''} onClick={() => setLanguage('sq')}>SQ</button></div></div></div></header>;
}
