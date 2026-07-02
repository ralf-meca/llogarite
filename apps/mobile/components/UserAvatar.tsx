import { Image, StyleSheet, Text } from 'react-native';
import type { AuthUser } from '../lib/authApi';
import { GlassView } from './GlassView';

type UserAvatarProps = {
  user: AuthUser | null;
  size: number;
};

export function UserAvatar({ user, size }: UserAvatarProps) {
  const dimensionStyle = { width: size, height: size, borderRadius: size / 2 };

  if (user?.avatarUrl) {
    return <Image source={{ uri: user.avatarUrl }} style={[styles.image, dimensionStyle]} />;
  }

  const initial = (user?.name ?? user?.email ?? '?').trim().charAt(0).toUpperCase();
  return (
    <GlassView style={[dimensionStyle, styles.fallback]}>
      <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{initial}</Text>
    </GlassView>
  );
}

const styles = StyleSheet.create({
  image: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#2563eb',
  },
  initial: {
    fontWeight: '700',
    color: '#1f2937',
  },
});
