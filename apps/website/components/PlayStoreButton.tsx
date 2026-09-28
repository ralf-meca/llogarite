'use client';

import { PLAY_URL } from '../lib/appLinks';
import { useLanguage } from '../lib/LanguageContext';

// Google's own badge artwork, served from our own public folder rather than
// hotlinked, so the site does not depend on their URL staying put. The image
// carries its own padding, which is why the link has none.
const BADGE_SRC = '/google-play-badge.png';

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
      <img src={BADGE_SRC} alt={LABEL[language]} />
    </a>
  );
}
