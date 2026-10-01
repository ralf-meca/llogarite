import DateTimePicker from '@react-native-community/datetimepicker';
import {
  AirplaneTiltIcon,
  CalendarIcon,
  FolderIcon,
  PencilSimpleIcon,
  PlusIcon,
  XCircleIcon,
} from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useToasts } from '../hooks/useToasts';
import { fetchBuddies, type Buddy } from '../lib/buddiesApi';
import { toDateLabel, toLocalIsoString } from '../lib/date';
import { formatAmount, formatAmountInput, parseAmountInput } from '../lib/formatAmount';
import { useTranslation } from '../lib/i18n';
import {
  createProject,
  deleteProject,
  fetchProjects,
  updateProject,
  type Project,
  type ProjectKind,
} from '../lib/projectsApi';
import type { SavedInvoice } from '../lib/savedInvoicesApi';
import { colors } from '../lib/theme';
import { BuddyPicker } from './BuddyPicker';
import { GlassButton } from './GlassButton';
import { GlassTextInput } from './GlassTextInput';
import { GlassView } from './GlassView';
import { ToastHost } from './ToastHost';

type ProjectsScreenProps = {
  invoices: SavedInvoice[];
  currentUserId: string;
  onSelectProject: (project: Project) => void;
};

type FormState = {
  name: string;
  details: string;
  budget: string;
  kind: ProjectKind;
  startDate: Date | null;
  endDate: Date | null;
  buddyIds: string[];
};

function emptyForm(): FormState {
  return { name: '', details: '', budget: '', kind: 'project', startDate: null, endDate: null, buddyIds: [] };
}

const KINDS: { key: ProjectKind; labelKey: 'projects.kindProject' | 'projects.kindTrip' }[] = [
  { key: 'project', labelKey: 'projects.kindProject' },
  { key: 'trip', labelKey: 'projects.kindTrip' },
];

// Dates are stored as YYYY-MM-DD, which also compare correctly as strings.
function toDateOnly(date: Date): string {
  return toLocalIsoString(date).slice(0, 10);
}

function isCompleted(project: Project): boolean {
  if (!project.endDate) {
    return false;
  }
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return new Date(project.endDate) < startOfToday;
}

