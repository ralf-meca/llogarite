import { BellIcon } from 'phosphor-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { toDateLabel } from '../lib/date';
import { useTranslation } from '../lib/i18n';
import { fetchNotifications, markAllNotificationsRead, type AppNotification } from '../lib/notificationsApi';
import { colors } from '../lib/theme';

type NotificationBellProps = {
  unreadCount: number;
  onOpened: () => void;
  onSelectBuddyId: (buddyId: string) => void;
  onNavigateToBuddies: () => void;
  onNavigateToMonthlyPayments: () => void;
};

export function NotificationBell({
  unreadCount,
  onOpened,
  onSelectBuddyId,
  onNavigateToBuddies,
  onNavigateToMonthlyPayments,
}: NotificationBellProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const open = () => {
    setIsOpen(true);
    setIsLoading(true);
    fetchNotifications()
      .then((list) => {
        setNotifications(list);
        onOpened();
        return markAllNotificationsRead();
      })
      .catch(() => setNotifications([]))
      .finally(() => setIsLoading(false));
  };

  const handleSelect = (notification: AppNotification) => {
    setIsOpen(false);
    const data = notification.data ?? {};
    if (notification.type === 'invoice_buddy_added' && typeof data.buddyId === 'string') {
      onSelectBuddyId(data.buddyId);
    } else if (notification.type === 'buddy_request' || notification.type === 'invoice_notify_paid') {
      onNavigateToBuddies();
    } else if (notification.type === 'monthly_payment_reminder') {
      onNavigateToMonthlyPayments();
    }
  };

  return (
    <>
      <Pressable style={styles.button} hitSlop={12} onPress={open}>
        <BellIcon size={22} weight="fill" color={colors.white} />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        )}
      </Pressable>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <Pressable style={styles.panelWrapper} onPress={(event) => event.stopPropagation()}>
            <View style={styles.tail} />
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>{t('notifications.title')}</Text>
              <ScrollView style={styles.list} bounces={false}>
                {notifications.length === 0 && !isLoading ? (
                  <Text style={styles.emptyText}>{t('notifications.empty')}</Text>
                ) : (
                  notifications.map((notification) => (
                    <Pressable
                      key={notification.id}
                      style={[styles.row, !notification.read && styles.rowUnread]}
                      onPress={() => handleSelect(notification)}
                    >
                      {!notification.read && <View style={styles.rowDot} />}
                      <View style={styles.rowText}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {notification.title}
                        </Text>
                        <Text style={styles.rowBody} numberOfLines={2}>
                          {notification.body}
                        </Text>
                        <Text style={styles.rowDate}>{toDateLabel(new Date(notification.createdAt))}</Text>
                      </View>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    zIndex: 1,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.white,
    includeFontPadding: false,
  },
  backdrop: {
    flex: 1,
    alignItems: 'flex-end',
    paddingTop: 86,
    paddingRight: 16,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  panelWrapper: {
    width: '85%',
    maxWidth: 340,
  },
  tail: {
    position: 'absolute',
    top: -8,
    right: 16,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#ffffff',
  },
  panel: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    maxHeight: 420,
    boxShadow: '0px 8px 24px rgba(0,0,0,0.2)',
  },
  panelTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  list: {
    maxHeight: 380,
  },
  emptyText: {
    fontSize: 13,
    color: '#6b7280',
    paddingVertical: 20,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  rowUnread: {
    backgroundColor: colors.primaryTint,
    borderRadius: 8,
  },
  rowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
    marginTop: 6,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f2937',
  },
  rowBody: {
    fontSize: 12,
    color: '#4b5563',
    marginTop: 2,
  },
  rowDate: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
  },
});
