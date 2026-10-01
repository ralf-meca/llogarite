import { AirplaneTiltIcon, FolderIcon, PencilSimpleIcon, PlusIcon } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useToasts } from '../hooks/useToasts';
import { CURRENCY_SYMBOL, datesNeedingRates, formatMoney, moneyConverter, type RateBook } from '../lib/currency';
import { fetchEurRates } from '../lib/exchangeRatesApi';
import { toDateLabel } from '../lib/date';
import { formatAmount } from '../lib/formatAmount';
import { useTranslation } from '../lib/i18n';
import { fetchProjects, type Project } from '../lib/projectsApi';
import type { SavedInvoice } from '../lib/savedInvoicesApi';
import { colors } from '../lib/theme';
import { GlassView } from './GlassView';
import { ToastHost } from './ToastHost';

type ProjectsScreenProps = {
  invoices: SavedInvoice[];
  currentUserId: string;
  onSelectProject: (project: Project) => void;
  // Adding and changing happen on a screen of their own.
  onAddProject: () => void;
  onEditProject: (project: Project) => void;
};

function isCompleted(project: Project): boolean {
  if (!project.endDate) {
    return false;
  }
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return new Date(project.endDate) < startOfToday;
}

export function ProjectsScreen({
  invoices,
  currentUserId,
  onSelectProject,
  onAddProject,
  onEditProject,
}: ProjectsScreenProps) {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  // Lek per euro for the days of lek invoices sitting on euro projects - the
  // only ones that need a rate from outside to be shown in the project's
  // currency. Missing rates are lived with: the card falls back to lek.
  const [rates, setRates] = useState<RateBook>({});
  const ratesWanted = datesNeedingRates(
    invoices
      .filter((invoice) => projects.some((project) => project.id === invoice.data.projectId && project.currency === 'EUR'))
      .map((invoice) => invoice.data),
  )
    .sort()
    .join(',');
  useEffect(() => {
    if (!ratesWanted) {
      return;
    }
    fetchEurRates(ratesWanted.split(','))
      .then(setRates)
      .catch(() => undefined);
  }, [ratesWanted]);

  // What has been spent on a project, in the project's currency where the
  // rates allow it. Marked ALL when a euro project had to fall back.
  const expensesLabel = (project: Project): string => {
    const own = invoices.filter((invoice) => invoice.data.projectId === project.id).map((invoice) => invoice.data);
    const money = moneyConverter(project.currency ?? 'ALL', own, rates);
    const spent = own.reduce((sum, data) => sum + money.convert(data.totalPrice, data), 0);
    return money.currency === 'ALL' && project.currency === 'EUR'
      ? `${formatAmount(spent)} ${CURRENCY_SYMBOL.ALL}`
      : formatMoney(spent, money.currency, true);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t('projects.title')}</Text>
          <Pressable style={styles.addButton} onPress={onAddProject}>
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
                  <KindIcon size={18} color={colors.primary} style={styles.kindIcon} />
                  <Text style={styles.projectName}>
                    {project.name}
                  </Text>
                  {isOwner && (
                    <Pressable style={styles.editButton} onPress={() => onEditProject(project)} hitSlop={6}>
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
                  <Text style={styles.metaValue}>{formatMoney(project.budget, project.currency ?? 'ALL', true)}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>{t('projects.expenses')}</Text>
                  <Text style={styles.metaValue}>{expensesLabel(project)}</Text>
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
  // Top-aligned, so a name long enough to wrap runs onto a second line under
  // itself while the icon and the pencil stay level with the first.
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  kindIcon: {
    marginTop: 2,
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
});
