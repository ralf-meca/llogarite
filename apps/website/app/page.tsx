'use client';

import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';
import { useLanguage } from '../lib/LanguageContext';
import { HOME_CONTENT } from '../lib/homeContent';

const screenHighlights = [
  { image: '/screens/budget.jpeg', label: 'Budget', index: '01' },
  { image: '/screens/invoices.jpeg', label: 'Invoices', index: '02' },
  { image: '/screens/payments.jpeg', label: 'Payments', index: '03' },
  { image: '/screens/projects.jpeg', label: 'Projects', index: '04' },
  { image: '/screens/buddies.jpeg', label: 'Shared expenses', index: '05' },
];

export default function HomePage() {
  const { language } = useLanguage();
  const content = HOME_CONTENT[language];
  const copy = language === 'en'
    ? { eyebrow: 'A clearer relationship with money', explore: 'Explore the app', builtFor: 'Everything you need. Nothing you do not.', featured: 'The complete picture', featuredTitle: 'See the story behind every purchase.', featuredBody: 'Llogarite turns receipts into a simple, useful view of your spending — from one purchase to your entire month.', flow: 'Your money, in motion', flowTitle: 'Capture. Understand. Move forward.', cta: 'Built for the details that make life add up.' }
    : { eyebrow: 'Një marrëdhënie më e qartë me paratë', explore: 'Shiko aplikacionin', builtFor: 'Gjithçka që të duhet. Asgjë që s’të duhet.', featured: 'Pamja e plotë', featuredTitle: 'Shiko historinë pas çdo blerjeje.', featuredBody: 'Llogarite i kthen faturat në një pamje të thjeshtë dhe të dobishme të shpenzimeve të tua.', flow: 'Paratë e tua, në lëvizje', flowTitle: 'Regjistro. Kupto. Ec përpara.', cta: 'Ndërtuar për detajet që e bëjnë jetën të përputhet.' };

  return <><SiteHeader /><main>
    <section className="hero-section"><div className="hero-glow hero-glow-one" /><div className="hero-glow hero-glow-two" /><div className="wrapper hero-content">
      <p className="eyebrow">{copy.eyebrow}</p><h1>{content.heroTitle}</h1><p className="hero-subtitle">{content.heroSubtitle}</p><a className="hero-link" href="#features">{copy.explore} <span>↓</span></a>
      <div className="hero-device-wrap" aria-label="Llogarite dashboard preview"><div className="hero-device device-frame"><img src="/screens/dashboard.jpeg" alt="Llogarite expense dashboard" /></div><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="hero-stat hero-stat-left"><strong>22</strong><span>invoices saved</span></div><div className="hero-stat hero-stat-right"><i /> <span>Budget on track</span></div></div>
    </div></section>
    <section className="intro-section" id="features"><div className="wrapper"><p className="eyebrow">{copy.builtFor}</p><div className="feature-grid">{content.features.map((feature, index) => <article key={feature.title} className="feature-card"><span className="feature-number">0{index + 1}</span><h2>{feature.title}</h2><p>{feature.body}</p><span className="feature-arrow">↗</span></article>)}</div></div></section>
    <section className="showcase-section"><div className="wrapper showcase-grid"><div className="showcase-copy"><p className="eyebrow">{copy.featured}</p><h2>{copy.featuredTitle}</h2><p>{copy.featuredBody}</p></div><div className="insight-devices"><div className="device-frame device-small device-back"><img src="/screens/insights.jpeg" alt="Spending insights" /></div><div className="device-frame device-small device-front"><img src="/screens/invoices.jpeg" alt="Saved invoices" /></div></div></div></section>
    <section className="screens-section"><div className="wrapper"><div className="section-heading"><div><p className="eyebrow">{copy.flow}</p><h2>{copy.flowTitle}</h2></div><span className="section-line" /></div><div className="screen-rail">{screenHighlights.map((screen) => <figure className="screen-card" key={screen.image}><div className="screen-image device-frame"><img src={screen.image} alt={`Llogarite ${screen.label} screen`} /></div><figcaption><span>{screen.index}</span><strong>{screen.label}</strong></figcaption></figure>)}</div></div></section>
    <section className="closing-section"><div className="closing-orb" /><div className="wrapper"><p>{copy.cta}</p><span className="wordmark">Llogarite<span>.</span></span></div></section>
  </main><SiteFooter /></>;
}
