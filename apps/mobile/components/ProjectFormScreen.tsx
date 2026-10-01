import DateTimePicker from '@react-native-community/datetimepicker';
import { ArrowLeftIcon, CalendarIcon, PencilSlashIcon, XCircleIcon, XIcon } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToasts } from '../hooks/useToasts';
import { fetchBuddies, type Buddy } from '../lib/buddiesApi';
import { CURRENCIES, CURRENCY_SYMBOL, type Currency } from '../lib/currency';
import { toDateLabel, toLocalIsoString } from '../lib/date';
import { formatAmountInput, formatAmountLoose, parseAmountInput } from '../lib/formatAmount';
import { useTranslation } from '../lib/i18n';
import { createProject, deleteProject, updateProject, type Project, type ProjectKind } from '../lib/projectsApi';
import { HEADER_INSET, colors, radius } from '../lib/theme';
import { BuddyPicker } from './BuddyPicker';
import { GlassButton } from './GlassButton';
import { GlassTextInput } from './GlassTextInput';
import { ToastHost } from './ToastHost';

type ProjectFormScreenProps = {
  // The project being changed, or null to add a new one.
  project: Project | null;
  // Leaves without saving.
  onClose: () => void;
  // Called once the project has been saved, with how it now stands, or
  // deleted, with null.
  onDone: (saved: Project | null) => void;
};

type FormState = {
  name: string;
  details: string;
  budget: string;
  kind: ProjectKind;
  currency: Currency;
  startDate: Date | null;
  endDate: Date | null;
  buddyIds: string[];
};

function initialForm(project: Project | null): FormState {
  if (!project) {
    return {
      name: '',
      details: '',
      budget: '',
      kind: 'project',
      currency: 'ALL',
      startDate: null,
      endDate: null,
      buddyIds: [],
    };
  }
  return {
    name: project.name,
    details: project.details ?? '',
    budget: formatAmountLoose(project.budget),
    kind: project.kind === 'trip' ? 'trip' : 'project',
    currency: project.currency === 'EUR' ? 'EUR' : 'ALL',
    startDate: project.startDate ? new Date(project.startDate) : null,
    endDate: project.endDate ? new Date(project.endDate) : null,
    buddyIds: project.buddyIds,
  };
}

const KINDS: { key: ProjectKind; labelKey: 'projects.kindProject' | 'projects.kindTrip' }[] = [
  { key: 'project', labelKey: 'projects.kindProject' },
  { key: 'trip', labelKey: 'projects.kindTrip' },
];

// Dates are stored as YYYY-MM-DD, which also compare correctly as strings.
function toDateOnly(date: Date): string {
  return toLocalIsoString(date).slice(0, 10);
}

