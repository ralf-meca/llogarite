import { CheckIcon, WarningIcon, XIcon } from 'phosphor-react-native';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ToastItem } from '../hooks/useToasts';
import { colors, radius } from '../lib/theme';

type ToastHostProps = {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  bottomOffset?: number;
};

// A message reads as a headline and, when it runs to more than one sentence,
// the rest beneath it. The messages are written as plain sentences, so the
// first full stop that is followed by more text is where they part - which
// leaves a figure like "1.5" alone, there being no space after its point.
function splitMessage(message: string): { title: string; detail: string | null } {
  const match = message.trim().match(/^(.+?)[.!?]\s+(\S[\s\S]*)$/);
  return match ? { title: match[1], detail: match[2] } : { title: message.trim(), detail: null };
}

export function ToastHost({ toasts, onDismiss, bottomOffset = 32 }: ToastHostProps) {
  const insets = useSafeAreaInsets();
  if (toasts.length === 0) {
    return null;
  }
  // The offsets passed in were measured on Android, where the system bar is
  // already accounted for; an iPhone's home indicator sits below them.
  const bottom = bottomOffset + (Platform.OS === 'ios' ? insets.bottom : 0);

  return (
    <View style={[styles.container, { bottom }]} pointerEvents="box-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const { title, detail } = splitMessage(toast.message);
        return (
          <View key={toast.id} style={styles.toast}>
            <View style={[styles.iconCircle, isSuccess ? styles.iconCircleSuccess : styles.iconCircleError]}>
              {isSuccess ? (
                <CheckIcon size={18} weight="bold" color={colors.primary} />
              ) : (
                <WarningIcon size={18} weight="fill" color={colors.danger} />
              )}
            </View>
            <View style={styles.text}>
              <Text style={styles.title}>{title}</Text>
              {detail !== null && <Text style={styles.detail}>{detail}</Text>}
            </View>
            {/* Only the button closes it, so a stray touch on the card - or on
                what the card happens to cover - does not make it vanish unread. */}
            <Pressable
              style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
              onPress={() => onDismiss(toast.id)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Mbyll"
            >
              <XIcon size={18} weight="bold" color={colors.textDark} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 32,
    gap: 8,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    // Lifted off whatever it lies over, so it reads as sitting on top of the
    // screen rather than as one more card in it.
    shadowColor: colors.textDark,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleError: {
    backgroundColor: colors.dangerTint,
  },
  iconCircleSuccess: {
    backgroundColor: colors.primaryTint,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.textDark,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  detail: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral,
  },
  closeButtonPressed: {
    backgroundColor: colors.border,
  },
});
