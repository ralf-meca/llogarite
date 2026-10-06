import { scanFromURLAsync } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    AppState,
    BackHandler,
    FlatList,
    Linking,
    Modal,
    PanResponder,
    Platform,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider, initialWindowMetrics, useSafeAreaInsets } from "react-native-safe-area-context";
import { BuddiesScreen } from "./components/BuddiesScreen";
import { UpdateGate } from "./components/UpdateGate";
import { BuddyDetailScreen } from "./components/BuddyDetailScreen";
import { BudgetScreen } from "./components/BudgetScreen";
import { CategoryFilter } from "./components/CategoryFilter";
import { DashboardScreen } from "./components/DashboardScreen";
import { InvoiceReviewScreen } from "./components/InvoiceReviewScreen";
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
import { ProjectDetailScreen } from "./components/ProjectDetailScreen";
import { ProjectFormScreen } from "./components/ProjectFormScreen";
import { ProjectsScreen } from "./components/ProjectsScreen";
import { QrScannerModal } from "./components/QrScannerModal";
import { ReceiptScannerModal } from "./components/ReceiptScannerModal";
import { ScreenTransition, type TransitionDirection } from "./components/ScreenTransition";
import { ScanMenu } from "./components/ScanMenu";
import { BottomNavBar, type NavScreen } from "./components/BottomNavBar";
import { ToastHost } from "./components/ToastHost";
import { UserAvatar } from "./components/UserAvatar";
import { UserMenuModal } from "./components/UserMenuModal";
import { VerifiedBadge } from "./components/VerifiedBadge";
import { useToasts } from "./hooks/useToasts";
import type { AuthResponse, AuthUser } from "./lib/authApi";
import { clearToken, clearUser, getToken, getUser, saveToken, saveUser } from "./lib/authStorage";
import { categoryColor, categoryIcon, categoryLabelKey, categoryPlaceKey } from "./lib/categories";
import { dominantCategory, hasCategory } from "./lib/categorySpending";
import { formatAmount } from "./lib/formatAmount";
import { fetchBuddies, fetchBuddyRequests, type Buddy } from "./lib/buddiesApi";
import { fetchNotifications, markNotificationRead, syncMonthlyPaymentReminder } from "./lib/notificationsApi";
import { addPaymentReminderFiredListener } from "./lib/paymentNotifications";
import { NotificationBell } from "./components/NotificationBell";
import { preloadInterstitialAd, showInterstitialAd } from "./lib/ads";
import { fetchAccountStatus } from "./lib/usersApi";
import { parseInvoiceQrUrl, verifyInvoice, type InvoiceItem, type InvoiceVerificationResult } from "./lib/invoiceApi";
import { toLocalIsoString } from "./lib/date";
import { currentMonthKey, monthKeyOf } from "./lib/monthlySpending";
import { fetchSharedPrices } from "./lib/pricesApi";
import { fetchProjects, findActiveTrip, type Project } from "./lib/projectsApi";
import { useTranslation } from "./lib/i18n";
import { hasCompletedOnboarding, resetOnboarding, setOnboardingCompleted } from "./lib/onboarding";
import {
    addNotificationTapListener,
    type PushNotificationPayload,
    getInitialNotificationData,
    registerPushToken,
    setAppBadgeCount,
} from "./lib/pushNotifications";
import { configurePurchases } from "./lib/purchases";
import { BOTTOM_NAV_HEIGHT, HEADER_INSET, colors, radius } from "./lib/theme";
import { normalizeKey, type PricedInvoice, type ProductSummary } from "./lib/productPrices";
import { recognizeReceipt } from "./lib/receiptOcr";
import { parseReceipt, toQrParams } from "./lib/receiptParser";
import {
    deleteInvoice,
    fetchSavedInvoices,
    saveInvoice,
    updateInvoice,
    type OwedInvoice,
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
    | "plans"
    | "projectDetail"
    | "projectForm";

const MAIN_SCREENS = new Set<Screen>([
    "dashboard",
    "list",
    "budget",
    "monthlyPayments",
    "projects",
    "products",
    "buddies",
    "review",
]);

// How deep into the app a screen sits, for which way it arrives: going deeper comes
// in from the right, coming back out from the left, and moving sideways just fades.
// The tabs are 0; anything not listed is too.
const SCREEN_DEPTH: Partial<Record<Screen, number>> = {
    detail: 1,
    invoice: 1,
    plans: 1,
    projectDetail: 1,
    buddyDetail: 1,
    manual: 2,
    productDetail: 2,
    projectForm: 2,
};

function transitionBetween(from: Screen, to: Screen): TransitionDirection {
    if (from === "loading" || from === "auth" || to === "auth") {
        return "fade";
    }
    const change = (SCREEN_DEPTH[to] ?? 0) - (SCREEN_DEPTH[from] ?? 0);
    return change > 0 ? "forward" : change < 0 ? "back" : "fade";
}

const PREMIUM_SCREENS = new Set<NavScreen>(["projects", "products", "buddies"]);
// How long after a purchase the server is given to hear of it from the store
// before its "not premium" is believed.
const PURCHASE_SETTLE_MS = 10 * 60 * 1000;
// How far in from the left edge a drag may start and still count as "back" on
// iOS, and the screens where it does not apply.
const BACK_SWIPE_EDGE_WIDTH = 32;
const BACK_SWIPE_OFF_SCREENS = new Set<Screen>(["dashboard", "auth", "loading"]);

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
    // On the home screen a swipe towards the right pulls the profile drawer in
    // from the left edge, the way it slides. Only a clearly sideways drag is
    // claimed, so scrolling the page up and down is left alone.
    const homeSwipe = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponderCapture: (_event, gesture) =>
                gesture.dx > 14 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,
            onPanResponderRelease: (_event, gesture) => {
                if (gesture.dx > 56 || gesture.vx > 0.5) {
                    setIsUserMenuVisible(true);
                }
            },
        }),
    ).current;
    const [isPlansOverlayOpen, setIsPlansOverlayOpen] = useState(false);
    // Everyone's accepted invoices, not the signed-in user's own: the price
    // screens compare across people now, which is the point of reviewing them.
    const [sharedPrices, setSharedPrices] = useState<PricedInvoice[]>([]);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    // The project open in the form screen; null there means a new one.
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    // Where the form screen was opened from, and so where leaving it leads.
    const [projectFormReturn, setProjectFormReturn] = useState<"projects" | "projectDetail">("projects");
    // The trip under way today, looked up when the app opens. New invoices are
    // filed against it by default.
    const [activeTrip, setActiveTrip] = useState<Project | null>(null);
    const [verification, setVerification] = useState<VerificationState>({ status: "idle" });
    const [screen, setScreen] = useState<Screen>("loading");
    const [savedInvoices, setSavedInvoices] = useState<SavedInvoice[]>([]);
    const [selectedInvoice, setSelectedInvoice] = useState<SavedInvoice | null>(null);
    const [manualPrefill, setManualPrefill] = useState<InvoiceVerificationResult | null>(null);
    // Set only when the prefilled data came from a successful QR verification, so
    // the save can keep the "verified" flag, unless the user actually changed the
    // item rows.
    const [scannedVerifiedData, setScannedVerifiedData] = useState<InvoiceVerificationResult | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedProduct, setSelectedProduct] = useState<ProductSummary | null>(null);
    const [productDetailReturnScreen, setProductDetailReturnScreen] = useState<"products" | "detail">("products");
    const [selectedBuddy, setSelectedBuddy] = useState<Buddy | null>(null);
    const [detailReturnScreen, setDetailReturnScreen] = useState<
        "list" | "buddyDetail" | "buddies" | "projectDetail"
    >("list");
    // Set when the open invoice is someone else's expense on a shared project:
    // it can be read, but editing and deleting stay with whoever entered it.
    const [isDetailReadOnly, setIsDetailReadOnly] = useState(false);
    // Who entered the open invoice, when it is not the signed-in user.
    const [detailOwner, setDetailOwner] = useState<{
        id: string;
        name: string | null;
        email: string;
        avatarUrl: string | null;
    } | null>(null);
    const [pendingBuddyRequests, setPendingBuddyRequests] = useState(0);
    const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
    const [buddiesInitialTab, setBuddiesInitialTab] = useState<"owedByMe" | "owedToMe">("owedToMe");
    // Held rather than acted on straight away: a link can arrive before the
    // session is restored, and the buddies screen is no use while logged out.
    const [pendingBuddyCode, setPendingBuddyCode] = useState<string | null>(null);
    // A sign-in link opened from the code email: the address and code it carried.
    const [pendingLogin, setPendingLogin] = useState<{ email: string; code: string } | null>(null);
    const [highlightInvoiceId, setHighlightInvoiceId] = useState<string | null>(null);
    // Bumped whenever a notification sends the reader somewhere. It is the `key` of the
    // screens a notification can lead to, so each one opens afresh and fetches again.
    const [notificationRefreshKey, setNotificationRefreshKey] = useState(0);
    const [isOnboarding, setIsOnboarding] = useState(false);
    const [onboardingStep, setOnboardingStep] = useState(0);
    const { toasts, showError, showSuccess, dismissToast } = useToasts();

    // Which way the screen now showing came in, worked out as the screen changes.
    const shownScreenRef = useRef<Screen>("loading");
    const screenDirectionRef = useRef<TransitionDirection>("fade");
    const tabDirectionRef = useRef<TransitionDirection>("none");

    // For a pull down on a list: unlike loadSavedInvoices it can be waited on, and a
    // failure leaves what is already on screen where it is.
    const [isListRefreshing, setIsListRefreshing] = useState(false);
    const refreshSavedInvoices = useCallback(
        () =>
            fetchSavedInvoices()
                .then(setSavedInvoices)
                .catch((error: Error) => showError(error.message)),
        [showError],
    );

    const loadSavedInvoices = useCallback(() => {
        fetchSavedInvoices()
            .then(setSavedInvoices)
            .catch((error: Error) => {
                setSavedInvoices([]);
                showError(error.message);
            });
    }, [showError]);

    // Quiet on failure: this only pre-fills a field, so a missed lookup costs a
    // tap rather than an error worth interrupting for.
    const loadActiveTrip = useCallback(() => {
        fetchProjects()
            .then((projects) => setActiveTrip(findActiveTrip(projects, toLocalIsoString(new Date()).slice(0, 10))))
            .catch(() => setActiveTrip(null));
    }, []);

    // Premium is saved on the device at sign-in, and a subscription can end, or
    // start on another device, long after that. So the server is asked again
    // whenever the app is opened or brought back to the front.
    //
    // The server hears of a purchase from the store a little after the app
    // does, and closing the store's sheet brings the app to the front. Without
    // the pause below, that first check would take premium away again seconds
    // after it was bought.
    const premiumGrantedAt = useRef(0);
    const refreshAccountStatus = useCallback(() => {
        fetchAccountStatus()
            .then((status) => {
                if (!status) {
                    return;
                }
                if (!status.isPremium && Date.now() - premiumGrantedAt.current < PURCHASE_SETTLE_MS) {
                    return;
                }
                setUser((current) => {
                    if (!current || (current.isPremium === status.isPremium && current.isAdmin === status.isAdmin)) {
                        return current;
                    }
                    const updated = { ...current, ...status };
                    saveUser(updated);
                    return updated;
                });
            })
            .catch(() => undefined);
    }, []);

    // Projects are a premium feature, so a free account has no trip to default to.
    const userId = user?.id;
    const isPremiumUser = Boolean(user?.isPremium);
    useEffect(() => {
        if (userId && isPremiumUser) {
            loadActiveTrip();
        } else {
            setActiveTrip(null);
        }
    }, [userId, isPremiumUser, loadActiveTrip]);

    useEffect(() => {
        if (!userId) {
            return;
        }
        refreshAccountStatus();
        const subscription = AppState.addEventListener("change", (state) => {
            if (state === "active") {
                refreshAccountStatus();
            }
        });
        return () => subscription.remove();
    }, [userId, refreshAccountStatus]);

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

    // Whether anything is waiting on the reader: buddy requests, and the bell's unread
    // count (which is also the number on the app's icon).
    const refreshBadges = useCallback(() => {
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
    }, []);

    // Where a tapped notification leads, from a cold start and from a running app alike.
    // Returns whether it led anywhere.
    //
    // The screens read their data when they open and not again, so a tap on a
    // notification while already looking at the screen it points to would show whatever
    // was loaded before the thing it is about happened. Bumping the key opens the screen
    // afresh, and what is kept above the screens - the reader's own invoices, which a
    // buddy paying changes, and the counts - is asked for again.
    const handleNotificationOpened = (payload: PushNotificationPayload | null): boolean => {
        const data = payload?.data;
        if (!data) {
            return false;
        }
        let isHandled = true;
        if (data.type === "invoice_notify_paid" && data.invoiceId) {
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
                title: payload?.title ?? "",
                body: payload?.body ?? "",
            }).then((notification) => {
                if (notification) {
                    markNotificationRead(notification.id);
                }
            });
            setScreen("monthlyPayments");
        } else {
            isHandled = false;
        }
        if (isHandled) {
            setNotificationRefreshKey((key) => key + 1);
            loadSavedInvoices();
            refreshBadges();
        }
        if (data.notificationId) {
            markNotificationRead(data.notificationId);
        }
        return isHandled;
    };
    const notificationOpenedRef = useRef(handleNotificationOpened);
    notificationOpenedRef.current = handleNotificationOpened;

    useEffect(() => {
        getToken().then((token) => {
            if (!token) {
                setScreen("auth");
                return;
            }
            getUser().then(setUser);
            getInitialNotificationData().then((payload) => {
                console.log("cold-start notification data", JSON.stringify(payload?.data));
                if (!notificationOpenedRef.current(payload)) {
                    setScreen("dashboard");
                    startOnboardingIfNeeded();
                }
            });
        });
    }, [startOnboardingIfNeeded]);

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
        if (user && !user.isPremium) {
            preloadInterstitialAd();
        }
    }, [user]);

    useEffect(() => {
        if (MAIN_SCREENS.has(screen)) {
            refreshBadges();
        }
    }, [screen, refreshBadges]);

    useEffect(() => {
        if (user) {
            registerPushToken();
            configurePurchases(user.id);
        }
    }, [user]);

    useEffect(() => {
        return addNotificationTapListener((payload) => {
            notificationOpenedRef.current(payload);
        });
    }, []);

    useEffect(() => {
        return addPaymentReminderFiredListener((payload) => {
            syncMonthlyPaymentReminder(payload);
        });
    }, []);

    // llogarite://shoku?code=123456, sent by the invite page on the site, and
    // llogarite://hyr?kodi=123456&email=..., sent by the button in the sign-in
    // email. The sign-in code goes by `kodi` so that it is never mistaken for a
    // buddy code, here or by app versions that only know the first kind.
    //
    // On iOS the site's own links open the app directly, so the sign-in one
    // also arrives as the page's address: https://llogarite.site/hyr/#k=...&e=...
    useEffect(() => {
        const readCode = (url: string | null) => {
            const login =
                url?.match(/[?&]kodi=(\d{6})(?:\D|$)/) ?? url?.match(/\/hyr\/?(?:\?[^#]*)?#(?:[^#]*&)?k=(\d{6})(?:\D|$)/);
            if (login) {
                const address = url?.match(/[?&]email=([^&#]+)/) ?? url?.match(/#(?:[^#]*&)?e=([^&#]+)/);
                let email = "";
                try {
                    email = address ? decodeURIComponent(address[1]) : "";
                } catch {
                    email = "";
                }
                setPendingLogin({ email, code: login[1] });
                return;
            }
            const match = url?.match(/[?&]code=(\d{6})(?:\D|$)/);
            if (match) {
                setPendingBuddyCode(match[1]);
            }
        };
        Linking.getInitialURL().then(readCode).catch(() => undefined);
        const subscription = Linking.addEventListener("url", (event) => readCode(event.url));
        return () => subscription.remove();
    }, []);

    // A sign-in link is only for someone signed out. Opened while signed in it
    // is dropped, so it cannot sit waiting and sign someone in after a later
    // sign-out.
    useEffect(() => {
        if (pendingLogin && user) {
            setPendingLogin(null);
        }
    }, [pendingLogin, user]);

    useEffect(() => {
        if (!pendingBuddyCode || !user) {
            return;
        }
        // Buddies is a premium screen, and an invite link must not be a way
        // around that. Same PREMIUM_SCREENS lookup handleNavigate uses, so the
        // rule cannot drift between the two ways in.
        if (PREMIUM_SCREENS.has("buddies") && !user.isPremium) {
            setPendingBuddyCode(null);
            setScreen("plans");
            return;
        }
        setScreen("buddies");
    }, [pendingBuddyCode, user]);

    const handleNavigate = (target: NavScreen) => {
        setSelectedInvoice(null);
        setManualPrefill(null);
        // Leaving the projects screen is the one moment a trip may have been
        // added, moved or removed, so the lookup is repeated then.
        if (screen === "projects" && target !== "projects" && user?.isPremium) {
            loadActiveTrip();
        }
        if (PREMIUM_SCREENS.has(target) && !user?.isPremium) {
            setScreen("plans");
            return;
        }
        setScreen(target);
    };

    // Fetched on arrival rather than at startup: it is everyone's data, it only
    // grows, and most sessions never open these two screens.
    useEffect(() => {
        if (screen !== "products" && screen !== "productDetail") {
            return;
        }
        fetchSharedPrices()
            .then(setSharedPrices)
            .catch(() => setSharedPrices([]));
    }, [screen]);

    const handlePremiumGranted = () => {
        if (!user) {
            return;
        }
        premiumGrantedAt.current = Date.now();
        const updated = { ...user, isPremium: true };
        setUser(updated);
        saveUser(updated);
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

    // Where a scan ends up when the invoice could not be had from the tax
    // authority: the form, with whatever was read off the paper. The form
    // alone does not say why it opened, so the reader is told.
    const fallbackToManualEntry = (prefill: InvoiceVerificationResult) => {
        showError(t(prefill.items.length > 0 ? "app.receiptPartlyRead" : "app.receiptNotRead"));
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

    const handleSelectInvoice = (
        invoice: SavedInvoice,
        returnTo: "list" | "buddyDetail" | "buddies" | "projectDetail" = "list",
        readOnly = false,
        owner: { id: string; name: string | null; email: string; avatarUrl: string | null } | null = null,
    ) => {
        setSelectedInvoice(invoice);
        setIsDetailReadOnly(readOnly);
        setDetailOwner(owner);
        setDetailReturnScreen(returnTo);
        setScreen("detail");
    };

    // Someone else's invoice that the user owes a share on: shown read-only, as
    // the buddy's, since only its owner can change it.
    const openOwedInvoice = (invoice: OwedInvoice, returnTo: "buddies" | "buddyDetail") => {
        handleSelectInvoice(
            { id: invoice.id, iic: invoice.iic, data: invoice.data, createdAt: invoice.createdAt },
            returnTo,
            true,
            {
                id: invoice.user.id,
                name: invoice.user.name,
                email: invoice.user.email,
                avatarUrl: invoice.user.avatarUrl,
            },
        );
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
        if (isPlansOverlayOpen) {
            setIsPlansOverlayOpen(false);
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
            case "projectDetail":
                setScreen("projects");
                return true;
            case "projectForm":
                setScreen(projectFormReturn);
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

    // iOS has no back button or system back gesture for an app that keeps its
    // own screens, so a drag in from the left edge does what Android's back
    // does. Only a drag that starts at the edge and runs sideways is claimed,
    // which leaves taps and scrolling alone. Not on the home screen, where the
    // same drag opens the profile drawer, nor before signing in.
    const backSwipeScreenRef = useRef(screen);
    backSwipeScreenRef.current = screen;
    const backSwipe = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponderCapture: (_event, gesture) =>
                !BACK_SWIPE_OFF_SCREENS.has(backSwipeScreenRef.current) &&
                gesture.x0 <= BACK_SWIPE_EDGE_WIDTH &&
                gesture.dx > 12 &&
                Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,
            onPanResponderRelease: (_event, gesture) => {
                if (gesture.dx > 60 || gesture.vx > 0.5) {
                    hardwareBackRef.current();
                }
            },
        }),
    ).current;
    const backSwipeHandlers = Platform.OS === "ios" ? backSwipe.panHandlers : {};

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

        // Only a scan can claim an invoice is verified, and only while its rows
        // still say what the scan read.
        const verified = scannedVerifiedData ? !haveItemsChanged(scannedVerifiedData.items, data.items) : false;
        setIsSaving(true);
        saveInvoice({ ...data, verified })
            .then(() => {
                setIsSaving(false);
                setScannedVerifiedData(null);
                loadSavedInvoices();
                handleClose();
                if (!user?.isPremium) {
                    showInterstitialAd();
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

    if (shownScreenRef.current !== screen) {
        const from = shownScreenRef.current;
        screenDirectionRef.current = transitionBetween(from, screen);
        // A tab reached from another tab fades in by itself. One reached from outside
        // them arrives with the whole tabbed frame, so it has nothing of its own to do.
        tabDirectionRef.current = MAIN_SCREENS.has(from) && MAIN_SCREENS.has(screen) ? "fade" : "none";
        shownScreenRef.current = screen;
    }

    return (
        <View style={styles.container} {...backSwipeHandlers}>
            {/* The tabs share one frame - header, sheet, bar - which stays put while they
                change inside it; every other screen is a frame of its own. */}
            <ScreenTransition
                key={MAIN_SCREENS.has(screen) ? "main" : screen}
                direction={screenDirectionRef.current}
            >
            {screen === "loading" ? (
                <Text style={styles.statusText}>{t("common.loading")}</Text>
            ) : screen === "auth" ? (
                <LoginScreen
                    onAuthenticated={handleAuthenticated}
                    loginLink={pendingLogin}
                    onLoginLinkHandled={() => setPendingLogin(null)}
                />
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
                            onSelectBuddyId={(buddyId) => {
                                setNotificationRefreshKey((key) => key + 1);
                                navigateToBuddyDetail(buddyId);
                            }}
                            onNavigateToBuddies={() => {
                                setNotificationRefreshKey((key) => key + 1);
                                setScreen("buddies");
                            }}
                            onNavigateToMonthlyPayments={() => {
                                setNotificationRefreshKey((key) => key + 1);
                                setScreen("monthlyPayments");
                            }}
                        />
                    </View>

                    <View style={[styles.sheet, { paddingBottom: BOTTOM_NAV_HEIGHT + insets.bottom }]}>
                        <ScreenTransition key={screen} direction={tabDirectionRef.current}>
                        {screen === "dashboard" ? (
                            <View style={styles.homeSwipeArea} {...homeSwipe.panHandlers}>
                                <DashboardScreen
                                    invoices={savedInvoices}
                                    userId={user?.id ?? ""}
                                    onRefresh={refreshSavedInvoices}
                                    onSelectBuddies={(tab) => {
                                        // Same rule as every other way in: buddies are a
                                        // Premium screen.
                                        if (PREMIUM_SCREENS.has("buddies") && !user?.isPremium) {
                                            setScreen("plans");
                                            return;
                                        }
                                        setBuddiesInitialTab(tab);
                                        setScreen("buddies");
                                    }}
                                    onSelectBudget={() => setScreen("budget")}
                                    onSelectInvoiceList={() => setScreen("list")}
                                    onSelectCategory={(categoryId) => {
                                        // The card counts this month only, so the list it opens is
                                        // scoped the same way - otherwise tapping a figure lands you
                                        // on a list that disagrees with it.
                                        setSelectedCategory(categoryId);
                                        setSelectedMonthKey(currentMonthKey());
                                        setScreen("list");
                                    }}
                                    onSelectInvoice={(invoice) => handleSelectInvoice(invoice, "list")}
                                />
                            </View>
                        ) : screen === "list" ? (
                            <FlatList
                                style={styles.list}
                                contentContainerStyle={styles.listContent}
                                data={filteredInvoices}
                                keyExtractor={(item) => item.id}
                                refreshControl={
                                    <RefreshControl
                                        refreshing={isListRefreshing}
                                        onRefresh={() => {
                                            setIsListRefreshing(true);
                                            refreshSavedInvoices().finally(() => setIsListRefreshing(false));
                                        }}
                                        colors={[colors.primary]}
                                        tintColor={colors.primary}
                                    />
                                }
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
                                renderItem={({ item }) => {
                                    // The row wears the active filter's category when there is
                                    // one, the invoice's own otherwise - same as the home page rows.
                                    const rowCategory = selectedCategory ?? dominantCategory(item);
                                    const RowIcon = categoryIcon(rowCategory);
                                    return (
                                        <Pressable style={styles.savedRow} onPress={() => handleSelectInvoice(item)}>
                                            <View
                                                style={[
                                                    styles.savedRowIcon,
                                                    { backgroundColor: categoryColor(rowCategory) },
                                                ]}
                                            >
                                                <RowIcon size={20} color={colors.white} weight="fill" />
                                            </View>
                                            <View style={styles.savedRowTextGroup}>
                                                <View style={styles.savedSellerRow}>
                                                    {/* Manual invoices often have no seller, which left the
                                                        row's only identifying line blank. Falls back to the
                                                        kind of place the invoice reads like, from the category
                                                        its spending mostly sits in. dominantCategory, not the
                                                        active filter the icon uses - otherwise every row would
                                                        say the same word while a filter is on. */}
                                                    <Text
                                                        style={[
                                                            styles.savedSeller,
                                                            !item.data.seller.name.trim() && styles.savedSellerFallback,
                                                        ]}
                                                        numberOfLines={1}
                                                    >
                                                        {item.data.seller.name.trim() ||
                                                            t(categoryPlaceKey(dominantCategory(item)))}
                                                    </Text>
                                                    {item.data.verified && <VerifiedBadge size={15} />}
                                                </View>
                                                <Text style={styles.savedDate} numberOfLines={1}>
                                                    {new Date(item.data.dateTimeCreated).toLocaleDateString()} ·{" "}
                                                    {t(categoryLabelKey(rowCategory))}
                                                </Text>
                                            </View>
                                            <Text style={styles.savedTotal}>{formatAmount(item.data.totalPrice)}</Text>
                                        </Pressable>
                                    );
                                }}
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
                            <MonthlyPaymentsScreen key={notificationRefreshKey} />
                        ) : screen === "projects" ? (
                            <ProjectsScreen
                                invoices={savedInvoices}
                                currentUserId={user?.id ?? ""}
                                onSelectProject={(project) => {
                                    setSelectedProject(project);
                                    setScreen("projectDetail");
                                }}
                                onAddProject={() => {
                                    setEditingProject(null);
                                    setProjectFormReturn("projects");
                                    setScreen("projectForm");
                                }}
                                onEditProject={(project) => {
                                    setEditingProject(project);
                                    setProjectFormReturn("projects");
                                    setScreen("projectForm");
                                }}
                            />
                        ) : screen === "review" ? (
                            <InvoiceReviewScreen />
                        ) : screen === "products" ? (
                            <ProductsScreen
                                invoices={sharedPrices}
                                onSelectProduct={(product) => {
                                    setSelectedProduct(product);
                                    setProductDetailReturnScreen("products");
                                    setScreen("productDetail");
                                }}
                            />
                        ) : (
                            <BuddiesScreen
                                key={notificationRefreshKey}
                                userId={user?.id ?? ""}
                                invoices={savedInvoices}
                                onInvoicesChanged={loadSavedInvoices}
                                initialTab={buddiesInitialTab}
                                highlightInvoiceId={highlightInvoiceId}
                                initialCode={pendingBuddyCode}
                                onInitialCodeHandled={() => setPendingBuddyCode(null)}
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
                                onSelectOwedInvoice={(invoice) => openOwedInvoice(invoice, "buddies")}
                            />
                        )}
                        </ScreenTransition>
                    </View>

                    <BottomNavBar
                        activeScreen={screen}
                        isPremium={Boolean(user?.isPremium)}
                        isAdmin={Boolean(user?.isAdmin)}
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
                    isPremium={Boolean(user?.isPremium)}
                    activeTrip={activeTrip}
                    lockCurrency={Boolean(scannedVerifiedData)}
                    currentUser={user}
                    onClose={handleManualClose}
                    onBack={handleCloseDetail}
                    onRequirePremium={() => setIsPlansOverlayOpen(true)}
                    onSubmit={handleManualSubmit}
                />
            ) : screen === "invoice" ? (
                <InvoiceScreen verification={verification} onClose={handleClose} />
            ) : screen === "plans" ? (
                <PlansScreen
                    isPremium={Boolean(user?.isPremium)}
                    onBack={() => setScreen("dashboard")}
                    onPremiumGranted={handlePremiumGranted}
                />
            ) : screen === "productDetail" ? (
                selectedProduct && (
                    <ProductDetailScreen
                        productKey={selectedProduct.key}
                        productName={selectedProduct.name}
                        invoices={sharedPrices}
                        onBack={() => setScreen(productDetailReturnScreen)}
                    />
                )
            ) : screen === "projectForm" ? (
                <ProjectFormScreen
                    project={editingProject}
                    onClose={() => setScreen(projectFormReturn)}
                    onDone={(saved) => {
                        // A trip may have been added, moved or removed, which
                        // changes what new invoices default to.
                        loadActiveTrip();
                        // Back to the project it was opened from, as it now
                        // stands - or to the list, when it no longer exists.
                        if (saved && projectFormReturn === "projectDetail") {
                            setSelectedProject(saved);
                            setScreen("projectDetail");
                        } else {
                            setScreen("projects");
                        }
                    }}
                />
            ) : screen === "projectDetail" ? (
                selectedProject && (
                    <ProjectDetailScreen
                        project={selectedProject}
                        currentUserId={user?.id ?? ""}
                        currentUser={user}
                        onInvoicesChanged={loadSavedInvoices}
                        onBack={() => setScreen("projects")}
                        onLeft={() => {
                            // It may have been the trip under way, which new
                            // invoices would otherwise still default to.
                            loadActiveTrip();
                            setSelectedProject(null);
                            setScreen("projects");
                            showSuccess(t("app.projectLeft"));
                        }}
                        onEdit={() => {
                            setEditingProject(selectedProject);
                            setProjectFormReturn("projectDetail");
                            setScreen("projectForm");
                        }}
                        onSelectExpense={(expense) => {
                            // Opened from the expense the project just fetched, not
                            // from the saved list: that copy is only as fresh as
                            // its last load, and showed a share as unpaid right
                            // after it was settled here. A buddy's opens read-only,
                            // since it belongs to them.
                            const invoice = {
                                id: expense.id,
                                iic: expense.data.iic,
                                data: expense.data,
                                createdAt: expense.createdAt,
                            };
                            const isSomeoneElses = expense.ownerId !== user?.id;
                            handleSelectInvoice(
                                invoice,
                                "projectDetail",
                                isSomeoneElses,
                                isSomeoneElses
                                    ? {
                                          id: expense.ownerId,
                                          name: expense.ownerName,
                                          email: expense.ownerEmail,
                                          avatarUrl: null,
                                      }
                                    : null,
                            );
                        }}
                    />
                )
            ) : screen === "buddyDetail" ? (
                selectedBuddy && (
                    <BuddyDetailScreen
                        key={notificationRefreshKey}
                        buddyId={selectedBuddy.id}
                        buddyName={selectedBuddy.name ?? selectedBuddy.email}
                        userId={user?.id ?? ""}
                        invoices={savedInvoices}
                        onSelectOwedInvoice={(invoice) => openOwedInvoice(invoice, "buddyDetail")}
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
                        owner={isDetailReadOnly ? detailOwner : user}
                        ownerIsViewer={!isDetailReadOnly}
                        onDelete={isDetailReadOnly ? undefined : handleDelete}
                        onEdit={isDetailReadOnly ? undefined : () => setScreen("manual")}
                        onSelectItem={(item) => {
                            setSelectedProduct({ key: normalizeKey(item.name), name: item.name });
                            setProductDetailReturnScreen("detail");
                            setScreen("productDetail");
                        }}
                    />
                )
            )}
            </ScreenTransition>

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

            {/* A plain overlay on iOS rather than a Modal. Reading the receipt ends
                by opening the invoice form, whose item editor is a Modal of its
                own - and iOS will not present one Modal while another is still
                being dismissed. The second never appears, yet goes on swallowing
                every touch, and the app looks frozen. */}
            {Platform.OS === "ios" ? (
                isProcessingReceipt &&
                !isReceiptScannerVisible && (
                    <View style={[StyleSheet.absoluteFill, styles.processingOverlay]}>
                        <View style={styles.processingCard}>
                            <ActivityIndicator color={colors.primary} size="large" />
                            <Text style={styles.processingText}>{t("receiptScanner.processing")}</Text>
                        </View>
                    </View>
                )
            ) : (
                <Modal visible={isProcessingReceipt && !isReceiptScannerVisible} transparent animationType="fade">
                    <View style={styles.processingOverlay}>
                        <View style={styles.processingCard}>
                            <ActivityIndicator color={colors.primary} size="large" />
                            <Text style={styles.processingText}>{t("receiptScanner.processing")}</Text>
                        </View>
                    </View>
                </Modal>
            )}

            {/* Opened by the locked project/buddy controls on the expense form. An
                overlay rather than a screen change on purpose: switching screens
                unmounts the form, and with it the invoice being written. Buying
                from here therefore lands back on that form, unlocked. */}
            <Modal
                visible={isPlansOverlayOpen}
                animationType="slide"
                onRequestClose={() => setIsPlansOverlayOpen(false)}
            >
                <View style={styles.container}>
                    <PlansScreen
                        isPremium={Boolean(user?.isPremium)}
                        onBack={() => setIsPlansOverlayOpen(false)}
                        onPremiumGranted={handlePremiumGranted}
                    />
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
            {/* Above the tab bar where there is one, so a notice never covers it. */}
            <ToastHost
                toasts={toasts}
                onDismiss={dismissToast}
                bottomOffset={MAIN_SCREENS.has(screen) ? BOTTOM_NAV_HEIGHT + 28 : undefined}
            />
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
                    <UpdateGate />
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
    homeSwipeArea: {
        flex: 1,
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
        gap: 14,
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
    // Flat rows, like the recent invoices on the home page: no card and no
    // outline, just the category tile, two lines of text and the amount.
    savedRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    savedRowIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
    },
    savedRowTextGroup: {
        flex: 1,
    },
    savedSellerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    savedSeller: {
        flexShrink: 1,
        fontSize: 13,
        fontWeight: "600",
        color: colors.textDark,
    },
    // Muted, so a guessed place never reads as a name someone actually entered.
    savedSellerFallback: {
        color: colors.textMuted,
    },
    savedDate: {
        fontSize: 9,
        color: colors.textMuted,
        marginTop: 1,
    },
    savedTotal: {
        fontSize: 15,
        fontWeight: "700",
        color: colors.textDark,
    },
    emptyText: {
        textAlign: "center",
        color: "#6b7280",
        marginTop: 40,
    },
});
