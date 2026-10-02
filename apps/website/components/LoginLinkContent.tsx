'use client';

import { useEffect, useState } from 'react';
import { ANDROID_PACKAGE as PACKAGE, PLAY_URL } from '../lib/appLinks';

const CODE_PATTERN = /^\d{6}$/;

type LoginLink = { code: string; email: string };

// The sign-in email's button lands here with the code and the address in the
// URL fragment (#k=123456&e=someone@example.com). A fragment is never sent to
// the server, so the code does not end up in anyone's request logs.
function readLink(): LoginLink | null {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const code = params.get('k') ?? '';
  return CODE_PATTERN.test(code) ? { code, email: params.get('e') ?? '' } : null;
}

// Hands the code to the app. It travels as `kodi`, not `code`: app versions
// that predate this link read any `code=` as a buddy invite.
//
// If the app is not installed Android follows the fallback, which is this same
// page marked as already tried (?f=1), so the reader ends up looking at the
// code and the copy button rather than being bounced to the store.
function intentUrl({ code, email }: LoginLink): string {
  const here = `${window.location.origin}${window.location.pathname}?f=1#k=${code}&e=${encodeURIComponent(email)}`;
  const query = `kodi=${code}&email=${encodeURIComponent(email)}`;
  return `intent://hyr?${query}#Intent;scheme=llogarite;package=${PACKAGE};S.browser_fallback_url=${encodeURIComponent(here)};end`;
}

export function LoginLinkContent() {
  const [link, setLink] = useState<LoginLink | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    const parsed = readLink();
    const android = /android/i.test(window.navigator.userAgent);
    setLink(parsed);
    setIsAndroid(android);
    setIsReady(true);
    // Straight to the app on the first visit; on the fallback visit the reader
    // stays here with the code in front of them.
    const alreadyTried = new URLSearchParams(window.location.search).get('f') === '1';
    if (parsed && android && !alreadyTried) {
      window.location.replace(intentUrl(parsed));
    }
  }, []);

  const copy = () => {
    if (!link) {
      return;
    }
    navigator.clipboard
      .writeText(link.code)
      .then(() => {
        setIsCopied(true);
        window.setTimeout(() => setIsCopied(false), 2500);
      })
      .catch(() => undefined);
  };

  if (!isReady) {
    return <div className="wrapper login-link-page" />;
  }

  if (!link) {
    return (
      <div className="wrapper login-link-page">
        <h1>Lidhja nuk është e vlefshme</h1>
        <p>Hap email-in e fundit nga Llogarite dhe shkruaje kodin në aplikacion.</p>
        <p className="login-link-sub">This link is not valid. Open the latest email from Llogarite and type the code into the app.</p>
      </div>
    );
  }

  return (
    <div className="wrapper login-link-page">
      <h1>Kodi yt i kyçjes</h1>
      <p>Shkruaje në aplikacion, ose kopjoje me një prekje.</p>
      <p className="login-link-sub">Your sign-in code. Type it into the app, or copy it with one tap.</p>

      <div className="login-link-code" aria-label="Kodi">
        {link.code}
      </div>

      <div className="login-link-actions">
        <button type="button" className="login-link-button" onClick={copy}>
          {isCopied ? 'U kopjua ✓' : 'Kopjo kodin'}
        </button>
        {isAndroid && (
          <a className="login-link-button login-link-button-secondary" href={intentUrl(link)}>
            Hap aplikacionin
          </a>
        )}
      </div>

      <p className="login-link-sub">
        Nuk e ke aplikacionin? <a href={PLAY_URL}>Shkarkoje në Google Play</a>.
      </p>
    </div>
  );
}
