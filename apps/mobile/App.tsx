import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { BuddiesScreen } from './components/BuddiesScreen';
import { BuddyDetailScreen } from './components/BuddyDetailScreen';
import { BudgetScreen } from './components/BudgetScreen';
import { DashboardScreen } from './components/DashboardScreen';
import { GlassView } from './components/GlassView';
import { InvoiceScreen } from './components/InvoiceScreen';
import { LoginScreen } from './components/LoginScreen';
import { ManualInvoiceScreen } from './components/ManualInvoiceScreen';
import { MonthFilter } from './components/MonthFilter';
import { MonthlyPaymentsScreen } from './components/MonthlyPaymentsScreen';
import { ProductDetailScreen } from './components/ProductDetailScreen';
import { ProductsScreen } from './components/ProductsScreen';
import { ProjectsScreen } from './components/ProjectsScreen';
import { QrScannerModal } from './components/QrScannerModal';
import { ReceiptScannerModal } from './components/ReceiptScannerModal';
import { ScanMenu } from './components/ScanMenu';
import { SideDrawer, type DrawerScreen } from './components/SideDrawer';
import { ToastHost } from './components/ToastHost';
import { UserMenuModal } from './components/UserMenuModal';
import { VerifiedBadge } from './components/VerifiedBadge';
import { useToasts } from './hooks/useToasts';
import type { AuthResponse, AuthUser } from './lib/authApi';
import { clearToken, clearUser, getToken, getUser, saveToken, saveUser } from './lib/authStorage';
import { categoryIcon } from './lib/categories';
import { dominantCategory } from './lib/categorySpending';
import { formatAmount } from './lib/formatAmount';
import { fetchBuddyRequests, type Buddy } from './lib/buddiesApi';
import { parseInvoiceQrUrl, verifyInvoice, type InvoiceVerificationResult } from './lib/invoiceApi';
import { toLocalIsoString } from './lib/date';
import { monthKeyOf } from './lib/monthlySpending';
import type { ProductSummary } from './lib/productPrices';
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

type Screen = 'loading' | 'auth' | DrawerScreen | 'invoice' | 'detail' | 'manual' | 'productDetail' | 'buddyDetail';

