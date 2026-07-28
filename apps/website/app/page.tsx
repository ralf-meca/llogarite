import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';

const FEATURES = [
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
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />

      <main className="wrapper hero">
        <h1>Know exactly where your money goes.</h1>
        <p className="hero-subtitle">
          Llogarite scans and verifies your purchase invoices, tracks your budget, and splits shared expenses with
          friends — all in one app.
        </p>
      </main>

      <section className="wrapper features">
        {FEATURES.map((feature) => (
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
