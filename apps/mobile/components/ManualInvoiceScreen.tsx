import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useToasts } from '../hooks/useToasts';
import { fetchBuddies, type Buddy } from '../lib/buddiesApi';
import { computeBuddyShareFromRows } from '../lib/buddyExpenses';
import { DEFAULT_CATEGORY, suggestCategory } from '../lib/categories';
import { parseDateLabel, toDateLabel, todayLabel, toLocalIsoString } from '../lib/date';
import { formatAmount, formatAmountInput, parseAmountInput } from '../lib/formatAmount';
import { useTranslation } from '../lib/i18n';
import type { InvoiceBuddy, InvoiceItem, InvoiceVerificationResult } from '../lib/invoiceApi';
import { fetchProjects, type Project } from '../lib/projectsApi';
import { colors } from '../lib/theme';
import { BuddyPicker } from './BuddyPicker';
import { CategoryPicker } from './CategoryPicker';
import { GlassButton } from './GlassButton';
import { GlassTextInput } from './GlassTextInput';
import { GlassView } from './GlassView';
import { ItemAssignPicker } from './ItemAssignPicker';
import { ProjectPicker } from './ProjectPicker';
import { ToastHost } from './ToastHost';
import { UserAvatar } from './UserAvatar';

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
  buddyQuantities: Record<string, number>;
  excludedBuddyIds: string[];
};

function emptyItem(): ItemDraft {
  return {
    name: '',
    quantity: '1',
    unitPrice: '',
    category: DEFAULT_CATEGORY,
    categoryTouched: false,
    buddyQuantities: {},
    excludedBuddyIds: [],
  };
}

function toItemDrafts(items: InvoiceItem[]): ItemDraft[] {
  return items.map((item) => ({
    name: item.name,
    quantity: String(item.quantity),
    unitPrice: formatAmount(item.unitPriceAfterVat),
    category: item.category ?? suggestCategory(item.name),
    categoryTouched: Boolean(item.category),
    buddyQuantities: item.buddyQuantities ?? {},
    excludedBuddyIds: item.excludedBuddyIds ?? [],
  }));
}

