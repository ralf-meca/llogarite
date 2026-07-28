import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrapper site-footer-inner">
        <span>© {new Date().getFullYear()} Llogarite</span>
        <div className="site-footer-links">
          <Link href="/privacy-policy">Privacy Policy</Link>
          <Link href="/terms-of-service">Terms of Service</Link>
          <Link href="/delete-account">Delete Account</Link>
          <a href="mailto:support@llogarite.site">support@llogarite.site</a>
        </div>
      </div>
    </footer>
  );
}
