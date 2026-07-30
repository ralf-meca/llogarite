import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Buddy } from '../lib/buddiesApi';
import { formatAmount } from '../lib/formatAmount';
import { useTranslation } from '../lib/i18n';
import { colors } from '../lib/theme';
import { MultiPersonAvatar } from './MultiPersonAvatar';
import { UserAvatar } from './UserAvatar';

type ItemAssignPickerProps = {
  buddies: Buddy[];
  rowQuantity: number;
  unitPrice: number;
  buddyQuantities: Record<string, number>;
  onQuantityChange: (buddyId: string, quantity: number) => void;
};

export function ItemAssignPicker({
  buddies,
  rowQuantity,
  unitPrice,
  buddyQuantities,
  onQuantityChange,
}: ItemAssignPickerProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'quantity' | 'percentage'>('quantity');

  const isCustomized = Object.values(buddyQuantities).some((qty) => qty > 0);
  const assignedQuantity = Object.values(buddyQuantities).reduce((sum, qty) => sum + qty, 0);
  const remainingQuantity = Math.max(0, rowQuantity - assignedQuantity);
  const remainingPercent = rowQuantity > 0 ? Math.ceil((remainingQuantity / rowQuantity) * 100) : 0;
  const claimedBuddies = buddies.filter((buddy) => (buddyQuantities[buddy.id] ?? 0) > 0);
  const percentStep = 5;

  const toPercent = (quantity: number) => (rowQuantity > 0 ? Math.round((quantity / rowQuantity) * 100) : 0);
  const fromPercent = (percent: number) => (percent / 100) * rowQuantity;

  return (
    <>
      <Pressable onPress={() => setIsOpen(true)}>
        {claimedBuddies.length > 0 ? (
          <MultiPersonAvatar people={claimedBuddies} size={34} />
        ) : (
          <View style={[styles.circle, isCustomized && styles.circleCustomized]}>
            <Ionicons name="people" size={19} color={isCustomized ? '#ffffff' : colors.primary} />
          </View>
        )}
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
              <View style={styles.modeToggle}>
                <Pressable
                  style={[styles.modeOption, mode === 'quantity' && styles.modeOptionActive]}
                  onPress={() => setMode('quantity')}
                >
                  <Text style={[styles.modeOptionText, mode === 'quantity' && styles.modeOptionTextActive]}>
                    {t('itemAssignPicker.quantityMode')}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.modeOption, mode === 'percentage' && styles.modeOptionActive]}
                  onPress={() => setMode('percentage')}
                >
                  <Text style={[styles.modeOptionText, mode === 'percentage' && styles.modeOptionTextActive]}>
                    {t('itemAssignPicker.percentageMode')}
                  </Text>
                </Pressable>
              </View>
              <ScrollView style={styles.scrollArea} bounces={false}>
                {buddies.map((buddy) => {
                  const quantity = buddyQuantities[buddy.id] ?? 0;
                  const otherAssigned = assignedQuantity - quantity;
                  const maxQuantity = Math.max(0, rowQuantity - otherAssigned);

                  const percent = toPercent(quantity);
                  const maxPercent = toPercent(maxQuantity);
                  const step = mode === 'percentage' ? percentStep : 1;
                  const value = mode === 'percentage' ? percent : quantity;
                  const maxValue = mode === 'percentage' ? maxPercent : maxQuantity;

                  const applyValue = (nextValue: number) => {
                    const clamped = Math.max(0, Math.min(maxValue, nextValue));
                    onQuantityChange(buddy.id, mode === 'percentage' ? fromPercent(clamped) : clamped);
                  };

                  return (
                    <View key={buddy.id} style={styles.buddyRow}>
                      <UserAvatar user={buddy} size={22} />
                      <Text style={styles.buddyName} numberOfLines={1}>
                        {buddy.name ?? buddy.email}
                      </Text>
                      <View style={styles.stepper}>
                        <Pressable onPress={() => applyValue(value - step)} disabled={value <= 0} hitSlop={6}>
                          <Ionicons
                            name="remove-circle-outline"
                            size={20}
                            color={value <= 0 ? '#d1d5db' : colors.primary}
                          />
                        </Pressable>
                        <Text style={styles.stepperValue}>
                          {mode === 'percentage' ? `${value}%` : value}
                        </Text>
                        <Pressable onPress={() => applyValue(value + step)} disabled={value >= maxValue} hitSlop={6}>
                          <Ionicons
                            name="add-circle-outline"
                            size={20}
                            color={value >= maxValue ? '#d1d5db' : colors.primary}
                          />
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
                <View style={styles.restRow}>
                  <View style={styles.restIcon}>
                    <Ionicons name="people" size={16} color={colors.primary} />
                  </View>
                  <Text style={styles.restLabel}>{t('itemAssignPicker.restOfGroup')}</Text>
                  <Text style={styles.restAmount}>
                    {mode === 'percentage' ? `${remainingPercent}%` : Math.ceil(remainingQuantity)} ·{' '}
                    {formatAmount(remainingQuantity * unitPrice)}
                  </Text>
                </View>
              </ScrollView>
              <Text style={styles.sharedInfo}>
                {mode === 'percentage'
                  ? t('itemAssignPicker.sharedInfoPercent', { percent: remainingPercent })
                  : t('itemAssignPicker.sharedInfo', { remaining: Math.ceil(remainingQuantity), total: rowQuantity })}
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
    width: 34,
    height: 34,
    borderRadius: 17,
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
    maxHeight: 520,
    boxShadow: '0px 8px 24px rgba(0,0,0,0.2)',
  },
  scrollArea: {
    maxHeight: 340,
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
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 3,
    marginBottom: 8,
  },
  modeOption: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  modeOptionActive: {
    backgroundColor: '#ffffff',
    boxShadow: '0px 1px 3px rgba(0,0,0,0.15)',
  },
  modeOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  modeOptionTextActive: {
    color: colors.primary,
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
