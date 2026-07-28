export type HomeContent = {
  heroTitle: string;
  heroSubtitle: string;
  features: { title: string; body: string }[];
};

export const HOME_CONTENT: Record<'en' | 'sq', HomeContent> = {
  en: {
    heroTitle: 'Know exactly where your money goes.',
    heroSubtitle:
      'Llogarite scans and verifies your purchase invoices, tracks your budget, and splits shared expenses with friends — all in one app.',
    features: [
      {
        title: 'Scan and save invoices',
        body: 'Scan a QR code or a receipt photo and Llogarite verifies it against the tax authority and saves it automatically.',
      },
      {
        title: 'Budget and monthly payments',
        body: 'Track your spending against a monthly budget and get reminders for recurring payments.',
      },
      {
        title: 'Projects',
        body: 'Group invoices by project to see exactly what a renovation, trip, or event actually cost.',
      },
      {
        title: 'Price tracking',
        body: 'See how prices for the things you buy change over time across your saved invoices.',
      },
      {
        title: 'Expense buddies',
        body: 'Split shared purchases with friends or family and keep track of who owes who.',
      },
    ],
  },
  sq: {
    heroTitle: 'Di saktësisht ku shkojnë paratë e tua.',
    heroSubtitle:
      'Llogarite skanon dhe verifikon faturat e blerjeve, ndjek buxhetin tënd, dhe ndan shpenzimet e përbashkëta me shokët — të gjitha në një aplikacion.',
    features: [
      {
        title: 'Skano dhe ruaj fatura',
        body: 'Skano një kod QR ose një foto të faturës dhe Llogarite e verifikon pranë autoritetit tatimor dhe e ruan automatikisht.',
      },
      {
        title: 'Buxheti dhe pagesat mujore',
        body: 'Ndiq shpenzimet e tua kundrejt një buxheti mujor dhe merr kujtesa për pagesat e përsëritura.',
      },
      {
        title: 'Projektet',
        body: 'Grupo faturat sipas projektit për të parë saktësisht sa kushtoi një rinovim, udhëtim, apo eveniment.',
      },
      {
        title: 'Ndjekja e çmimeve',
        body: 'Shiko si ndryshojnë çmimet e gjërave që blen me kalimin e kohës në bazë të faturave të ruajtura.',
      },
      {
        title: 'Shokët e shpenzimeve',
        body: 'Ndaj blerjet e përbashkëta me miq ose familjen dhe mbaj gjurmët e kush i detyrohet kujt.',
      },
    ],
  },
};
