import DateTimePicker from '@react-native-community/datetimepicker';
import {
  ArrowLeftIcon,
  CalendarIcon,
  CaretDownIcon,
  CaretUpIcon,
  CheckSquareIcon,
  InfoIcon,
  CrownIcon,
  PencilSlashIcon,
  SquareIcon,
  StorefrontIcon,
  UserPlusIcon,
  UsersIcon,
  XCircleIcon,
  XIcon,
} from 'phosphor-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToasts } from '../hooks/useToasts';
import { fetchBuddies, type Buddy } from '../lib/buddiesApi';
import { computeBuddyShareFromRows, isSplitByItem } from '../lib/buddyExpenses';
import { categoryIcon, suggestCategory } from '../lib/categories';
import {
  CURRENCIES,
  CURRENCY_SYMBOL,
  formatMoney,
  formatRate,
  invoiceCurrency,
  invoiceRate,
  type Currency,
} from '../lib/currency';
import { fetchEurRates } from '../lib/exchangeRatesApi';
import { toDateLabel, toLocalIsoString } from '../lib/date';
import { formatAmount, formatAmountInput, formatAmountLoose, needsCents, parseAmountInput } from '../lib/formatAmount';
import { useTranslation } from '../lib/i18n';
import type { InvoiceBuddy, InvoiceItem, InvoiceVerificationResult } from '../lib/invoiceApi';
import { AMOUNT_EPSILON, buddyTillPayments } from '../lib/invoicePayments';
import { fetchProjects, type Project } from '../lib/projectsApi';
import { HEADER_INSET, colors, radius } from '../lib/theme';
import { BuddyPicker } from './BuddyPicker';
import { GlassButton } from './GlassButton';
import { GlassTextInput } from './GlassTextInput';
import { GlassView } from './GlassView';
import { ItemAssignPicker } from './ItemAssignPicker';
import { ItemEditorModal, type ItemEditorValue } from './ItemEditorModal';
import { ProjectPicker } from './ProjectPicker';
import { ToastHost } from './ToastHost';
import { UserAvatar } from './UserAvatar';

type ManualInvoiceScreenProps = {
  initialData?: InvoiceVerificationResult;
  isEditing?: boolean;
  isSaving?: boolean;
  isPremium: boolean;
  // The trip under way today, if any. A new invoice starts out filed against
  // it, with its buddies; an invoice being edited keeps what it already has.
  activeTrip?: Project | null;
  // Set for an invoice read from a fiscal QR code: those are issued in lek, so
  // the currency is not offered and a project's currency does not apply.
  lockCurrency?: boolean;
  // The signed-in user, for their own circle in the "paid by" row.
  currentUser?: { id: string; name: string | null; email: string; avatarUrl: string | null } | null;
  onClose: () => void;
  onBack?: () => void;
  onRequirePremium: () => void;
  onSubmit: (result: InvoiceVerificationResult) => void;
};

// How long iOS is given to finish dismissing whatever led to the form before
// the item editor is presented over it.
const IOS_EDITOR_OPEN_DELAY_MS = 600;

// The owner's key among the payers; every other payer goes by their user id.
const OWNER_KEY = 'owner';

// A second tap on the same person within this long is a double tap.
const DOUBLE_TAP_MS = 300;

// How the bill was paid when the form opens. Usually one person paid all of
// it; `split` is set only when the till took money from more than one.
//
// Stored amounts are in lek; `rate` brings them back to the currency the form
// is being filled in.
function initialPayers(
  data: InvoiceVerificationResult | undefined,
  rate: number,
): {
  sole: string;
  split: Record<string, number> | null;
} {
  if (!data) {
    return { sole: OWNER_KEY, split: null };
  }
  const payments = Object.fromEntries(
    Object.entries(buddyTillPayments(data)).map(([buddyId, amount]) => [buddyId, amount / rate]),
  );
  const payers = Object.entries(payments);
  if (payers.length === 0) {
    return { sole: OWNER_KEY, split: null };
  }
  const paidByBuddies = payers.reduce((sum, [, amount]) => sum + amount, 0);
  const totalPrice = data.totalPrice / rate;
  if (payers.length === 1 && paidByBuddies >= totalPrice - AMOUNT_EPSILON) {
    return { sole: payers[0][0], split: null };
  }
  const ownerPart = totalPrice - paidByBuddies;
  return {
    sole: OWNER_KEY,
    split: ownerPart > AMOUNT_EPSILON ? { ...payments, [OWNER_KEY]: ownerPart } : payments,
  };
}

// The item screen owns the name/quantity/price/category half of a row. The
// split across buddies is only reachable from the row itself, so it stays out
// of that screen rather than being silently dropped on save.
type ItemDraft = ItemEditorValue & {
  buddyQuantities: Record<string, number>;
  buddySplitTouched: boolean;
};

// Which row the item screen is open on, or that it is about to add one.
type EditorTarget = { mode: 'new' } | { mode: 'edit'; index: number };

// Prices are stored in lek; `rate` turns them back into what was typed.
function toItemDrafts(items: InvoiceItem[], rate: number): ItemDraft[] {
  return items.map((item) => ({
    name: item.name,
    quantity: String(item.quantity),
    unitPrice: formatAmount(item.unitPriceAfterVat / rate),
    category: item.category ?? suggestCategory(item.name),
    categoryTouched: Boolean(item.category),
    buddyQuantities: item.buddyQuantities ?? {},
    buddySplitTouched: Object.values(item.buddyQuantities ?? {}).some((qty) => qty > 0),
  }));
}

