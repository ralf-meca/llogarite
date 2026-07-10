import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { BuddiesScreen } from "./components/BuddiesScreen";
import { BuddyDetailScreen } from "./components/BuddyDetailScreen";
import { BudgetScreen } from "./components/BudgetScreen";
import { DashboardScreen } from "./components/DashboardScreen";
import { GlassView } from "./components/GlassView";
import { InvoiceScreen } from "./components/InvoiceScreen";
import { LoginScreen } from "./components/LoginScreen";
import { ManualInvoiceScreen } from "./components/ManualInvoiceScreen";
import { MonthFilter } from "./components/MonthFilter";
import { LanguageProvider } from "./components/LanguageProvider";
import { MonthlyPaymentsScreen } from "./components/MonthlyPaymentsScreen";
import { OnboardingGuide, type OnboardingStep } from "./components/OnboardingGuide";
import { PlansScreen } from "./components/PlansScreen";
import { ProductDetailScreen } from "./components/ProductDetailScreen";
import { ProductsScreen } from "./components/ProductsScreen";
import { ProjectsScreen } from "./components/ProjectsScreen";
import { QrScannerModal } from "./components/QrScannerModal";
import { ReceiptScannerModal } from "./components/ReceiptScannerModal";
import { ScanMenu } from "./components/ScanMenu";
import { SideDrawer, type DrawerScreen } from "./components/SideDrawer";
import { ToastHost } from "./components/ToastHost";
import { UserMenuModal } from "./components/UserMenuModal";
import { VerifiedBadge } from "./components/VerifiedBadge";
import { useToasts } from "./hooks/useToasts";
import type { AuthResponse, AuthUser } from "./lib/authApi";
import { clearToken, clearUser, getToken, getUser, saveToken, saveUser } from "./lib/authStorage";
import { categoryIcon } from "./lib/categories";
import { dominantCategory } from "./lib/categorySpending";
import { formatAmount } from "./lib/formatAmount";
import { fetchBuddyRequests, type Buddy } from "./lib/buddiesApi";
import { showInterstitialAd } from "./lib/ads";
import { parseInvoiceQrUrl, verifyInvoice, type InvoiceVerificationResult } from "./lib/invoiceApi";
import { toLocalIsoString } from "./lib/date";
import { monthKeyOf } from "./lib/monthlySpending";
import { useTranslation } from "./lib/i18n";
import { hasCompletedOnboarding, resetOnboarding, setOnboardingCompleted } from "./lib/onboarding";
import { HEADER_INSET, colors, radius } from "./lib/theme";
import type { ProductSummary } from "./lib/productPrices";
import { recognizeReceipt } from "./lib/receiptOcr";
import { parseReceipt, toQrParams } from "./lib/receiptParser";
import {
    deleteInvoice,
    fetchSavedInvoices,
    saveInvoice,
    updateInvoice,
    type SavedInvoice,
} from "./lib/savedInvoicesApi";

export type VerificationState =
    | { status: "idle" }
    | { status: "invalid" }
    | { status: "loading" }
    | { status: "success"; data: InvoiceVerificationResult }
    | { status: "error"; message: string };

type Screen =
    | "loading"
    | "auth"
    | DrawerScreen
    | "invoice"
    | "detail"
    | "manual"
    | "productDetail"
    | "buddyDetail"
    | "plans";

const MAIN_SCREENS = new Set<Screen>([
    "dashboard",
    "list",
    "budget",
    "monthlyPayments",
    "projects",
    "products",
    "buddies",
]);

const PREMIUM_SCREENS = new Set<DrawerScreen>(["projects", "products", "buddies"]);

type OnboardingStepConfig = OnboardingStep & { screen: DrawerScreen };

