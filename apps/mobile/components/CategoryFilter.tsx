import { CaretDownIcon, CheckIcon, SquaresFourIcon } from 'phosphor-react-native';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { CATEGORIES, categoryIcon, categoryLabelKey } from '../lib/categories';
import { useTranslation } from '../lib/i18n';
import { colors } from '../lib/theme';

type CategoryFilterProps = {
  value: string | null;
  onChange: (categoryId: string | null) => void;
  style?: StyleProp<ViewStyle>;
};

export function CategoryFilter({ value, onChange, style }: CategoryFilterProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  // The grid icon stands for "no category in particular", so the trigger reads
  // as a filter even before one is picked.
  const TriggerIcon = value ? categoryIcon(value) : SquaresFourIcon;

  const select = (categoryId: string | null) => {
    onChange(categoryId);
    setIsOpen(false);
  };

  return (
    <>
      <Pressable style={[styles.trigger, style]} onPress={() => setIsOpen(true)}>
        <TriggerIcon size={14} color="#374151" />
        <Text style={styles.triggerText} numberOfLines={1}>
          {value ? t(categoryLabelKey(value)) : t('categoryFilter.allCategories')}
        </Text>
        <CaretDownIcon size={12} color="#6b7280" />
      </Pressable>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.title}>{t('categoryFilter.selectCategory')}</Text>

            <ScrollView style={styles.options} showsVerticalScrollIndicator={false} bounces={false}>
              <Pressable style={styles.optionRow} onPress={() => select(null)}>
                <View style={styles.optionLeft}>
                  <SquaresFourIcon size={18} color={value === null ? colors.primary : '#4b5563'} />
                  <Text style={[styles.optionText, value === null && styles.optionTextActive]}>
                    {t('categoryFilter.allCategories')}
                  </Text>
                </View>
                {value === null && <CheckIcon size={16} weight="bold" color={colors.primary} />}
              </Pressable>

              {CATEGORIES.map((category) => {
                const ItemIcon = category.icon;
                const isActive = category.id === value;
                return (
                  <Pressable key={category.id} style={styles.optionRow} onPress={() => select(category.id)}>
                    <View style={styles.optionLeft}>
                      <ItemIcon size={18} color={isActive ? colors.primary : '#4b5563'} />
                      <Text style={[styles.optionText, isActive && styles.optionTextActive]}>
                        {t(category.labelKey)}
                      </Text>
                    </View>
                    {isActive && <CheckIcon size={16} weight="bold" color={colors.primary} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Matches the month filter's pill so the two sit together as one filter bar.
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    boxShadow: '0px 1px 3px rgba(0,0,0,0.15)',
  },
  triggerText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
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
    paddingVertical: 20,
    paddingHorizontal: 12,
    boxShadow: '0px 6px 16px rgba(0,0,0,0.2)',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
    color: '#1f2937',
  },
  options: {
    flexGrow: 0,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  optionTextActive: {
    color: colors.primary,
  },
});
