import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useToasts } from '../hooks/useToasts';
import { fetchBuddies, type Buddy } from '../lib/buddiesApi';
import { DEFAULT_CATEGORY, suggestCategory } from '../lib/categories';
import { parseDateLabel, toDateLabel, todayLabel, toLocalIsoString } from '../lib/date';
import { formatAmount, formatAmountInput, parseAmountInput } from '../lib/formatAmount';
import type { InvoiceBuddy, InvoiceItem, InvoiceVerificationResult } from '../lib/invoiceApi';
import { fetchProjects, type Project } from '../lib/projectsApi';
import { colors } from '../lib/theme';
import { BuddyPicker } from './BuddyPicker';
import { CategoryPicker } from './CategoryPicker';
import { GlassButton } from './GlassButton';
import { GlassTextInput } from './GlassTextInput';
import { GlassView } from './GlassView';
import { ProjectPicker } from './ProjectPicker';
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
  category: string;
  categoryTouched: boolean;
};

function emptyItem(): ItemDraft {
  return { name: '', quantity: '1', unitPrice: '', category: DEFAULT_CATEGORY, categoryTouched: false };
}

function toItemDrafts(items: InvoiceItem[]): ItemDraft[] {
  return items.map((item) => ({
    name: item.name,
    quantity: String(item.quantity),
    unitPrice: formatAmount(item.unitPriceAfterVat),
    category: item.category ?? suggestCategory(item.name),
    categoryTouched: Boolean(item.category),
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
  const [projectId, setProjectId] = useState<string | null>(initialData?.projectId ?? null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedBuddies, setSelectedBuddies] = useState<InvoiceBuddy[]>(initialData?.buddies ?? []);
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const { toasts, showError, dismissToast } = useToasts();

  useEffect(() => {
    fetchProjects()
      .then(setProjects)
      .catch(() => setProjects([]));
    fetchBuddies()
      .then(setBuddies)
      .catch(() => setBuddies([]));
  }, []);

  const total = items.reduce((sum, item) => {
    const price = parseAmountInput(item.unitPrice);
    const quantity = Number(item.quantity);
    return sum + (Number.isFinite(price) && Number.isFinite(quantity) ? price * quantity : 0);
  }, 0);

  const shareAmount = total / (selectedBuddies.length + 1);

  const toggleBuddy = (buddyId: string) => {
    setSelectedBuddies((current) =>
      current.some((buddy) => buddy.userId === buddyId)
        ? current.filter((buddy) => buddy.userId !== buddyId)
        : [...current, { userId: buddyId, paid: false }],
    );
  };

  const setBuddyPaid = (buddyId: string, paid: boolean) => {
    setSelectedBuddies((current) => current.map((buddy) => (buddy.userId === buddyId ? { ...buddy, paid } : buddy)));
  };

  const handleProjectChange = (newProjectId: string | null) => {
    setProjectId(newProjectId);
    const project = projects.find((candidate) => candidate.id === newProjectId);
    if (!project || project.buddyIds.length === 0) {
      return;
    }
    setSelectedBuddies((current) => {
      const missing = project.buddyIds
        .filter((buddyId) => !current.some((buddy) => buddy.userId === buddyId))
        .map((buddyId) => ({ userId: buddyId, paid: false }));
      return missing.length > 0 ? [...current, ...missing] : current;
    });
  };

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
    const date = parseDateLabel(dateLabel);
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
        category: item.category,
      });
    }

    onSubmit({
      iic: isEditing && initialData ? initialData.iic : `MANUAL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      dateTimeCreated: toLocalIsoString(date),
      totalPrice: parsedItems.reduce((sum, item) => sum + item.unitPriceAfterVat * item.quantity, 0),
      seller: { name: sellerName.trim() },
      items: parsedItems,
      projectId,
      buddies: selectedBuddies,
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

        <View style={styles.projectRow}>
          <ProjectPicker projects={projects} value={projectId} onChange={handleProjectChange} />
        </View>

        <View style={styles.projectRow}>
          <BuddyPicker
            buddies={buddies}
            selectedIds={selectedBuddies.map((buddy) => buddy.userId)}
            onToggle={toggleBuddy}
          />
        </View>

        {selectedBuddies.length > 0 && (
          <GlassView style={[styles.card, styles.buddiesCard]}>
            <Text style={styles.buddiesTitle}>Ndarja e faturës ({formatAmount(shareAmount)} secili)</Text>
            {selectedBuddies.map((buddy) => {
              const info = buddies.find((candidate) => candidate.id === buddy.userId);
              return (
                <Pressable
                  key={buddy.userId}
                  style={styles.buddyRow}
                  onPress={() => setBuddyPaid(buddy.userId, !buddy.paid)}
                >
                  <Text style={styles.buddyName} numberOfLines={1}>
                    {info?.name ?? info?.email ?? 'Shok'}
                  </Text>
                  <View style={styles.buddyPaidToggle}>
                    <Ionicons
                      name={buddy.paid ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={buddy.paid ? '#10b981' : '#9ca3af'}
                    />
                    <Text style={[styles.buddyPaidText, buddy.paid && styles.buddyPaidTextOn]}>
                      {buddy.paid ? 'Paguar' : 'Papaguar'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </GlassView>
        )}

        <GlassView style={styles.card}>
          <View style={styles.itemsHeader}>
            <View style={styles.categoryColumn} />
            <Text style={[styles.headerCell, styles.nameColumn]}>Artikulli</Text>
            <Text style={[styles.headerCell, styles.qtyColumn]}>Sasia</Text>
            <Text style={[styles.headerCell, styles.priceColumn]}>Çmimi</Text>
            <View style={styles.removeColumn} />
          </View>

          {items.map((item, index) => (
            <View key={index} style={styles.itemBlock}>
              <View style={styles.itemRow}>
                <View style={styles.categoryColumn}>
                  <CategoryPicker
                    value={item.category}
                    onChange={(categoryId) => updateItem(index, { category: categoryId, categoryTouched: true })}
                    iconOnly
                  />
                </View>
                <GlassTextInput
                  style={[styles.cellInput, styles.nameColumn]}
                  placeholder="Emri"
                  value={item.name}
                  onChangeText={(value) =>
                    updateItem(index, {
                      name: value,
                      ...(item.categoryTouched ? null : { category: suggestCategory(value) }),
                    })
                  }
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
  projectRow: {
    marginBottom: 16,
  },
  card: {
    padding: 20,
  },
  buddiesCard: {
    marginBottom: 16,
  },
  buddiesTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  buddyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  buddyName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  buddyPaidToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  buddyPaidText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  buddyPaidTextOn: {
    color: '#059669',
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
  itemBlock: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryColumn: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellInput: {
    borderWidth: 0,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 6,
    fontSize: 14,
    boxShadow: '0px 1px 3px rgba(0,0,0,0.15)',
  },
  nameColumn: {
    flex: 2.4,
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
    color: colors.primary,
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
