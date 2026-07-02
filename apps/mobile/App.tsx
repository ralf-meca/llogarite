import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { GlassView } from './components/GlassView';
import { InvoiceScreen } from './components/InvoiceScreen';
import { LoginScreen } from './components/LoginScreen';
import { ManualInvoiceScreen } from './components/ManualInvoiceScreen';
import { QrScannerModal } from './components/QrScannerModal';
import { ReceiptScannerModal } from './components/ReceiptScannerModal';
import { ScanMenu } from './components/ScanMenu';
import { ToastHost } from './components/ToastHost';
import { UserAvatar } from './components/UserAvatar';
import { UserMenuModal } from './components/UserMenuModal';
import { useToasts } from './hooks/useToasts';
import type { AuthResponse, AuthUser } from './lib/authApi';
import { clearToken, clearUser, getToken, getUser, saveToken, saveUser } from './lib/authStorage';
import { formatAmount } from './lib/formatAmount';
import { parseInvoiceQrUrl, verifyInvoice, type InvoiceVerificationResult } from './lib/invoiceApi';
import { toLocalIsoString } from './lib/date';
import { recognizeReceipt } from './lib/receiptOcr';
import { parseReceipt, toQrParams } from './lib/receiptParser';
import {
  deleteInvoice,
  fetchSavedInvoices,
  saveInvoice,
  updateInvoice,
  type SavedInvoice,
} from './lib/savedInvoicesApi';

export type VerificationState =
  | { status: 'idle' }
  | { status: 'invalid' }
  | { status: 'loading' }
  | { status: 'success'; data: InvoiceVerificationResult }
  | { status: 'error'; message: string };

type Screen = 'loading' | 'auth' | 'home' | 'invoice' | 'detail' | 'manual';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [isReceiptScannerVisible, setIsReceiptScannerVisible] = useState(false);
  const [isProcessingReceipt, setIsProcessingReceipt] = useState(false);
  const [isUserMenuVisible, setIsUserMenuVisible] = useState(false);
  const [verification, setVerification] = useState<VerificationState>({ status: 'idle' });
  const [screen, setScreen] = useState<Screen>('loading');
  const [savedInvoices, setSavedInvoices] = useState<SavedInvoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<SavedInvoice | null>(null);
  const [manualPrefill, setManualPrefill] = useState<InvoiceVerificationResult | null>(null);
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
    setManualPrefill(null);
  };

  const handleManualClose = () => {
    if (selectedInvoice) {
      setScreen('detail');
    } else {
      handleClose();
    }
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

  const handleReceiptCaptured = (photoUri: string) => {
    setIsProcessingReceipt(true);
    recognizeReceipt(photoUri)
      .then((result) => {
        let parsed;
        try {
          parsed = parseReceipt(result);
        } catch (parseError) {
          console.log('[OCR parse error]', parseError);
          throw new Error('Nuk u përpunuan dot të dhënat e faturës. Provo përsëri.');
        }
        const qrParams = toQrParams(parsed);
        setIsProcessingReceipt(false);
        setIsReceiptScannerVisible(false);

        if (qrParams) {
          setScreen('invoice');
          setVerification({ status: 'loading' });
          verifyInvoice(qrParams)
            .then((data) => setVerification({ status: 'success', data }))
            .catch((error: Error) => setVerification({ status: 'error', message: error.message }));
          return;
        }

        setSelectedInvoice(null);
        setManualPrefill({
          iic: parsed.iic ?? '',
          dateTimeCreated: parsed.dateTimeCreated ?? toLocalIsoString(new Date()),
          totalPrice: 0,
          seller: { name: parsed.sellerName ?? '' },
          items: parsed.items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unitPriceBeforeVat: item.unitPrice,
            unitPriceAfterVat: item.unitPrice,
          })),
        });
        setScreen('manual');
      })
      .catch((error: Error) => {
        setIsProcessingReceipt(false);
        showError(error.message);
      });
  };

  const handleManualSubmit = (data: InvoiceVerificationResult) => {
    if (selectedInvoice) {
      setIsSaving(true);
      updateInvoice(selectedInvoice.id, data)
        .then((updated) => {
          setIsSaving(false);
          setSelectedInvoice(updated);
          loadSavedInvoices();
          setScreen('detail');
        })
        .catch((error: Error) => {
          setIsSaving(false);
          showError(error.message);
        });
      return;
    }
    setVerification({ status: 'success', data });
    setScreen('invoice');
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
    <View style={styles.container}>
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

          <ScanMenu
            onScanQr={() => setIsScannerVisible(true)}
            onAddManually={() => {
              setSelectedInvoice(null);
              setManualPrefill(null);
              setScreen('manual');
            }}
            onScanReceipt={() => setIsReceiptScannerVisible(true)}
          />
        </>
      ) : screen === 'manual' ? (
        <ManualInvoiceScreen
          initialData={selectedInvoice?.data ?? manualPrefill ?? undefined}
          isEditing={Boolean(selectedInvoice)}
          isSaving={isSaving}
          onClose={handleManualClose}
          onSubmit={handleManualSubmit}
        />
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
            onEdit={() => setScreen('manual')}
          />
        )
      )}

      <QrScannerModal
        visible={isScannerVisible}
        onClose={() => setIsScannerVisible(false)}
        onScanned={handleScanned}
      />

      <ReceiptScannerModal
        visible={isReceiptScannerVisible}
        isProcessing={isProcessingReceipt}
        onClose={() => setIsReceiptScannerVisible(false)}
        onCaptured={handleReceiptCaptured}
      />

      <UserMenuModal
        visible={isUserMenuVisible}
        user={user}
        onClose={() => setIsUserMenuVisible(false)}
        onLogout={handleLogout}
      />

      <StatusBar style="auto" />
      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 80,
    backgroundColor: '#ffffff',
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
});