export function ProjectsScreen({ invoices, currentUserId, onSelectProject }: ProjectsScreenProps) {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // Which of the two dates the picker is open for, if any.
  const [datePickerField, setDatePickerField] = useState<'startDate' | 'endDate' | null>(null);
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const { toasts, showError, dismissToast } = useToasts();

  const load = () => {
    fetchProjects()
      .then((data) => {
        setProjects(data);
        setIsLoading(false);
      })
      .catch((error: Error) => {
        setIsLoading(false);
        showError(error.message);
      });
  };

  useEffect(load, []);

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

  const totalExpenses = (projectId: string): number =>
    invoices.reduce((sum, invoice) => (invoice.data.projectId === projectId ? sum + invoice.data.totalPrice : sum), 0);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm());
    setIsModalVisible(true);
  };

  const openEdit = (project: Project) => {
    setEditingId(project.id);
    setForm({
      name: project.name,
      details: project.details ?? '',
      budget: formatAmount(project.budget),
      kind: project.kind === 'trip' ? 'trip' : 'project',
      startDate: project.startDate ? new Date(project.startDate) : null,
      endDate: project.endDate ? new Date(project.endDate) : null,
      buddyIds: project.buddyIds,
    });
    setIsModalVisible(true);
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
    const isTrip = form.kind === 'trip';
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
      startDate,
      endDate,
      buddyIds: form.buddyIds,
    };
    const request = editingId ? updateProject(editingId, payload) : createProject(payload);
    request
      .then(() => {
        setIsSaving(false);
        setIsModalVisible(false);
        load();
      })
      .catch((error: Error) => {
        setIsSaving(false);
        showError(error.message);
      });
  };

  // Lives in the edit form, behind a confirmation: a bin on the card sat one
  // stray tap away from losing a project, with nothing asking first.
  const handleDelete = () => {
    if (!editingId) {
      return;
    }
    const id = editingId;
    Alert.alert(t('projects.deleteTitle', { name: form.name.trim() }), t('projects.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          setIsDeleting(true);
          deleteProject(id)
            .then(() => {
              setIsDeleting(false);
              setIsModalVisible(false);
              load();
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
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t('projects.title')}</Text>
          <Pressable style={styles.addButton} onPress={openAdd}>
            <PlusIcon size={22} weight="bold" color={colors.primary} />
          </Pressable>
        </View>

        {!isLoading && projects.length === 0 && (
          <Text style={styles.emptyText}>{t('projects.empty')}</Text>
        )}

        {projects.map((project) => {
          const completed = isCompleted(project);
          // A project you were added to is someone else's to change: tapping it
          // opens what it holds, and the pencil is not yours.
          const isOwner = project.userId === currentUserId;
          const isTrip = project.kind === 'trip';
          const KindIcon = isTrip ? AirplaneTiltIcon : FolderIcon;
          return (
            <Pressable key={project.id} onPress={() => onSelectProject(project)}>
              <GlassView style={styles.card}>
                <View style={styles.cardHeader}>
                  <KindIcon size={18} color={colors.primary} />
                  <Text style={styles.projectName} numberOfLines={1}>
                    {project.name}
                  </Text>
                  {isOwner && (
                    <Pressable style={styles.editButton} onPress={() => openEdit(project)} hitSlop={6}>
                      <PencilSimpleIcon size={17} color={colors.primary} />
                    </Pressable>
                  )}
                </View>

                <View style={[styles.statusBadge, completed ? styles.statusBadgeDone : styles.statusBadgeOngoing]}>
                  <Text style={[styles.statusText, completed ? styles.statusTextDone : styles.statusTextOngoing]}>
                    {completed ? t('projects.completed') : t('projects.ongoing')}
                  </Text>
                </View>

                {project.details && <Text style={styles.details}>{project.details}</Text>}

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>{t('projects.budget')}</Text>
                  <Text style={styles.metaValue}>{formatAmount(project.budget)}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>{t('projects.expenses')}</Text>
                  <Text style={styles.metaValue}>{formatAmount(totalExpenses(project.id))}</Text>
                </View>
                {isTrip && project.startDate && project.endDate ? (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>{t('projects.dates')}</Text>
                    <Text style={styles.metaValue}>
                      {toDateLabel(new Date(project.startDate))} – {toDateLabel(new Date(project.endDate))}
                    </Text>
                  </View>
                ) : (
                  project.endDate && (
                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>{t('projects.endDate')}</Text>
                      <Text style={styles.metaValue}>{toDateLabel(new Date(project.endDate))}</Text>
                    </View>
                  )
                )}
              </GlassView>
            </Pressable>
          );
        })}
      </ScrollView>

      <Modal visible={isModalVisible} transparent animationType="fade" onRequestClose={() => setIsModalVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsModalVisible(false)}>
          <Pressable style={styles.formCard} onPress={(event) => event.stopPropagation()}>
            <ScrollView>
              <Text style={styles.formTitle}>{editingId ? t('projects.editProject') : t('projects.addProject')}</Text>
              <View style={styles.kindSwitch}>
                {KINDS.map((kind) => {
                  const isSelected = form.kind === kind.key;
                  return (
                    <Pressable
                      key={kind.key}
                      style={[styles.kindOption, isSelected && styles.kindOptionSelected]}
                      onPress={() => setForm((current) => ({ ...current, kind: kind.key }))}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text style={[styles.kindText, isSelected && styles.kindTextSelected]}>{t(kind.labelKey)}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <GlassTextInput
                style={styles.input}
                placeholder={t('projects.namePlaceholder')}
                value={form.name}
                onChangeText={(value) => setForm((current) => ({ ...current, name: value }))}
              />
              <GlassTextInput
                style={[styles.input, styles.detailsInput]}
                placeholder={t('projects.detailsPlaceholder')}
                multiline
                value={form.details}
                onChangeText={(value) => setForm((current) => ({ ...current, details: value }))}
              />
              <GlassTextInput
                style={styles.input}
                placeholder={t('projects.budgetPlaceholder')}
                keyboardType="numeric"
                value={form.budget}
                onChangeText={(value) => setForm((current) => ({ ...current, budget: formatAmountInput(value) }))}
              />
              {/* A trip has both dates and needs both; a project only an optional end. */}
              {form.kind === 'trip' && (
                <Pressable
                  style={[styles.input, styles.dateTrigger]}
                  onPress={() => setDatePickerField('startDate')}
                >
                  <CalendarIcon size={16} color="#6b7280" />
                  <Text style={form.startDate ? styles.dateText : styles.datePlaceholder}>
                    {form.startDate ? toDateLabel(form.startDate) : t('projects.startDatePlaceholder')}
                  </Text>
                </Pressable>
              )}
              <View style={styles.endDateRow}>
                <Pressable
                  style={[styles.input, styles.endDateInput, styles.dateTrigger]}
                  onPress={() => setDatePickerField('endDate')}
                >
                  <CalendarIcon size={16} color="#6b7280" />
                  <Text style={form.endDate ? styles.dateText : styles.datePlaceholder}>
                    {form.endDate
                      ? toDateLabel(form.endDate)
                      : t(form.kind === 'trip' ? 'projects.tripEndDatePlaceholder' : 'projects.endDatePlaceholder')}
                  </Text>
                </Pressable>
                {form.endDate && form.kind !== 'trip' && (
                  <Pressable
                    style={styles.clearDateButton}
                    onPress={() => setForm((current) => ({ ...current, endDate: null }))}
                  >
                    <XCircleIcon size={20} weight="fill" color="#9ca3af" />
                  </Pressable>
                )}
              </View>
              {datePickerField && (
                <DateTimePicker
                  value={form[datePickerField] ?? form.startDate ?? new Date()}
                  minimumDate={
                    datePickerField === 'endDate' && form.kind === 'trip' ? (form.startDate ?? undefined) : undefined
                  }
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
              <View style={styles.buddyRow}>
                <BuddyPicker buddies={buddies} selectedIds={form.buddyIds} onToggle={toggleBuddy} />
              </View>
              <GlassButton
                label={isSaving ? t('common.saving') : t('common.save')}
                variant="accent"
                onPress={handleSubmit}
                disabled={isSaving || isDeleting}
              />
              {editingId && (
                <GlassButton
                  label={isDeleting ? t('common.deleting') : t('common.delete')}
                  variant="danger"
                  style={styles.deleteButton}
                  onPress={handleDelete}
                  disabled={isSaving || isDeleting}
                />
              )}
              <Pressable onPress={() => setIsModalVisible(false)}>
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
    marginTop: 12,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 140,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    boxShadow: '0px 2px 4px rgba(0,0,0,0.15)',
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 40,
  },
  card: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  projectName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  editButton: {
    padding: 4,
  },
  deleteButton: {
    marginTop: 12,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeOngoing: {
    backgroundColor: colors.primaryTint,
  },
  statusBadgeDone: {
    backgroundColor: 'rgba(107,114,128,0.12)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextOngoing: {
    color: colors.primary,
  },
  statusTextDone: {
    color: '#6b7280',
  },
  details: {
    marginTop: 10,
    fontSize: 13,
    color: '#4b5563',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  metaLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  formCard: {
    width: '85%',
    maxHeight: '80%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    boxShadow: '0px 6px 16px rgba(0,0,0,0.2)',
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
    color: '#1f2937',
  },
  kindSwitch: {
    flexDirection: 'row',
    marginBottom: 12,
    padding: 3,
    borderRadius: 14,
    backgroundColor: colors.neutral,
  },
  kindOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 11,
  },
  kindOptionSelected: {
    backgroundColor: colors.white,
    boxShadow: '0px 1px 3px rgba(0,0,0,0.12)',
  },
  kindText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  kindTextSelected: {
    color: colors.primary,
  },
  input: {
    marginBottom: 12,
  },
  detailsInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  endDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  endDateInput: {
    flex: 1,
    marginBottom: 12,
  },
  dateTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dateText: {
    fontSize: 16,
    color: '#1f2937',
  },
  datePlaceholder: {
    fontSize: 16,
    color: 'rgba(31,41,55,0.45)',
  },
  clearDateButton: {
    marginBottom: 12,
    padding: 4,
  },
  buddyRow: {
    marginBottom: 16,
  },
  cancelText: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 12,
  },
});
