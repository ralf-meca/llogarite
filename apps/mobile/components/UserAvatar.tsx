import { Image, StyleSheet, Text } from 'react-native';
import { colors } from '../lib/theme';
import { GlassView } from './GlassView';

type AvatarPerson = {
  name: string | null;
  email: string;
  avatarUrl: string | null;
};

type UserAvatarProps = {
  user: AvatarPerson | null;
  size: number;
};

function getInitials(name: string | null | undefined, email: string | undefined): string {
  const source = name?.trim();
  if (source) {
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length > 1) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return parts[0].charAt(0).toUpperCase();
  }
  return (email?.trim().charAt(0) ?? '?').toUpperCase();
}

export function UserAvatar({ user, size }: UserAvatarProps) {
  const dimensionStyle = { width: size, height: size, borderRadius: size / 2 };

  if (user?.avatarUrl) {
    return <Image source={{ uri: user.avatarUrl }} style={[styles.image, dimensionStyle]} />;
  }

  const initials = getInitials(user?.name, user?.email);
  return (
    <GlassView style={[dimensionStyle, styles.fallback]}>
      <Text style={[styles.initial, { fontSize: size * 0.36 }]}>{initials}</Text>
    </GlassView>
  );
}

const styles = StyleSheet.create({
  image: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    backgroundColor: colors.primaryTint,
  },
  initial: {
    fontWeight: '700',
    color: colors.primary,
  },
});
