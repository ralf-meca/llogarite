import {
  ArrowLeftIcon,
  CaretDownIcon,
  CheckSquareIcon,
  PencilSlashIcon,
  SquareIcon,
  UserPlusIcon,
  UsersIcon,
  XCircleIcon,
  XIcon,
} from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToasts } from '../hooks/useToasts';
import { fetchBuddies, type Buddy } from '../lib/buddiesApi';
import { computeBuddyShareFromRows } from '../lib/buddyExpenses';
import { DEFAULT_CATEGORY, suggestCategory } from '../lib/categories';
import { parseDateLabel, toDateLabel, todayLabel, toLocalIsoString } from '../lib/date';
import { formatAmount, formatAmountInput, parseAmountInput } from '../lib/formatAmount';
import { useTranslation } from '../lib/i18n';
import type { InvoiceBuddy, InvoiceItem, InvoiceVerificationResult } from '../lib/invoiceApi';
import { fetchProjects, type Project } from '../lib/projectsApi';
import { HEADER_INSET, colors, radius } from '../lib/theme';
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
  onBack?: () => void;
  onSubmit: (result: InvoiceVerificationResult) => void;
};

type ItemDraft = {
  name: string;
  quantity: string;
  unitPrice: string;
  category: string;
  categoryTouched: boolean;
  buddyQuantities: Record<string, number>;
  buddySplitTouched: boolean;
};

function emptyItem(): ItemDraft {
  return {
    name: '',
    quantity: '1',
    unitPrice: '',
    category: DEFAULT_CATEGORY,
    categoryTouched: false,
    buddyQuantities: {},
    buddySplitTouched: false,
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
    buddySplitTouched: Object.values(item.buddyQuantities ?? {}).some((qty) => qty > 0),
  }));
}

// Even split of a row's quantity across the owner + every selected buddy, e.g. a
// 2-quantity row with one buddy defaults to 1 for them; a 1-quantity row defaults to 0.5
// (shown as 50% in the picker). Only applied to rows the user hasn't customized yet.
function defaultBuddyQuantities(rowQuantity: number, buddyIds: string[]): Record<string, number> {
  if (buddyIds.length === 0 || !Number.isFinite(rowQuantity) || rowQuantity <= 0) {
    return {};
  }
  const share = rowQuantity / (buddyIds.length + 1);
  return Object.fromEntries(buddyIds.map((id) => [id, share]));
}

