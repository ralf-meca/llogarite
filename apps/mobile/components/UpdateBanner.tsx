import { ArrowClockwiseIcon, XIcon } from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import SpInAppUpdates, {
  AndroidInstallStatus,
  AndroidUpdateType,
  type StatusUpdateEvent,
} from 'sp-react-native-in-app-updates';
import { useTranslation } from '../lib/i18n';
import { colors } from '../lib/theme';

type BannerState = 'hidden' | 'available' | 'downloading' | 'downloaded';

// Play knows what version is live, so nothing here has to be told about a
// release - the check asks the store directly and there is no version number
// to keep in step on a server.
//
// The flexible flow on purpose: the download happens in the background and the
// app stays usable throughout, where an immediate update takes the screen and
// refuses to give it back. Nobody is blocked from recording an expense because
// there is a newer build.
export function UpdateBanner() {
  const { t } = useTranslation();
  const [state, setState] = useState<BannerState>('hidden');
  const [isDismissed, setIsDismissed] = useState(false);
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
      if (status.status === AndroidInstallStatus.DOWNLOADED) {
        setState('downloaded');
      } else if (status.status === AndroidInstallStatus.DOWNLOADING) {
        setState('downloading');
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
      // None of them is worth telling anyone about: the app works either way.
      .catch(() => undefined);

    return () => {
      isMounted = false;
      updates.removeStatusUpdateListener(onStatus);
    };
  }, []);

  if (state === 'hidden' || isDismissed) {
    return null;
  }

  const isDownloaded = state === 'downloaded';
  const isDownloading = state === 'downloading';

  const handlePress = () => {
    if (isDownloaded) {
      updatesRef.current?.installUpdate();
      return;
    }
    updatesRef.current
      ?.startUpdate({ updateType: AndroidUpdateType.FLEXIBLE })
      .catch(() => setState('hidden'));
  };

  return (
    <View style={styles.banner}>
      <ArrowClockwiseIcon size={17} color={colors.primary} weight="bold" />

      <Text style={styles.message} numberOfLines={2}>
        {t(
          isDownloaded
            ? 'update.readyToInstall'
            : isDownloading
              ? 'update.downloading'
              : 'update.available',
        )}
      </Text>

      {!isDownloading && (
        <Pressable style={styles.action} onPress={handlePress} hitSlop={6}>
          <Text style={styles.actionText}>
            {t(isDownloaded ? 'update.restart' : 'update.action')}
          </Text>
        </Pressable>
      )}

      {/* Dismissed for this run only. A newer version is still newer next time
          the app opens, and quietly forgetting that helps nobody. */}
      <Pressable onPress={() => setIsDismissed(true)} hitSlop={10} accessibilityLabel={t('common.close')}>
        <XIcon size={15} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.primaryTint,
  },
  message: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textDark,
  },
  action: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
});
