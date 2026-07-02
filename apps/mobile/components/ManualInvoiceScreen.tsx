import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useToasts } from '../hooks/useToasts';
import { toLocalIsoString } from '../lib/date';
import { formatAmount, formatAmountInput, parseAmountInput } from '../lib/formatAmount';
import type { InvoiceItem, InvoiceVerificationResult } from '../lib/invoiceApi';
import { GlassButton } from './GlassButton';
import { GlassTextInput } from './GlassTextInput';
import { GlassView } from './GlassView';
import { ToastHost } from './ToastHost';

type ManualInvoiceScreenProps = {
  initialData?: InvoiceVerificationResult;
  isEditing?: boolean;
  isSaving?: boolean;
  onClose: () => void;
  onSubmit: (result: InvoiceVerificationResult) => void;
};

type ItemDraft = {
  name: string;
  quantity: string;
  unitPrice: string;
};

function emptyItem(): ItemDraft {
  return { name: '', quantity: '1', unitPrice: '' };
}

function todayLabel(): string {
  return toDateLabel(new Date());
}

function toDateLabel(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

function parseDate(label: string): Date | null {
  const match = label.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) {
    return null;
  }
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toItemDrafts(items: InvoiceItem[]): ItemDraft[] {
  return items.map((item) => ({
    name: item.name,
    quantity: String(item.quantity),
    unitPrice: formatAmount(item.unitPriceAfterVat),
  }));
}

export function ManualInvoiceScreen({
  initialData,
  isEditing,
  isSaving,
  onClose,
  onSubmit,
}: ManualInvoiceScreenProps) {
  const [sellerName, setSellerName] = useState(initialData?.seller.name ?? '');
  const [dateLabel, setDateLabel] = useState(
    initialData ? toDateLabel(new Date(initialData.dateTimeCreated)) : todayLabel(),
  );
  const [items, setItems] = useState<ItemDraft[]>(
    initialData && initialData.items.length > 0 ? toItemDrafts(initialData.items) : [emptyItem()],
  );
  const { toasts, showError, dismissToast } = useToasts();

  const total = items.reduce((sum, item) => {
    const price = parseAmountInput(item.unitPrice);
    const quantity = Number(item.quantity);
    return sum + (Number.isFinite(price) && Number.isFinite(quantity) ? price * quantity : 0);
  }, 0);

  const updateItem = (index: number, patch: Partial<ItemDraft>) => {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const addItem = () => setItems((current) => [...current, emptyItem()]);

  const removeItem = (index: number) => {
    setItems((current) => (current.length > 1 ? current.filter((_, i) => i !== index) : current));
  };

  const handleSubmit = () => {
    if (!sellerName.trim()) {
      showError('Shkruaj emrin e shitësit.');
      return;
    }
    const date = parseDate(dateLabel);
    if (!date) {
      showError('Data duhet të jetë në formatin DD/MM/VVVV.');
      return;
    }

    const parsedItems: InvoiceItem[] = [];
    for (const item of items) {
      const quantity = Number(item.quantity);
      const unitPrice = parseAmountInput(item.unitPrice);
      if (!item.name.trim() || !Number.isFinite(quantity) || !Number.isFinite(unitPrice)) {
        showError('Plotëso saktë të gjithë artikujt (emri, sasia dhe çmimi).');
        return;
      }
      parsedItems.push({
        name: item.name.trim(),
        quantity,
        unitPriceBeforeVat: unitPrice,
        unitPriceAfterVat: unitPrice,
      });
    }

    onSubmit({
      iic: isEditing && initialData ? initialData.iic : `MANUAL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      dateTimeCreated: toLocalIsoString(date),
      totalPrice: parsedItems.reduce((sum, item) => sum + item.unitPriceAfterVat * item.quantity, 0),
      seller: { name: sellerName.trim() },
      items: parsedItems,
    });
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={onClose} style={styles.closeButtonWrapper}>
        <GlassView style={styles.closeButton}>
          {isEditing ? (
            <MaterialCommunityIcons name="pencil-off-outline" size={18} color="#111827" />
          ) : (
            <Text style={styles.closeButtonText}>✕</Text>
          )}
        </GlassView>
      </Pressable>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{isEditing ? 'Ndrysho faturën' : 'Shto faturë manualisht'}</Text>

        <GlassTextInput
          style={styles.input}
          placeholder="Emri i shitësit"
          value={sellerName}
          onChangeText={setSellerName}
        />
        <GlassTextInput
          style={styles.input}
          placeholder="Data (DD/MM/VVVV)"
          value={dateLabel}
          onChangeText={setDateLabel}
        />

        <GlassView style={styles.card}>
          <View style={styles.itemsHeader}>
            <Text style={[styles.headerCell, styles.nameColumn]}>Artikulli</Text>
            <Text style={[styles.headerCell, styles.qtyColumn]}>Sasia</Text>
            <Text style={[styles.headerCell, styles.priceColumn]}>Çmimi</Text>
            <View style={styles.removeColumn} />
          </View>

          {items.map((item, index) => (
            <View key={index} style={styles.itemRow}>
              <GlassTextInput
                style={[styles.cellInput, styles.nameColumn]}
                placeholder="Emri"
                value={item.name}
                onChangeText={(value) => updateItem(index, { name: value })}
              />
              <GlassTextInput
                style={[styles.cellInput, styles.qtyColumn]}
                keyboardType="numeric"
                value={item.quantity}
                onChangeText={(value) => updateItem(index, { quantity: value })}
              />
              <GlassTextInput
                style={[styles.cellInput, styles.priceColumn, styles.priceInput]}
                keyboardType="numeric"
                value={item.unitPrice}
                onChangeText={(value) => updateItem(index, { unitPrice: formatAmountInput(value) })}
              />
              <Pressable
                style={styles.removeColumn}
                onPress={() => removeItem(index)}
                disabled={items.length === 1}
              >
                {items.length > 1 && <Ionicons name="close-circle" size={18} color="#dc2626" />}
              </Pressable>
            </View>
          ))}

          <Pressable onPress={addItem} style={styles.addItemButton}>
            <Text style={styles.addItemText}>+ Shto artikull</Text>
          </Pressable>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Totali</Text>
            <Text style={styles.totalValue}>{formatAmount(total)}</Text>
          </View>
        </GlassView>
      </ScrollView>

      <View style={styles.footer}>
        <GlassButton
          label={isSaving ? 'Duke ruajtur...' : isEditing ? 'Ruaj ndryshimet' : 'Vazhdo'}
          variant="accent"
          onPress={handleSubmit}
          disabled={isSaving}
        />
      </View>

      <ToastHost toasts={toasts} onDismiss={dismissToast} bottomOffset={110} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  closeButtonWrapper: {
    alignSelf: 'flex-end',
    marginTop: 8,
    marginBottom: 12,
    marginRight: 16,
    borderRadius: 18,
    boxShadow: '0px 2px 4px rgba(0,0,0,0.15)',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#111827',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
  },
  card: {
    padding: 20,
  },
  itemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 6,
  },
  headerCell: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 6,
  },
  cellInput: {
    borderWidth: 0,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 6,
    fontSize: 14,
  },
  nameColumn: {
    flex: 3,
  },
  qtyColumn: {
    flex: 1,
    textAlign: 'center',
  },
  priceColumn: {
    flex: 1.5,
    textAlign: 'center',
  },
  priceInput: {
    textAlign: 'right',
  },
  removeColumn: {
    width: 20,
    marginLeft: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addItemButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  addItemText: {
    color: '#2563eb',
    fontWeight: '600',
    fontSize: 14,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
});
