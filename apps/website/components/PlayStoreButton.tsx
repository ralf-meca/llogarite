'use client';

import { PLAY_URL } from '../lib/appLinks';
import { useLanguage } from '../lib/LanguageContext';

const LABEL = {
  en: 'Get it on Google Play',
  sq: 'Shkarkoje në Google Play',
};

type PlayStoreButtonProps = {
  className?: string;
};

export function PlayStoreButton({ className }: PlayStoreButtonProps) {
  const { language } = useLanguage();

  return (
    <a
      className={className ? `play-cta ${className}` : 'play-cta'}
      href={PLAY_URL}
      target="_blank"
      rel="noreferrer"
    >
      {/* A plain monochrome play mark rather than a copy of Google's coloured
          logo, which may only be reproduced from their own badge asset. */}
      <svg width="13" height="15" viewBox="0 0 13 15" aria-hidden="true" focusable="false">
        <path d="M0.8 0.6 L11.6 7.5 L0.8 14.4 Z" fill="currentColor" />
      </svg>
      {LABEL[language]}
    </a>
  );
}
