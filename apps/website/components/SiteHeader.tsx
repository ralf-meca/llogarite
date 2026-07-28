import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="wrapper site-header-inner">
        <Link href="/" className="brand">
          Llogarite
        </Link>
        <nav className="site-nav">
          <Link href="/privacy-policy">Privacy Policy</Link>
          <Link href="/terms-of-service">Terms of Service</Link>
        </nav>
      </div>
    </header>
  );
}
