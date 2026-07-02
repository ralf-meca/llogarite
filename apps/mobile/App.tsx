import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { GlassButton } from './components/GlassButton';
import { GlassView } from './components/GlassView';
import { InvoiceScreen } from './components/InvoiceScreen';
import { LoginScreen } from './components/LoginScreen';
import { QrScannerModal } from './components/QrScannerModal';
import { ToastHost } from './components/ToastHost';
import { UserAvatar } from './components/UserAvatar';
import { UserMenuModal } from './components/UserMenuModal';
import { useToasts } from './hooks/useToasts';
import type { AuthResponse, AuthUser } from './lib/authApi';
import { clearToken, clearUser, getToken, getUser, saveToken, saveUser } from './lib/authStorage';
import { formatAmount } from './lib/formatAmount';
import { parseInvoiceQrUrl, verifyInvoice, type InvoiceVerificationResult } from './lib/invoiceApi';
import { deleteInvoice, fetchSavedInvoices, saveInvoice, type SavedInvoice } from './lib/savedInvoicesApi';

export type VerificationState =
  | { status: 'idle' }
  | { status: 'invalid' }
  | { status: 'loading' }
  | { status: 'success'; data: InvoiceVerificationResult }
  | { status: 'error'; message: string };

type Screen = 'loading' | 'auth' | 'home' | 'invoice' | 'detail';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [isUserMenuVisible, setIsUserMenuVisible] = useState(false);
  const [verification, setVerification] = useState<VerificationState>({ status: 'idle' });
  const [screen, setScreen] = useState<Screen>('loading');
  const [savedInvoices, setSavedInvoices] = useState<SavedInvoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<SavedInvoice | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toasts, showError, dismissToast } = useToasts();

  const loadSavedInvoices = useCallback(() => {
    fetchSavedInvoices()
      .then(setSavedInvoices)
      .catch((error: Error) => {
        setSavedInvoices([]);
        showError(error.message);
      });
  }, [showError]);

  useEffect(() => {
    getToken().then((token) => {
      if (token) {
        getUser().then(setUser);
        setScreen('home');
      } else {
        setScreen('auth');
      }
    });
  }, []);

  useEffect(() => {
    if (screen === 'home') {
      loadSavedInvoices();
    }
  }, [screen, loadSavedInvoices]);

  const handleAuthenticated = (auth: AuthResponse) => {
    Promise.all([saveToken(auth.accessToken), saveUser(auth.user)]).then(() => {
      setUser(auth.user);
      setScreen('home');
    });
  };

  const handleLogout = () => {
    Promise.all([clearToken(), clearUser()]).then(() => {
      setSavedInvoices([]);
      setUser(null);
      setScreen('auth');
    });
  };

  const handleScanned = (scannedText: string) => {
    setIsScannerVisible(false);
    setScreen('invoice');

    const invoiceParams = parseInvoiceQrUrl(scannedText);
    if (!invoiceParams) {
      setVerification({ status: 'invalid' });
      return;
    }

    setVerification({ status: 'loading' });
    verifyInvoice(invoiceParams)
      .then((data) => setVerification({ status: 'success', data }))
      .catch((error: Error) => setVerification({ status: 'error', message: error.message }));
  };

  const handleClose = () => {
    setScreen('home');
    setVerification({ status: 'idle' });
    setSelectedInvoice(null);
  };

  const handleSelectInvoice = (invoice: SavedInvoice) => {
    setSelectedInvoice(invoice);
    setScreen('detail');
  };

  const handleDelete = () => {
    if (!selectedInvoice) {
      return;
    }
    Alert.alert('Fshi faturën?', 'Ky veprim nuk mund të kthehet.', [
      { text: 'Anulo', style: 'cancel' },
      {
        text: 'Fshi',
        style: 'destructive',
        onPress: () => {
          setIsDeleting(true);
          deleteInvoice(selectedInvoice.id)
            .then(() => {
              setIsDeleting(false);
              loadSavedInvoices();
              handleClose();
            })
            .catch((error: Error) => {
              setIsDeleting(false);
              showError(error.message);
            });
        },
      },
    ]);
  };

  const handleConfirm = () => {
    if (verification.status !== 'success') {
      return;
    }
    setIsSaving(true);
    saveInvoice(verification.data)
      .then(() => {
        setIsSaving(false);
        loadSavedInvoices();
        handleClose();
      })
      .catch((error: Error) => {
        setIsSaving(false);
        showError(error.message);
      });
  };

  return (
    <LinearGradient colors={['#dbeafe', '#ede9fe', '#fdf4ff']} style={styles.container}>
      {screen === 'loading' ? (
        <Text style={styles.statusText}>Duke u ngarkuar...</Text>
      ) : screen === 'auth' ? (
        <LoginScreen onAuthenticated={handleAuthenticated} />
      ) : screen === 'home' ? (
        <>
          <GlassView style={styles.headerRow}>
            <Text style={styles.title}>Llogarite</Text>
            <Pressable style={styles.userIconButton} onPress={() => setIsUserMenuVisible(true)}>
              <UserAvatar user={user} size={30} />
            </Pressable>
          </GlassView>

          <FlatList
            style={styles.list}
            contentContainerStyle={styles.listContent}
            data={savedInvoices}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable onPress={() => handleSelectInvoice(item)}>
                <GlassView style={styles.savedRow}>
                  <View>
                    <Text style={styles.savedSeller}>{item.data.seller.name}</Text>
                    <Text style={styles.savedDate}>{new Date(item.data.dateTimeCreated).toLocaleString()}</Text>
                  </View>
                  <Text style={styles.savedTotal}>{formatAmount(item.data.totalPrice)}</Text>
                </GlassView>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>Nuk ka fatura të ruajtura.</Text>}
          />

          <GlassButton
            label="Skano"
            variant="accent"
            style={styles.scanButton}
            onPress={() => setIsScannerVisible(true)}
          />
        </>
      ) : screen === 'invoice' ? (
        <InvoiceScreen
          verification={verification}
          isSaving={isSaving}
          onClose={handleClose}
          onConfirm={handleConfirm}
        />
      ) : (
        selectedInvoice && (
          <InvoiceScreen
            verification={{ status: 'success', data: selectedInvoice.data }}
            onClose={handleClose}
            isDeleting={isDeleting}
            onDelete={handleDelete}
          />
        )
      )}

      <QrScannerModal
        visible={isScannerVisible}
        onClose={() => setIsScannerVisible(false)}
        onScanned={handleScanned}
      />

      <UserMenuModal
        visible={isUserMenuVisible}
        user={user}
        onClose={() => setIsUserMenuVisible(false)}
        onLogout={handleLogout}
      />

      <StatusBar style="auto" />
      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 80,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 24,
    paddingVertical: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  userIconButton: {
    position: 'absolute',
    right: 20,
    padding: 4,
  },
  statusText: {
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 8,
    color: '#4b5563',
  },
  list: {
    flex: 1,
    marginTop: 12,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 120,
    gap: 12,
  },
  savedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  savedSeller: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  savedDate: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  savedTotal: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 40,
  },
  scanButton: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
  },
});
