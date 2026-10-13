import * as SecureStore from 'expo-secure-store';
import { StyleSheet } from 'react-native';
import { colors } from './theme';

// Night mode for the whole app, without every screen having to know about it.
//
// The app's colours live in two places: the `colors` tokens in theme.ts, and the
// style sheets each component builds once, when its file is first loaded - many with
// colours written straight into them. Rather than rewrite every component to build
// its styles on the fly, this module sees every style sheet as it is made (it wraps
// StyleSheet.create, which is why it has to be the first thing index.ts imports) and
// gives each style that has a colour with a night counterpart a second, night
// version. The sheet then answers with the day or the night one, whichever is on.
// The tokens are switched alongside.
//
// Root.tsx draws the app again after a switch; every screen stays where it was and
// simply picks up the other set of styles.

type Style = Record<string, unknown>;
type ColourKind = 'text' | 'surface' | 'border';

const PROPERTY_KIND: Record<string, ColourKind> = {
  color: 'text',
  backgroundColor: 'surface',
  borderColor: 'border',
  borderTopColor: 'border',
  borderBottomColor: 'border',
  borderLeftColor: 'border',
  borderRightColor: 'border',
};

// Day colour to night colour, by what the colour is used for: white behind a card
// turns dark, white lettering on a blue button stays white.
const NIGHT: Record<ColourKind, Record<string, string>> = {
  text: {
    '#1d1f20': '#E8EAED',
    '#1f2937': '#E8EAED',
    '#111827': '#E8EAED',
    '#374151': '#CBD2DA',
    '#4b5563': '#CBD2DA',
    '#6f7375': '#9AA1AB',
    '#6b7280': '#9AA1AB',
    '#5980a6': '#8FB4DA',
  },
  surface: {
    // The blue of the header and of filled buttons, taken down to sit with the dark.
    '#5980a6': '#2A4058',
    '#ffffff': '#1B1F24',
    '#eef6ff': '#22303F',
    '#f5f5f5': '#252A31',
    '#f3f4f6': '#252A31',
    '#f2f2f3': '#121417',
    '#e5e7eb': '#333A44',
    '#fee2e2': '#4A1F1F',
    '#c9d8e5': '#3A4A5C',
    'rgba(0,0,0,0.04)': 'rgba(255,255,255,0.08)',
    'rgba(0,0,0,0.06)': 'rgba(255,255,255,0.08)',
    'rgba(0,0,0,0.08)': 'rgba(255,255,255,0.10)',
    'rgba(107,114,128,0.12)': 'rgba(255,255,255,0.10)',
  },
  border: {
    '#e7e7ea': '#2F353D',
    '#f3f4f6': '#2F353D',
    '#e5e7eb': '#2F353D',
    '#d1d5db': '#3A414B',
    '#ffffff': '#1B1F24',
  },
};

// The tokens, for the colours components pass straight to an icon or a spinner.
const DAY_TOKENS: Record<string, string> = { ...colors };
const NIGHT_TOKENS: Record<string, string> = {
  primary: '#8FB4DA',
  primaryTint: '#22303F',
  primarySubtle: '#3A4A5C',
  surface: '#1B1F24',
  surfaceRaised: '#2B323B',
  textDark: '#E8EAED',
  textMuted: '#9AA1AB',
  border: '#2F353D',
  background: '#121417',
  neutral: '#252A31',
  dangerTint: '#4A1F1F',
};

function normalise(colour: string): string {
  const value = colour.trim().toLowerCase().replace(/\s+/g, '');
  // #abc is #aabbcc.
  return /^#[0-9a-f]{3}$/.test(value) ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}` : value;
}

let isNight = false;

// White things that float over the page - menus, dialogs, the drawer, a toast - and
// the chosen half of a toggle. By day they are the same white as the page and stand
// out by their shadow; in the dark a shadow shows nothing, so they are a shade
// lighter than the page instead. Told by the name of the style.
const RAISED = /^(modalCard|card|menu|panel|payerCard|formCard|bubble|bubbleTail|toast|drawer|popover|processingCard|moreSheet)$|(Active|Selected)$/;
const RAISED_SURFACE = '#2B323B';
// White that is white for a reason, on any background: a brand's button, the camera's shutter.
const STAYS_WHITE = /^(dotActive|signInButton|googleButton|captureButton)$/;

function register(sheet: Record<string, unknown>): void {
  for (const [name, style] of Object.entries(sheet)) {
    if (!style || typeof style !== 'object') {
      continue;
    }
    let night: Style | null = null;
    for (const [property, kind] of Object.entries(PROPERTY_KIND)) {
      const day = (style as Style)[property];
      if (typeof day !== 'string') {
        continue;
      }
      const isWhiteSurface = kind === 'surface' && normalise(day) === '#ffffff';
      if (isWhiteSurface && STAYS_WHITE.test(name)) {
        continue;
      }
      const nightColour = isWhiteSurface && RAISED.test(name) ? RAISED_SURFACE : NIGHT[kind][normalise(day)];
      if (nightColour) {
        night = night ?? { ...(style as Style) };
        night[property] = nightColour;
      }
    }
    if (night === null) {
      continue;
    }
    // Two styles, and the sheet hands out whichever is on. They have to be two
    // objects rather than one that changes: a view on screen only takes a style in
    // again when it is given a different one.
    const dayStyle = Object.freeze(style);
    const nightStyle = Object.freeze(night);
    Object.defineProperty(sheet, name, { enumerable: true, get: () => (isNight ? nightStyle : dayStyle) });
  }
}

// React Native's own create returns the object it is given, so this does too.
const sheets = StyleSheet as unknown as { create: (sheet: Record<string, unknown>) => unknown };
sheets.create = (sheet) => {
  register(sheet);
  return sheet;
};

function apply(night: boolean): void {
  isNight = night;
  const tokens = colors as unknown as Record<string, string>;
  for (const name of Object.keys(DAY_TOKENS)) {
    tokens[name] = night ? (NIGHT_TOKENS[name] ?? DAY_TOKENS[name]) : DAY_TOKENS[name];
  }
}

const STORAGE_KEY = 'night_mode';
const listeners = new Set<() => void>();

export function isNightMode(): boolean {
  return isNight;
}

// What was chosen last time, applied before the app first draws.
export async function restoreNightMode(): Promise<void> {
  try {
    apply((await SecureStore.getItemAsync(STORAGE_KEY)) === '1');
  } catch {
    apply(false);
  }
}

export function setNightMode(night: boolean): void {
  if (night === isNight) {
    return;
  }
  apply(night);
  SecureStore.setItemAsync(STORAGE_KEY, night ? '1' : '0').catch(() => undefined);
  listeners.forEach((listener) => listener());
}

export function onNightModeChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
