import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { Buddy } from '../lib/buddiesApi';
import { GlassButton } from './GlassButton';

type BuddyPickerProps = {
  buddies: Buddy[];
  selectedIds: string[];
  onToggle: (buddyId: string) => void;
};

export function BuddyPicker({ buddies, selectedIds, onToggle }: BuddyPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedBuddies = buddies.filter((buddy) => selectedIds.includes(buddy.id));
  const label =
    selectedBuddies.length === 0
      ? 'Shto shok shpenzimesh'
      : selectedBuddies.map((buddy) => buddy.name ?? buddy.email).join(', ');

  return (
    <>
      <Pressable style={styles.trigger} onPress={() => setIsOpen(true)}>
        <Ionicons name="people-outline" size={14} color="#374151" />
        <Text style={styles.triggerText} numberOfLines={1}>
          {label}
        </Text>
        <Ionicons name="chevron-down" size={12} color="#6b7280" />
      </Pressable>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.title}>Shokët e shpenzimeve</Text>
            <ScrollView style={styles.list} bounces={false}>
              {buddies.length === 0 && <Text style={styles.emptyText}>Nuk ke shokë shpenzimesh ende.</Text>}
              {buddies.map((buddy) => {
                const isSelected = selectedIds.includes(buddy.id);
                return (
                  <Pressable key={buddy.id} style={styles.row} onPress={() => onToggle(buddy.id)}>
                    <Text style={[styles.rowText, isSelected && styles.rowTextActive]} numberOfLines={1}>
                      {buddy.name ?? buddy.email}
                    </Text>
                    <Ionicons
                      name={isSelected ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={isSelected ? '#2563eb' : '#9ca3af'}
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
            <GlassButton label="Mbyll" variant="accent" onPress={() => setIsOpen(false)} />
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
    color: '#2563eb',
  },
});