// Adding or changing a project, on a screen of its own: kind, currency, dates
// and buddies had outgrown the popup this used to be.
export function ProjectFormScreen({ project, onClose, onDone }: ProjectFormScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<FormState>(() => initialForm(project));
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // Which of the two dates the picker is open for, if any.
  const [datePickerField, setDatePickerField] = useState<'startDate' | 'endDate' | null>(null);
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const { toasts, showError, dismissToast } = useToasts();

  const isBusy = isSaving || isDeleting;
  const isTrip = form.kind === 'trip';

  useEffect(() => {
    fetchBuddies()
      .then(setBuddies)
      .catch(() => setBuddies([]));
  }, []);

  const toggleBuddy = (buddyId: string) => {
    setForm((current) => ({
      ...current,
      buddyIds: current.buddyIds.includes(buddyId)
        ? current.buddyIds.filter((id) => id !== buddyId)
        : [...current.buddyIds, buddyId],
    }));
  };

  const handleSubmit = () => {
    const budget = parseAmountInput(form.budget);
    if (!form.name.trim()) {
      showError(t('projects.nameRequired'));
      return;
    }
    if (!Number.isFinite(budget) || budget < 0) {
      showError(t('projects.invalidBudget'));
      return;
    }
    const startDate = isTrip && form.startDate ? toDateOnly(form.startDate) : null;
    const endDate = form.endDate ? toDateOnly(form.endDate) : null;
    if (isTrip && (!startDate || !endDate)) {
      showError(t('projects.tripDatesRequired'));
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      showError(t('projects.endBeforeStart'));
      return;
    }

    setIsSaving(true);
    const payload = {
      name: form.name.trim(),
      details: form.details.trim() || null,
      budget,
      kind: form.kind,
      currency: form.currency,
      startDate,
      endDate,
      buddyIds: form.buddyIds,
    };
    const request = project ? updateProject(project.id, payload) : createProject(payload);
    request
      .then((saved) => {
        setIsSaving(false);
        onDone(saved);
      })
      .catch((error: Error) => {
        setIsSaving(false);
        showError(error.message);
      });
  };

  // Behind a confirmation, and only here: a bin on the project's card sat one
  // stray tap away from losing it, with nothing asking first.
  const handleDelete = () => {
    if (!project) {
      return;
    }
    Alert.alert(t('projects.deleteTitle', { name: form.name.trim() || project.name }), t('projects.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          setIsDeleting(true);
          deleteProject(project.id)
            .then(() => {
              setIsDeleting(false);
              onDone(null);
            })
            .catch((error: Error) => {
              setIsDeleting(false);
              showError(error.message);
            });
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        {/* Back and the cross both leave without saving. */}
        <Pressable onPress={onClose} style={styles.iconButton} hitSlop={10}>
          <ArrowLeftIcon size={18} color={colors.primary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {project ? t('projects.editProject') : t('projects.addProject')}
        </Text>
        {/* A struck-through pencil when editing, as on the invoice form: a
            cross next to an existing project reads as deleting it. */}
        <Pressable onPress={onClose} style={styles.iconButton} hitSlop={10}>
          {project ? (
            <PencilSlashIcon size={18} color={colors.primary} />
          ) : (
            <XIcon size={18} color={colors.primary} weight="bold" />
          )}
        </Pressable>
      </View>

      <View style={styles.sheet}>
        <KeyboardAwareScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 32 + insets.bottom }]}
          bottomOffset={20}
        >
          <View style={styles.field}>
            <Text style={styles.label}>{t('projects.kindLabel')}</Text>
            <View style={styles.segmented}>
              {KINDS.map((kind) => {
                const isSelected = form.kind === kind.key;
                return (
                  <Pressable
                    key={kind.key}
                    style={[styles.segment, isSelected && styles.segmentSelected]}
                    onPress={() => setForm((current) => ({ ...current, kind: kind.key }))}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text style={[styles.segmentText, isSelected && styles.segmentTextSelected]}>
                      {t(kind.labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('projects.nameLabel')}</Text>
            <GlassTextInput
              placeholder={t('projects.namePlaceholder')}
              value={form.name}
              onChangeText={(value) => setForm((current) => ({ ...current, name: value }))}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('projects.detailsLabel')}</Text>
            <GlassTextInput
              style={styles.detailsInput}
              placeholder={t('projects.detailsPlaceholder')}
              multiline
              value={form.details}
              onChangeText={(value) => setForm((current) => ({ ...current, details: value }))}
            />
          </View>

          {/* The budget is counted in the currency above it, and a new invoice
              filed against the project starts out in it. */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('projects.currency')}</Text>
            <View style={styles.segmented}>
              {CURRENCIES.map((currency) => {
                const isSelected = form.currency === currency;
                return (
                  <Pressable
                    key={currency}
                    style={[styles.segment, isSelected && styles.segmentSelected]}
                    onPress={() => setForm((current) => ({ ...current, currency }))}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text style={[styles.segmentText, isSelected && styles.segmentTextSelected]}>
                      {CURRENCY_SYMBOL[currency]} · {t(`currency.${currency}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              {t('projects.budget')} ({CURRENCY_SYMBOL[form.currency]})
            </Text>
            <GlassTextInput
              placeholder={t('projects.budgetPlaceholder')}
              keyboardType="numeric"
              value={form.budget}
              onChangeText={(value) => setForm((current) => ({ ...current, budget: formatAmountInput(value) }))}
            />
          </View>

          {/* A trip has both dates and needs both; a project only an optional end. */}
          <View style={styles.field}>
            <Text style={styles.label}>{t(isTrip ? 'projects.dates' : 'projects.endDate')}</Text>
            <View style={styles.dateRow}>
              {isTrip && (
                <Pressable style={styles.dateTrigger} onPress={() => setDatePickerField('startDate')}>
                  <CalendarIcon size={16} color={colors.textMuted} />
                  <Text style={form.startDate ? styles.dateText : styles.datePlaceholder} numberOfLines={1}>
                    {form.startDate ? toDateLabel(form.startDate) : t('projects.startDatePlaceholder')}
                  </Text>
                </Pressable>
              )}
              <Pressable style={styles.dateTrigger} onPress={() => setDatePickerField('endDate')}>
                <CalendarIcon size={16} color={colors.textMuted} />
                <Text style={form.endDate ? styles.dateText : styles.datePlaceholder} numberOfLines={1}>
                  {form.endDate
                    ? toDateLabel(form.endDate)
                    : t(isTrip ? 'projects.tripEndDatePlaceholder' : 'projects.endDatePlaceholder')}
                </Text>
              </Pressable>
              {form.endDate && !isTrip && (
                <Pressable
                  style={styles.clearDateButton}
                  onPress={() => setForm((current) => ({ ...current, endDate: null }))}
                  hitSlop={6}
                >
                  <XCircleIcon size={20} weight="fill" color="#9ca3af" />
                </Pressable>
              )}
            </View>
          </View>
          {datePickerField && (
            <DateTimePicker
              value={form[datePickerField] ?? form.startDate ?? new Date()}
              minimumDate={datePickerField === 'endDate' && isTrip ? (form.startDate ?? undefined) : undefined}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                const field = datePickerField;
                setDatePickerField(null);
                if (event.type === 'set' && selectedDate) {
                  setForm((current) => ({ ...current, [field]: selectedDate }));
                }
              }}
            />
          )}

          <View style={styles.field}>
            <Text style={styles.label}>{t('projects.sharedWith')}</Text>
            <BuddyPicker buddies={buddies} selectedIds={form.buddyIds} onToggle={toggleBuddy} />
          </View>

          <GlassButton
            label={isSaving ? t('common.saving') : t('common.save')}
            variant="accent"
            style={styles.saveButton}
            onPress={handleSubmit}
            disabled={isBusy}
          />
          {project && (
            <GlassButton
              label={isDeleting ? t('common.deleting') : t('common.delete')}
              variant="danger"
              onPress={handleDelete}
              disabled={isBusy}
            />
          )}
        </KeyboardAwareScrollView>
      </View>

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
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
    paddingTop: 24,
    gap: 18,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  segmented: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 14,
    backgroundColor: colors.neutral,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 11,
  },
  segmentSelected: {
    backgroundColor: colors.white,
    boxShadow: '0px 1px 3px rgba(0,0,0,0.12)',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  segmentTextSelected: {
    color: colors.primary,
  },
  detailsInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Matches GlassTextInput, so the dates read as fields like the rest.
  dateTrigger: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card - 4,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: colors.primaryTint,
  },
  dateText: {
    flexShrink: 1,
    fontSize: 15,
    color: colors.textDark,
  },
  datePlaceholder: {
    flexShrink: 1,
    fontSize: 15,
    color: colors.textMuted,
  },
  clearDateButton: {
    padding: 4,
  },
  saveButton: {
    marginTop: 6,
  },
});
