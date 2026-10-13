import { useEffect, useState } from 'react';
import App from './App';
import { onNightModeChange, restoreNightMode } from './lib/nightMode';

// Sits above the app for night mode. Switching it changes which styles the sheets
// hand out, and nothing on screen asks for its styles again until it is drawn again -
// so this draws the whole app again, from the top, when the mode changes. Nothing is
// unmounted: every screen, form and open drawer stays as it was, in the new colours.
export default function Root() {
  const [isReady, setIsReady] = useState(false);
  const [, setDrawCount] = useState(0);

  useEffect(() => {
    restoreNightMode().finally(() => setIsReady(true));
    return onNightModeChange(() => setDrawCount((current) => current + 1));
  }, []);

  // Nothing is drawn until the saved choice is known, or a night-mode reader would
  // get a flash of the day colours at every launch.
  if (!isReady) {
    return null;
  }
  return <App />;
}