// Who else is on a project, from the point of view of whoever is writing the
// invoice. `buddyIds` is the owner's list - it leaves the owner out and has
// every other member in it, the writer included when they are not the owner.
function otherProjectMembers(project: Project, viewerId: string | undefined): string[] {
  const members = [project.userId, ...project.buddyIds];
  return members.filter((id, index) => id !== viewerId && members.indexOf(id) === index);
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

type PremiumLockProps = {
  locked: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

// Projects and buddies are premium, so on a free account their controls stay
// where they are, dimmed and inert, and a tap goes to the plans screen instead.
// It wraps rather than passing `disabled` down because each of these controls
// owns its own Pressable, which would otherwise take the tap before this one
// ever sees it. Unlocked it renders the control untouched, so nothing about the
// paid layout depends on this being in the tree.
function PremiumLock({ locked, onPress, style, children }: PremiumLockProps) {
  if (!locked) {
    return <>{children}</>;
  }
  return (
    <View style={style}>
      <View pointerEvents="none" style={styles.lockedControl}>
        {children}
      </View>
      <Pressable style={StyleSheet.absoluteFill} onPress={onPress} />
      <View pointerEvents="none" style={styles.lockBadge}>
        <CrownIcon size={9} weight="fill" color={colors.white} />
      </View>
    </View>
  );
}

export function ManualInvoiceScreen({
  initialData,
  isEditing,
  isSaving,
  isPremium,
  activeTrip,
  lockCurrency,
  currentUser,
  onClose,
  onBack,
  onRequirePremium,
  onSubmit,
}: ManualInvoiceScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [sellerName, setSellerName] = useState(initialData?.seller.name ?? '');
  const [invoiceDate, setInvoiceDate] = useState(() =>
    initialData ? new Date(initialData.dateTimeCreated) : new Date(),
  );
  // Android shows its calendar as a dialog opened on demand; iOS keeps its own in the row.
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  // Lek per unit of the currency the invoice was saved in; the stored amounts
  // are divided by it on the way into the form. A prefilled scan is in lek.
  const loadRate = isEditing && initialData ? invoiceRate(initialData) : 1;
  const [items, setItems] = useState<ItemDraft[]>(
    initialData && initialData.items.length > 0 ? toItemDrafts(initialData.items, loadRate) : [],
  );
  // An invoice that opens with no items has nothing to look at yet, so it goes
  // straight to the item screen. Only on mount: emptying the table by removing
  // the last row must not drag the screen back open.
  //
  // On iOS it opens a moment later. The form is often reached straight from
  // the photo picker or the receipt camera, and iOS refuses to present the
  // editor's Modal while one of those is still sliding away - it then never
  // shows, but blocks every touch.
  const opensOnItemEditor = !(initialData && initialData.items.length > 0);
  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(
    opensOnItemEditor && Platform.OS !== 'ios' ? { mode: 'new' } : null,
  );
  useEffect(() => {
    if (!opensOnItemEditor || Platform.OS !== 'ios') {
      return;
    }
    const timer = setTimeout(() => setEditorTarget({ mode: 'new' }), IOS_EDITOR_OPEN_DELAY_MS);
    return () => clearTimeout(timer);
    // Only on mount, as above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const defaultTrip = isEditing ? null : (activeTrip ?? null);
  // A verified invoice came from a fiscal QR code, whenever it is opened.
  const isCurrencyLocked = Boolean(lockCurrency) || initialData?.verified === true;
  // A new invoice that arrives already filled in was read off a receipt - its QR
  // code or a photo of it. What is read that way is an Albanian receipt, in lek,
  // so it starts in lek and does not follow a trip into euros: 227 lek read off
  // the paper must not become 227 euros. Unlike a verified one it can still be
  // switched by hand, for the photo of a receipt from abroad.
  const isReadFromReceipt = Boolean(initialData) && !isEditing;
  // The form is filled in the invoice's own currency throughout - prices,
  // shares, who paid what - and turned into lek only on the way out. An
  // invoice being edited keeps its currency; a new one takes the trip's.
  const [currency, setCurrency] = useState<Currency>(() =>
    isEditing && initialData
      ? invoiceCurrency(initialData)
      : isCurrencyLocked || isReadFromReceipt
        ? 'ALL'
        : (defaultTrip?.currency ?? 'ALL'),
  );
  // Lek per unit, as typed. A saved invoice keeps the rate it was converted
  // at; otherwise the day's rate is fetched until the user types their own.
  const [rateInput, setRateInput] = useState(() =>
    isEditing && initialData && invoiceCurrency(initialData) !== 'ALL' ? formatRate(invoiceRate(initialData)) : '',
  );
  const [isRateTouched, setIsRateTouched] = useState(
    () => Boolean(isEditing && initialData) && invoiceCurrency(initialData as InvoiceVerificationResult) !== 'ALL',
  );
  const [rateStatus, setRateStatus] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [projectId, setProjectId] = useState<string | null>(initialData?.projectId ?? defaultTrip?.id ?? null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedBuddies, setSelectedBuddies] = useState<InvoiceBuddy[]>(
    initialData?.buddies ??
      (initialData?.projectId || !defaultTrip
        ? []
        : otherProjectMembers(defaultTrip, currentUser?.id).map((userId) => ({ userId, paid: false }))),
  );
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  // Who paid at the till. One person covering the whole bill is `solePayer`,
  // which follows the total as items change; `splitPayments` takes over with
  // fixed amounts once the bill was paid by more than one person.
  const [solePayer, setSolePayer] = useState<string>(() => initialPayers(initialData, loadRate).sole);
  const [splitPayments, setSplitPayments] = useState<Record<string, number> | null>(
    () => initialPayers(initialData, loadRate).split,
  );
  // The amount popup, opened by double-tapping a person.
  const [payerEditor, setPayerEditor] = useState<{ key: string; amount: string; isInvalid: boolean } | null>(null);
  const lastPayerTap = useRef<{ key: string; at: number } | null>(null);
  const payerTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Whether the owner has settled what they owe. Only shown, and only saved,
  // while someone else paid part of the bill.
  const [ownerPaid, setOwnerPaid] = useState(initialData?.ownerPaid === true);

  useEffect(
    () => () => {
      if (payerTapTimer.current) {
        clearTimeout(payerTapTimer.current);
      }
    },
    [],
  );
  const [isBuddyPickerOpen, setIsBuddyPickerOpen] = useState(false);
  // The buddies' cards - who paid, and how the bill is shared - are folded away into
  // a pill beside the project until asked for, which keeps a long form short. The
  // one time they open by themselves is when the writer adds the first buddy by
  // hand: that is them asking to share the bill. Buddies a trip brings along with
  // it stay folded.
  const [isBuddiesExpanded, setIsBuddiesExpanded] = useState(false);
  const [isItemSplitEnabled, setIsItemSplitEnabled] = useState(() =>
    Boolean(
      initialData &&
        isSplitByItem(
          initialData.items.map((item) => ({
            quantity: item.quantity,
            unitPrice: item.unitPriceAfterVat,
            buddyQuantities: item.buddyQuantities ?? {},
          })),
          initialData.itemSplit,
        ),
    ),
  );
  const { toasts, showError, dismissToast } = useToasts();

  useEffect(() => {
    fetchProjects()
      .then(setProjects)
      .catch(() => setProjects([]));
    fetchBuddies()
      .then((loaded) => {
        setBuddies(loaded);
        // A new invoice can only be shared with the writer's own buddies. A
        // trip may have people on it who are the owner's buddies and not
        // theirs, so those the trip put forward are dropped once it is known
        // who is who. A saved invoice keeps whoever is on it.
        if (!initialData?.buddies) {
          setSelectedBuddies((current) =>
            current.filter((buddy) => loaded.some((candidate) => candidate.id === buddy.userId)),
          );
        }
      })
      .catch(() => setBuddies([]));
  }, []);

  // The rate follows the invoice's date - the day's rate for a receipt
  // entered a week late is the one from a week ago - until it is typed over.
  const rateDay = toLocalIsoString(invoiceDate).slice(0, 10);
  useEffect(() => {
    if (currency === 'ALL' || isRateTouched) {
      return;
    }
    let isCurrent = true;
    setRateStatus('loading');
    fetchEurRates([rateDay])
      .then((rates) => {
        if (!isCurrent) {
          return;
        }
        const fetched = rates[rateDay];
        setRateStatus(fetched ? 'idle' : 'failed');
        if (fetched) {
          setRateInput(formatRate(fetched));
        }
      })
      .catch(() => {
        if (isCurrent) {
          setRateStatus('failed');
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [currency, isRateTouched, rateDay]);

  const parsedRate = parseAmountInput(rateInput);
  const rate = currency === 'ALL' ? 1 : Number.isFinite(parsedRate) && parsedRate > 0 ? parsedRate : null;

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
  const showCents = needsCents([
    total,
    ...itemRows.flatMap((row) => [row.unitPrice, row.unitPrice * row.quantity]),
  ]);
  const allBuddyIds = selectedBuddies.map((buddy) => buddy.userId);
  const getBuddyShare = (buddyId: string) =>
    computeBuddyShareFromRows(itemRows, buddyId, allBuddyIds, isItemSplitEnabled);
  const buddiesTotal = allBuddyIds.reduce((sum, buddyId) => sum + getBuddyShare(buddyId), 0);
  const groupShare = total - buddiesTotal;

  // "Paid by" belongs to trips, where the group takes turns paying. The trip
  // under way stands in until the project list has loaded.
  const selectedProject =
    projects.find((project) => project.id === projectId) ?? (activeTrip?.id === projectId ? activeTrip : undefined);
  const hasBuddies = selectedBuddies.length > 0;
  const showBuddyCards = hasBuddies && isBuddiesExpanded;
  const showPaidBy = selectedProject?.kind === 'trip' && showBuddyCards;
  // Dropped only when the invoice is known not to be on a trip, so an edit
  // saved before the projects arrive cannot quietly lose who paid.
  const isKnownNonTrip = projectId === null || (selectedProject !== undefined && selectedProject.kind !== 'trip');
  const payerKeys = isKnownNonTrip ? [OWNER_KEY] : [OWNER_KEY, ...allBuddyIds];
  // Amounts held by people no longer on the invoice are dropped rather than
  // left to unbalance the sum.
  const liveSplit = splitPayments
    ? Object.fromEntries(
        Object.entries(splitPayments).filter(([key, amount]) => payerKeys.includes(key) && amount > AMOUNT_EPSILON),
      )
    : null;
  const effectiveSplit = liveSplit && Object.keys(liveSplit).length > 0 ? liveSplit : null;
  const effectiveSole = effectiveSplit ? null : payerKeys.includes(solePayer) ? solePayer : OWNER_KEY;
  const paidAtTill = (key: string) => (effectiveSplit ? (effectiveSplit[key] ?? 0) : key === effectiveSole ? total : 0);
  const buddyPayments = Object.fromEntries(
    allBuddyIds.map((id) => [id, paidAtTill(id)] as const).filter(([, amount]) => amount > AMOUNT_EPSILON),
  );
  const othersPaid = Object.keys(buddyPayments).length > 0;
  const debtOf = (share: number, key: string) => {
    const debt = share - paidAtTill(key);
    return debt > AMOUNT_EPSILON ? debt : 0;
  };
  const ownerDebt = debtOf(groupShare, OWNER_KEY);
  // One answer for the whole split card, so its amounts line up: cents on all
  // of them as soon as any one has some, and on none while they are all whole.
  const splitShowCents = needsCents([
    groupShare,
    ownerDebt,
    buddiesTotal,
    ...allBuddyIds.flatMap((id) => [getBuddyShare(id), debtOf(getBuddyShare(id), id)]),
  ]);

  const payerName = (key: string) => {
    if (key === OWNER_KEY) {
      return t('manualInvoice.you');
    }
    const info = buddies.find((candidate) => candidate.id === key);
    return info?.name ?? info?.email ?? t('manualInvoice.buddyFallback');
  };

  const selectSolePayer = (key: string) => {
    // Having settled up under one arrangement says nothing about another.
    if (effectiveSplit || key !== effectiveSole) {
      setOwnerPaid(false);
    }
    setSolePayer(key);
    setSplitPayments(null);
  };

  const openPayerAmount = (key: string) => {
    const paidByOthers = effectiveSplit
      ? Object.entries(effectiveSplit).reduce((sum, [other, amount]) => (other === key ? sum : sum + amount), 0)
      : 0;
    // The whole bill to begin with; once someone has paid part of it, what
    // is still uncovered.
    const suggested = effectiveSplit ? (effectiveSplit[key] ?? Math.max(0, total - paidByOthers)) : total;
    setPayerEditor({ key, amount: formatAmountLoose(suggested), isInvalid: false });
  };

  // One tap makes that person the only payer, two open the amount popup. The
  // single tap waits out the double-tap window so the first half of a double
  // tap does not wipe the amounts already entered.
  //
  // Once the bill is split there is no single payer to switch to, so one tap
  // goes straight to that person's amount.
  const handlePayerPress = (key: string) => {
    if (effectiveSplit) {
      openPayerAmount(key);
      return;
    }
    const now = Date.now();
    if (payerTapTimer.current) {
      clearTimeout(payerTapTimer.current);
      payerTapTimer.current = null;
    }
    if (lastPayerTap.current && lastPayerTap.current.key === key && now - lastPayerTap.current.at < DOUBLE_TAP_MS) {
      lastPayerTap.current = null;
      openPayerAmount(key);
      return;
    }
    lastPayerTap.current = { key, at: now };
    payerTapTimer.current = setTimeout(() => selectSolePayer(key), DOUBLE_TAP_MS);
  };

  const confirmPayerAmount = () => {
    if (!payerEditor) {
      return;
    }
    const { key } = payerEditor;
    const amount = parseAmountInput(payerEditor.amount);
    if (!Number.isFinite(amount) || amount < 0 || amount > total + AMOUNT_EPSILON) {
      setPayerEditor({ ...payerEditor, isInvalid: true });
      return;
    }
    setPayerEditor(null);
    if (amount >= total - AMOUNT_EPSILON) {
      selectSolePayer(key);
      return;
    }
    // Leaving "one person paid it all": whoever that was keeps the rest,
    // unless it is their own amount being lowered, which leaves it open.
    const next: Record<string, number> = effectiveSplit
      ? { ...effectiveSplit }
      : effectiveSole && effectiveSole !== key
        ? { [effectiveSole]: total - amount }
        : {};
    if (amount > AMOUNT_EPSILON) {
      next[key] = amount;
    } else {
      delete next[key];
    }
    setOwnerPaid(false);
    setSplitPayments(next);
  };

  const toggleBuddy = (buddyId: string) => {
    const isRemoving = selectedBuddies.some((buddy) => buddy.userId === buddyId);
    if (!isRemoving && selectedBuddies.length === 0) {
      setIsBuddiesExpanded(true);
    }
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

  const setItemBuddyQuantities = (index: number, quantities: Record<string, number>) => {
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, buddyQuantities: quantities, buddySplitTouched: true } : item)),
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

  const changeCurrency = (next: Currency) => {
    if (next === currency) {
      return;
    }
    // The figures stay as typed and are read in the new currency: 25 becomes
    // 25 euros, not 25 lek converted. The rate starts over from the day's.
    setCurrency(next);
    setRateInput('');
    setIsRateTouched(false);
    setRateStatus('idle');
  };

  // An invoice on no project is the writer's alone: the buddies go, and with
  // them what each had on a row and anything they were down as having paid.
  const clearProjectAndBuddies = () => {
    setProjectId(null);
    setSelectedBuddies([]);
    setSolePayer(OWNER_KEY);
    setSplitPayments(null);
    setOwnerPaid(false);
    setIsItemSplitEnabled(false);
    setItems((current) => current.map((item) => ({ ...item, buddyQuantities: {}, buddySplitTouched: false })));
  };

  const handleProjectChange = (newProjectId: string | null) => {
    // An invoice not yet saved took its currency from the project, so it goes back to
    // lek when the project is taken off. A saved one stays in what it was written in.
    if (newProjectId === null && !isEditing && !isCurrencyLocked) {
      changeCurrency('ALL');
    }
    if (newProjectId === null && selectedBuddies.length > 0) {
      // On a saved invoice the buddies may already owe or have paid, so that
      // is not undone without asking.
      if (isEditing) {
        Alert.alert(t('manualInvoice.removeProjectTitle'), t('manualInvoice.removeProjectMessage'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('manualInvoice.removeProjectConfirm'), style: 'destructive', onPress: clearProjectAndBuddies },
        ]);
        return;
      }
      clearProjectAndBuddies();
      return;
    }
    setProjectId(newProjectId);
    const project = projects.find((candidate) => candidate.id === newProjectId);
    // The project's currency is where a new invoice starts. One already saved
    // was written in what it was written in, whichever project it moves to.
    if (project && !isEditing && !isCurrencyLocked && !isReadFromReceipt) {
      changeCurrency(project.currency ?? 'ALL');
    }
    if (!project) {
      return;
    }
    // Only those of its members the writer can share an invoice with.
    const members = otherProjectMembers(project, currentUser?.id).filter((memberId) =>
      buddies.some((candidate) => candidate.id === memberId),
    );
    setSelectedBuddies((current) => {
      const missing = members
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

  const handleEditorSave = (value: ItemEditorValue) => {
    if (editorTarget?.mode === 'edit') {
      updateItem(editorTarget.index, value);
    } else {
      setItems((current) => {
        const draft: ItemDraft = { ...value, buddyQuantities: {}, buddySplitTouched: false };
        if (isItemSplitEnabled && selectedBuddies.length > 0) {
          const quantity = Number(draft.quantity);
          draft.buddyQuantities = defaultBuddyQuantities(
            Number.isFinite(quantity) ? quantity : 0,
            selectedBuddies.map((buddy) => buddy.userId),
          );
        }
        return [...current, draft];
      });
    }
    setEditorTarget(null);
  };

  const removeItem = (index: number) => {
    setItems((current) => current.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    // The day, with no time of day: the picker hands back the moment it was opened at,
    // and an invoice is dated by its day.
    const date = new Date(invoiceDate.getFullYear(), invoiceDate.getMonth(), invoiceDate.getDate());

    if (items.length === 0) {
      showError(t('manualInvoice.noItems'));
      return;
    }

    if (rate === null) {
      showError(t('manualInvoice.rateRequired'));
      return;
    }

    // Typed in the invoice's currency, stored in lek.
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
        unitPriceBeforeVat: unitPrice * rate,
        unitPriceAfterVat: unitPrice * rate,
        category: item.category,
        buddyQuantities: item.buddyQuantities,
      });
    }

    if (effectiveSplit) {
      const uncovered = total - Object.values(effectiveSplit).reduce((sum, amount) => sum + amount, 0);
      if (Math.abs(uncovered) > AMOUNT_EPSILON) {
        showError(
          t(uncovered > 0 ? 'manualInvoice.paymentsShort' : 'manualInvoice.paymentsOver', {
            amount: formatMoney(Math.abs(uncovered), currency),
          }),
        );
        return;
      }
    }

    onSubmit({
      iic: isEditing && initialData ? initialData.iic : `MANUAL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      dateTimeCreated: toLocalIsoString(date),
      totalPrice: parsedItems.reduce((sum, item) => sum + item.unitPriceAfterVat * item.quantity, 0),
      seller: { name: sellerName.trim() },
      items: parsedItems,
      projectId,
      buddies: selectedBuddies,
      currency: currency === 'ALL' ? null : currency,
      exchangeRate: currency === 'ALL' ? null : rate,
      payments: othersPaid
        ? Object.fromEntries(Object.entries(buddyPayments).map(([buddyId, amount]) => [buddyId, amount * rate]))
        : null,
      paidBy: null,
      ownerPaid: othersPaid && ownerPaid,
      itemSplit: isItemSplitEnabled && selectedBuddies.length > 0,
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

        {Platform.OS === 'ios' ? (
          // Apple's own date control: a small button that opens its calendar.
          <View style={[styles.dateTrigger, styles.dateTriggerIos]}>
            <CalendarIcon size={18} color={colors.textMuted} />
            <DateTimePicker
              value={invoiceDate}
              mode="date"
              display="compact"
              accentColor={colors.primary}
              onChange={(_event, selected) => {
                if (selected) {
                  setInvoiceDate(selected);
                }
              }}
            />
          </View>
        ) : (
          <>
            <Pressable style={styles.dateTrigger} onPress={() => setIsDatePickerOpen(true)}>
              <CalendarIcon size={18} color={colors.textMuted} />
              <Text style={styles.dateText}>{toDateLabel(invoiceDate)}</Text>
            </Pressable>
            {isDatePickerOpen && (
              <DateTimePicker
                value={invoiceDate}
                mode="date"
                display="default"
                onChange={(event, selected) => {
                  setIsDatePickerOpen(false);
                  if (event.type === 'set' && selected) {
                    setInvoiceDate(selected);
                  }
                }}
              />
            )}
          </>
        )}
        <View style={styles.input}>
          <GlassTextInput
            style={styles.sellerInput}
            placeholder={t('manualInvoice.sellerPlaceholder')}
            value={sellerName}
            onChangeText={setSellerName}
          />
          <View style={styles.sellerIcon} pointerEvents="none">
            <StorefrontIcon size={18} color={colors.textMuted} />
          </View>
        </View>

        {/* With the buddies' cards open the project has the row to itself, as wide as
            the fields above it. With them folded away - or with no buddies yet - it is
            a pill, and the buddies sit beside it as another. */}
        <View style={styles.pickersRow}>
          <View style={styles.pickerSlot}>
            <PremiumLock
              locked={!isPremium}
              onPress={onRequirePremium}
            >
              <ProjectPicker
                projects={projects}
                value={projectId}
                onChange={handleProjectChange}
                variant={showBuddyCards ? 'field' : 'wide-pill'}
              />
            </PremiumLock>
          </View>
          {/* Just a trigger button here (no Modal inside), so hiding it via style when
              the cards are open can't suppress repaints for the shared modal below. */}
          <View style={[styles.pickerSlot, showBuddyCards && styles.hiddenSlot]}>
            {hasBuddies ? (
              <Pressable
                style={styles.buddyPillTrigger}
                onPress={() => setIsBuddiesExpanded(true)}
                accessibilityRole="button"
                accessibilityState={{ expanded: false }}
              >
                <View style={styles.buddyStack}>
                  {selectedBuddies.slice(0, 3).map((buddy, index) => (
                    <View key={buddy.userId} style={index > 0 && styles.buddyStackOverlap}>
                      <UserAvatar
                        user={buddies.find((candidate) => candidate.id === buddy.userId) ?? null}
                        size={20}
                      />
                    </View>
                  ))}
                </View>
                <Text style={styles.buddyPillTriggerText} numberOfLines={1}>
                  {t(selectedBuddies.length === 1 ? 'manualInvoice.buddiesFoldedOne' : 'manualInvoice.buddiesFolded', {
                    count: selectedBuddies.length,
                  })}
                </Text>
                <CaretDownIcon size={12} color="#6b7280" />
              </Pressable>
            ) : (
              <PremiumLock locked={!isPremium} onPress={onRequirePremium}>
                <Pressable style={styles.buddyPillTrigger} onPress={() => setIsBuddyPickerOpen(true)}>
                  <UsersIcon size={14} color="#374151" />
                  <Text style={styles.buddyPillTriggerText} numberOfLines={1}>
                    {t('buddyPicker.addBuddy')}
                  </Text>
                  <CaretDownIcon size={12} color="#6b7280" />
                </Pressable>
              </PremiumLock>
            )}
          </View>
        </View>

        {/* Open, the buddies' cards sit inside one outlined box with the heading that
            folds them away, so they read as a single section that can be closed. The
            box itself is never hidden - it holds the picker's Modal (see below). */}
        <View style={showBuddyCards && styles.buddiesSection}>
        {showBuddyCards && (
          <Pressable
            style={styles.buddiesSectionHeader}
            onPress={() => setIsBuddiesExpanded(false)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityState={{ expanded: true }}
          >
            <UsersIcon size={16} weight="fill" color={colors.primary} />
            <Text style={styles.buddiesSectionTitle} numberOfLines={1}>
              {t('buddyPicker.title')}
            </Text>
            <View style={styles.buddiesSectionClose}>
              <Text style={styles.buddiesSectionCloseText}>{t('manualInvoice.buddiesHide')}</Text>
              <CaretUpIcon size={12} weight="bold" color={colors.primary} />
            </View>
          </Pressable>
        )}

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

        {/* Its own card, above the split: who paid comes before how it is shared. */}
        {showPaidBy && (
          <GlassView style={[styles.card, styles.buddiesCard, styles.paidBySection]}>
            <Text style={styles.paidByLabel}>{t('manualInvoice.paidBy')}</Text>
            <View style={styles.paidByRow}>
              {payerKeys.map((key) => {
                const info = key === OWNER_KEY ? null : buddies.find((candidate) => candidate.id === key);
                const paid = paidAtTill(key);
                const isSelected = paid > AMOUNT_EPSILON;
                return (
                  <Pressable
                    key={key}
                    style={styles.paidByPerson}
                    onPress={() => handlePayerPress(key)}
                    onLongPress={() => openPayerAmount(key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <View style={[styles.paidByRing, isSelected && styles.paidByRingSelected]}>
                      <UserAvatar user={key === OWNER_KEY ? (currentUser ?? null) : (info ?? null)} size={36} />
                    </View>
                    <Text style={[styles.paidByName, isSelected && styles.paidByNameSelected]} numberOfLines={1}>
                      {payerName(key).split(/[\s@]/)[0]}
                    </Text>
                    {/* Amounts only once the bill is split - one payer paid all of it. */}
                    {effectiveSplit && isSelected && (
                      <Text style={styles.paidByAmount} numberOfLines={1}>
                        {formatAmount(paid, showCents)}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.paidByHint}>{t('manualInvoice.paidByHint')}</Text>
          </GlassView>
        )}

        <GlassView
          style={[styles.card, styles.buddiesCard, !showBuddyCards && styles.hiddenCard]}
        >
          <View style={styles.buddiesHeader}>
              <Text style={styles.buddiesTitle}>{t('manualInvoice.buddiesTitle')}</Text>
              <PremiumLock locked={!isPremium} onPress={onRequirePremium}>
                <Pressable
                  style={styles.addBuddyIconTrigger}
                  onPress={() => setIsBuddyPickerOpen(true)}
                  hitSlop={8}
                >
                  <UserPlusIcon size={16} color={colors.primary} />
                </Pressable>
              </PremiumLock>
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
            {/* When buddies paid, the owner may owe too, so they get a row of their
                own to tick off - without the cross, since they cannot be removed. */}
            {othersPaid && (
              <View style={styles.buddyRow}>
                <View style={styles.ownerRowSpacer} />
                <Pressable
                  style={styles.buddyRowMain}
                  onPress={() => setOwnerPaid((current) => !current)}
                  disabled={ownerDebt === 0}
                >
                  <UserAvatar user={currentUser ?? null} size={28} />
                  <Text style={styles.buddyName} numberOfLines={1}>
                    {t('manualInvoice.you')}
                  </Text>
                  <Text style={styles.buddyShareAmount}>{formatAmount(ownerDebt > 0 ? ownerDebt : groupShare, splitShowCents)}</Text>
                  {ownerDebt === 0 ? (
                    <Text style={[styles.buddyPaidText, styles.buddyPayerText]}>{t('manualInvoice.payer')}</Text>
                  ) : (
                    <View style={styles.buddyPaidToggle}>
                      {ownerPaid ? (
                        <CheckSquareIcon size={20} weight="fill" color="#10b981" />
                      ) : (
                        <SquareIcon size={20} color="#9ca3af" />
                      )}
                      <Text style={[styles.buddyPaidText, ownerPaid && styles.buddyPaidTextOn]}>
                        {t('manualInvoice.paid')}
                      </Text>
                    </View>
                  )}
                </Pressable>
              </View>
            )}
            {selectedBuddies.map((buddy) => {
              const info = buddies.find((candidate) => candidate.id === buddy.userId);
              // Paying at the till counts against the share: someone who covered
              // theirs has nothing to pay back, someone who covered part owes the rest.
              const buddyShare = getBuddyShare(buddy.userId);
              // Less anything already balanced away against the owner's own debts.
              const buddyDebt = Math.max(0, debtOf(buddyShare, buddy.userId) - (buddy.settled ?? 0));
              const isPayer = paidAtTill(buddy.userId) > AMOUNT_EPSILON && buddyDebt === 0;
              return (
                <View key={buddy.userId} style={styles.buddyRow}>
                  <Pressable onPress={() => toggleBuddy(buddy.userId)} hitSlop={8}>
                    <XIcon size={18} color="#9ca3af" />
                  </Pressable>
                  <Pressable
                    style={styles.buddyRowMain}
                    onPress={() => setBuddyPaid(buddy.userId, !buddy.paid)}
                    disabled={isPayer}
                  >
                    <UserAvatar user={info ?? null} size={28} />
                    <Text style={styles.buddyName} numberOfLines={1}>
                      {info?.name ?? info?.email ?? t('manualInvoice.buddyFallback')}
                    </Text>
                    <Text style={styles.buddyShareAmount}>{formatAmount(buddyDebt > 0 ? buddyDebt : buddyShare, splitShowCents)}</Text>
                    {isPayer ? (
                      <Text style={[styles.buddyPaidText, styles.buddyPayerText]}>{t('manualInvoice.payer')}</Text>
                    ) : (
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
                    )}
                  </Pressable>
                </View>
              );
            })}
            {isItemSplitEnabled && selectedBuddies.length > 0 && (
              <View style={styles.itemSplitHint}>
                <InfoIcon size={14} color={colors.textMuted} />
                <Text style={styles.itemSplitHintText}>{t('manualInvoice.itemSplitHint')}</Text>
              </View>
            )}
            {selectedBuddies.length > 0 && (
              <View style={styles.buddiesSummary}>
                <View style={styles.buddiesSummaryRow}>
                  <Text style={styles.buddiesSummaryLabel}>{t('manualInvoice.buddiesTotal')}</Text>
                  <Text style={styles.buddiesSummaryValue}>{formatAmount(buddiesTotal, splitShowCents)}</Text>
                </View>
                <View style={styles.buddiesSummaryRow}>
                  <Text style={styles.buddiesSummaryLabel}>{t('manualInvoice.groupShare')}</Text>
                  <Text style={styles.buddiesSummaryValue}>{formatAmount(groupShare, splitShowCents)}</Text>
                </View>
              </View>
            )}
        </GlassView>
        </View>

        <GlassView style={styles.card}>
          <View style={styles.itemsHeader}>
            <Text style={[styles.headerCell, styles.nameColumn]}>{t('manualInvoice.itemColumn')}</Text>
            <Text style={[styles.headerCell, styles.qtyColumn]}>{t('manualInvoice.quantityColumn')}</Text>
            <Text style={[styles.headerCell, styles.priceColumn]}>{t('manualInvoice.priceColumn')}</Text>
            <Text style={[styles.headerCell, styles.priceColumn]}>{t('manualInvoice.totalColumn')}</Text>
            {isItemSplitEnabled && selectedBuddies.length > 0 && <View style={styles.assignColumn} />}
            <View style={styles.removeColumn} />
          </View>

          {items.length === 0 ? (
            <Text style={styles.emptyItems}>{t('manualInvoice.emptyItems')}</Text>
          ) : (
            items.map((item, index) => {
              const ItemCategoryIcon = categoryIcon(item.category);
              const rowQuantity = Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 0;
              const rowUnitPrice = Number.isFinite(parseAmountInput(item.unitPrice))
                ? parseAmountInput(item.unitPrice)
                : 0;
              return (
                // Read-only row: the whole thing is the way into the item screen,
                // so nothing here competes with that press except the two controls
                // that open something of their own.
                <Pressable
                  key={index}
                  style={({ pressed }) => [styles.itemBlock, pressed && styles.itemBlockPressed]}
                  onPress={() => setEditorTarget({ mode: 'edit', index })}
                >
                  <View style={styles.itemRow}>
                    <View style={[styles.nameColumn, styles.nameCell]}>
                      <ItemCategoryIcon size={18} color={colors.primary} />
                      <Text style={styles.nameText} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </View>
                    <Text style={[styles.cellText, styles.qtyColumn]}>{item.quantity}</Text>
                    <Text style={[styles.cellText, styles.priceColumn]}>
                      {formatAmount(rowUnitPrice, showCents)}
                    </Text>
                    <Text style={[styles.cellText, styles.priceColumn]}>
                      {formatAmount(rowUnitPrice * rowQuantity, showCents)}
                    </Text>
                    {isItemSplitEnabled && selectedBuddies.length > 0 && (
                      <View style={styles.assignColumn}>
                        <ItemAssignPicker
                          buddies={selectedBuddies
                            .map((buddy) => buddies.find((candidate) => candidate.id === buddy.userId))
                            .filter((buddy): buddy is Buddy => Boolean(buddy))}
                          rowQuantity={rowQuantity}
                          unitPrice={rowUnitPrice}
                          buddyQuantities={item.buddyQuantities}
                          onQuantityChange={(buddyId, quantity) => setItemBuddyQuantity(index, buddyId, quantity)}
                          onQuantitiesChange={(quantities) => setItemBuddyQuantities(index, quantities)}
                        />
                      </View>
                    )}
                    <Pressable style={styles.removeColumn} onPress={() => removeItem(index)} hitSlop={8}>
                      <XCircleIcon size={18} weight="fill" color="#dc2626" />
                    </Pressable>
                  </View>
                </Pressable>
              );
            })
          )}

          <Pressable onPress={() => setEditorTarget({ mode: 'new' })} style={styles.addItemButton}>
            <Text style={styles.addItemText}>{t('manualInvoice.addItem')}</Text>
          </Pressable>

          {items.length > 0 && <Text style={styles.tapToEdit}>{t('manualInvoice.tapToEdit')}</Text>}

          <View style={styles.totalBox}>
            <View style={styles.totalRow}>
              <View style={styles.totalLead}>
                <Text style={styles.totalLabel}>{t('manualInvoice.total')}</Text>
                {!isCurrencyLocked && (
                  <View style={styles.currencySwitch}>
                    {CURRENCIES.map((option) => {
                      const isSelected = currency === option;
                      return (
                        <Pressable
                          key={option}
                          style={[styles.currencyOption, isSelected && styles.currencyOptionSelected]}
                          onPress={() => changeCurrency(option)}
                          hitSlop={4}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                        >
                          <Text style={[styles.currencyText, isSelected && styles.currencyTextSelected]}>
                            {CURRENCY_SYMBOL[option]}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
              <Text style={styles.totalValue}>{formatMoney(total, currency, showCents)}</Text>
            </View>
            {/* What it comes to in lek, and the rate that says so - the day's
                unless typed over. */}
            {currency !== 'ALL' && (
              <View style={styles.totalConversionRow}>
                <View style={styles.rateEditor}>
                  <Text style={styles.rateText}>
                    {t('manualInvoice.rateLabel', { symbol: CURRENCY_SYMBOL[currency] })}
                  </Text>
                  <TextInput
                    style={styles.rateInput}
                    value={rateInput}
                    onChangeText={(value) => {
                      setIsRateTouched(true);
                      setRateStatus('idle');
                      setRateInput(formatAmountInput(value));
                    }}
                    keyboardType="numeric"
                    selectTextOnFocus
                    placeholder="0"
                    placeholderTextColor="rgba(255,255,255,0.5)"
                  />
                  <Text style={styles.rateText}>{CURRENCY_SYMBOL.ALL}</Text>
                </View>
                <Text style={styles.totalConverted} numberOfLines={1}>
                  {rate !== null
                    ? `= ${formatAmount(total * rate, needsCents([total * rate]))} ${CURRENCY_SYMBOL.ALL}`
                    : rateStatus === 'loading'
                      ? t('manualInvoice.rateLoading')
                      : t('manualInvoice.rateUnavailable')}
                </Text>
              </View>
            )}
          </View>
        </GlassView>
      </KeyboardAwareScrollView>

      <View style={[styles.footer, { paddingBottom: 32 + insets.bottom }]}>
        <GlassButton
          label={isSaving ? t('common.saving') : isEditing ? t('manualInvoice.saveChanges') : t('common.save')}
          variant="accent"
          onPress={handleSubmit}
          disabled={isSaving}
        />
      </View>
      </View>

      <Modal
        visible={payerEditor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPayerEditor(null)}
      >
        <Pressable style={styles.payerBackdrop} onPress={() => setPayerEditor(null)}>
          <Pressable style={styles.payerCard} onPress={(event) => event.stopPropagation()}>
            {payerEditor &&
              (() => {
                const paidByOthers = effectiveSplit
                  ? Object.entries(effectiveSplit).reduce(
                      (sum, [other, amount]) => (other === payerEditor.key ? sum : sum + amount),
                      0,
                    )
                  : 0;
                const remaining = Math.max(0, total - paidByOthers);
                // The three figures sit in a column, so they keep or drop cents together.
                const popupShowCents = needsCents([total, paidByOthers, remaining]);
                return (
                  <>
                    <Text style={styles.payerTitle}>
                      {payerEditor.key === OWNER_KEY
                        ? t('manualInvoice.paidAmountTitleSelf')
                        : t('manualInvoice.paidAmountTitle', { name: payerName(payerEditor.key) })}
                    </Text>
                    <GlassTextInput
                      keyboardType="numeric"
                      autoFocus
                      selectTextOnFocus
                      value={payerEditor.amount}
                      onChangeText={(value) =>
                        setPayerEditor({ ...payerEditor, amount: formatAmountInput(value), isInvalid: false })
                      }
                      onSubmitEditing={confirmPayerAmount}
                    />
                    {payerEditor.isInvalid && (
                      <Text style={styles.payerError}>{t('manualInvoice.paidAmountInvalid')}</Text>
                    )}
                    <View style={styles.payerInfoRow}>
                      <Text style={styles.payerInfoLabel}>{t('manualInvoice.paidAmountTotal')}</Text>
                      <Text style={styles.payerInfoValue}>{formatAmount(total, popupShowCents)}</Text>
                    </View>
                    {/* Once someone else has paid part of it, what is left to cover. */}
                    {paidByOthers > AMOUNT_EPSILON && (
                      <>
                        <View style={styles.payerInfoRow}>
                          <Text style={styles.payerInfoLabel}>{t('manualInvoice.paidAmountOthers')}</Text>
                          <Text style={styles.payerInfoValue}>{formatAmount(paidByOthers, popupShowCents)}</Text>
                        </View>
                        <View style={styles.payerInfoRow}>
                          <Text style={styles.payerInfoLabel}>{t('manualInvoice.paidAmountRemaining')}</Text>
                          <Text style={[styles.payerInfoValue, styles.payerRemainingValue]}>
                            {formatAmount(remaining, popupShowCents)}
                          </Text>
                        </View>
                      </>
                    )}
                    <GlassButton label={t('common.save')} variant="accent" onPress={confirmPayerAmount} />
                    <Pressable onPress={() => setPayerEditor(null)}>
                      <Text style={styles.payerCancel}>{t('common.cancel')}</Text>
                    </Pressable>
                  </>
                );
              })()}
          </Pressable>
        </Pressable>
      </Modal>

      <ItemEditorModal
        visible={editorTarget !== null}
        initialValue={editorTarget?.mode === 'edit' ? items[editorTarget.index] : null}
        onCancel={() => setEditorTarget(null)}
        onSave={handleEditorSave}
      />

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
  // Room on the left for the shop icon, which is laid over the field.
  sellerInput: {
    paddingLeft: 44,
  },
  sellerIcon: {
    position: 'absolute',
    left: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  dateTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.primaryTint,
  },
  dateTriggerIos: {
    paddingVertical: 7,
  },
  dateText: {
    fontSize: 16,
    color: colors.textDark,
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
  lockedControl: {
    opacity: 0.5,
  },
  lockBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 15,
    height: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  addBuddyIconTrigger: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint,
  },
  // Fills its half of the row, the label taking the slack so the arrow sits at the
  // far end.
  buddyPillTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    boxShadow: '0px 1px 3px rgba(0,0,0,0.15)',
    maxWidth: '100%',
  },
  buddyPillTriggerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textDark,
  },
  card: {
    padding: 20,
  },
  buddiesCard: {
    marginBottom: 16,
  },
  buddyStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buddyStackOverlap: {
    marginLeft: -7,
  },
  buddiesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  buddiesSectionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.textDark,
  },
  buddiesSection: {
    marginBottom: 16,
    paddingTop: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sheet,
    backgroundColor: colors.primaryTint,
  },
  buddiesSectionClose: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  buddiesSectionCloseText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    textDecorationLine: 'underline',
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
  buddyPayerText: {
    color: colors.primary,
  },
  // Stands where a buddy row has its remove cross, so the columns line up.
  ownerRowSpacer: {
    width: 18,
  },
  paidBySection: {
    gap: 12,
  },
  paidByLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  paidByRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  paidByPerson: {
    width: 52,
    alignItems: 'center',
    gap: 4,
  },
  // The ring is always there so choosing someone does not shift the row; only
  // its colour and the glow change.
  paidByRing: {
    padding: 2,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'transparent',
    opacity: 0.55,
  },
  paidByRingSelected: {
    borderColor: colors.primary,
    opacity: 1,
    boxShadow: '0px 0px 10px rgba(89,128,166,0.65)',
  },
  paidByName: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
  },
  paidByNameSelected: {
    color: colors.primary,
  },
  paidByAmount: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  paidByHint: {
    fontSize: 11,
    color: colors.textMuted,
  },
  itemSplitHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 10,
  },
  itemSplitHintText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  payerBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.scrim,
  },
  payerCard: {
    width: '82%',
    padding: 24,
    borderRadius: 20,
    backgroundColor: colors.white,
    gap: 12,
  },
  payerTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    color: colors.textDark,
  },
  payerInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  payerInfoLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  payerInfoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
  },
  payerRemainingValue: {
    color: colors.primary,
  },
  payerError: {
    fontSize: 12,
    color: colors.danger,
  },
  payerCancel: {
    textAlign: 'center',
    color: colors.textMuted,
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
  itemBlockPressed: {
    opacity: 0.6,
  },
  // The category's icon, then the name beside it.
  nameCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
  },
  cellText: {
    fontSize: 14,
    color: colors.textDark,
  },
  emptyItems: {
    paddingVertical: 18,
    textAlign: 'center',
    fontSize: 13,
    color: colors.textMuted,
  },
  tapToEdit: {
    textAlign: 'center',
    fontSize: 11,
    color: colors.textMuted,
  },
  nameColumn: {
    flex: 2.4,
  },
  qtyColumn: {
    flex: 0.8,
    textAlign: 'right',
  },
  // Two money columns now, so they read like the ones on the invoice detail:
  // right aligned, and narrow enough that the name still has room.
  priceColumn: {
    flex: 1.3,
    textAlign: 'right',
  },
  removeColumn: {
    width: 20,
    marginLeft: 8,
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
  totalBox: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    gap: 8,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  currencySwitch: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  currencyOption: {
    minWidth: 30,
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  currencyOptionSelected: {
    backgroundColor: colors.white,
  },
  currencyText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  currencyTextSelected: {
    color: colors.primary,
  },
  totalConversionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.25)',
  },
  rateEditor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rateText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
    opacity: 0.85,
  },
  rateInput: {
    minWidth: 58,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.white,
  },
  totalConverted: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
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
