import { CheckCircleIcon, WarningCircleIcon } from 'phosphor-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ToastItem } from '../hooks/useToasts';
import { GlassView } from './GlassView';

type ToastHostProps = {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  bottomOffset?: number;
};

export function ToastHost({ toasts, onDismiss, bottomOffset = 32 }: ToastHostProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, { bottom: bottomOffset }]} pointerEvents="box-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        return (
          <Pressable key={toast.id} style={styles.toastWrapper} onPress={() => onDismiss(toast.id)}>
            <GlassView style={[styles.toast, isSuccess ? styles.toastSuccess : styles.toastError]}>
              {isSuccess ? (
                <CheckCircleIcon size={20} weight="fill" color="#059669" />
              ) : (
                <WarningCircleIcon size={20} weight="fill" color="#dc2626" />
              )}
              <Text style={styles.message}>{toast.message}</Text>
            </GlassView>
          </Pressable>
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
    alignItems: 'flex-start',
  },
  toastWrapper: {
    maxWidth: '100%',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  toastError: {
    borderColor: 'rgba(220,38,38,0.4)',
  },
  toastSuccess: {
    borderColor: 'rgba(5,150,105,0.4)',
  },
  message: {
    flexShrink: 1,
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '600',
  },
});
