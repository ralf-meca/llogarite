'use client';

import { useEffect } from 'react';

const PACKAGE = 'com.rmtech.llogarite';
const PLAY_URL = `https://play.google.com/store/apps/details?id=${PACKAGE}`;
const CODE_PATTERN = /^\d{6}$/;

// Nothing to read here. Anyone with the app is routed straight to it by the
// App Link and never loads this page at all; anyone who lands here does not
// have the app, so the page exists only to get out of the way.
//
// The intent:// hop is kept as a second chance for a device that has the app
// but has not verified the App Link yet (a sideloaded build, or verification
// that has not run). Android hands it to the app when it can and follows
// browser_fallback_url to the Play Store when it cannot, so either way this
// page is the last thing the reader sees of the web.
function intentUrl(code: string): string {
  const fallback = encodeURIComponent(PLAY_URL);
  return `intent://shoku?code=${code}#Intent;scheme=llogarite;package=${PACKAGE};S.browser_fallback_url=${fallback};end`;
}

export function BuddyInviteContent() {
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code') ?? '';
    const isAndroid = /android/i.test(window.navigator.userAgent);
    window.location.replace(isAndroid && CODE_PATTERN.test(code) ? intentUrl(code) : PLAY_URL);
  }, []);

  // Only ever seen if the redirect is blocked, e.g. with scripting off.
  return (
    <div className="wrapper legal-page">
      <noscript>
        <meta httpEquiv="refresh" content={`0; url=${PLAY_URL}`} />
      </noscript>
      <p>
        <a href={PLAY_URL}>Llogarite</a>
      </p>
    </div>
  );
}