const MAIN_SCREENS = new Set<Screen>([
  'dashboard',
  'list',
  'budget',
  'monthlyPayments',
  'projects',
  'products',
  'buddies',
]);

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [isReceiptScannerVisible, setIsReceiptScannerVisible] = useState(false);
  const [isProcessingReceipt, setIsProcessingReceipt] = useState(false);
  const [isUserMenuVisible, setIsUserMenuVisible] = useState(false);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [verification, setVerification] = useState<VerificationState>({ status: 'idle' });
  const [screen, setScreen] = useState<Screen>('loading');
  const [savedInvoices, setSavedInvoices] = useState<SavedInvoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<SavedInvoice | null>(null);
  const [manualPrefill, setManualPrefill] = useState<InvoiceVerificationResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductSummary | null>(null);
  const [selectedBuddy, setSelectedBuddy] = useState<Buddy | null>(null);
  const [detailReturnScreen, setDetailReturnScreen] = useState<'list' | 'buddyDetail'>('list');
  const [pendingBuddyRequests, setPendingBuddyRequests] = useState(0);
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
        setScreen('dashboard');
      } else {
        setScreen('auth');
      }
    });
  }, []);

  useEffect(() => {
    if (screen === 'dashboard' || screen === 'list' || screen === 'budget') {
      loadSavedInvoices();
    }
  }, [screen, loadSavedInvoices]);

  useEffect(() => {
    if (MAIN_SCREENS.has(screen)) {
      fetchBuddyRequests()
        .then((requests) => setPendingBuddyRequests(requests.length))
        .catch(() => {});
    }
  }, [screen]);

  const handleAuthenticated = (auth: AuthResponse) => {
    Promise.all([saveToken(auth.accessToken), saveUser(auth.user)]).then(() => {
      setUser(auth.user);
      setScreen('dashboard');
    });
  };

  const handleLogout = () => {
    Promise.all([clearToken(), clearUser()]).then(() => {
      setSavedInvoices([]);
      setUser(null);
      setScreen('auth');
    });
  };

  const fallbackToManualEntry = (prefill: InvoiceVerificationResult) => {
    setSelectedInvoice(null);
    setManualPrefill(prefill);
    setScreen('manual');
  };

  const handleScanned = (scannedText: string) => {
    setIsScannerVisible(false);

    const invoiceParams = parseInvoiceQrUrl(scannedText);
    if (!invoiceParams) {
      setScreen('invoice');
      setVerification({ status: 'invalid' });
      return;
    }

    setScreen('invoice');
    setVerification({ status: 'loading' });
    verifyInvoice(invoiceParams)
      .then((data) => setVerification({ status: 'success', data: { ...data, verified: true } }))
      .catch((error: Error) => {
        showError(error.message);
        fallbackToManualEntry({
          iic: invoiceParams.iic,
          dateTimeCreated: invoiceParams.dateTimeCreated || toLocalIsoString(new Date()),
          totalPrice: 0,
          seller: { name: '' },
          items: [],
        });
      });
  };

  const handleClose = () => {
    setScreen('list');
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

  const handleSelectInvoice = (invoice: SavedInvoice, returnTo: 'list' | 'buddyDetail' = 'list') => {
    setSelectedInvoice(invoice);
    setDetailReturnScreen(returnTo);
    setScreen('detail');
  };

  const handleCloseDetail = () => {
    setVerification({ status: 'idle' });
    setSelectedInvoice(null);
    setManualPrefill(null);
    setScreen(detailReturnScreen);
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
              handleCloseDetail();
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

        const receiptPrefill: InvoiceVerificationResult = {
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
        };

        if (qrParams) {
          setScreen('invoice');
          setVerification({ status: 'loading' });
          verifyInvoice(qrParams)
            .then((data) => setVerification({ status: 'success', data: { ...data, verified: true } }))
            .catch((error: Error) => {
              showError(error.message);
              fallbackToManualEntry(receiptPrefill);
            });
          return;
        }

        fallbackToManualEntry(receiptPrefill);
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
    setVerification({ status: 'success', data: { ...data, verified: false } });
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

  const filteredInvoices =
    selectedMonthKey === null
      ? savedInvoices
      : savedInvoices.filter((invoice) => monthKeyOf(invoice.data.dateTimeCreated) === selectedMonthKey);

  return (
    <View style={styles.container}>
      {screen === 'loading' ? (
        <Text style={styles.statusText}>Duke u ngarkuar...</Text>
      ) : screen === 'auth' ? (
        <LoginScreen onAuthenticated={handleAuthenticated} />
      ) : MAIN_SCREENS.has(screen) ? (
        <>
          <GlassView style={styles.headerRow}>
            <Pressable
              style={styles.menuButton}
              hitSlop={12}
              onPress={() => setIsDrawerVisible(true)}
            >
              <Ionicons name="menu-outline" size={24} color="#1f2937" />
            </Pressable>
            <Text style={styles.title}>Llogarite</Text>
            <View style={styles.headerSpacer} />
          </GlassView>

          {screen === 'dashboard' ? (
            <DashboardScreen invoices={savedInvoices} />
          ) : screen === 'list' ? (
            <FlatList
              style={styles.list}
              contentContainerStyle={styles.listContent}
              data={filteredInvoices}
              keyExtractor={(item) => item.id}
              ListHeaderComponent={<MonthFilter value={selectedMonthKey} onChange={setSelectedMonthKey} />}
              renderItem={({ item }) => (
                <Pressable onPress={() => handleSelectInvoice(item)}>
                  <GlassView style={styles.savedRow}>
                    <View style={styles.savedRowLeft}>
                      <Ionicons name={categoryIcon(dominantCategory(item))} size={32} color="#4b5563" />
                      <View style={styles.savedRowTextGroup}>
                        <View style={styles.savedSellerRow}>
                          <Text style={styles.savedSeller} numberOfLines={1}>
                            {item.data.seller.name}
                          </Text>
                          {item.data.verified && <VerifiedBadge size={15} />}
                        </View>
                        <Text style={styles.savedDate}>{new Date(item.data.dateTimeCreated).toLocaleDateString()}</Text>
                      </View>
                    </View>
                    <Text style={styles.savedTotal}>{formatAmount(item.data.totalPrice)}</Text>
                  </GlassView>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  {savedInvoices.length === 0 ? 'Nuk ka fatura të ruajtura.' : 'Nuk ka fatura për këtë muaj.'}
                </Text>
              }
            />
          ) : screen === 'budget' ? (
            <BudgetScreen invoices={savedInvoices} />
          ) : screen === 'monthlyPayments' ? (
            <MonthlyPaymentsScreen />
          ) : screen === 'projects' ? (
            <ProjectsScreen invoices={savedInvoices} />
          ) : screen === 'products' ? (
            <ProductsScreen
              invoices={savedInvoices}
              onSelectProduct={(product) => {
                setSelectedProduct(product);
                setScreen('productDetail');
              }}
            />
          ) : (
            <BuddiesScreen
              onSelectBuddy={(buddy) => {
                setSelectedBuddy(buddy);
                setScreen('buddyDetail');
              }}
            />
          )}

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
      ) : screen === 'productDetail' ? (
        selectedProduct && (
          <ProductDetailScreen
            productKey={selectedProduct.key}
            productName={selectedProduct.name}
            invoices={savedInvoices}
            onBack={() => setScreen('products')}
          />
        )
      ) : screen === 'buddyDetail' ? (
        selectedBuddy && (
          <BuddyDetailScreen
            buddyId={selectedBuddy.id}
            buddyName={selectedBuddy.name ?? selectedBuddy.email}
            invoices={savedInvoices}
            onBack={() => setScreen('buddies')}
            onSelectInvoice={(invoiceId) => {
              const invoice = savedInvoices.find((candidate) => candidate.id === invoiceId);
              if (invoice) {
                handleSelectInvoice(invoice, 'buddyDetail');
              }
            }}
          />
        )
      ) : (
        selectedInvoice && (
          <InvoiceScreen
            verification={{ status: 'success', data: selectedInvoice.data }}
            onClose={handleCloseDetail}
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

      <SideDrawer
        visible={isDrawerVisible}
        activeScreen={screen}
        user={user}
        pendingBuddyRequests={pendingBuddyRequests}
        onClose={() => setIsDrawerVisible(false)}
        onNavigate={(target) => {
          setIsDrawerVisible(false);
          setSelectedInvoice(null);
          setManualPrefill(null);
          setScreen(target);
        }}
        onOpenAccount={() => {
          setIsDrawerVisible(false);
          setIsUserMenuVisible(true);
        }}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 24,
    paddingVertical: 14,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  menuButton: {
    width: 32,
    padding: 4,
    zIndex: 1,
  },
  headerSpacer: {
    width: 32,
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
  savedRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  savedRowTextGroup: {
    flexShrink: 1,
  },
  savedSellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  savedSeller: {
    flexShrink: 1,
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
