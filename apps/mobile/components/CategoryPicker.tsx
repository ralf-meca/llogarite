import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CaretDownIcon, CheckIcon } from 'phosphor-react-native';
import { CATEGORIES, categoryIcon, categoryLabelKey } from '../lib/categories';
import { useTranslation } from '../lib/i18n';
import { colors, radius } from '../lib/theme';
import { GlassView } from './GlassView';

type CategoryPickerProps = {
  value: string;
  onChange: (categoryId: string) => void;
};

export function CategoryPicker({ value, onChange }: CategoryPickerProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const ValueIcon = categoryIcon(value);

  return (
    <>
      <Pressable style={styles.trigger} onPress={() => setIsOpen(true)}>
        <ValueIcon size={18} color={colors.primary} />
        <Text style={styles.triggerText} numberOfLines={1}>
          {t(categoryLabelKey(value))}
        </Text>
        <CaretDownIcon size={14} color={colors.textMuted} />
      </Pressable>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <View style={styles.menuWrapper} pointerEvents="box-none">
            <GlassView style={styles.menu}>
              <ScrollView bounces={false}>
                {CATEGORIES.map((category) => {
                  const ItemIcon = category.icon;
                  return (
                    <Pressable
                      key={category.id}
                      style={styles.menuItem}
                      onPress={() => {
                        onChange(category.id);
                        setIsOpen(false);
                      }}
                    >
                      <View style={styles.menuItemLeft}>
                        <ItemIcon size={18} color={category.id === value ? colors.primary : '#4b5563'} />
                        <Text style={[styles.menuItemText, category.id === value && styles.menuItemTextActive]}>
                          {t(category.labelKey)}
                        </Text>
                      </View>
                      {category.id === value && <CheckIcon size={16} weight="bold" color={colors.primary} />}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </GlassView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Sits in the item form next to the text fields, so it is shaped like one
  // rather than like the compact pills in the row above the items table.
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card - 4,
    backgroundColor: colors.primaryTint,
  },
  triggerText: {
    flex: 1,
    fontSize: 16,
    color: colors.textDark,
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
