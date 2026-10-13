import { PlusIcon } from 'phosphor-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Buddy } from '../lib/buddiesApi';
import { useTranslation } from '../lib/i18n';
import { colors } from '../lib/theme';
import { BuddyPicker } from './BuddyPicker';
import { UserAvatar } from './UserAvatar';

const CIRCLE = 44;
// Room for a short first name; a longer one is cut rather than pushing the row apart.
const CELL_WIDTH = 56;

// The first name, or the part of the address before the @ for a buddy with no name.
function shortName(buddy: Buddy): string {
  const name = buddy.name?.trim();
  return name ? name.split(/\s+/)[0] : buddy.email.split('@')[0];
}

type BuddyCirclesProps = {
  buddies: Buddy[];
  selectedIds: string[];
  onToggle: (buddyId: string) => void;
};

// Who is in on something, as faces, and a plus that opens the list to choose from.
// A face opens the same list, which is also where one is taken off.
export function BuddyCircles({ buddies, selectedIds, onToggle }: BuddyCirclesProps) {
  const { t } = useTranslation();
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  return (
    <View style={styles.row}>
      {buddies
        .filter((buddy) => selectedIds.includes(buddy.id))
        .map((buddy) => (
          <Pressable
            key={buddy.id}
            style={styles.cell}
            onPress={() => setIsPickerOpen(true)}
            accessibilityLabel={buddy.name ?? buddy.email}
          >
            <UserAvatar user={buddy} size={CIRCLE} />
            <Text style={styles.name} numberOfLines={1}>
              {shortName(buddy)}
            </Text>
          </Pressable>
        ))}
      <Pressable
        style={styles.add}
        onPress={() => setIsPickerOpen(true)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={t('buddyPicker.addBuddy')}
      >
        <PlusIcon size={18} weight="bold" color={colors.primary} />
      </Pressable>
      <BuddyPicker
        buddies={buddies}
        selectedIds={selectedIds}
        onToggle={onToggle}
        isOpen={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        hideTrigger
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // From the top, so the plus lines up with the faces and not with their names.
    alignItems: 'flex-start',
    gap: 6,
  },
  cell: {
    width: CELL_WIDTH,
    alignItems: 'center',
    gap: 4,
  },
  name: {
    maxWidth: CELL_WIDTH,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  add: {
    marginHorizontal: (CELL_WIDTH - CIRCLE) / 2,
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
});
