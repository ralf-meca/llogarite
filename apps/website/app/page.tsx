'use client';

import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';
import { useLanguage } from '../lib/LanguageContext';
import { HOME_CONTENT } from '../lib/homeContent';

export default function HomePage() {
  const { language } = useLanguage();
  const content = HOME_CONTENT[language];

  return (
    <>
      <SiteHeader />

      <main className="wrapper hero">
        <h1>{content.heroTitle}</h1>
        <p className="hero-subtitle">{content.heroSubtitle}</p>
      </main>

      <section className="wrapper features">
        {content.features.map((feature) => (
          <div key={feature.title} className="feature-card">
            <h2>{feature.title}</h2>
            <p>{feature.body}</p>
          </div>
        ))}
      </section>

      <SiteFooter />
    </>
  );
}
