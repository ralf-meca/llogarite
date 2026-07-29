import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Buddy } from '../lib/buddiesApi';
import { formatAmount } from '../lib/formatAmount';
import { useTranslation } from '../lib/i18n';
import { colors } from '../lib/theme';
import { UserAvatar } from './UserAvatar';

type ItemAssignPickerProps = {
  buddies: Buddy[];
  rowQuantity: number;
  unitPrice: number;
  buddyQuantities: Record<string, number>;
  excludedBuddyIds: string[];
  onQuantityChange: (buddyId: string, quantity: number) => void;
  onToggleExcluded: (buddyId: string) => void;
};

export function ItemAssignPicker({
  buddies,
  rowQuantity,
  unitPrice,
  buddyQuantities,
  excludedBuddyIds,
  onQuantityChange,
  onToggleExcluded,
}: ItemAssignPickerProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const isCustomized =
    Object.values(buddyQuantities).some((qty) => qty > 0) || excludedBuddyIds.length > 0;
  const assignedQuantity = Object.values(buddyQuantities).reduce((sum, qty) => sum + qty, 0);
  const remainingQuantity = Math.max(0, rowQuantity - assignedQuantity);

  return (
    <>
      <Pressable onPress={() => setIsOpen(true)}>
        <View style={[styles.circle, isCustomized && styles.circleCustomized]}>
          <Ionicons name="people" size={14} color={isCustomized ? '#ffffff' : colors.primary} />
        </View>
      </Pressable>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <Pressable style={styles.menuWrapper} onPress={(event) => event.stopPropagation()}>
            <View style={styles.menu}>
              <Text style={styles.menuTitle}>{t('itemAssignPicker.title')}</Text>
              <View style={styles.quantityRow}>
                <Text style={styles.quantityLabel}>{t('itemAssignPicker.quantity')}</Text>
                <Text style={styles.quantityValue}>{rowQuantity}</Text>
              </View>
              <ScrollView bounces={false}>
                {buddies.map((buddy) => {
                  const quantity = buddyQuantities[buddy.id] ?? 0;
                  const otherAssigned = assignedQuantity - quantity;
                  const maxQuantity = Math.max(0, rowQuantity - otherAssigned);
                  const isExcluded = excludedBuddyIds.includes(buddy.id);
                  return (
                    <View key={buddy.id} style={styles.buddyRow}>
                      <UserAvatar user={buddy} size={22} />
                      <Text style={styles.buddyName} numberOfLines={1}>
                        {buddy.name ?? buddy.email}
                      </Text>
                      <View style={styles.stepper}>
                        <Pressable
                          onPress={() => onQuantityChange(buddy.id, Math.max(0, quantity - 1))}
                          disabled={quantity <= 0}
                          hitSlop={6}
                        >
                          <Ionicons
                            name="remove-circle-outline"
                            size={20}
                            color={quantity <= 0 ? '#d1d5db' : colors.primary}
                          />
                        </Pressable>
                        <Text style={styles.stepperValue}>{quantity}</Text>
                        <Pressable
                          onPress={() => onQuantityChange(buddy.id, Math.min(maxQuantity, quantity + 1))}
                          disabled={quantity >= maxQuantity}
                          hitSlop={6}
                        >
                          <Ionicons
                            name="add-circle-outline"
                            size={20}
                            color={quantity >= maxQuantity ? '#d1d5db' : colors.primary}
                          />
                        </Pressable>
                      </View>
                      <Pressable onPress={() => onToggleExcluded(buddy.id)} hitSlop={6}>
                        <Ionicons
                          name={isExcluded ? 'square-outline' : 'checkbox'}
                          size={20}
                          color={isExcluded ? '#9ca3af' : '#10b981'}
                        />
                      </Pressable>
                    </View>
                  );
                })}
                <View style={styles.restRow}>
                  <View style={styles.restIcon}>
                    <Ionicons name="people" size={16} color={colors.primary} />
                  </View>
                  <Text style={styles.restLabel}>{t('itemAssignPicker.restOfGroup')}</Text>
                  <Text style={styles.restAmount}>{formatAmount(remainingQuantity * unitPrice)}</Text>
                </View>
              </ScrollView>
              <Text style={styles.sharedInfo}>
                {t('itemAssignPicker.sharedInfo', { remaining: remainingQuantity, total: rowQuantity })}
              </Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint,
  },
  circleCustomized: {
    backgroundColor: colors.primary,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  menuWrapper: {
    width: '85%',
    maxWidth: 340,
  },
  menu: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    maxHeight: 380,
    boxShadow: '0px 8px 24px rgba(0,0,0,0.2)',
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 10,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  quantityLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  quantityValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f2937',
  },
  buddyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  buddyName: {
    flex: 1,
    fontSize: 13,
    color: '#1f2937',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepperValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    minWidth: 16,
    textAlign: 'center',
  },
  restRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  restIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint,
  },
  restLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  restAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f2937',
  },
  sharedInfo: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
});
