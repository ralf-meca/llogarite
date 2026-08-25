import {
  CalendarIcon,
  CrownIcon,
  DotsThreeOutlineIcon,
  FolderIcon,
  HouseIcon,
  ReceiptIcon,
  TrendUpIcon,
  UsersIcon,
  WalletIcon,
  type Icon,
} from 'phosphor-react-native';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation, type TranslationKey } from '../lib/i18n';
import { BOTTOM_NAV_HEIGHT, colors, radius } from '../lib/theme';

export type NavScreen =
  | 'dashboard'
  | 'list'
  | 'budget'
  | 'monthlyPayments'
  | 'projects'
  | 'products'
  | 'buddies';

type NavItem = { key: NavScreen; icon: Icon; labelKey: TranslationKey; premium?: boolean };

// Slots 1-2 sit left of the FAB, slot 4 right of it, slot 5 is the "more" button.
const LEFT_ITEMS: NavItem[] = [
  { key: 'dashboard', icon: HouseIcon, labelKey: 'drawer.dashboard' },
  { key: 'list', icon: ReceiptIcon, labelKey: 'nav.list' },
];

const RIGHT_ITEMS: NavItem[] = [{ key: 'budget', icon: WalletIcon, labelKey: 'drawer.budget' }];

// Everything that doesn't fit the bar lives behind the "more" button.
const MORE_ITEMS: NavItem[] = [
  { key: 'monthlyPayments', icon: CalendarIcon, labelKey: 'drawer.monthlyPayments' },
  { key: 'projects', icon: FolderIcon, labelKey: 'drawer.projects', premium: true },
  { key: 'products', icon: TrendUpIcon, labelKey: 'drawer.products', premium: true },
  { key: 'buddies', icon: UsersIcon, labelKey: 'drawer.buddies', premium: true },
];

type BottomNavBarProps = {
  activeScreen: string;
  isPremium: boolean;
  pendingBuddyRequests: number;
  onNavigate: (target: NavScreen) => void;
};

export function BottomNavBar({
  activeScreen,
  isPremium,
  pendingBuddyRequests,
  onNavigate,
}: BottomNavBarProps) {
  const { t } = useTranslation();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  // The "more" slot stands in for whichever hidden screen is active, and carries
  // the buddy-request badge since buddies lives behind it.
  const isMoreActive = MORE_ITEMS.some((item) => item.key === activeScreen);

  const handleNavigate = (target: NavScreen) => {
    setIsMoreOpen(false);
    onNavigate(target);
  };

  const renderTab = (item: NavItem) => {
    const isActive = activeScreen === item.key;
    return (
      <Pressable
        key={item.key}
        style={styles.tab}
        onPress={() => handleNavigate(item.key)}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
      >
        <View style={isActive ? undefined : styles.inactive}>
          <item.icon size={20} weight={isActive ? 'fill' : 'regular'} color={colors.primary} />
        </View>
        <Text style={[styles.tabLabel, !isActive && styles.inactive]} numberOfLines={1}>
          {t(item.labelKey)}
        </Text>
      </Pressable>
    );
  };

  return (
    <>
      <View style={styles.bar}>
        {LEFT_ITEMS.map(renderTab)}

        {/* Empty slot the floating ScanMenu button sits in. */}
        <View style={styles.tab} pointerEvents="none" />

        {RIGHT_ITEMS.map(renderTab)}

        <Pressable
          style={styles.tab}
          onPress={() => setIsMoreOpen(true)}
          accessibilityRole="button"
          accessibilityState={{ selected: isMoreActive }}
        >
          <View style={isMoreActive ? undefined : styles.inactive}>
            <DotsThreeOutlineIcon
              size={20}
              weight={isMoreActive ? 'fill' : 'regular'}
              color={colors.primary}
            />
          </View>
          <Text style={[styles.tabLabel, !isMoreActive && styles.inactive]} numberOfLines={1}>
            {t('drawer.more')}
          </Text>
          {pendingBuddyRequests > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingBuddyRequests}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <Modal
        visible={isMoreOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsMoreOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setIsMoreOpen(false)}>
          <View style={styles.sheetWrapper} pointerEvents="box-none">
            <View style={styles.sheet}>
              {MORE_ITEMS.map((item) => {
                const isActive = activeScreen === item.key;
                const isLocked = Boolean(item.premium) && !isPremium;
                return (
                  <Pressable
                    key={item.key}
                    style={[styles.row, isActive && styles.rowActive]}
                    onPress={() => handleNavigate(item.key)}
                  >
                    <item.icon size={20} color={colors.primary} />
                    <Text style={styles.rowText} numberOfLines={1}>
                      {t(item.labelKey)}
                    </Text>
                    {item.key === 'buddies' && pendingBuddyRequests > 0 && (
                      <View style={styles.rowBadge}>
                        <Text style={styles.badgeText}>{pendingBuddyRequests}</Text>
                      </View>
                    )}
                    {isLocked && <CrownIcon size={16} color={colors.textMuted} />}
                  </Pressable>
                );
              })}

            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BOTTOM_NAV_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    color: colors.primary,
  },
  inactive: {
    opacity: 0.5,
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: '28%',
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.white,
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
  },
  sheetWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    marginHorizontal: 16,
    marginBottom: BOTTOM_NAV_HEIGHT + 14,
    paddingVertical: 8,
    borderRadius: radius.card,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  rowActive: {
    backgroundColor: colors.primaryTint,
  },
  rowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textDark,
  },
  rowBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
