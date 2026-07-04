import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { GlassView } from './GlassView';

type PlaceholderScreenProps = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  message: string;
};

export function PlaceholderScreen({ title, icon, message }: PlaceholderScreenProps) {
  return (
    <View style={styles.container}>
      <GlassView style={styles.card}>
        <Ionicons name={icon} size={40} color="#2563eb" />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </GlassView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    padding: 32,
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  message: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});
