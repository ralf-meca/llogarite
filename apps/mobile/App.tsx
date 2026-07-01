import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { InvoiceScreen } from './components/InvoiceScreen';
import { LoginScreen } from './components/LoginScreen';
import { QrScannerModal } from './components/QrScannerModal';
import { UserMenuModal } from './components/UserMenuModal';
import type { AuthResponse } from './lib/authApi';
import { clearToken, getToken, saveToken } from './lib/authStorage';
import { formatAmount } from './lib/formatAmount';
import { parseInvoiceQrUrl, verifyInvoice, type InvoiceVerificationResult } from './lib/invoiceApi';
import { deleteInvoice, fetchSavedInvoices, saveInvoice, type SavedInvoice } from './lib/savedInvoicesApi';

type ConnectionStatus = 'checking' | 'connected' | 'failed';

const connectionStatusLabels: Record<ConnectionStatus, string> = {
  checking: 'duke kontrolluar',
  connected: 'lidhur',
  failed: 'dështoi',
};

export type VerificationState =
  | { status: 'idle' }
  | { status: 'invalid' }
  | { status: 'loading' }
  | { status: 'success'; data: InvoiceVerificationResult }
  | { status: 'error'; message: string };

type Screen = 'loading' | 'auth' | 'home' | 'invoice' | 'detail';

export default function App() {
  const [status, setStatus] = useState<ConnectionStatus>('checking');
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [isUserMenuVisible, setIsUserMenuVisible] = useState(false);
  const [verification, setVerification] = useState<VerificationState>({ status: 'idle' });
  const [screen, setScreen] = useState<Screen>('loading');
  const [savedInvoices, setSavedInvoices] = useState<SavedInvoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<SavedInvoice | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL;
    if (!apiUrl) {
      setStatus('failed');
      return;
    }
    fetch(`${apiUrl}/health`)
      .then((res) => setStatus(res.ok ? 'connected' : 'failed'))
      .catch(() => setStatus('failed'));
  }, []);

  const loadSavedInvoices = useCallback(() => {
    fetchSavedInvoices()
      .then(setSavedInvoices)
      .catch(() => setSavedInvoices([]));
  }, []);

  useEffect(() => {
    getToken().then((token) => {
      if (token) {
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
    saveToken(auth.accessToken).then(() => setScreen('home'));
  };

  const handleLogout = () => {
    clearToken().then(() => {
      setSavedInvoices([]);
      setScreen('auth');
    });
  };

  const handleScanned = (scannedText: string) => {
    setIsScannerVisible(false);
    setSaveError(null);
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
    setSaveError(null);
    setDeleteError(null);
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
          setDeleteError(null);
          deleteInvoice(selectedInvoice.id)
            .then(() => {
              setIsDeleting(false);
              loadSavedInvoices();
              handleClose();
            })
            .catch((error: Error) => {
              setIsDeleting(false);
              setDeleteError(error.message);
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
    setSaveError(null);
    saveInvoice(verification.data)
      .then(() => {
        setIsSaving(false);
        loadSavedInvoices();
        handleClose();
      })
      .catch((error: Error) => {
        setIsSaving(false);
        setSaveError(error.message);
      });
  };

  return (
    <View style={styles.container}>
      {screen === 'loading' ? (
        <Text style={styles.statusText}>Duke u ngarkuar...</Text>
      ) : screen === 'auth' ? (
        <LoginScreen onAuthenticated={handleAuthenticated} />
      ) : screen === 'home' ? (
        <>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Llogarite</Text>
            <Pressable style={styles.userIconButton} onPress={() => setIsUserMenuVisible(true)}>
              <Text style={styles.userIconText}>👤</Text>
            </Pressable>
          </View>
          <Text style={styles.statusText}>Statusi i serverit: {connectionStatusLabels[status]}</Text>

          <FlatList
            style={styles.list}
            contentContainerStyle={styles.listContent}
            data={savedInvoices}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable style={styles.savedRow} onPress={() => handleSelectInvoice(item)}>
                <View>
                  <Text style={styles.savedSeller}>{item.data.seller.name}</Text>
                  <Text style={styles.savedDate}>{new Date(item.data.dateTimeCreated).toLocaleString()}</Text>
                </View>
                <Text style={styles.savedTotal}>{formatAmount(item.data.totalPrice)}</Text>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>Nuk ka fatura të ruajtura.</Text>}
          />

          <Pressable style={styles.scanButton} onPress={() => setIsScannerVisible(true)}>
            <Text style={styles.scanButtonText}>Skano</Text>
          </Pressable>
        </>
      ) : screen === 'invoice' ? (
        <InvoiceScreen
          verification={verification}
          isSaving={isSaving}
          saveError={saveError}
          onClose={handleClose}
          onConfirm={handleConfirm}
        />
      ) : (
        selectedInvoice && (
          <InvoiceScreen
            verification={{ status: 'success', data: selectedInvoice.data }}
            onClose={handleClose}
            isDeleting={isDeleting}
            deleteError={deleteError}
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
        onClose={() => setIsUserMenuVisible(false)}
        onLogout={handleLogout}
      />

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 80,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  userIconButton: {
    position: 'absolute',
    right: 24,
    padding: 4,
  },
  userIconText: {
    fontSize: 20,
  },
  statusText: {
    textAlign: 'center',
    marginBottom: 8,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 120,
  },
  savedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  savedSeller: {
    fontSize: 15,
    fontWeight: '600',
  },
  savedDate: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  savedTotal: {
    fontSize: 15,
    fontWeight: '600',
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
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 999,
  },
  scanButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
