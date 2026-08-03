import { CaretDownIcon, CheckSquareIcon, SquareIcon, UserPlusIcon, UsersIcon } from 'phosphor-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { Buddy } from '../lib/buddiesApi';
import { useTranslation } from '../lib/i18n';
import { colors } from '../lib/theme';
import { GlassButton } from './GlassButton';
import { UserAvatar } from './UserAvatar';

type BuddyPickerProps = {
  buddies: Buddy[];
  selectedIds: string[];
  onToggle: (buddyId: string) => void;
  iconOnly?: boolean;
  // Optional controlled open state, so a caller can share one picker's modal across
  // multiple trigger buttons instead of each trigger owning its own modal instance.
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  // Suppresses this instance's own trigger button, rendering only the modal. Lets a
  // caller place the Modal-owning instance somewhere that's never a display:'none'
  // descendant (that hides the Modal's content from repainting) while driving it
  // from external trigger buttons elsewhere via isOpen/onOpenChange.
  hideTrigger?: boolean;
};

export function BuddyPicker({
  buddies,
  selectedIds,
  onToggle,
  iconOnly,
  isOpen: controlledIsOpen,
  onOpenChange,
  hideTrigger,
}: BuddyPickerProps) {
  const { t } = useTranslation();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen ?? internalIsOpen;
  const setIsOpen = onOpenChange ?? setInternalIsOpen;
  const selectedBuddies = buddies.filter((buddy) => selectedIds.includes(buddy.id));
  const label =
    selectedBuddies.length === 0
      ? t('buddyPicker.addBuddy')
      : t('buddyPicker.selectedCount', { count: selectedBuddies.length });

  return (
    <>
      {hideTrigger ? null : iconOnly ? (
        <Pressable style={styles.iconTrigger} onPress={() => setIsOpen(true)} hitSlop={8}>
          <UserPlusIcon size={16} color={colors.primary} />
        </Pressable>
      ) : (
        <Pressable style={styles.trigger} onPress={() => setIsOpen(true)}>
          <UsersIcon size={14} color="#374151" />
          <Text style={styles.triggerText} numberOfLines={1}>
            {label}
          </Text>
          <CaretDownIcon size={12} color="#6b7280" />
        </Pressable>
      )}

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.title}>{t('buddyPicker.title')}</Text>
            <ScrollView style={styles.list} bounces={false}>
              {buddies.length === 0 && <Text style={styles.emptyText}>{t('buddies.noBuddiesYet')}</Text>}
              {buddies.map((buddy) => {
                const isSelected = selectedIds.includes(buddy.id);
                return (
                  <Pressable
                    key={buddy.id}
                    style={styles.row}
                    onPress={() => {
                      onToggle(buddy.id);
                      if (buddies.length === 1) {
                        setIsOpen(false);
                      }
                    }}
                  >
                    <UserAvatar user={buddy} size={32} />
                    <Text style={[styles.rowText, isSelected && styles.rowTextActive]} numberOfLines={1}>
                      {buddy.name ?? buddy.email}
                    </Text>
                    {isSelected ? (
                      <CheckSquareIcon size={20} weight="fill" color={colors.primary} />
                    ) : (
                      <SquareIcon size={20} color="#9ca3af" />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
            <GlassButton label={t('common.close')} variant="accent" onPress={() => setIsOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    boxShadow: '0px 1px 3px rgba(0,0,0,0.15)',
    maxWidth: '100%',
  },
  triggerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    flexShrink: 1,
  },
  iconTrigger: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  card: {
    width: '85%',
    maxHeight: '70%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    boxShadow: '0px 6px 16px rgba(0,0,0,0.2)',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
    color: '#1f2937',
  },
  list: {
    marginBottom: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
    paddingVertical: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: 12,
  },
  rowText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  rowTextActive: {
    color: colors.primary,
  },
});