export function ManualInvoiceScreen({
  initialData,
  isEditing,
  isSaving,
  onClose,
  onSubmit,
}: ManualInvoiceScreenProps) {
  const { t } = useTranslation();
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
  const [isItemSplitEnabled, setIsItemSplitEnabled] = useState(() =>
    Boolean(
      initialData?.items.some(
        (item) =>
          Object.values(item.buddyQuantities ?? {}).some((qty) => qty > 0) ||
          (item.excludedBuddyIds?.length ?? 0) > 0,
      ),
    ),
  );
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

  const itemRows = items.map((item) => {
    const price = parseAmountInput(item.unitPrice);
    const quantity = Number(item.quantity);
    return {
      quantity: Number.isFinite(quantity) ? quantity : 0,
      unitPrice: Number.isFinite(price) ? price : 0,
      buddyQuantities: item.buddyQuantities,
      excludedBuddyIds: item.excludedBuddyIds,
    };
  });
  const allBuddyIds = selectedBuddies.map((buddy) => buddy.userId);
  const getBuddyShare = (buddyId: string) => computeBuddyShareFromRows(itemRows, buddyId, allBuddyIds);

  const toggleBuddy = (buddyId: string) => {
    setSelectedBuddies((current) =>
      current.some((buddy) => buddy.userId === buddyId)
        ? current.filter((buddy) => buddy.userId !== buddyId)
        : [...current, { userId: buddyId, paid: false }],
    );
    // Clear any dangling quantity/exclusion a removed buddy held on any row.
    setItems((current) =>
      current.map((item) => {
        if (!(buddyId in item.buddyQuantities) && !item.excludedBuddyIds.includes(buddyId)) {
          return item;
        }
        const { [buddyId]: _removedQuantity, ...restQuantities } = item.buddyQuantities;
        return {
          ...item,
          buddyQuantities: restQuantities,
          excludedBuddyIds: item.excludedBuddyIds.filter((id) => id !== buddyId),
        };
      }),
    );
  };

  const setItemBuddyQuantity = (index: number, buddyId: string, quantity: number) => {
    setItems((current) =>
      current.map((item, i) => {
        if (i !== index) {
          return item;
        }
        const nextQuantities = { ...item.buddyQuantities };
        if (quantity <= 0) {
          delete nextQuantities[buddyId];
        } else {
          nextQuantities[buddyId] = quantity;
        }
        return { ...item, buddyQuantities: nextQuantities };
      }),
    );
  };

  const toggleItemBuddyExcluded = (index: number, buddyId: string) => {
    setItems((current) =>
      current.map((item, i) => {
        if (i !== index) {
          return item;
        }
        const isExcluded = item.excludedBuddyIds.includes(buddyId);
        return {
          ...item,
          excludedBuddyIds: isExcluded
            ? item.excludedBuddyIds.filter((id) => id !== buddyId)
            : [...item.excludedBuddyIds, buddyId],
        };
      }),
    );
  };

  const handleToggleItemSplit = (value: boolean) => {
    setIsItemSplitEnabled(value);
    if (!value) {
      setItems((current) => current.map((item) => ({ ...item, buddyQuantities: {}, excludedBuddyIds: [] })));
    }
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
    const date = parseDateLabel(dateLabel);
    if (!date) {
      showError(t('manualInvoice.invalidDate'));
      return;
    }

    const parsedItems: InvoiceItem[] = [];
    for (const item of items) {
      const quantity = Number(item.quantity);
      const unitPrice = parseAmountInput(item.unitPrice);
      if (!item.name.trim() || !Number.isFinite(quantity) || !Number.isFinite(unitPrice)) {
        showError(t('manualInvoice.invalidItems'));
        return;
      }
      parsedItems.push({
        name: item.name.trim(),
        quantity,
        unitPriceBeforeVat: unitPrice,
        unitPriceAfterVat: unitPrice,
        category: item.category,
        buddyQuantities: item.buddyQuantities,
        excludedBuddyIds: item.excludedBuddyIds,
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

      <KeyboardAwareScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} bottomOffset={20}>
        <Text style={styles.title}>{isEditing ? t('manualInvoice.editTitle') : t('manualInvoice.addTitle')}</Text>

        <GlassTextInput
          style={styles.input}
          placeholder={t('manualInvoice.sellerPlaceholder')}
          value={sellerName}
          onChangeText={setSellerName}
        />
        <GlassTextInput
          style={styles.input}
          placeholder={t('manualInvoice.datePlaceholder')}
          value={dateLabel}
          onChangeText={setDateLabel}
        />

        <View style={styles.pickersRow}>
          <View style={styles.pickerSlot}>
            <ProjectPicker projects={projects} value={projectId} onChange={handleProjectChange} />
          </View>
          {selectedBuddies.length === 0 && (
            <View style={styles.pickerSlot}>
              <BuddyPicker buddies={buddies} selectedIds={[]} onToggle={toggleBuddy} />
            </View>
          )}
        </View>

        {selectedBuddies.length > 0 && (
          <GlassView style={[styles.card, styles.buddiesCard]}>
            <View style={styles.buddiesHeader}>
              <Text style={styles.buddiesTitle}>{t('manualInvoice.buddiesTitle')}</Text>
              <Switch value={isItemSplitEnabled} onValueChange={handleToggleItemSplit} />
              <BuddyPicker
                buddies={buddies}
                selectedIds={selectedBuddies.map((buddy) => buddy.userId)}
                onToggle={toggleBuddy}
                iconOnly
              />
            </View>
            {selectedBuddies.map((buddy) => {
              const info = buddies.find((candidate) => candidate.id === buddy.userId);
              return (
                <View key={buddy.userId} style={styles.buddyRow}>
                  <Pressable onPress={() => toggleBuddy(buddy.userId)} hitSlop={8}>
                    <Ionicons name="close" size={18} color="#9ca3af" />
                  </Pressable>
                  <Pressable style={styles.buddyRowMain} onPress={() => setBuddyPaid(buddy.userId, !buddy.paid)}>
                    <UserAvatar user={info ?? null} size={28} />
                    <Text style={styles.buddyName} numberOfLines={1}>
                      {info?.name ?? info?.email ?? t('manualInvoice.buddyFallback')}
                    </Text>
                    <Text style={styles.buddyShareAmount}>{formatAmount(getBuddyShare(buddy.userId))}</Text>
                    <View style={styles.buddyPaidToggle}>
                      <Ionicons
                        name={buddy.paid ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={buddy.paid ? '#10b981' : '#9ca3af'}
                      />
                      <Text style={[styles.buddyPaidText, buddy.paid && styles.buddyPaidTextOn]}>
                        {t('manualInvoice.paid')}
                      </Text>
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </GlassView>
        )}

        <GlassView style={styles.card}>
          <View style={styles.itemsHeader}>
            <View style={styles.categoryColumn} />
            <Text style={[styles.headerCell, styles.nameColumn]}>{t('manualInvoice.itemColumn')}</Text>
            <Text style={[styles.headerCell, styles.qtyColumn]}>{t('manualInvoice.quantityColumn')}</Text>
            <Text style={[styles.headerCell, styles.priceColumn]}>{t('manualInvoice.priceColumn')}</Text>
            {isItemSplitEnabled && selectedBuddies.length > 0 && <View style={styles.assignColumn} />}
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
                  placeholder={t('common.name')}
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
                {isItemSplitEnabled && selectedBuddies.length > 0 && (
                  <View style={styles.assignColumn}>
                    <ItemAssignPicker
                      buddies={selectedBuddies
                        .map((buddy) => buddies.find((candidate) => candidate.id === buddy.userId))
                        .filter((buddy): buddy is Buddy => Boolean(buddy))}
                      rowQuantity={Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 0}
                      unitPrice={
                        Number.isFinite(parseAmountInput(item.unitPrice)) ? parseAmountInput(item.unitPrice) : 0
                      }
                      buddyQuantities={item.buddyQuantities}
                      excludedBuddyIds={item.excludedBuddyIds}
                      onQuantityChange={(buddyId, quantity) => setItemBuddyQuantity(index, buddyId, quantity)}
                      onToggleExcluded={(buddyId) => toggleItemBuddyExcluded(index, buddyId)}
                    />
                  </View>
                )}
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
            <Text style={styles.addItemText}>{t('manualInvoice.addItem')}</Text>
          </Pressable>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t('manualInvoice.total')}</Text>
            <Text style={styles.totalValue}>{formatAmount(total)}</Text>
          </View>
        </GlassView>
      </KeyboardAwareScrollView>

      <View style={styles.footer}>
        <GlassButton
          label={isSaving ? t('common.saving') : isEditing ? t('manualInvoice.saveChanges') : t('manualInvoice.continue')}
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
  pickersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  pickerSlot: {
    flex: 1,
  },
  card: {
    padding: 20,
  },
  buddiesCard: {
    marginBottom: 16,
  },
  buddiesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  buddiesTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  buddyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  buddyRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
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
  buddyShareAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f2937',
  },
  assignColumn: {
    width: 28,
    marginLeft: 6,
    alignItems: 'center',
    justifyContent: 'center',
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