const ONBOARDING_STEPS: OnboardingStepConfig[] = [
    { screen: "dashboard", titleKey: "onboarding.step1Title", messageKey: "onboarding.step1Message" },
    { screen: "list", titleKey: "onboarding.step2Title", messageKey: "onboarding.step2Message" },
    {
        screen: "list",
        titleKey: "onboarding.step3Title",
        messageKey: "onboarding.step3Message",
        highlightFab: true,
    },
    { screen: "budget", titleKey: "onboarding.step4Title", messageKey: "onboarding.step4Message" },
    { screen: "monthlyPayments", titleKey: "onboarding.step5Title", messageKey: "onboarding.step5Message" },
    { screen: "projects", titleKey: "onboarding.step6Title", messageKey: "onboarding.step6Message", premium: true },
    { screen: "products", titleKey: "onboarding.step7Title", messageKey: "onboarding.step7Message", premium: true },
    { screen: "buddies", titleKey: "onboarding.step8Title", messageKey: "onboarding.step8Message", premium: true },
];

function AppContent() {
    const { t } = useTranslation();
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isScannerVisible, setIsScannerVisible] = useState(false);
    const [isReceiptScannerVisible, setIsReceiptScannerVisible] = useState(false);
    const [isProcessingReceipt, setIsProcessingReceipt] = useState(false);
    const [isUserMenuVisible, setIsUserMenuVisible] = useState(false);
    const [isDrawerVisible, setIsDrawerVisible] = useState(false);
    const [verification, setVerification] = useState<VerificationState>({ status: "idle" });
    const [screen, setScreen] = useState<Screen>("loading");
    const [savedInvoices, setSavedInvoices] = useState<SavedInvoice[]>([]);
    const [selectedInvoice, setSelectedInvoice] = useState<SavedInvoice | null>(null);
    const [manualPrefill, setManualPrefill] = useState<InvoiceVerificationResult | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
    const [selectedProduct, setSelectedProduct] = useState<ProductSummary | null>(null);
    const [selectedBuddy, setSelectedBuddy] = useState<Buddy | null>(null);
    const [detailReturnScreen, setDetailReturnScreen] = useState<"list" | "buddyDetail">("list");
    const [pendingBuddyRequests, setPendingBuddyRequests] = useState(0);
    const [isOnboarding, setIsOnboarding] = useState(false);
    const [onboardingStep, setOnboardingStep] = useState(0);
    const { toasts, showError, dismissToast } = useToasts();

    const loadSavedInvoices = useCallback(() => {
        fetchSavedInvoices()
            .then(setSavedInvoices)
            .catch((error: Error) => {
                setSavedInvoices([]);
                showError(error.message);
            });
    }, [showError]);

    const startOnboardingIfNeeded = useCallback(() => {
        hasCompletedOnboarding().then((completed) => {
            if (!completed) {
                setIsOnboarding(true);
                setOnboardingStep(0);
            }
        });
    }, []);

    useEffect(() => {
        getToken().then((token) => {
            if (token) {
                getUser().then(setUser);
                setScreen("dashboard");
                startOnboardingIfNeeded();
            } else {
                setScreen("auth");
            }
        });
    }, [startOnboardingIfNeeded]);

    useEffect(() => {
        if (isOnboarding) {
            setScreen(ONBOARDING_STEPS[onboardingStep].screen);
        }
    }, [isOnboarding, onboardingStep]);

    useEffect(() => {
        if (screen === "dashboard" || screen === "list" || screen === "budget") {
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
            setScreen("dashboard");
            startOnboardingIfNeeded();
        });
    };

    const handleLogout = () => {
        Promise.all([clearToken(), clearUser()]).then(() => {
            setSavedInvoices([]);
            setUser(null);
            setScreen("auth");
        });
    };

    const finishOnboarding = () => {
        setIsOnboarding(false);
        setOnboardingCompleted();
        setScreen("dashboard");
    };

    const handleOnboardingNext = () => {
        if (onboardingStep === ONBOARDING_STEPS.length - 1) {
            finishOnboarding();
            return;
        }
        setOnboardingStep((current) => current + 1);
    };

    const handleOnboardingBack = () => {
        setOnboardingStep((current) => Math.max(0, current - 1));
    };

    const handleRestartOnboarding = () => {
        resetOnboarding().then(() => {
            setIsOnboarding(true);
            setOnboardingStep(0);
        });
    };

    const fallbackToManualEntry = (prefill: InvoiceVerificationResult) => {
        setSelectedInvoice(null);
        setManualPrefill(prefill);
        setScreen("manual");
    };

    const handleScanned = (scannedText: string) => {
        setIsScannerVisible(false);

        const invoiceParams = parseInvoiceQrUrl(scannedText);
        if (!invoiceParams) {
            setScreen("invoice");
            setVerification({ status: "invalid" });
            return;
        }

        setScreen("invoice");
        setVerification({ status: "loading" });
        verifyInvoice(invoiceParams)
            .then((data) => setVerification({ status: "success", data: { ...data, verified: true } }))
            .catch((error: Error) => {
                showError(error.message);
                fallbackToManualEntry({
                    iic: invoiceParams.iic,
                    dateTimeCreated: invoiceParams.dateTimeCreated || toLocalIsoString(new Date()),
                    totalPrice: 0,
                    seller: { name: "" },
                    items: [],
                });
            });
    };

    const handleClose = () => {
        setScreen("list");
        setVerification({ status: "idle" });
        setSelectedInvoice(null);
        setManualPrefill(null);
    };

    const handleManualClose = () => {
        if (selectedInvoice) {
            setScreen("detail");
        } else {
            handleClose();
        }
    };

    const handleSelectInvoice = (invoice: SavedInvoice, returnTo: "list" | "buddyDetail" = "list") => {
        setSelectedInvoice(invoice);
        setDetailReturnScreen(returnTo);
        setScreen("detail");
    };

    const handleCloseDetail = () => {
        setVerification({ status: "idle" });
        setSelectedInvoice(null);
        setManualPrefill(null);
        setScreen(detailReturnScreen);
    };

    const handleDelete = () => {
        if (!selectedInvoice) {
            return;
        }
        Alert.alert(t("app.deleteInvoiceTitle"), t("app.deleteInvoiceMessage"), [
            { text: t("common.cancel"), style: "cancel" },
            {
                text: t("common.delete"),
                style: "destructive",
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
                    console.log("[OCR parse error]", parseError);
                    throw new Error(t("app.receiptParseError"));
                }
                const qrParams = toQrParams(parsed);
                setIsProcessingReceipt(false);
                setIsReceiptScannerVisible(false);

                const receiptPrefill: InvoiceVerificationResult = {
                    iic: parsed.iic ?? "",
                    dateTimeCreated: parsed.dateTimeCreated ?? toLocalIsoString(new Date()),
                    totalPrice: 0,
                    seller: { name: parsed.sellerName ?? "" },
                    items: parsed.items.map((item) => ({
                        name: item.name,
                        quantity: item.quantity,
                        unitPriceBeforeVat: item.unitPrice,
                        unitPriceAfterVat: item.unitPrice,
                    })),
                };

                if (qrParams) {
                    setScreen("invoice");
                    setVerification({ status: "loading" });
                    verifyInvoice(qrParams)
                        .then((data) => setVerification({ status: "success", data: { ...data, verified: true } }))
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
                    setScreen("detail");
                })
                .catch((error: Error) => {
                    setIsSaving(false);
                    showError(error.message);
                });
            return;
        }
        setVerification({ status: "success", data: { ...data, verified: false } });
        setScreen("invoice");
    };

    const handleConfirm = () => {
        if (verification.status !== "success") {
            return;
        }
        setIsSaving(true);
        saveInvoice(verification.data)
            .then(() => {
                setIsSaving(false);
                loadSavedInvoices();
                handleClose();
                if (!user?.isPremium) {
                    showInterstitialAd().catch(() => undefined);
                }
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
            {screen === "loading" ? (
                <Text style={styles.statusText}>{t("common.loading")}</Text>
            ) : screen === "auth" ? (
                <LoginScreen onAuthenticated={handleAuthenticated} />
            ) : MAIN_SCREENS.has(screen) ? (
                <View style={styles.mainWrapper}>
                    <View style={styles.headerRow}>
                        <Pressable style={styles.menuButton} hitSlop={12} onPress={() => setIsDrawerVisible(true)}>
                            <Ionicons name="menu-outline" size={20} color={colors.primary} />
                        </Pressable>
                        <Text style={styles.title}>Llogarite</Text>
                        <View style={styles.headerSpacer} />
                    </View>

                    <View style={styles.sheet}>
                        {screen === "dashboard" ? (
                            <DashboardScreen invoices={savedInvoices} />
                        ) : screen === "list" ? (
                            <FlatList
                                style={styles.list}
                                contentContainerStyle={styles.listContent}
                                data={filteredInvoices}
                                keyExtractor={(item) => item.id}
                                ListHeaderComponent={
                                    <MonthFilter value={selectedMonthKey} onChange={setSelectedMonthKey} />
                                }
                                renderItem={({ item }) => (
                                    <Pressable onPress={() => handleSelectInvoice(item)}>
                                        <GlassView style={styles.savedRow}>
                                            <View style={styles.savedRowLeft}>
                                                <View style={styles.savedRowIcon}>
                                                    <Ionicons
                                                        name={categoryIcon(dominantCategory(item))}
                                                        size={18}
                                                        color={colors.white}
                                                    />
                                                </View>
                                                <View style={styles.savedRowTextGroup}>
                                                    <View style={styles.savedSellerRow}>
                                                        <Text style={styles.savedSeller} numberOfLines={1}>
                                                            {item.data.seller.name}
                                                        </Text>
                                                        {item.data.verified && <VerifiedBadge size={15} />}
                                                    </View>
                                                    <Text style={styles.savedDate}>
                                                        {new Date(item.data.dateTimeCreated).toLocaleDateString()}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text style={styles.savedTotal}>{formatAmount(item.data.totalPrice)}</Text>
                                        </GlassView>
                                    </Pressable>
                                )}
                                ListEmptyComponent={
                                    <Text style={styles.emptyText}>
                                        {savedInvoices.length === 0
                                            ? t("app.noInvoicesSaved")
                                            : t("app.noInvoicesThisMonth")}
                                    </Text>
                                }
                            />
                        ) : screen === "budget" ? (
                            <BudgetScreen invoices={savedInvoices} />
                        ) : screen === "monthlyPayments" ? (
                            <MonthlyPaymentsScreen />
                        ) : screen === "projects" ? (
                            <ProjectsScreen invoices={savedInvoices} />
                        ) : screen === "products" ? (
                            <ProductsScreen
                                invoices={savedInvoices}
                                onSelectProduct={(product) => {
                                    setSelectedProduct(product);
                                    setScreen("productDetail");
                                }}
                            />
                        ) : (
                            <BuddiesScreen
                                onSelectBuddy={(buddy) => {
                                    setSelectedBuddy(buddy);
                                    setScreen("buddyDetail");
                                }}
                            />
                        )}
                    </View>

                    <ScanMenu
                        onScanQr={() => setIsScannerVisible(true)}
                        onAddManually={() => {
                            setSelectedInvoice(null);
                            setManualPrefill(null);
                            setScreen("manual");
                        }}
                        onScanReceipt={() => setIsReceiptScannerVisible(true)}
                    />
                </View>
            ) : screen === "manual" ? (
                <ManualInvoiceScreen
                    initialData={selectedInvoice?.data ?? manualPrefill ?? undefined}
                    isEditing={Boolean(selectedInvoice)}
                    isSaving={isSaving}
                    onClose={handleManualClose}
                    onSubmit={handleManualSubmit}
                />
            ) : screen === "invoice" ? (
                <InvoiceScreen
                    verification={verification}
                    isSaving={isSaving}
                    onClose={handleClose}
                    onConfirm={handleConfirm}
                />
            ) : screen === "plans" ? (
                <PlansScreen
                    isPremium={Boolean(user?.isPremium)}
                    onBack={() => setScreen("dashboard")}
                    onPremiumGranted={() => {
                        if (!user) {
                            return;
                        }
                        const updated = { ...user, isPremium: true };
                        setUser(updated);
                        saveUser(updated);
                    }}
                />
            ) : screen === "productDetail" ? (
                selectedProduct && (
                    <ProductDetailScreen
                        productKey={selectedProduct.key}
                        productName={selectedProduct.name}
                        invoices={savedInvoices}
                        onBack={() => setScreen("products")}
                    />
                )
            ) : screen === "buddyDetail" ? (
                selectedBuddy && (
                    <BuddyDetailScreen
                        buddyId={selectedBuddy.id}
                        buddyName={selectedBuddy.name ?? selectedBuddy.email}
                        invoices={savedInvoices}
                        onBack={() => setScreen("buddies")}
                        onSelectInvoice={(invoiceId) => {
                            const invoice = savedInvoices.find((candidate) => candidate.id === invoiceId);
                            if (invoice) {
                                handleSelectInvoice(invoice, "buddyDetail");
                            }
                        }}
                    />
                )
            ) : (
                selectedInvoice && (
                    <InvoiceScreen
                        verification={{ status: "success", data: selectedInvoice.data }}
                        onClose={handleCloseDetail}
                        isDeleting={isDeleting}
                        onDelete={handleDelete}
                        onEdit={() => setScreen("manual")}
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
                onRestartTour={() => {
                    setIsUserMenuVisible(false);
                    handleRestartOnboarding();
                }}
            />

            {isOnboarding && MAIN_SCREENS.has(screen) && (
                <OnboardingGuide
                    step={ONBOARDING_STEPS[onboardingStep]}
                    stepIndex={onboardingStep}
                    totalSteps={ONBOARDING_STEPS.length}
                    onNext={handleOnboardingNext}
                    onBack={handleOnboardingBack}
                    onSkip={finishOnboarding}
                />
            )}

            <SideDrawer
                visible={isDrawerVisible}
                activeScreen={screen}
                user={user}
                isPremium={Boolean(user?.isPremium)}
                pendingBuddyRequests={pendingBuddyRequests}
                onClose={() => setIsDrawerVisible(false)}
                onNavigate={(target) => {
                    setIsDrawerVisible(false);
                    setSelectedInvoice(null);
                    setManualPrefill(null);
                    if (PREMIUM_SCREENS.has(target) && !user?.isPremium) {
                        setScreen("plans");
                        return;
                    }
                    setScreen(target);
                }}
                onOpenAccount={() => {
                    setIsDrawerVisible(false);
                    setIsUserMenuVisible(true);
                }}
            />

            <StatusBar style={MAIN_SCREENS.has(screen) || screen === "auth" ? "light" : "auto"} />
            <ToastHost toasts={toasts} onDismiss={dismissToast} />
        </View>
    );
}

export default function App() {
    return (
        <LanguageProvider>
            <AppContent />
        </LanguageProvider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: HEADER_INSET,
        backgroundColor: colors.white,
    },
    mainWrapper: {
        flex: 1,
        marginTop: -HEADER_INSET,
        paddingTop: HEADER_INSET,
        backgroundColor: colors.primary,
    },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        paddingHorizontal: 24,
        height: 52,
    },
    title: {
        flex: 1,
        fontSize: 18,
        fontWeight: "600",
        color: colors.white,
        textAlign: "center",
        textAlignVertical: "center",
        includeFontPadding: false,
    },
    menuButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.white,
        alignSelf: "flex-start",
        zIndex: 1,
    },
    headerSpacer: {
        width: 32,
        alignSelf: "center",
    },
    sheet: {
        flex: 1,
        backgroundColor: colors.white,
        borderTopLeftRadius: radius.sheet,
        borderTopRightRadius: radius.sheet,
        overflow: "hidden",
    },
    statusText: {
        textAlign: "center",
        marginTop: 12,
        marginBottom: 8,
        color: "#4b5563",
    },
    list: {
        flex: 1,
    },
    listContent: {
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 120,
        gap: 12,
    },
    savedRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    savedRowLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        flexShrink: 1,
    },
    savedRowIcon: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primary,
    },
    savedRowTextGroup: {
        flexShrink: 1,
    },
    savedSellerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    savedSeller: {
        flexShrink: 1,
        fontSize: 15,
        fontWeight: "600",
        color: colors.textDark,
    },
    savedDate: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 2,
    },
    savedTotal: {
        fontSize: 15,
        fontWeight: "600",
        color: colors.primary,
    },
    emptyText: {
        textAlign: "center",
        color: "#6b7280",
        marginTop: 40,
    },
});
