import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useToasts } from '../hooks/useToasts';
import {
  fetchBuddies,
  fetchBuddyRequests,
  respondToBuddyRequest,
  sendBuddyRequest,
  type Buddy,
} from '../lib/buddiesApi';
import { fetchMyCode } from '../lib/usersApi';
import { GlassButton } from './GlassButton';
import { GlassTextInput } from './GlassTextInput';
import { GlassView } from './GlassView';
import { ToastHost } from './ToastHost';

type BuddiesScreenProps = {
  onSelectBuddy: (buddy: Buddy) => void;
};

export function BuddiesScreen({ onSelectBuddy }: BuddiesScreenProps) {
  const [myCode, setMyCode] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [requests, setRequests] = useState<Buddy[]>([]);
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toasts, showError, showSuccess, dismissToast } = useToasts();

  const load = () => {
    Promise.all([fetchMyCode(), fetchBuddyRequests(), fetchBuddies()])
      .then(([code, incomingRequests, buddyList]) => {
        setMyCode(code);
        setRequests(incomingRequests);
        setBuddies(buddyList);
        setIsLoading(false);
      })
      .catch((error: Error) => {
        setIsLoading(false);
        showError(error.message);
      });
  };

  useEffect(load, []);

  const handleSendRequest = () => {
    if (!codeInput.trim()) {
      showError('Shkruaj kodin e shokut.');
      return;
    }
    setIsSending(true);
    sendBuddyRequest(codeInput.trim())
      .then(() => {
        setIsSending(false);
        setCodeInput('');
        showSuccess('Kërkesa u dërgua.');
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

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Shokët e shpenzimeve</Text>

        <GlassView style={styles.card}>
          <Text style={styles.cardLabel}>Kodi yt</Text>
          <Text style={styles.myCode}>{myCode ?? '...'}</Text>
          <Text style={styles.cardHint}>Jepja këtë kod dikujt për t'u bërë shok shpenzimesh.</Text>
        </GlassView>

        <GlassView style={styles.card}>
          <Text style={styles.cardLabel}>Shto shok me kod</Text>
          <GlassTextInput
            style={styles.input}
            placeholder="Shkruaj kodin"
            autoCapitalize="characters"
            value={codeInput}
            onChangeText={setCodeInput}
          />
          <GlassButton
            label={isSending ? 'Duke dërguar...' : 'Dërgo kërkesë'}
            variant="accent"
            onPress={handleSendRequest}
            disabled={isSending}
          />
        </GlassView>

        {requests.length > 0 && (
          <GlassView style={styles.card}>
            <Text style={styles.cardLabel}>Kërkesa në pritje</Text>
            {requests.map((request) => (
              <View key={request.connectionId} style={styles.requestRow}>
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

        <Text style={styles.sectionTitle}>Shokët e mi</Text>
        {!isLoading && buddies.length === 0 && <Text style={styles.emptyText}>Nuk ke shokë shpenzimesh ende.</Text>}
        {buddies.map((buddy) => (
          <Pressable key={buddy.connectionId} onPress={() => onSelectBuddy(buddy)}>
            <GlassView style={styles.row}>
              <Text style={styles.rowName} numberOfLines={1}>
                {buddy.name ?? buddy.email}
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
            </GlassView>
          </Pressable>
        ))}
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
  input: {
    marginBottom: 12,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
});
