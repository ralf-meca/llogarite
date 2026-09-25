import { scanFromURLAsync } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, BackHandler, FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider, initialWindowMetrics, useSafeAreaInsets } from "react-native-safe-area-context";
import { BuddiesScreen } from "./components/BuddiesScreen";
import { BuddyDetailScreen } from "./components/BuddyDetailScreen";
import { BudgetScreen } from "./components/BudgetScreen";
import { CategoryFilter } from "./components/CategoryFilter";
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
import { BottomNavBar, type NavScreen } from "./components/BottomNavBar";
import { ToastHost } from "./components/ToastHost";
import { UserAvatar } from "./components/UserAvatar";
import { UserMenuModal } from "./components/UserMenuModal";
import { VerifiedBadge } from "./components/VerifiedBadge";
import { useToasts } from "./hooks/useToasts";
import type { AuthResponse, AuthUser } from "./lib/authApi";
import { clearToken, clearUser, getToken, getUser, saveToken, saveUser } from "./lib/authStorage";
import { categoryIcon } from "./lib/categories";
import { dominantCategory, hasCategory } from "./lib/categorySpending";
import { formatAmount } from "./lib/formatAmount";
import { fetchBuddies, fetchBuddyRequests, type Buddy } from "./lib/buddiesApi";
import { fetchNotifications, markNotificationRead, syncMonthlyPaymentReminder } from "./lib/notificationsApi";
import { addPaymentReminderFiredListener } from "./lib/paymentNotifications";
import { NotificationBell } from "./components/NotificationBell";
import { showInterstitialAd } from "./lib/ads";
import { parseInvoiceQrUrl, verifyInvoice, type InvoiceItem, type InvoiceVerificationResult } from "./lib/invoiceApi";
import { toLocalIsoString } from "./lib/date";
import { monthKeyOf } from "./lib/monthlySpending";
import { useTranslation } from "./lib/i18n";
import { hasCompletedOnboarding, resetOnboarding, setOnboardingCompleted } from "./lib/onboarding";
import {
    addNotificationTapListener,
    getInitialNotificationData,
    registerPushToken,
    setAppBadgeCount,
} from "./lib/pushNotifications";
import { configurePurchases } from "./lib/purchases";
import { BOTTOM_NAV_HEIGHT, HEADER_INSET, colors, radius } from "./lib/theme";
import { normalizeKey, type ProductSummary } from "./lib/productPrices";
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
    | NavScreen
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

const PREMIUM_SCREENS = new Set<NavScreen>(["projects", "products", "buddies"]);

type OnboardingStepConfig = OnboardingStep & { screen: NavScreen };

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

// Mirrors the backend's own comparison (invoices.service.ts) so a scanned invoice's
// "verified" status only gets dropped when the item rows themselves actually changed
// during the edit step — not because of category auto-suggestion, VAT collapsing, or
// buddy-split fields that the form round-trips differently than the raw scan result.
function normalizeItemsForComparison(items: InvoiceItem[]) {
    return items.map((item) => ({
        name: item.name.trim(),
        quantity: item.quantity,
        unitPriceAfterVat: item.unitPriceAfterVat,
    }));
}

function haveItemsChanged(original: InvoiceItem[], next: InvoiceItem[]): boolean {
    return JSON.stringify(normalizeItemsForComparison(original)) !== JSON.stringify(normalizeItemsForComparison(next));
}

