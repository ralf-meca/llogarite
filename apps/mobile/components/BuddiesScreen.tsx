import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useToasts } from '../hooks/useToasts';
import { fetchBuddies, fetchBuddyRequests, respondToBuddyRequest, sendBuddyRequest, type Buddy } from '../lib/buddiesApi';
import {
  allBuddyInvoiceShares,
  owedByMeShares,
  type BuddyInvoiceShareWithBuddy,
  type OwedShare,
} from '../lib/buddyExpenses';
import { toDateLabel } from '../lib/date';
import { formatAmount } from '../lib/formatAmount';
import { useTranslation } from '../lib/i18n';
import {
  fetchOwedInvoices,
  notifyInvoicePaid,
  setBuddyPaid,
  type OwedInvoice,
  type SavedInvoice,
} from '../lib/savedInvoicesApi';
import { colors, radius } from '../lib/theme';
import { fetchMyCode } from '../lib/usersApi';
import { GlassButton } from './GlassButton';
import { GlassTextInput } from './GlassTextInput';
import { GlassView } from './GlassView';
import { ToastHost } from './ToastHost';
import { UserAvatar } from './UserAvatar';

type BuddyTab = 'owedByMe' | 'owedToMe';

type BuddiesScreenProps = {
  userId: string;
  invoices: SavedInvoice[];
  onInvoicesChanged: () => void;
  onSelectBuddy: (buddy: Buddy) => void;
  onSelectInvoice: (invoiceId: string) => void;
  initialTab?: BuddyTab;
  highlightInvoiceId?: string | null;
};

