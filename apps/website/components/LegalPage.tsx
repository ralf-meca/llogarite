'use client';

import { useLanguage } from '../lib/LanguageContext';
import { LEGAL_TITLES, LEGAL_UPDATED, getLegalSections, type LegalDocType } from '../lib/legalContent';

export function LegalPage({ type }: { type: LegalDocType }) {
  const { language } = useLanguage();
  const sections = getLegalSections(type, language);

  return (
    <div className="wrapper legal-page">
      <div className="legal-header">
        <div>
          <h1>{LEGAL_TITLES[language][type]}</h1>
          <div className="legal-updated">{LEGAL_UPDATED[language]}</div>
        </div>
      </div>

      {sections.map((section) => (
        <section key={section.heading} className="legal-section">
          <h2>{section.heading}</h2>
          <p>{section.body}</p>
        </section>
      ))}
    </div>
  );
}
