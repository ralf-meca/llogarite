import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CATEGORIES, categoryIcon, categoryLabel } from '../lib/categories';
import { colors } from '../lib/theme';
import { GlassView } from './GlassView';

type CategoryPickerProps = {
  value: string;
  onChange: (categoryId: string) => void;
  iconOnly?: boolean;
};

export function CategoryPicker({ value, onChange, iconOnly }: CategoryPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {iconOnly ? (
        <Pressable style={styles.iconTrigger} onPress={() => setIsOpen(true)}>
          <Ionicons name={categoryIcon(value)} size={18} color="#374151" />
        </Pressable>
      ) : (
        <Pressable style={styles.trigger} onPress={() => setIsOpen(true)}>
          <Ionicons name={categoryIcon(value)} size={13} color="#374151" />
          <Text style={styles.triggerText} numberOfLines={1}>
            {categoryLabel(value)}
          </Text>
          <Ionicons name="chevron-down" size={12} color="#6b7280" />
        </Pressable>
      )}

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <View style={styles.menuWrapper} pointerEvents="box-none">
            <GlassView style={styles.menu}>
              <ScrollView bounces={false}>
                {CATEGORIES.map((category) => (
                  <Pressable
                    key={category.id}
                    style={styles.menuItem}
                    onPress={() => {
                      onChange(category.id);
                      setIsOpen(false);
                    }}
                  >
                    <View style={styles.menuItemLeft}>
                      <Ionicons
                        name={category.icon}
                        size={18}
                        color={category.id === value ? colors.primary : '#4b5563'}
                      />
                      <Text style={[styles.menuItemText, category.id === value && styles.menuItemTextActive]}>
                        {category.label}
                      </Text>
                    </View>
                    {category.id === value && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                  </Pressable>
                ))}
              </ScrollView>
            </GlassView>
          </View>
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
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: colors.primaryTint,
    borderRadius: 8,
  },
  triggerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
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
  },
  menuWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menu: {
    minWidth: 240,
    maxHeight: 380,
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  menuItemTextActive: {
    color: colors.primary,
  },
});
