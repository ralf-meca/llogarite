import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { AuthUser } from '../lib/authApi';
import { useTranslation, type TranslationKey } from '../lib/i18n';
import { colors } from '../lib/theme';
import { LanguageSwitch } from './LanguageSwitch';
import { UserAvatar } from './UserAvatar';

export type DrawerScreen =
  | 'dashboard'
  | 'list'
  | 'budget'
  | 'monthlyPayments'
  | 'projects'
  | 'products'
  | 'buddies';

const PANEL_WIDTH = Math.min(300, Dimensions.get('window').width * 0.78);

const NAV_ITEMS: {
  key: DrawerScreen;
  icon: keyof typeof Ionicons.glyphMap;
  labelKey: TranslationKey;
  premium?: boolean;
}[] = [
  { key: 'dashboard', icon: 'home-outline', labelKey: 'drawer.dashboard' },
  { key: 'list', icon: 'receipt-outline', labelKey: 'drawer.list' },
  { key: 'budget', icon: 'wallet-outline', labelKey: 'drawer.budget' },
  { key: 'monthlyPayments', icon: 'calendar-outline', labelKey: 'drawer.monthlyPayments' },
  { key: 'projects', icon: 'folder-outline', labelKey: 'drawer.projects', premium: true },
  { key: 'products', icon: 'trending-up-outline', labelKey: 'drawer.products', premium: true },
  { key: 'buddies', icon: 'people-outline', labelKey: 'drawer.buddies', premium: true },
];

type SideDrawerProps = {
  visible: boolean;
  activeScreen: string;
  user: AuthUser | null;
  isPremium: boolean;
  pendingBuddyRequests?: number;
  onClose: () => void;
  onNavigate: (screen: DrawerScreen) => void;
  onOpenAccount: () => void;
};

export function SideDrawer({
  visible,
  activeScreen,
  user,
  isPremium,
  pendingBuddyRequests = 0,
  onClose,
  onNavigate,
  onOpenAccount,
}: SideDrawerProps) {
  const { t } = useTranslation();
  const [isRendered, setIsRendered] = useState(visible);
  const translateX = useRef(new Animated.Value(-PANEL_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // Mount the Modal first; the entrance animation only starts once the
  // Animated.View it drives actually exists in the native tree (see below).
  useEffect(() => {
    if (visible) {
      setIsRendered(true);
    }
  }, [visible]);

  useEffect(() => {
    if (!isRendered) {
      return;
    }
    if (visible) {
      Animated.parallel([
        Animated.timing(translateX, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, { toValue: -PANEL_WIDTH, duration: 200, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => setIsRendered(false));
    }
  }, [visible, isRendered]);

  if (!isRendered) {
    return null;
  }

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.container}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View style={[styles.panel, { width: PANEL_WIDTH, transform: [{ translateX }] }]}>
          <Text style={styles.brand}>Llogarite</Text>

          <ScrollView style={styles.navList} contentContainerStyle={styles.navListContent}>
            {NAV_ITEMS.map((item) => {
              const isActive = activeScreen === item.key;
              const isLocked = Boolean(item.premium) && !isPremium;
              return (
                <Pressable
                  key={item.key}
                  style={[styles.navItem, isActive && styles.navItemActive]}
                  onPress={() => onNavigate(item.key)}
                >
                  <View>
                    <Ionicons
                      name={item.icon}
                      size={20}
                      color={isLocked ? colors.textMuted : isActive ? colors.primary : '#4b5563'}
                    />
                    {item.key === 'buddies' && pendingBuddyRequests > 0 && <View style={styles.navBadgeDot} />}
                  </View>
                  <Text
                    style={[
                      styles.navItemText,
                      isActive && styles.navItemTextActive,
                      isLocked && styles.navItemTextLocked,
                    ]}
                  >
                    {t(item.labelKey)}
                  </Text>
                  {isLocked && <MaterialCommunityIcons name="crown-outline" size={16} color={colors.primary} />}
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.languageSwitchWrapper}>
            <LanguageSwitch />
          </View>

          <Pressable style={styles.accountRow} onPress={onOpenAccount}>
            <UserAvatar user={user} size={40} />
            <View style={styles.accountText}>
              <Text style={styles.accountName} numberOfLines={1}>
                {user?.name ?? user?.email ?? ''}
              </Text>
              {user?.name && (
                <Text style={styles.accountEmail} numberOfLines={1}>
                  {user.email}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  panel: {
    height: '100%',
    backgroundColor: '#ffffff',
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 24,
    boxShadow: '4px 0px 16px rgba(0,0,0,0.25)',
  },
  brand: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  navList: {
    flex: 1,
  },
  navListContent: {
    gap: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  navItemActive: {
    backgroundColor: colors.primaryTint,
  },
  navItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4b5563',
  },
  navItemTextActive: {
    color: colors.primary,
  },
  navItemTextLocked: {
    color: colors.textMuted,
  },
  navBadgeDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#dc2626',
  },
  languageSwitchWrapper: {
    alignItems: 'center',
    paddingBottom: 16,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 16,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  accountText: {
    flex: 1,
  },
  accountName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  accountEmail: {
    fontSize: 12,
    color: '#6b7280',
  },
});
