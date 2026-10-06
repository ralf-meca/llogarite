import { ArrowCircleUpIcon } from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
// The IAU* names are the only ones the package exports at runtime. Its type
// declarations also offer AndroidInstallStatus and AndroidUpdateType, which
// typecheck and then come out undefined - tapping the banner crashed on that.
import SpInAppUpdates, {
  IAUInstallStatus,
  IAUUpdateKind,
  type StatusUpdateEvent,
} from 'sp-react-native-in-app-updates';
import { useTranslation } from '../lib/i18n';
import { colors, radius } from '../lib/theme';
import { GlassButton } from './GlassButton';

const STORE_URL = 'market://details?id=com.rmtech.llogarite';
const STORE_WEB_URL = 'https://play.google.com/store/apps/details?id=com.rmtech.llogarite';

type GateState = 'hidden' | 'available' | 'updating' | 'downloaded' | 'failed';

// Stands in front of the whole app, on every screen, while Play has a newer
// version than the one running: the app is not used until it is updated.
//
// Play knows what version is live, so nothing here has to be told about a
// release - the check asks the store directly and there is no version number
// to keep in step on a server.
//
// The update itself is Play's "immediate" flow: Play takes the screen,
// downloads, installs and restarts the app. Backing out of it lands here again.
//
// The one way past is after an attempt has failed. A phone with no room, no
// connection or a Play that will not serve the update would otherwise be
// locked out of an app that works, with nothing its owner can do about it.
//
// Android only: there is no App Store release to compare against yet.
export function UpdateGate() {
  const { t } = useTranslation();
  const [state, setState] = useState<GateState>('hidden');
  const [isSkipped, setIsSkipped] = useState(false);
  const updatesRef = useRef<SpInAppUpdates | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const updates = new SpInAppUpdates(false);
    updatesRef.current = updates;
    let isMounted = true;

    const onStatus = (status: StatusUpdateEvent) => {
      if (!isMounted) {
        return;
      }
      if (status.status === IAUInstallStatus.DOWNLOADED) {
        setState('downloaded');
      } else if (status.status === IAUInstallStatus.DOWNLOADING) {
        setState('updating');
      }
    };

    updates.addStatusUpdateListener(onStatus);

    updates
      .checkNeedsUpdate()
      .then((result) => {
        if (isMounted && result.shouldUpdate) {
          setState('available');
        }
      })
      // Sideloaded builds, no network, or a device without Play all land here.
      // With nothing known to be newer, nobody is held up.
      .catch(() => undefined);

    return () => {
      isMounted = false;
      updates.removeStatusUpdateListener(onStatus);
    };
  }, []);

  if (state === 'hidden' || isSkipped) {
    return null;
  }

  // Whatever the update flow throws must not take the app down with it; it
  // becomes a failed attempt, which is what opens the way past.
  const handleUpdate = () => {
    try {
      if (state === 'downloaded') {
        updatesRef.current?.installUpdate();
        return;
      }
      setState('updating');
      const started = updatesRef.current?.startUpdate({ updateType: IAUUpdateKind.IMMEDIATE });
      if (!started) {
        setState('failed');
        return;
      }
      started
        // Play hands back control without the app having restarted: the
        // update was put off, so the offer stands.
        .then(() => setState((current) => (current === 'updating' ? 'available' : current)))
        .catch(() => setState('failed'));
    } catch {
      setState('failed');
    }
  };

  const handleOpenStore = () => {
    Linking.openURL(STORE_URL).catch(() => Linking.openURL(STORE_WEB_URL).catch(() => undefined));
  };

  const isUpdating = state === 'updating';
  const hasFailed = state === 'failed';

  return (
    // Back does nothing here: there is nowhere behind this to go back to.
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={() => undefined}>
      <View style={styles.screen}>
        <View style={styles.iconCircle}>
          <ArrowCircleUpIcon size={56} weight="fill" color={colors.primary} />
        </View>

        <Text style={styles.title}>{t('update.requiredTitle')}</Text>
        <Text style={styles.body}>{t(hasFailed ? 'update.failed' : 'update.requiredBody')}</Text>

        {isUpdating ? (
          <View style={styles.progress}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.progressText}>{t('update.downloading')}</Text>
          </View>
        ) : (
          <GlassButton
            label={t(state === 'downloaded' ? 'update.restart' : hasFailed ? 'update.openStore' : 'update.action')}
            variant="accent"
            style={styles.button}
            onPress={hasFailed ? handleOpenStore : handleUpdate}
          />
        )}

        {hasFailed && (
          <>
            <Pressable onPress={handleUpdate} hitSlop={8} style={styles.link}>
              <Text style={styles.linkText}>{t('update.tryAgain')}</Text>
            </Pressable>
            <Pressable onPress={() => setIsSkipped(true)} hitSlop={8} style={styles.link}>
              <Text style={styles.skipText}>{t('update.continueAnyway')}</Text>
            </Pressable>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: colors.background,
  },
  iconCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    backgroundColor: colors.primaryTint,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.textDark,
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: colors.textMuted,
    marginBottom: 32,
  },
  button: {
    alignSelf: 'stretch',
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: radius.card,
    backgroundColor: colors.white,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
  },
  link: {
    marginTop: 20,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  skipText: {
    fontSize: 13,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
});
