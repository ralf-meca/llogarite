import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useToasts } from '../hooks/useToasts';
import { fetchBuddies, type Buddy } from '../lib/buddiesApi';
import { toDateLabel, toLocalIsoString } from '../lib/date';
import { formatAmount, formatAmountInput, parseAmountInput } from '../lib/formatAmount';
import { useTranslation } from '../lib/i18n';
import { createProject, deleteProject, fetchProjects, updateProject, type Project } from '../lib/projectsApi';
import type { SavedInvoice } from '../lib/savedInvoicesApi';
import { colors } from '../lib/theme';
import { BuddyPicker } from './BuddyPicker';
import { GlassButton } from './GlassButton';
import { GlassTextInput } from './GlassTextInput';
import { GlassView } from './GlassView';
import { ToastHost } from './ToastHost';

type ProjectsScreenProps = {
  invoices: SavedInvoice[];
};

type FormState = {
  name: string;
  details: string;
  budget: string;
  endDate: Date | null;
  buddyIds: string[];
};

function emptyForm(): FormState {
  return { name: '', details: '', budget: '', endDate: null, buddyIds: [] };
}

function isCompleted(project: Project): boolean {
  if (!project.endDate) {
    return false;
  }
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return new Date(project.endDate) < startOfToday;
}

export function ProjectsScreen({ invoices }: ProjectsScreenProps) {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [isSaving, setIsSaving] = useState(false);
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
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
    const endDate = form.endDate ? toLocalIsoString(form.endDate).slice(0, 10) : null;

    setIsSaving(true);
    const payload = {
      name: form.name.trim(),
      details: form.details.trim() || null,
      budget,
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

  const handleDelete = (id: string) => {
    deleteProject(id)
      .then(load)
      .catch((error: Error) => showError(error.message));
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t('projects.title')}</Text>
          <Pressable style={styles.addButton} onPress={openAdd}>
            <Ionicons name="add" size={22} color={colors.primary} />
          </Pressable>
        </View>

        {!isLoading && projects.length === 0 && (
          <Text style={styles.emptyText}>{t('projects.empty')}</Text>
        )}

        {projects.map((project) => {
          const completed = isCompleted(project);
          return (
            <Pressable key={project.id} onPress={() => openEdit(project)}>
              <GlassView style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.projectName} numberOfLines={1}>
                    {project.name}
                  </Text>
                  <Pressable style={styles.deleteButton} onPress={() => handleDelete(project.id)}>
                    <Ionicons name="trash-outline" size={18} color="#dc2626" />
                  </Pressable>
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
                {project.endDate && (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>{t('projects.endDate')}</Text>
                    <Text style={styles.metaValue}>{toDateLabel(new Date(project.endDate))}</Text>
                  </View>
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
              <View style={styles.endDateRow}>
                <Pressable
                  style={[styles.input, styles.endDateInput, styles.dateTrigger]}
                  onPress={() => setIsDatePickerVisible(true)}
                >
                  <Ionicons name="calendar-outline" size={16} color="#6b7280" />
                  <Text style={form.endDate ? styles.dateText : styles.datePlaceholder}>
                    {form.endDate ? toDateLabel(form.endDate) : t('projects.endDatePlaceholder')}
                  </Text>
                </Pressable>
                {form.endDate && (
                  <Pressable
                    style={styles.clearDateButton}
                    onPress={() => setForm((current) => ({ ...current, endDate: null }))}
                  >
                    <Ionicons name="close-circle" size={20} color="#9ca3af" />
                  </Pressable>
                )}
              </View>
              {isDatePickerVisible && (
                <DateTimePicker
                  value={form.endDate ?? new Date()}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setIsDatePickerVisible(false);
                    if (event.type === 'set' && selectedDate) {
                      setForm((current) => ({ ...current, endDate: selectedDate }));
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
                disabled={isSaving}
              />
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
  },
  projectName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  deleteButton: {
    padding: 4,
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
