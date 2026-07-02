import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ToastItem } from '../hooks/useToasts';
import { GlassView } from './GlassView';

type ToastHostProps = {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
};

export function ToastHost({ toasts, onDismiss }: ToastHostProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      {toasts.map((toast) => (
        <Pressable key={toast.id} onPress={() => onDismiss(toast.id)}>
          <GlassView style={styles.toast}>
            <Ionicons name="alert-circle" size={20} color="#dc2626" />
            <Text style={styles.message}>{toast.message}</Text>
          </GlassView>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    bottom: 32,
    gap: 8,
    maxWidth: '80%',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderColor: 'rgba(220,38,38,0.4)',
  },
  message: {
    flex: 1,
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '600',
  },
});