export function BuddiesScreen({
  userId,
  invoices,
  onInvoicesChanged,
  onSelectBuddy,
  onSelectInvoice,
  initialTab,
  highlightInvoiceId,
}: BuddiesScreenProps) {
  const { t } = useTranslation();
  const [myCode, setMyCode] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [requests, setRequests] = useState<Buddy[]>([]);
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [owedInvoices, setOwedInvoices] = useState<OwedInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<BuddyTab>(initialTab ?? 'owedToMe');
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [notifyingId, setNotifyingId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(highlightInvoiceId ?? null);
  const { toasts, showError, showSuccess, dismissToast } = useToasts();
  const scrollRef = useRef<ScrollView>(null);
  const hasScrolledToHighlightRef = useRef(false);

  const load = () => {
    Promise.all([fetchMyCode(), fetchBuddyRequests(), fetchBuddies(), fetchOwedInvoices()])
      .then(([code, incomingRequests, buddyList, owed]) => {
        setMyCode(code);
        setRequests(incomingRequests);
        setBuddies(buddyList);
        setOwedInvoices(owed);
        setIsLoading(false);
      })
      .catch((error: Error) => {
        setIsLoading(false);
        showError(error.message);
      });
  };

  useEffect(load, []);

  useEffect(() => {
    if (!highlightInvoiceId) {
      return;
    }
    setTab('owedToMe');
    setHighlightedId(highlightInvoiceId);
    hasScrolledToHighlightRef.current = false;
    const timeout = setTimeout(() => setHighlightedId(null), 5000);
    return () => clearTimeout(timeout);
  }, [highlightInvoiceId]);

  const owedToMeShares = useMemo(
    () => allBuddyInvoiceShares(invoices, buddies).filter((share) => !share.paid),
    [invoices, buddies],
  );
  const owedByMeSharesList = useMemo(
    () => owedByMeShares(owedInvoices, userId).filter((share) => !share.paid),
    [owedInvoices, userId],
  );

  const handleSendRequest = () => {
    if (!codeInput.trim()) {
      showError(t('buddies.codeRequired'));
      return;
    }
    setIsSending(true);
    sendBuddyRequest(codeInput.trim())
      .then(() => {
        setIsSending(false);
        setCodeInput('');
        setIsAddFriendOpen(false);
        showSuccess(t('buddies.requestSent'));
      })
      .catch((error: Error) => {
        setIsSending(false);
        showError(error.message);
      });
  };

  const handleRespond = (connectionId: string, accept: boolean) => {
    respondToBuddyRequest(connectionId, accept)
      .then(load)
      .catch((error: Error) => showError(error.message));
  };

  const handleMarkPaid = (share: BuddyInvoiceShareWithBuddy) => {
    Alert.alert(
      t('buddyDetail.confirmMarkPaidTitle'),
      t('buddyDetail.confirmMarkPaidMessage', { seller: share.sellerName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: () => {
            setMarkingId(share.invoiceId);
            setBuddyPaid(share.invoiceId, share.buddyId, true)
              .then(() => {
                setMarkingId(null);
                onInvoicesChanged();
              })
              .catch((error: Error) => {
                setMarkingId(null);
                Alert.alert(t('buddyDetail.markPaidErrorTitle'), error.message);
              });
          },
        },
      ],
    );
  };

  const handleNotifyPaid = (share: OwedShare) => {
    setNotifyingId(share.invoiceId);
    notifyInvoicePaid(share.invoiceId)
      .then(() => {
        setNotifyingId(null);
        showSuccess(t('buddies.notifySent'));
      })
      .catch((error: Error) => {
        setNotifyingId(null);
        showError(error.message);
      });
  };

  return (
    <View style={styles.container}>
      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{t('buddies.title')}</Text>

        <View style={styles.codeRow}>
          <GlassView style={[styles.card, styles.codeCard]}>
            <Text style={styles.cardLabel}>{t('buddies.myCode')}</Text>
            <Text style={styles.myCode}>{myCode ?? '...'}</Text>
            <Text style={styles.cardHint}>{t('buddies.myCodeHint')}</Text>
          </GlassView>

          <Pressable style={styles.addFriendTrigger} onPress={() => setIsAddFriendOpen(true)}>
            <Ionicons name="person-add" size={20} color={colors.white} />
            <Text style={styles.addFriendTriggerText}>{t('buddies.addFriend')}</Text>
          </Pressable>
        </View>

        {requests.length > 0 && (
          <GlassView style={styles.card}>
            <Text style={styles.cardLabel}>{t('buddies.pendingRequests')}</Text>
            {requests.map((request) => (
              <View key={request.connectionId} style={styles.requestRow}>
                <UserAvatar user={request} size={36} />
                <Text style={styles.requestName} numberOfLines={1}>
                  {request.name ?? request.email}
                </Text>
                <View style={styles.requestActions}>
                  <Pressable
                    style={[styles.requestButton, styles.acceptButton]}
                    onPress={() => handleRespond(request.connectionId, true)}
                  >
                    <Ionicons name="checkmark" size={18} color="#ffffff" />
                  </Pressable>
                  <Pressable
                    style={[styles.requestButton, styles.rejectButton]}
                    onPress={() => handleRespond(request.connectionId, false)}
                  >
                    <Ionicons name="close" size={18} color="#dc2626" />
                  </Pressable>
                </View>
              </View>
            ))}
          </GlassView>
        )}

        <View style={styles.tabs}>
          <Pressable
            style={[styles.tabButton, tab === 'owedToMe' && styles.tabButtonActive]}
            onPress={() => setTab('owedToMe')}
          >
            <Text style={[styles.tabButtonText, tab === 'owedToMe' && styles.tabButtonTextActive]} numberOfLines={1}>
              {t('buddies.tabOwedToMe')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabButton, tab === 'owedByMe' && styles.tabButtonActive]}
            onPress={() => setTab('owedByMe')}
          >
            <Text style={[styles.tabButtonText, tab === 'owedByMe' && styles.tabButtonTextActive]} numberOfLines={1}>
              {t('buddies.tabOwedByMe')}
            </Text>
          </Pressable>
        </View>

        {tab === 'owedToMe' ? (
          <>
            {!isLoading && owedToMeShares.length === 0 && (
              <Text style={styles.emptyText}>{t('buddies.noOwedToMe')}</Text>
            )}
            {owedToMeShares.map((share) => {
              const isMarking = markingId === share.invoiceId;
              const isHighlighted = highlightedId === share.invoiceId;
              return (
                <GlassView
                  key={`${share.invoiceId}-${share.buddyId}`}
                  style={[styles.row, isHighlighted && styles.rowHighlighted]}
                  onLayout={(event) => {
                    if (isHighlighted && !hasScrolledToHighlightRef.current) {
                      hasScrolledToHighlightRef.current = true;
                      const y = event.nativeEvent.layout.y;
                      scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
                    }
                  }}
                >
                  <Pressable
                    style={styles.buddyIdentity}
                    onPress={() => {
                      const buddy = buddies.find((candidate) => candidate.id === share.buddyId);
                      if (buddy) {
                        onSelectBuddy(buddy);
                      }
                    }}
                  >
                    <UserAvatar
                      user={{ name: share.buddyName, email: share.buddyEmail, avatarUrl: share.buddyAvatarUrl }}
                      size={24}
                    />
                    <Text style={styles.buddyIdentityName} numberOfLines={1}>
                      {share.buddyName ?? share.buddyEmail}
                    </Text>
                  </Pressable>
                  <View style={styles.rowBody}>
                    <Pressable style={styles.rowLeft} onPress={() => onSelectInvoice(share.invoiceId)}>
                      <Text style={styles.rowSeller} numberOfLines={1}>
                        {share.sellerName}
                      </Text>
                      <Text style={styles.rowDate}>{toDateLabel(new Date(share.dateTimeCreated))}</Text>
                    </Pressable>
                    <View style={styles.rowRight}>
                      <Pressable onPress={() => onSelectInvoice(share.invoiceId)}>
                        <Text style={styles.rowShare}>{formatAmount(share.share)}</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
                        onPress={() => handleMarkPaid(share)}
                        disabled={isMarking}
                      >
                        <Ionicons name="checkmark-circle" size={13} color={colors.primary} />
                        <Text style={styles.actionButtonText}>
                          {isMarking ? t('common.saving') : t('buddyDetail.markPaid')}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </GlassView>
              );
            })}
          </>
        ) : (
          <>
            {!isLoading && owedByMeSharesList.length === 0 && (
              <Text style={styles.emptyText}>{t('buddies.noOwedByMe')}</Text>
            )}
            {owedByMeSharesList.map((share) => {
              const isNotifying = notifyingId === share.invoiceId;
              return (
                <GlassView key={share.invoiceId} style={styles.row}>
                  <Pressable
                    style={styles.buddyIdentity}
                    onPress={() => {
                      const owner = buddies.find((candidate) => candidate.id === share.ownerId);
                      if (owner) {
                        onSelectBuddy(owner);
                      }
                    }}
                  >
                    <UserAvatar
                      user={{ name: share.ownerName, email: share.ownerEmail, avatarUrl: share.ownerAvatarUrl }}
                      size={24}
                    />
                    <Text style={styles.buddyIdentityName} numberOfLines={1}>
                      {share.ownerName ?? share.ownerEmail}
                    </Text>
                  </Pressable>
                  <View style={styles.rowBody}>
                    <View style={styles.rowLeft}>
                      <Text style={styles.rowSeller} numberOfLines={1}>
                        {share.sellerName}
                      </Text>
                      <Text style={styles.rowDate}>{toDateLabel(new Date(share.dateTimeCreated))}</Text>
                    </View>
                    <View style={styles.rowRight}>
                      <Text style={styles.rowShare}>{formatAmount(share.share)}</Text>
                      <Pressable
                        style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
                        onPress={() => handleNotifyPaid(share)}
                        disabled={isNotifying}
                      >
                        <Ionicons name="paper-plane-outline" size={13} color={colors.primary} />
                        <Text style={styles.actionButtonText}>
                          {isNotifying ? t('common.saving') : t('buddies.notifyPaid')}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </GlassView>
              );
            })}
          </>
        )}
      </ScrollView>

      <Modal
        visible={isAddFriendOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAddFriendOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setIsAddFriendOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>{t('buddies.addWithCode')}</Text>
            <GlassTextInput
              style={styles.input}
              placeholder={t('buddies.codePlaceholder')}
              keyboardType="numeric"
              value={codeInput}
              onChangeText={(text) => setCodeInput(text.replace(/[^0-9]/g, ''))}
              autoFocus
            />
            <GlassButton
              label={isSending ? t('buddies.sending') : t('buddies.sendRequest')}
              variant="accent"
              onPress={handleSendRequest}
              disabled={isSending}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <ToastHost toasts={toasts} onDismiss={dismissToast} bottomOffset={110} />
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
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
  },
  card: {
    padding: 20,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  myCode: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1f2937',
    letterSpacing: 4,
  },
  cardHint: {
    marginTop: 8,
    fontSize: 12,
    color: '#9ca3af',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  codeCard: {
    flex: 1,
  },
  addFriendTrigger: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    minWidth: 76,
    backgroundColor: colors.primary,
    borderRadius: radius.card,
    boxShadow: '0px 3px 8px rgba(91,127,219,0.35)',
  },
  addFriendTriggerText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalCard: {
    width: '85%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    boxShadow: '0px 6px 16px rgba(0,0,0,0.2)',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
    color: '#1f2937',
  },
  input: {
    marginBottom: 12,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  requestName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  requestButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButton: {
    backgroundColor: '#10b981',
  },
  rejectButton: {
    backgroundColor: 'rgba(220,38,38,0.12)',
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 20,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: radius.pill,
    padding: 4,
    gap: 4,
    marginTop: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#ffffff',
    boxShadow: '0px 1px 3px rgba(0,0,0,0.12)',
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
  },
  tabButtonTextActive: {
    color: colors.primary,
  },
  row: {
    padding: 16,
    gap: 10,
  },
  rowHighlighted: {
    backgroundColor: colors.primaryTint,
  },
  buddyIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  buddyIdentityName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    flexShrink: 1,
  },
  rowBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowLeft: {
    flex: 1,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  rowSeller: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  rowDate: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  rowShare: {
    fontSize: 15,
    fontWeight: '700',
    color: '#dc2626',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
  },
  actionButtonPressed: {
    opacity: 0.6,
  },
  actionButtonText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
});
