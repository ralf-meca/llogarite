'use client';

import { PlayStoreButton } from '../components/PlayStoreButton';
import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';
import { useLanguage } from '../lib/LanguageContext';
import { HOME_CONTENT } from '../lib/homeContent';

// The ?v= on every screenshot is there to be bumped when the pictures change.
// They are served with a four-hour browser cache under the same file names,
// so without it a returning visitor keeps seeing the previous set.
const screenHighlights = [
  { image: '/screens/budget.jpeg?v=2', label: { en: 'Budget', sq: 'Buxheti' }, index: '01' },
  { image: '/screens/invoices.jpeg?v=2', label: { en: 'Invoices', sq: 'Faturat' }, index: '02' },
  { image: '/screens/projects.jpeg?v=2', label: { en: 'Projects & trips', sq: 'Projekte & udhëtime' }, index: '03' },
  { image: '/screens/trip.jpeg?v=2', label: { en: 'Trip costs', sq: 'Kostot e udhëtimit' }, index: '04' },
  { image: '/screens/buddies.jpeg?v=2', label: { en: 'Shared expenses', sq: 'Shpenzime të përbashkëta' }, index: '05' },
];

export default function HomePage() {
  const { language } = useLanguage();
  const content = HOME_CONTENT[language];
  const copy = language === 'en'
    ? { eyebrow: 'A clearer relationship with money', explore: 'Explore the app', builtFor: 'Simple. Clear. Private.', featured: 'The complete picture', featuredTitle: 'See the story behind every purchase.', featuredBody: 'Llogarite turns receipts into a simple, useful view of your spending — from one purchase to your entire month.', flow: 'More than just recording invoices', flowTitle: 'Everything about your money, in one place.', invoicesSaved: 'invoices saved', budgetOnTrack: 'Budget on track', cta: 'Built for the details that make life add up.' }
    : { eyebrow: 'Një marrëdhënie më e qartë me paratë', explore: 'Shiko aplikacionin', builtFor: 'E thjeshtë. E qartë. Private.', featured: 'Pamja e plotë', featuredTitle: 'Shiko historinë pas çdo blerjeje.', featuredBody: 'Llogarite i kthen faturat në një pamje të thjeshtë dhe të dobishme të shpenzimeve të tua.', flow: 'Më shumë se vetëm regjistrim faturash', flowTitle: 'Gjithçka për paratë e tua, në një vend.', invoicesSaved: 'fatura të ruajtura', budgetOnTrack: 'Buxheti në rregull', cta: 'Më pak hamendje. Më shumë kontroll.' };

  return <><SiteHeader /><main>
    <section className="hero-section"><div className="hero-glow hero-glow-one" /><div className="hero-glow hero-glow-two" /><div className="wrapper hero-content">
      <p className="eyebrow">{copy.eyebrow}</p><h1>{content.heroTitle}</h1><p className="hero-subtitle">{content.heroSubtitle}</p><div className="hero-ctas"><PlayStoreButton /><a className="hero-link" href="#features">{copy.explore} <span>↓</span></a></div>
      <div className="hero-device-wrap" aria-label="Llogarite dashboard preview"><div className="hero-device device-frame"><img src="/screens/dashboard.jpeg?v=3" alt="Llogarite expense dashboard" /></div><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="hero-stat hero-stat-left"><strong>22</strong><span>{copy.invoicesSaved}</span></div><div className="hero-stat hero-stat-right"><i /> <span>{copy.budgetOnTrack}</span></div></div>
    </div></section>
    <section className="intro-section" id="features"><div className="wrapper"><p className="eyebrow">{copy.builtFor}</p><div className="feature-grid">{content.features.map((feature, index) => <article key={feature.title} className="feature-card"><span className="feature-number">0{index + 1}</span><h2>{feature.title}</h2><p>{feature.body}</p><span className="feature-arrow">↗</span></article>)}</div></div></section>
    <section className="showcase-section"><div className="wrapper showcase-grid"><div className="showcase-copy"><p className="eyebrow">{copy.featured}</p><h2>{copy.featuredTitle}</h2><p>{copy.featuredBody}</p></div><div className="insight-devices"><div className="device-frame device-small device-back"><img src="/screens/trip.jpeg?v=2" alt="A trip with its expenses and who owes what" /></div><div className="device-frame device-small device-front"><img src="/screens/invoices.jpeg?v=2" alt="Saved invoices" /></div></div></div></section>
    <section className="screens-section"><div className="wrapper"><div className="section-heading"><div><p className="eyebrow">{copy.flow}</p><h2>{copy.flowTitle}</h2></div><span className="section-line" /></div><div className="screen-rail">{screenHighlights.map((screen) => <figure className="screen-card" key={screen.image}><div className="screen-image device-frame"><img src={screen.image} alt={`Llogarite — ${screen.label[language]}`} /></div><figcaption><span>{screen.index}</span><strong>{screen.label[language]}</strong></figcaption></figure>)}</div></div></section>
    <section className="closing-section"><div className="closing-orb" /><div className="wrapper"><p>{copy.cta}</p><PlayStoreButton className="closing-cta" /><span className="wordmark">Llogarite<span>.</span></span></div></section>
  </main><SiteFooter /></>;
}
