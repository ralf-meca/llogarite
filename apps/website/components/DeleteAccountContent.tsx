'use client';

import { useLanguage } from '../lib/LanguageContext';

const CONTENT = {
  en: {
    title: 'Delete your account',
    updated: 'Last updated: July 2026',
    sections: [
      {
        heading: 'In the app (recommended)',
        body: (
          <>
            Open Llogarite, tap your profile icon in the top corner, then <strong>Delete account</strong>. Confirm
            the warning and your account is deleted immediately.
          </>
        ),
      },
      {
        heading: 'What gets deleted',
        body: 'Your account, all saved invoices, budget and monthly payment settings, projects, and expense-buddy connections. This is permanent and cannot be undone.',
      },
      {
        heading: 'No longer have access to the app?',
        body: (
          <>
            Email <a href="mailto:support@llogarite.site">support@llogarite.site</a> from the address registered to
            your account and ask us to delete it. We&apos;ll process the request and confirm once it&apos;s done.
          </>
        ),
      },
    ],
  },
  sq: {
    title: 'Fshi llogarinë tënde',
    updated: 'Përditësuar së fundmi: Korrik 2026',
    sections: [
      {
        heading: 'Në aplikacion (rekomandohet)',
        body: (
          <>
            Hap Llogarite, prek ikonën e profilit në cep të ekranit, pastaj <strong>Fshi llogarinë</strong>. Konfirmo
            paralajmërimin dhe llogaria jote fshihet menjëherë.
          </>
        ),
      },
      {
        heading: 'Çfarë fshihet',
        body: 'Llogaria jote, të gjitha faturat e ruajtura, cilësimet e buxhetit dhe pagesave mujore, projektet, dhe lidhjet me shokë shpenzimesh. Kjo është e përhershme dhe nuk mund të kthehet.',
      },
      {
        heading: 'Nuk ke më qasje në aplikacion?',
        body: (
          <>
            Na shkruaj në <a href="mailto:support@llogarite.site">support@llogarite.site</a> nga adresa e regjistruar
            në llogarinë tënde dhe na kërko ta fshijmë. Do ta procesojmë kërkesën dhe do të konfirmojmë kur të
            përfundojë.
          </>
        ),
      },
    ],
  },
};

export function DeleteAccountContent() {
  const { language } = useLanguage();
  const content = CONTENT[language];

  return (
    <div className="wrapper legal-page">
      <div className="legal-header">
        <div>
          <h1>{content.title}</h1>
          <div className="legal-updated">{content.updated}</div>
        </div>
      </div>

      {content.sections.map((section) => (
        <section key={section.heading} className="legal-section">
          <h2>{section.heading}</h2>
          <p>{section.body}</p>
        </section>
      ))}
    </div>
  );
}