export function ManualInvoiceScreen({
  initialData,
  isEditing,
  isSaving,
  onClose,
  onBack,
  onSubmit,
}: ManualInvoiceScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
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
  const [isBuddyPickerOpen, setIsBuddyPickerOpen] = useState(false);
  const [isItemSplitEnabled, setIsItemSplitEnabled] = useState(() =>
    Boolean(
      initialData?.items.some((item) => Object.values(item.buddyQuantities ?? {}).some((qty) => qty > 0)),
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
    };
  });
  const allBuddyIds = selectedBuddies.map((buddy) => buddy.userId);
  const getBuddyShare = (buddyId: string) => computeBuddyShareFromRows(itemRows, buddyId, allBuddyIds);
  const buddiesTotal = allBuddyIds.reduce((sum, buddyId) => sum + getBuddyShare(buddyId), 0);
  const groupShare = total - buddiesTotal;

  const toggleBuddy = (buddyId: string) => {
    const isRemoving = selectedBuddies.some((buddy) => buddy.userId === buddyId);
    const nextBuddyIds = isRemoving
      ? selectedBuddies.filter((buddy) => buddy.userId !== buddyId).map((buddy) => buddy.userId)
      : [...selectedBuddies.map((buddy) => buddy.userId), buddyId];

    setSelectedBuddies((current) =>
      current.some((buddy) => buddy.userId === buddyId)
        ? current.filter((buddy) => buddy.userId !== buddyId)
        : [...current, { userId: buddyId, paid: false }],
    );

    setItems((current) =>
      current.map((item) => {
        if (item.buddySplitTouched) {
          // Clear any dangling quantity a removed buddy held on a row the user customized.
          if (!(buddyId in item.buddyQuantities)) {
            return item;
          }
          const { [buddyId]: _removedQuantity, ...restQuantities } = item.buddyQuantities;
          return { ...item, buddyQuantities: restQuantities };
        }
        if (!isItemSplitEnabled) {
          return item;
        }
        const quantity = Number(item.quantity);
        const rowQuantity = Number.isFinite(quantity) ? quantity : 0;
        return { ...item, buddyQuantities: defaultBuddyQuantities(rowQuantity, nextBuddyIds) };
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
        return { ...item, buddyQuantities: nextQuantities, buddySplitTouched: true };
      }),
    );
  };

  const handleToggleItemSplit = (value: boolean) => {
    setIsItemSplitEnabled(value);
    if (!value) {
      setItems((current) => current.map((item) => ({ ...item, buddyQuantities: {}, buddySplitTouched: false })));
      return;
    }
    const buddyIds = selectedBuddies.map((buddy) => buddy.userId);
    setItems((current) =>
      current.map((item) => {
        if (item.buddySplitTouched || buddyIds.length === 0) {
          return item;
        }
        const quantity = Number(item.quantity);
        const rowQuantity = Number.isFinite(quantity) ? quantity : 0;
        return { ...item, buddyQuantities: defaultBuddyQuantities(rowQuantity, buddyIds) };
      }),
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
    setItems((current) =>
      current.map((item, i) => {
        if (i !== index) {
          return item;
        }
        const merged = { ...item, ...patch };
        if ('quantity' in patch && isItemSplitEnabled && !merged.buddySplitTouched && selectedBuddies.length > 0) {
          const quantity = Number(merged.quantity);
          merged.buddyQuantities = defaultBuddyQuantities(
            Number.isFinite(quantity) ? quantity : 0,
            selectedBuddies.map((buddy) => buddy.userId),
          );
        }
        return merged;
      }),
    );
  };

  const addItem = () =>
    setItems((current) => {
      const draft = emptyItem();
      if (isItemSplitEnabled && selectedBuddies.length > 0) {
        const quantity = Number(draft.quantity);
        draft.buddyQuantities = defaultBuddyQuantities(
          Number.isFinite(quantity) ? quantity : 0,
          selectedBuddies.map((buddy) => buddy.userId),
        );
      }
      return [...current, draft];
    });

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
      <View style={styles.headerRow}>
        {isEditing && onBack ? (
          <Pressable onPress={onBack} style={styles.iconButton} hitSlop={10}>
            <ArrowLeftIcon size={18} color={colors.primary} />
          </Pressable>
        ) : (
          <View style={styles.iconButtonSpacer} />
        )}
        <Text style={styles.headerTitle} numberOfLines={1}>
          {isEditing ? t('manualInvoice.editTitle') : t('manualInvoice.addTitle')}
        </Text>
        <Pressable onPress={onClose} style={styles.iconButton} hitSlop={10}>
          {isEditing ? (
            <PencilSlashIcon size={18} color={colors.primary} />
          ) : (
            <XIcon size={18} color={colors.primary} weight="bold" />
          )}
        </Pressable>
      </View>

      <View style={styles.sheet}>
      <KeyboardAwareScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} bottomOffset={20}>

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
          {/* Just a trigger button here (no Modal inside), so hiding it via style when
              buddies exist can't suppress repaints for the shared modal below. */}
          <View style={[styles.pickerSlot, selectedBuddies.length > 0 && styles.hiddenSlot]}>
            <Pressable style={styles.buddyPillTrigger} onPress={() => setIsBuddyPickerOpen(true)}>
              <UsersIcon size={14} color="#374151" />
              <Text style={styles.buddyPillTriggerText} numberOfLines={1}>
                {t('buddyPicker.addBuddy')}
              </Text>
              <CaretDownIcon size={12} color="#6b7280" />
            </Pressable>
          </View>
        </View>

        {/* The one instance that actually owns the shared Modal, mounted at a stable
            position that's never a display:'none' descendant — Fabric stops repainting
            hidden subtrees' content (e.g. these checkboxes) even though state updates
            correctly, so the Modal itself must never be nested under a hidden ancestor. */}
        <BuddyPicker
          buddies={buddies}
          selectedIds={selectedBuddies.map((buddy) => buddy.userId)}
          onToggle={toggleBuddy}
          isOpen={isBuddyPickerOpen}
          onOpenChange={setIsBuddyPickerOpen}
          hideTrigger
        />

        <GlassView
          style={[styles.card, styles.buddiesCard, selectedBuddies.length === 0 && styles.hiddenCard]}
        >
          <View style={styles.buddiesHeader}>
              <Text style={styles.buddiesTitle}>{t('manualInvoice.buddiesTitle')}</Text>
              <Pressable style={styles.addBuddyIconTrigger} onPress={() => setIsBuddyPickerOpen(true)} hitSlop={8}>
                <UserPlusIcon size={16} color={colors.primary} />
              </Pressable>
            </View>
            <View style={styles.splitModeToggle}>
              <Pressable
                style={[styles.splitModeOption, !isItemSplitEnabled && styles.splitModeOptionActive]}
                onPress={() => handleToggleItemSplit(false)}
              >
                <Text style={[styles.splitModeOptionText, !isItemSplitEnabled && styles.splitModeOptionTextActive]}>
                  {t('manualInvoice.splitEvenly')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.splitModeOption, isItemSplitEnabled && styles.splitModeOptionActive]}
                onPress={() => handleToggleItemSplit(true)}
              >
                <Text style={[styles.splitModeOptionText, isItemSplitEnabled && styles.splitModeOptionTextActive]}>
                  {t('manualInvoice.splitByItem')}
                </Text>
              </Pressable>
            </View>
            {selectedBuddies.map((buddy) => {
              const info = buddies.find((candidate) => candidate.id === buddy.userId);
              return (
                <View key={buddy.userId} style={styles.buddyRow}>
                  <Pressable onPress={() => toggleBuddy(buddy.userId)} hitSlop={8}>
                    <XIcon size={18} color="#9ca3af" />
                  </Pressable>
                  <Pressable style={styles.buddyRowMain} onPress={() => setBuddyPaid(buddy.userId, !buddy.paid)}>
                    <UserAvatar user={info ?? null} size={28} />
                    <Text style={styles.buddyName} numberOfLines={1}>
                      {info?.name ?? info?.email ?? t('manualInvoice.buddyFallback')}
                    </Text>
                    <Text style={styles.buddyShareAmount}>{formatAmount(getBuddyShare(buddy.userId))}</Text>
                    <View style={styles.buddyPaidToggle}>
                      {buddy.paid ? (
                        <CheckSquareIcon size={20} weight="fill" color="#10b981" />
                      ) : (
                        <SquareIcon size={20} color="#9ca3af" />
                      )}
                      <Text style={[styles.buddyPaidText, buddy.paid && styles.buddyPaidTextOn]}>
                        {t('manualInvoice.paid')}
                      </Text>
                    </View>
                  </Pressable>
                </View>
              );
            })}
            {selectedBuddies.length > 0 && (
              <View style={styles.buddiesSummary}>
                <View style={styles.buddiesSummaryRow}>
                  <Text style={styles.buddiesSummaryLabel}>{t('manualInvoice.buddiesTotal')}</Text>
                  <Text style={styles.buddiesSummaryValue}>{formatAmount(buddiesTotal)}</Text>
                </View>
                <View style={styles.buddiesSummaryRow}>
                  <Text style={styles.buddiesSummaryLabel}>{t('manualInvoice.groupShare')}</Text>
                  <Text style={styles.buddiesSummaryValue}>{formatAmount(groupShare)}</Text>
                </View>
              </View>
            )}
        </GlassView>

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
                      onQuantityChange={(buddyId, quantity) => setItemBuddyQuantity(index, buddyId, quantity)}
                    />
                  </View>
                )}
                <Pressable
                  style={styles.removeColumn}
                  onPress={() => removeItem(index)}
                  disabled={items.length === 1}
                >
                  {items.length > 1 && <XCircleIcon size={18} weight="fill" color="#dc2626" />}
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

      <View style={[styles.footer, { paddingBottom: 32 + insets.bottom }]}>
        <GlassButton
          label={isSaving ? t('common.saving') : isEditing ? t('manualInvoice.saveChanges') : t('manualInvoice.continue')}
          variant="accent"
          onPress={handleSubmit}
          disabled={isSaving}
        />
      </View>
      </View>

      <ToastHost toasts={toasts} onDismiss={dismissToast} bottomOffset={110} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: -HEADER_INSET,
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
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
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
  hiddenSlot: {
    display: 'none',
  },
  addBuddyIconTrigger: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint,
  },
  buddyPillTrigger: {
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
  buddyPillTriggerText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textDark,
    flexShrink: 1,
  },
  card: {
    padding: 20,
  },
  buddiesCard: {
    marginBottom: 16,
  },
  hiddenCard: {
    display: 'none',
  },
  buddiesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  splitModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 2,
    marginHorizontal: -8,
    marginBottom: 8,
  },
  splitModeOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  splitModeOptionActive: {
    backgroundColor: '#ffffff',
    boxShadow: '0px 1px 3px rgba(0,0,0,0.15)',
  },
  splitModeOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
  },
  splitModeOptionTextActive: {
    color: colors.primary,
  },
  buddiesTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
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
    color: colors.textDark,
  },
  buddyPaidToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  buddyPaidText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  buddyPaidTextOn: {
    color: '#059669',
  },
  buddyShareAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
  },
  buddiesSummary: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 6,
  },
  buddiesSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  buddiesSummaryLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  buddiesSummaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
  },
  assignColumn: {
    width: 38,
    marginLeft: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 6,
  },
  headerCell: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  itemBlock: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  totalLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    color: colors.white,
    opacity: 0.85,
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.white,
  },
  footer: {
    paddingHorizontal: 24,
    // Explicit white that reaches just above the button, so the solid-primary
    // total strip can't butt straight up against the primary submit button.
    paddingTop: 2,
    paddingBottom: 32,
    backgroundColor: colors.white,
  },
});
