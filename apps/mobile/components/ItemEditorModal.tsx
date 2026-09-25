import { ArrowLeftIcon } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_CATEGORY, suggestCategory } from '../lib/categories';
import { formatAmount, formatAmountInput, parseAmountInput } from '../lib/formatAmount';
import { useTranslation } from '../lib/i18n';
import { HEADER_INSET, colors, radius } from '../lib/theme';
import { CategoryPicker } from './CategoryPicker';
import { GlassButton } from './GlassButton';
import { GlassTextInput } from './GlassTextInput';

// The editable half of an invoice item. The items table owns the rest of the
// draft (the buddy split), so this stays exactly the set of fields this screen
// shows and nothing that would be silently dropped on save.
export type ItemEditorValue = {
  name: string;
  quantity: string;
  unitPrice: string;
  category: string;
  categoryTouched: boolean;
};

export function emptyItemEditorValue(): ItemEditorValue {
  return {
    name: '',
    quantity: '1',
    unitPrice: '',
    category: DEFAULT_CATEGORY,
    categoryTouched: false,
  };
}

type ItemEditorModalProps = {
  visible: boolean;
  // null opens the screen for a new item rather than an existing row.
  initialValue: ItemEditorValue | null;
  onCancel: () => void;
  onSave: (value: ItemEditorValue) => void;
};

export function ItemEditorModal({ visible, initialValue, onCancel, onSave }: ItemEditorModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState<ItemEditorValue>(() => initialValue ?? emptyItemEditorValue());
  const [error, setError] = useState<string | null>(null);

  // The screen stays mounted between openings, so each one has to start from the
  // row it was opened on instead of from whatever the last edit left behind.
  useEffect(() => {
    if (!visible) {
      return;
    }
    setValue(initialValue ?? emptyItemEditorValue());
    setError(null);
  }, [visible, initialValue]);

  const quantity = Number(value.quantity);
  const unitPrice = parseAmountInput(value.unitPrice);
  const lineTotal = Number.isFinite(quantity) && Number.isFinite(unitPrice) ? quantity * unitPrice : 0;

  const handleNameChange = (name: string) => {
    setValue((current) => ({
      ...current,
      name,
      // Until the category is picked by hand it keeps following the name.
      ...(current.categoryTouched ? null : { category: suggestCategory(name) }),
    }));
  };

  const handleCategoryChange = (category: string) => {
    setValue((current) => ({ ...current, category, categoryTouched: true }));
  };

  const handleSave = () => {
    if (!value.name.trim()) {
      setError(t('itemEditor.nameRequired'));
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError(t('itemEditor.quantityRequired'));
      return;
    }
    if (!value.unitPrice.trim() || !Number.isFinite(unitPrice)) {
      setError(t('itemEditor.priceRequired'));
      return;
    }
    onSave({ ...value, name: value.name.trim() });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable onPress={onCancel} style={styles.iconButton} hitSlop={10}>
            <ArrowLeftIcon size={18} color={colors.primary} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {initialValue ? t('itemEditor.editTitle') : t('itemEditor.addTitle')}
          </Text>
          <View style={styles.iconButtonSpacer} />
        </View>

        <View style={styles.sheet}>
          <KeyboardAwareScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            bottomOffset={20}
          >
            <Text style={styles.label}>{t('common.name')}</Text>
            <GlassTextInput
              style={styles.field}
              placeholder={t('itemEditor.namePlaceholder')}
              value={value.name}
              onChangeText={handleNameChange}
              autoFocus={!initialValue}
            />

            <View style={styles.fieldRow}>
              <View style={styles.fieldSlot}>
                <Text style={styles.label}>{t('manualInvoice.quantityColumn')}</Text>
                <GlassTextInput
                  style={styles.field}
                  keyboardType="numeric"
                  value={value.quantity}
                  onChangeText={(quantityInput) => setValue((current) => ({ ...current, quantity: quantityInput }))}
                />
              </View>
              <View style={styles.fieldSlot}>
                <Text style={styles.label}>{t('itemEditor.priceLabel')}</Text>
                <GlassTextInput
                  style={styles.field}
                  keyboardType="numeric"
                  placeholder="0,00"
                  value={value.unitPrice}
                  onChangeText={(priceInput) =>
                    setValue((current) => ({ ...current, unitPrice: formatAmountInput(priceInput) }))
                  }
                />
              </View>
            </View>

            <Text style={styles.label}>{t('itemEditor.categoryLabel')}</Text>
            <View style={styles.field}>
              <CategoryPicker value={value.category} onChange={handleCategoryChange} />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t('manualInvoice.total')}</Text>
              <Text style={styles.totalValue}>{formatAmount(lineTotal)}</Text>
            </View>
          </KeyboardAwareScrollView>

          <View style={[styles.footer, { paddingBottom: 32 + insets.bottom }]}>
            <GlassButton label={t('common.save')} variant="accent" onPress={handleSave} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: HEADER_INSET,
    backgroundColor: colors.primary,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    height: 52,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: colors.white,
    textAlign: 'center',
    includeFontPadding: false,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  iconButtonSpacer: {
    width: 32,
    height: 32,
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 6,
  },
  field: {
    marginBottom: 16,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldSlot: {
    flex: 1,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
    marginBottom: 12,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.primaryTint,
  },
  totalLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textDark,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 2,
    paddingBottom: 32,
    backgroundColor: colors.white,
  },
});
