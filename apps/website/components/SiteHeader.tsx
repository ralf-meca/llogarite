'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type CSSProperties,
} from 'react';
import { useLanguage, type Language } from '../lib/LanguageContext';

const NAV_LABELS = {
  en: { features: 'Features', privacy: 'Privacy', terms: 'Terms', contact: 'Get in touch', openMenu: 'Open menu', closeMenu: 'Close menu' },
  sq: { features: 'Veçoritë', privacy: 'Privatësia', terms: 'Kushtet', contact: 'Na kontaktoni', openMenu: 'Hap menunë', closeMenu: 'Mbyll menunë' },
};

type NavKey = 'features' | 'privacy' | 'terms';

const NAV_ITEMS: { key: NavKey; href: string }[] = [
  { key: 'features', href: '/#features' },
  { key: 'privacy', href: '/privacy-policy' },
  { key: 'terms', href: '/terms-of-service' },
];

const CONTACT_HREF = 'mailto:support@llogarite.site';

// Must match the CSS breakpoint where the inline links collapse into the panel.
const PANEL_BREAKPOINT = 850;

type Highlight = { left: number; width: number; visible: boolean; instant: boolean };

function normalizePath(path: string) {
  return path.replace(/\/+$/, '') || '/';
}

type NavLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string; active: boolean };

// Hash links stay plain anchors so they scroll on the home page and do a normal
// navigation from the legal pages; real routes go through next/link.
function NavLink({ href, active, ...rest }: NavLinkProps) {
  const ariaCurrent = active ? 'page' : undefined;
  return href.includes('#')
    ? <a href={href} aria-current={ariaCurrent} {...rest} />
    : <Link href={href} aria-current={ariaCurrent} {...rest} />;
}

function LanguageSwitch({ language, onChange }: { language: Language; onChange: (next: Language) => void }) {
  return (
    <div className="lang-switch">
      <button type="button" className={language === 'en' ? 'active' : ''} aria-pressed={language === 'en'} onClick={() => onChange('en')}>EN</button>
      <button type="button" className={language === 'sq' ? 'active' : ''} aria-pressed={language === 'sq'} onClick={() => onChange('sq')}>SQ</button>
    </div>
  );
}

export function SiteHeader() {
  const { language, setLanguage } = useLanguage();
  const labels = NAV_LABELS[language];
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlight, setHighlight] = useState<Highlight>({ left: 0, width: 0, visible: false, instant: true });
  const linksRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Condense into the floating pill once the page has scrolled at all.
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        toggleRef.current?.focus();
      }
    };
    // Widening past the breakpoint hides the toggle, so an open panel would be stranded.
    const onResize = () => {
      if (window.innerWidth > PANEL_BREAKPOINT) {
        setIsOpen(false);
      }
    };
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    return () => {
      root.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    };
  }, [isOpen]);

  const moveHighlight = useCallback((target: HTMLElement) => {
    const container = linksRef.current;
    if (!container) {
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    // The very first placement jumps into position instead of sliding in from the left edge.
    setHighlight((current) => ({
      left: rect.left - containerRect.left,
      width: rect.width,
      visible: true,
      instant: current.width === 0,
    }));
  }, []);

  const hideHighlight = useCallback(() => {
    setHighlight((current) => ({ ...current, visible: false }));
  }, []);

  const isActive = (href: string) => !href.includes('#') && normalizePath(pathname ?? '/') === normalizePath(href);

  return (
    <>
      <header className="site-header" data-scrolled={isScrolled} data-open={isOpen}>
        <div className="nav-shell">
          <div className="nav-bar">
            <Link href="/" className="brand" aria-label="Llogarite home">
              <img className="brand-logo" src="/favicon.png?v=4" alt="" />Llogarite<span className="brand-dot">.</span>
            </Link>

            <nav className="nav-links" ref={linksRef} aria-label="Primary" onMouseLeave={hideHighlight}>
              <span
                className="nav-highlight"
                aria-hidden="true"
                data-visible={highlight.visible}
                data-instant={highlight.instant}
                style={{ transform: `translateX(${highlight.left}px)`, width: highlight.width }}
              />
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.key}
                  href={item.href}
                  active={isActive(item.href)}
                  className="nav-link"
                  onMouseEnter={(event) => moveHighlight(event.currentTarget)}
                  onFocus={(event) => moveHighlight(event.currentTarget)}
                  onBlur={hideHighlight}
                >
                  {labels[item.key]}
                </NavLink>
              ))}
            </nav>

            <div className="nav-actions">
              <LanguageSwitch language={language} onChange={setLanguage} />
              <a className="nav-cta" href={CONTACT_HREF}>{labels.contact}</a>
              <button
                ref={toggleRef}
                type="button"
                className="nav-toggle"
                aria-expanded={isOpen}
                aria-controls="site-nav-panel"
                aria-label={isOpen ? labels.closeMenu : labels.openMenu}
                onClick={() => setIsOpen((open) => !open)}
              >
                <span />
                <span />
              </button>
            </div>
          </div>

          <div className="nav-panel" id="site-nav-panel" inert={!isOpen}>
            <div className="nav-panel-inner">
              <nav className="nav-panel-links" aria-label="Menu">
                {NAV_ITEMS.map((item, index) => (
                  <NavLink
                    key={item.key}
                    href={item.href}
                    active={isActive(item.href)}
                    className="nav-panel-link"
                    style={{ '--i': index } as CSSProperties}
                    onClick={() => setIsOpen(false)}
                  >
                    {labels[item.key]}
                  </NavLink>
                ))}
              </nav>
              <div className="nav-panel-footer">
                <LanguageSwitch language={language} onChange={setLanguage} />
                <a className="nav-cta" href={CONTACT_HREF}>{labels.contact}</a>
              </div>
            </div>
          </div>
        </div>
      </header>
      <div className="nav-scrim" data-open={isOpen} aria-hidden="true" onClick={() => setIsOpen(false)} />
    </>
  );
}
