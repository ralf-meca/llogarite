import {
  CalendarIcon,
  SealCheckIcon,
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
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation, type TranslationKey } from '../lib/i18n';
import { BOTTOM_NAV_HEIGHT, colors, radius } from '../lib/theme';
import { POPOVER_TAIL_HEIGHT, POPOVER_TAIL_WIDTH, PopoverTail } from './PopoverTail';

export type NavScreen =
  | 'dashboard'
  | 'list'
  | 'budget'
  | 'monthlyPayments'
  | 'projects'
  | 'products'
  | 'buddies'
  | 'review';

type NavItem = { key: NavScreen; icon: Icon; labelKey: TranslationKey; premium?: boolean; admin?: boolean };

// Slots 1-2 sit left of the FAB, slot 4 right of it, slot 5 is the "more" button.
const LEFT_ITEMS: NavItem[] = [
  { key: 'dashboard', icon: HouseIcon, labelKey: 'drawer.dashboard' },
  { key: 'list', icon: ReceiptIcon, labelKey: 'nav.list' },
];

// The full name is too long for a fifth of the bar, so the tab uses a short one.
const RIGHT_ITEMS: NavItem[] = [{ key: 'projects', icon: FolderIcon, labelKey: 'nav.projects', premium: true }];

// Everything that doesn't fit the bar lives behind the "more" button.
const MORE_ITEMS: NavItem[] = [
  { key: 'monthlyPayments', icon: CalendarIcon, labelKey: 'drawer.monthlyPayments' },
  { key: 'budget', icon: WalletIcon, labelKey: 'drawer.budget' },
  { key: 'products', icon: TrendUpIcon, labelKey: 'drawer.products', premium: true },
  { key: 'buddies', icon: UsersIcon, labelKey: 'drawer.buddies', premium: true },
  { key: 'review', icon: SealCheckIcon, labelKey: 'drawer.review', admin: true },
];

type BottomNavBarProps = {
  activeScreen: string;
  isPremium: boolean;
  isAdmin: boolean;
  pendingBuddyRequests: number;
  onNavigate: (target: NavScreen) => void;
};

export function BottomNavBar({
  activeScreen,
  isPremium,
  isAdmin,
  pendingBuddyRequests,
  onNavigate,
}: BottomNavBarProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  // The bar is five equal slots and "more" is the last, so its centre sits a
  // tenth of the screen in from the right. The tail is placed against that
  // rather than centred on the sheet, which spans nearly the full width.
  const tailRight = width / 10 - POPOVER_TAIL_WIDTH / 2;
  // Clears the bar: the sheet rises by the tail's height so the tail hangs in
  // the gap instead of reaching down over the buttons.
  const sheetGap = BOTTOM_NAV_HEIGHT + insets.bottom + 14;

  // The "more" slot stands in for whichever hidden screen is active, and carries
  // the buddy-request badge since buddies lives behind it.
  // Reviewing is not a locked feature anyone can buy into, so unlike the
  // premium rows it is absent rather than shown with a crown.
  const moreItems = MORE_ITEMS.filter((item) => !item.admin || isAdmin);
  const isMoreActive = moreItems.some((item) => item.key === activeScreen);

  const handleNavigate = (target: NavScreen) => {
    setIsMoreOpen(false);
    onNavigate(target);
  };

  const renderTab = (item: NavItem) => {
    const isActive = activeScreen === item.key;
    const isLocked = Boolean(item.premium) && !isPremium;
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
        {isLocked && (
          <View style={styles.tabCrown}>
            <CrownIcon size={11} weight="fill" color={colors.textMuted} />
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <>
      <View style={[styles.bar, { height: BOTTOM_NAV_HEIGHT + insets.bottom, paddingBottom: insets.bottom }]}>
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
            <View style={[styles.sheet, { marginBottom: sheetGap + POPOVER_TAIL_HEIGHT }]}>
              {moreItems.map((item) => {
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
            {/* Absolute rather than in flow: the sheet is a sibling with its own
                margin, and the tail has to sit against the right edge of the
                screen, not the sheet's. The extra pixel overlaps the seam. */}
            <PopoverTail style={{ position: 'absolute', right: tailRight, bottom: sheetGap + 1 }} />
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
  // Same corner the "more" badge uses, so a locked tab reads like a locked row.
  tabCrown: {
    position: 'absolute',
    top: 8,
    right: '28%',
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
    paddingVertical: 8,
    borderRadius: radius.card,
    // The tail meets this edge about ten in from the right, which the full
    // corner radius is already curving away through - so the tail read as
    // hanging off a slope. Tightened just here so it joins a flat edge.
    borderBottomRightRadius: 6,
    backgroundColor: colors.white,
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