function AppContent() {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isScannerVisible, setIsScannerVisible] = useState(false);
    const [isReceiptScannerVisible, setIsReceiptScannerVisible] = useState(false);
    const [isProcessingReceipt, setIsProcessingReceipt] = useState(false);
    const [isUserMenuVisible, setIsUserMenuVisible] = useState(false);
    const [verification, setVerification] = useState<VerificationState>({ status: "idle" });
    const [screen, setScreen] = useState<Screen>("loading");
    const [savedInvoices, setSavedInvoices] = useState<SavedInvoice[]>([]);
    const [selectedInvoice, setSelectedInvoice] = useState<SavedInvoice | null>(null);
    const [manualPrefill, setManualPrefill] = useState<InvoiceVerificationResult | null>(null);
    // Set only when the prefilled data came from a successful QR verification, so
    // handleManualSubmit knows to save it directly (preserving "verified" unless the
    // user actually changed the item rows) instead of routing back through the
    // separate review-then-confirm screen used for plain manual entry.
    const [scannedVerifiedData, setScannedVerifiedData] = useState<InvoiceVerificationResult | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedProduct, setSelectedProduct] = useState<ProductSummary | null>(null);
    const [productDetailReturnScreen, setProductDetailReturnScreen] = useState<"products" | "detail">("products");
    const [selectedBuddy, setSelectedBuddy] = useState<Buddy | null>(null);
    const [detailReturnScreen, setDetailReturnScreen] = useState<"list" | "buddyDetail" | "buddies">("list");
    const [pendingBuddyRequests, setPendingBuddyRequests] = useState(0);
    const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
    const [buddiesInitialTab, setBuddiesInitialTab] = useState<"owedByMe" | "owedToMe">("owedToMe");
    const [highlightInvoiceId, setHighlightInvoiceId] = useState<string | null>(null);
    const [isOnboarding, setIsOnboarding] = useState(false);
    const [onboardingStep, setOnboardingStep] = useState(0);
    const { toasts, showError, showSuccess, dismissToast } = useToasts();

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

    // Notification payloads only carry a buddy id, so reaching BuddyDetailScreen (which
    // needs the full Buddy object) means looking it up first.
    const navigateToBuddyDetail = useCallback((buddyId: string) => {
        fetchBuddies()
            .then((buddies) => {
                const buddy = buddies.find((candidate) => candidate.id === buddyId);
                if (buddy) {
                    setSelectedBuddy(buddy);
                    setScreen("buddyDetail");
                } else {
                    setScreen("buddies");
                }
            })
            .catch(() => setScreen("buddies"));
    }, []);

    useEffect(() => {
        getToken().then((token) => {
            if (!token) {
                setScreen("auth");
                return;
            }
            getUser().then(setUser);
            getInitialNotificationData().then((payload) => {
                const data = payload?.data;
                console.log("cold-start notification data", JSON.stringify(data));
                if (data?.type === "invoice_notify_paid" && data.invoiceId) {
                    setBuddiesInitialTab("owedToMe");
                    setHighlightInvoiceId(data.invoiceId);
                    setScreen("buddies");
                } else if (data?.type === "buddy_request") {
                    setScreen("buddies");
                } else if (data?.type === "invoice_buddy_added" && data.buddyId) {
                    navigateToBuddyDetail(data.buddyId);
                } else if (data?.type === "monthly_payment_reminder" && data.paymentId) {
                    syncMonthlyPaymentReminder({
                        paymentId: data.paymentId,
                        title: payload?.title ?? "",
                        body: payload?.body ?? "",
                    }).then((notification) => {
                        if (notification) {
                            markNotificationRead(notification.id);
                        }
                    });
                    setScreen("monthlyPayments");
                } else {
                    setScreen("dashboard");
                    startOnboardingIfNeeded();
                }
                if (data?.notificationId) {
                    markNotificationRead(data.notificationId);
                }
            });
        });
    }, [startOnboardingIfNeeded, navigateToBuddyDetail]);

    useEffect(() => {
        const step = ONBOARDING_STEPS[onboardingStep];
        if (isOnboarding && step) {
            setScreen(step.screen);
        }
    }, [isOnboarding, onboardingStep]);

    useEffect(() => {
        if (screen === "dashboard" || screen === "list" || screen === "budget" || screen === "buddies") {
            loadSavedInvoices();
        }
    }, [screen, loadSavedInvoices]);

    useEffect(() => {
        if (MAIN_SCREENS.has(screen)) {
            fetchBuddyRequests()
                .then((requests) => setPendingBuddyRequests(requests.length))
                .catch(() => {});
            fetchNotifications()
                .then((notifications) => {
                    const count = notifications.filter((n) => !n.read).length;
                    setUnreadNotificationsCount(count);
                    setAppBadgeCount(count);
                })
                .catch(() => {});
        }
    }, [screen]);

    useEffect(() => {
        if (user) {
            registerPushToken();
            configurePurchases(user.id);
        }
    }, [user]);

    useEffect(() => {
        return addNotificationTapListener((payload) => {
            const data = payload.data;
            if (data.type === "invoice_notify_paid" && data.invoiceId) {
                loadSavedInvoices();
                setBuddiesInitialTab("owedToMe");
                setHighlightInvoiceId(data.invoiceId);
                setScreen("buddies");
            } else if (data.type === "buddy_request") {
                setScreen("buddies");
            } else if (data.type === "invoice_buddy_added" && data.buddyId) {
                navigateToBuddyDetail(data.buddyId);
            } else if (data.type === "monthly_payment_reminder" && data.paymentId) {
                syncMonthlyPaymentReminder({
                    paymentId: data.paymentId,
                    title: payload.title ?? "",
                    body: payload.body ?? "",
                }).then((notification) => {
                    if (notification) {
                        markNotificationRead(notification.id);
                    }
                });
                setScreen("monthlyPayments");
            }
            if (data.notificationId) {
                markNotificationRead(data.notificationId);
            }
        });
    }, [loadSavedInvoices, navigateToBuddyDetail]);

    useEffect(() => {
        return addPaymentReminderFiredListener((payload) => {
            syncMonthlyPaymentReminder(payload);
        });
    }, []);

    const handleNavigate = (target: NavScreen) => {
        setSelectedInvoice(null);
        setManualPrefill(null);
        if (PREMIUM_SCREENS.has(target) && !user?.isPremium) {
            setScreen("plans");
            return;
        }
        setScreen(target);
    };

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
        if (onboardingStep >= ONBOARDING_STEPS.length - 1) {
            finishOnboarding();
            return;
        }
        // Clamp inside the updater too: two taps batched into one render both read
        // the same stale `onboardingStep`, so the guard above passes twice while the
        // functional updates still stack — which used to walk past the last step.
        setOnboardingStep((current) => Math.min(current + 1, ONBOARDING_STEPS.length - 1));
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

    const openVerifiedScanForEdit = (data: InvoiceVerificationResult) => {
        setSelectedInvoice(null);
        setScannedVerifiedData(data);
        setManualPrefill(data);
        setScreen("manual");
    };

    const findExistingInvoice = (iic: string) => savedInvoices.find((invoice) => invoice.iic === iic);

    const goToExistingInvoice = (existing: SavedInvoice) => {
        showSuccess(t("app.invoiceAlreadyExists"));
        handleSelectInvoice(existing);
    };

    const handleScanned = (scannedText: string) => {
        setIsScannerVisible(false);

        const invoiceParams = parseInvoiceQrUrl(scannedText);
        if (!invoiceParams) {
            setScreen("invoice");
            setVerification({ status: "invalid" });
            return;
        }

        const existing = findExistingInvoice(invoiceParams.iic);
        if (existing) {
            goToExistingInvoice(existing);
            return;
        }

        setScreen("invoice");
        setVerification({ status: "loading" });
        verifyInvoice(invoiceParams)
            .then((data) => openVerifiedScanForEdit({ ...data, verified: true }))
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
        setScannedVerifiedData(null);
    };

    const handleManualClose = () => {
        if (selectedInvoice) {
            setScreen("detail");
        } else {
            handleClose();
        }
    };

    const handleSelectInvoice = (invoice: SavedInvoice, returnTo: "list" | "buddyDetail" | "buddies" = "list") => {
        setSelectedInvoice(invoice);
        setDetailReturnScreen(returnTo);
        setScreen("detail");
    };

    const handleCloseDetail = () => {
        setVerification({ status: "idle" });
        setSelectedInvoice(null);
        setManualPrefill(null);
        setScannedVerifiedData(null);
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

    const runOcrFallback = (photoUri: string) => {
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
                    const existing = findExistingInvoice(qrParams.iic);
                    if (existing) {
                        goToExistingInvoice(existing);
                        return;
                    }

                    setScreen("invoice");
                    setVerification({ status: "loading" });
                    verifyInvoice(qrParams)
                        .then((data) => openVerifiedScanForEdit({ ...data, verified: true }))
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

    // Android hardware/gesture back. Navigation here is a screen state machine
    // rather than a real navigator, so nothing was intercepting back and it fell
    // straight through to closing the app. Returning true consumes the press.
    const handleHardwareBack = (): boolean => {
        if (isScannerVisible) {
            setIsScannerVisible(false);
            return true;
        }
        if (isReceiptScannerVisible) {
            setIsReceiptScannerVisible(false);
            return true;
        }
        if (isUserMenuVisible) {
            setIsUserMenuVisible(false);
            return true;
        }
        if (isOnboarding) {
            if (onboardingStep === 0) {
                finishOnboarding();
            } else {
                handleOnboardingBack();
            }
            return true;
        }

        switch (screen) {
            case "detail":
                handleCloseDetail();
                return true;
            case "manual":
                handleManualClose();
                return true;
            case "invoice":
                handleClose();
                return true;
            case "productDetail":
                setScreen(productDetailReturnScreen);
                return true;
            case "buddyDetail":
                setScreen("buddies");
                return true;
            case "plans":
                setScreen("dashboard");
                return true;
            case "dashboard":
            case "auth":
            case "loading":
                // Home tab (or pre-auth): fall through so Android closes the app.
                return false;
            default:
                // Any other main screen returns to the home tab.
                setScreen("dashboard");
                return true;
        }
    };

    // Subscribe once, but always run the latest closure — re-subscribing on every
    // render would be needed otherwise, since the handler closes over screen state.
    const hardwareBackRef = useRef(handleHardwareBack);
    hardwareBackRef.current = handleHardwareBack;

    useEffect(() => {
        const subscription = BackHandler.addEventListener("hardwareBackPress", () =>
            hardwareBackRef.current(),
        );
        return () => subscription.remove();
    }, []);

    const handleReceiptCaptured = (photoUri: string) => {
        setIsProcessingReceipt(true);

        scanFromURLAsync(photoUri, ["qr"])
            .then((results) => {
                const qrData = results[0]?.data;
                const invoiceParams = qrData ? parseInvoiceQrUrl(qrData) : null;

                if (!invoiceParams) {
                    runOcrFallback(photoUri);
                    return;
                }

                setIsProcessingReceipt(false);
                setIsReceiptScannerVisible(false);

                const existing = findExistingInvoice(invoiceParams.iic);
                if (existing) {
                    goToExistingInvoice(existing);
                    return;
                }

                setScreen("invoice");
                setVerification({ status: "loading" });
                verifyInvoice(invoiceParams)
                    .then((data) => openVerifiedScanForEdit({ ...data, verified: true }))
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
            })
            .catch(() => runOcrFallback(photoUri));
    };

    const handleUploadFromGallery = () => {
        ImagePicker.requestMediaLibraryPermissionsAsync()
            .then((permission) => {
                if (!permission.granted) {
                    showError(t("scanMenu.galleryPermissionDenied"));
                    return;
                }
                return ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ["images"],
                    quality: 1,
                }).then((result) => {
                    if (!result.canceled && result.assets[0]) {
                        handleReceiptCaptured(result.assets[0].uri);
                    }
                });
            })
            .catch((error: Error) => showError(error.message));
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

        if (scannedVerifiedData) {
            const verified = !haveItemsChanged(scannedVerifiedData.items, data.items);
            setIsSaving(true);
            saveInvoice({ ...data, verified })
                .then(() => {
                    setIsSaving(false);
                    setScannedVerifiedData(null);
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

    const filteredInvoices = savedInvoices.filter(
        (invoice) =>
            (selectedMonthKey === null || monthKeyOf(invoice.data.dateTimeCreated) === selectedMonthKey) &&
            (selectedCategory === null || hasCategory(invoice, selectedCategory)),
    );

    return (
        <View style={styles.container}>
            {screen === "loading" ? (
                <Text style={styles.statusText}>{t("common.loading")}</Text>
            ) : screen === "auth" ? (
                <LoginScreen onAuthenticated={handleAuthenticated} />
            ) : MAIN_SCREENS.has(screen) ? (
                <View style={styles.mainWrapper}>
                    <View style={styles.headerRow}>
                        <Pressable
                            style={styles.headerAvatar}
                            hitSlop={12}
                            onPress={() => setIsUserMenuVisible(true)}
                        >
                            <UserAvatar user={user} size={32} />
                        </Pressable>
                        <Text style={styles.title}>Llogarite</Text>
                        <NotificationBell
                            unreadCount={unreadNotificationsCount}
                            onOpened={() => {
                                setUnreadNotificationsCount(0);
                                setAppBadgeCount(0);
                            }}
                            onSelectBuddyId={navigateToBuddyDetail}
                            onNavigateToBuddies={() => setScreen("buddies")}
                            onNavigateToMonthlyPayments={() => setScreen("monthlyPayments")}
                        />
                    </View>

                    <View style={[styles.sheet, { paddingBottom: BOTTOM_NAV_HEIGHT + insets.bottom }]}>
                        {screen === "dashboard" ? (
                            <DashboardScreen
                                invoices={savedInvoices}
                                onSelectBudget={() => setScreen("budget")}
                                onSelectInvoiceList={() => setScreen("list")}
                                onSelectInvoice={(invoice) => handleSelectInvoice(invoice, "list")}
                            />
                        ) : screen === "list" ? (
                            <FlatList
                                style={styles.list}
                                contentContainerStyle={styles.listContent}
                                data={filteredInvoices}
                                keyExtractor={(item) => item.id}
                                ListHeaderComponent={
                                    <View style={styles.listFilters}>
                                        <MonthFilter
                                            value={selectedMonthKey}
                                            onChange={setSelectedMonthKey}
                                            style={styles.monthFilterSlot}
                                        />
                                        <CategoryFilter
                                            value={selectedCategory}
                                            onChange={setSelectedCategory}
                                            style={styles.categoryFilterSlot}
                                        />
                                    </View>
                                }
                                renderItem={({ item }) => (
                                    <Pressable onPress={() => handleSelectInvoice(item)}>
                                        <GlassView style={styles.savedRow}>
                                            <View style={styles.savedRowLeft}>
                                                <View style={styles.savedRowIcon}>
                                                    {(() => {
                                                        const DominantIcon = categoryIcon(
                                                            selectedCategory ?? dominantCategory(item),
                                                        );
                                                        return <DominantIcon size={18} color={colors.primary} />;
                                                    })()}
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
                                            : selectedCategory !== null
                                              ? t("app.noInvoicesForCategory")
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
                                    setProductDetailReturnScreen("products");
                                    setScreen("productDetail");
                                }}
                            />
                        ) : (
                            <BuddiesScreen
                                userId={user?.id ?? ""}
                                invoices={savedInvoices}
                                onInvoicesChanged={loadSavedInvoices}
                                initialTab={buddiesInitialTab}
                                highlightInvoiceId={highlightInvoiceId}
                                onSelectBuddy={(buddy) => {
                                    setSelectedBuddy(buddy);
                                    setScreen("buddyDetail");
                                }}
                                onSelectInvoice={(invoiceId) => {
                                    const invoice = savedInvoices.find((candidate) => candidate.id === invoiceId);
                                    if (invoice) {
                                        handleSelectInvoice(invoice, "buddies");
                                    }
                                }}
                            />
                        )}
                    </View>

                    <BottomNavBar
                        activeScreen={screen}
                        isPremium={Boolean(user?.isPremium)}
                        pendingBuddyRequests={pendingBuddyRequests}
                        onNavigate={handleNavigate}
                    />
                    <ScanMenu
                        onScanQr={() => setIsScannerVisible(true)}
                        onAddManually={() => {
                            setSelectedInvoice(null);
                            setManualPrefill(null);
                            setScreen("manual");
                        }}
                        onScanReceipt={() => setIsReceiptScannerVisible(true)}
                        onUploadFromGallery={handleUploadFromGallery}
                    />

                </View>
            ) : screen === "manual" ? (
                <ManualInvoiceScreen
                    initialData={selectedInvoice?.data ?? manualPrefill ?? undefined}
                    isEditing={Boolean(selectedInvoice)}
                    isSaving={isSaving}
                    onClose={handleManualClose}
                    onBack={handleCloseDetail}
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
                        onBack={() => setScreen(productDetailReturnScreen)}
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
                        onInvoicesChanged={loadSavedInvoices}
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
                        onSelectItem={(item) => {
                            setSelectedProduct({ key: normalizeKey(item.name), name: item.name });
                            setProductDetailReturnScreen("detail");
                            setScreen("productDetail");
                        }}
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

            <Modal visible={isProcessingReceipt && !isReceiptScannerVisible} transparent animationType="fade">
                <View style={styles.processingOverlay}>
                    <View style={styles.processingCard}>
                        <ActivityIndicator color={colors.primary} size="large" />
                        <Text style={styles.processingText}>{t("receiptScanner.processing")}</Text>
                    </View>
                </View>
            </Modal>

            <UserMenuModal
                visible={isUserMenuVisible}
                user={user}
                onClose={() => setIsUserMenuVisible(false)}
                onLogout={handleLogout}
                onRestartTour={() => {
                    setIsUserMenuVisible(false);
                    handleRestartOnboarding();
                }}
                onOpenPlans={() => {
                    setIsUserMenuVisible(false);
                    setSelectedInvoice(null);
                    setManualPrefill(null);
                    setScreen("plans");
                }}
                onUserUpdated={(updated) => {
                    setUser(updated);
                    saveUser(updated);
                }}
            />

            {isOnboarding && MAIN_SCREENS.has(screen) && ONBOARDING_STEPS[onboardingStep] && (
                <OnboardingGuide
                    step={ONBOARDING_STEPS[onboardingStep]}
                    stepIndex={onboardingStep}
                    totalSteps={ONBOARDING_STEPS.length}
                    onNext={handleOnboardingNext}
                    onBack={handleOnboardingBack}
                    onSkip={finishOnboarding}
                />
            )}

            <StatusBar style={MAIN_SCREENS.has(screen) || screen === "auth" || screen === "manual" ? "light" : "auto"} />
            <ToastHost toasts={toasts} onDismiss={dismissToast} />
        </View>
    );
}

// initialMetrics seeds the insets synchronously from native at startup. Without
// it the first frame renders with zero insets and only corrects once native
// reports back — which on some devices (e.g. Oppo/ColorOS) leaves the nav bar
// sitting under the system buttons.
export default function App() {
    return (
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
            <KeyboardProvider>
                <LanguageProvider>
                    <AppContent />
                </LanguageProvider>
            </KeyboardProvider>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: HEADER_INSET,
        backgroundColor: colors.white,
    },
    processingOverlay: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.4)",
    },
    processingCard: {
        alignItems: "center",
        gap: 12,
        paddingVertical: 24,
        paddingHorizontal: 32,
        borderRadius: 20,
        backgroundColor: colors.white,
    },
    processingText: {
        fontSize: 14,
        fontWeight: "600",
        color: colors.textDark,
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
    headerAvatar: {
        width: 32,
        height: 32,
        alignSelf: "flex-start",
        zIndex: 1,
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
    listFilters: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    // No wrapping: when the two labels are too long for one row the month pill
    // gives up twice as much width as the category one, because category names
    // run long ("Argetim & Sherbime") and month names do not.
    monthFilterSlot: {
        flexShrink: 2,
    },
    categoryFilterSlot: {
        flexShrink: 1,
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
        backgroundColor: colors.primaryTint,
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
