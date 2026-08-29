import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Store, Package, Sparkles, Smartphone, Monitor,
  ArrowRight, ArrowLeft, Plus, Trash2, Check, ShoppingBag, 
  X, ExternalLink, Save, RefreshCw, Eye, Code, Phone, Info,
  ShieldCheck, LogOut, FileCheck, Sliders, Users, Settings,
  CheckCircle2
} from "lucide-react";

import { Product, StoreConfig, ELEGANT_PRESET, TECH_PRESET } from "./types";
import StorePreview from "./components/StorePreview";
import ControlPanel from "./components/ControlPanel";
import type { ControlTab } from "./features/store-builder/controlPanelTypes";
import DomainSetupModal from "./components/DomainSetupModal";
import ServerPricingPlans from "./components/ServerPricingPlans";
import AdminAuthModal from "./components/AdminAuthModal";
import AppToast, { type AppToastMessage } from "./app/AppToast";
import type { AppView } from "./app/appTypes";
import { isCentralFrontendHost } from "./app/hostRouting";
import PublicStorefrontScreen from "./features/storefront/PublicStorefrontScreen";
import WorkspaceRecoveryOverlays from "./features/store-builder/WorkspaceRecoveryOverlays";
import MerchantPortal from "./features/merchant/MerchantPortal";
import MerchantStoreOperations from "./components/MerchantStoreOperations";
import PlatformAdminConsole from "./components/PlatformAdminConsole";
import { canAccessPlatformConsole, safeAdminSection, type AdminSection } from "./features/admin/adminAccess";
import { useUiAdapters } from "./adapters/UiAdaptersContext";
import { adminPath, adminStorePath, merchantStorePath, parseCentralRoute, pushCentralPath, replaceCentralPath, type MerchantStoreSection } from "./app/centralNavigation";
import {
  isUiError,
  isUiErrorCode,
  uiErrorMessage,
  type StoreSubmission,
  type StoreDraft,
  type StoreWorkspace,
  type UserProfile,
  type CreateOrderInput,
  type OrderReceipt,
  type StorefrontBootstrap,
} from "./adapters/uiAdapters";
import { requestFingerprint } from "./utils/requestFingerprint";
import {
  LatestWorkspaceLoad,
  classifyMerchantRestore,
  hasRecoverableWorkspaceChanges,
  isAsyncWorkspaceResultCurrent,
  isRevisionConflict,
  mayDiscardDirtyWorkspace,
  openWorkspaceConflict,
  reloadWorkspaceConflict,
  resolveWorkspaceConflict,
  shouldApplyWorkspaceResponse,
  shouldClaimAiSave,
  tenantSafeConfig,
  type MerchantRestoreResult,
  type WorkspaceConflictReviewState,
  type WorkspaceConflictState,
} from "./workflows/merchantWorkspaceState";
import { reconcileCartWithStorefront } from "./workflows/orderState";
import { usePlatformSettings } from "./adapters/PlatformSettingsContext";
import AuthRoutePage from "./features/auth/AuthRoutePage";
import AccountPage from "./features/account/AccountPage";
import MerchantOnboardingPage from "./features/onboarding/MerchantOnboardingPage";
import PlatformLandingHero from "./features/landing/PlatformLandingHero";
import PlatformJourneySection from "./features/landing/PlatformJourneySection";
import PlatformCapabilitiesSection from "./features/landing/PlatformCapabilitiesSection";
import PlatformTemplatesSection from "./features/landing/PlatformTemplatesSection";
import PlatformLandingClosure from "./features/landing/PlatformLandingClosure";
import { refreshMerchantLifecycleSnapshot } from "./workflows/merchantLifecycleRefresh";
import { coordinateCustomizationCompletion } from "./workflows/customizationCompletion";
import { loadPublicStorefrontWithRecovery, publicStorefrontFailureMessage } from "./workflows/publicStorefrontRecovery";
import { randomUuid } from "./utils/randomUuid";

export default function App() {
  const {
    auth,
    assistant,
    provisioning,
    workspace: workspaceActions,
    orders: orderActions,
  } = useUiAdapters();
  const { settings: platformSettings } = usePlatformSettings();
  // Navigation State: 'landing' | 'templates' | 'builder' | 'merchant_dashboard'
  const [view, setView] = useState<AppView>("landing");
  const [publicStorefront, setPublicStorefront] = useState<StorefrontBootstrap | null>(null);
  const [publicStorefrontError, setPublicStorefrontError] = useState<string | null>(null);
  const [publicStorefrontLoading, setPublicStorefrontLoading] = useState(false);
  const publicStorefrontRequest = useRef<AbortController | null>(null);
  
  // Platform Administrator States
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAdminAuthModalOpen, setIsAdminAuthModalOpen] = useState(false);
  const [adminSection, setAdminSection] = useState<AdminSection>("overview");
  const [adminStoreId, setAdminStoreId] = useState<string | undefined>();
  const [adminSettingsDirty, setAdminSettingsDirty] = useState(false);
  const adminSettingsDirtyRef = useRef(false);
  
  // Customization Configuration
  const [config, setConfig] = useState<StoreConfig>(ELEGANT_PRESET);
  const [activeTab, setActiveTab] = useState<ControlTab>("branding");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  
  // Landing Page Interactive Phone Teaser Sector State
  const [teaserSector, setTeaserSector] = useState<"perfumes" | "tech" | "coffee" | "fashion">("perfumes");

  const teaserSectorsData = {
    perfumes: {
      id: "perfumes",
      label: "عطور وبخور",
      icon: "🌸",
      storeName: "لورين للعطور",
      tagline: "جديد صيف 2026",
      title: "تألق بعطور العود الملوكية",
      primaryColor: "#f59e0b",
      bgColor: "#121110",
      cardBg: "from-amber-950/60 to-amber-900/20",
      cardBorder: "border-amber-500/30",
      btnBg: "bg-amber-500 text-neutral-950 hover:bg-amber-400",
      preset: ELEGANT_PRESET
    },
    tech: {
      id: "tech",
      label: "إلكترونيات وتقنية",
      icon: "⚡",
      storeName: "تك زون للإلكترونيات",
      tagline: "عروض التكنولوجيا 2026",
      title: "أحدث الساعات والأجهزة الذكية",
      primaryColor: "#38bdf8",
      bgColor: "#090d18",
      cardBg: "from-sky-950/60 to-blue-900/20",
      cardBorder: "border-sky-500/30",
      btnBg: "bg-sky-500 text-slate-950 hover:bg-sky-400",
      preset: TECH_PRESET
    },
    coffee: {
      id: "coffee",
      label: "قهوة ومحامص",
      icon: "☕",
      storeName: "محمصة أرابيكا",
      tagline: "بن طازج محمص",
      title: "مذاق القهوة المختصة الفاخرة",
      primaryColor: "#f59e0b",
      bgColor: "#160e0a",
      cardBg: "from-orange-950/60 to-amber-900/20",
      cardBorder: "border-orange-500/30",
      btnBg: "bg-amber-600 text-white hover:bg-amber-500",
      preset: {
        ...ELEGANT_PRESET,
        storeName: "محمصة أرابيكا",
        slogan: "القهوة المختصة والبن الفاخر المحمص بعناية",
        logoIcon: "☕",
        primaryColor: "#7c2d12"
      }
    },
    fashion: {
      id: "fashion",
      label: "أزياء وبوتيك",
      icon: "👗",
      storeName: "بوتيك لوميير",
      tagline: "تشكيلة الموسم الجديد",
      title: "تصميمات وعبايات حصرية راقية",
      primaryColor: "#fb7185",
      bgColor: "#170a12",
      cardBg: "from-rose-950/60 to-pink-900/20",
      cardBorder: "border-rose-500/30",
      btnBg: "bg-rose-600 text-white hover:bg-rose-500",
      preset: ELEGANT_PRESET
    }
  };
  
  // App-level alerts / messages
  const [toast, setToast] = useState<AppToastMessage | null>(null);
  
  // AI Generation States
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  
  // Registered Merchant User Profile State
  const [authUser, setAuthUser] = useState<UserProfile | null>(null);
  const [authRestoring, setAuthRestoring] = useState(true);
  
  const [registeredUser, setRegisteredUser] = useState<any>(null);
  const [merchantStores, setMerchantStores] = useState<StoreSubmission[]>([]);
  const [merchantOnboardingDraft, setMerchantOnboardingDraft] = useState<StoreDraft | null>(null);
  const [merchantDraftLoading, setMerchantDraftLoading] = useState(false);
  const [merchantDraftError, setMerchantDraftError] = useState<string | null>(null);
  const [merchantStoresLoading, setMerchantStoresLoading] = useState(false);
  const [merchantStoresError, setMerchantStoresError] = useState<string | null>(null);
  const [merchantStoreRoute, setMerchantStoreRoute] = useState<{ tenantId: string; section: MerchantStoreSection } | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<StoreWorkspace | null>(null);
  const [activeDraft, setActiveDraft] = useState<StoreDraft | null>(null);
  const [localDraft, setLocalDraft] = useState<StoreConfig | null>(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [workspaceSaving, setWorkspaceSaving] = useState(false);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceConflict, setWorkspaceConflict] = useState<WorkspaceConflictState | null>(null);
  const [workspaceConflictReview, setWorkspaceConflictReview] = useState<WorkspaceConflictReviewState | null>(null);
  const [pendingArchivedProductIds, setPendingArchivedProductIds] = useState<string[]>([]);
  const workspaceEditGeneration = useRef(0);
  const workspaceOperationSequence = useRef(0);
  const merchantRestoreSequence = useRef(0);
  const merchantLifecycleRefreshSequence = useRef(0);
  const workspaceLoads = useRef(new LatestWorkspaceLoad());
  const draftLoads = useRef(new LatestWorkspaceLoad());
  const draftOperationSequence = useRef(0);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const workspaceDirty = useMemo(
    () => activeWorkspace !== null && (
      JSON.stringify(config) !== JSON.stringify(activeWorkspace.config)
      || pendingArchivedProductIds.length > 0
    ),
    [activeWorkspace, config, pendingArchivedProductIds],
  );
  const draftDirty = useMemo(
    () => activeWorkspace === null && authUser !== null && view === "builder"
      && JSON.stringify(config) !== JSON.stringify(activeDraft?.config ?? ELEGANT_PRESET),
    [activeWorkspace, activeDraft, authUser, config, view],
  );
  const workspaceEditorLocked = workspaceLoading || workspaceSaving || draftLoading || draftSaving || workspaceConflict !== null;
  const canViewInventory = activeWorkspace?.capabilities.inventoryView ?? false;
  const recoverableWorkspaceChanges = hasRecoverableWorkspaceChanges(
    workspaceDirty || draftDirty,
    workspaceConflict !== null,
    workspaceConflictReview !== null,
  );

  useEffect(() => {
    if (!recoverableWorkspaceChanges) return;
    const protectDirtyWorkspace = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protectDirtyWorkspace);
    return () => window.removeEventListener("beforeunload", protectDirtyWorkspace);
  }, [recoverableWorkspaceChanges]);

  // Store Interactive States inside Preview (Simulating Client Store)
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("الكل");
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [hasOrdered, setHasOrdered] = useState(false);
  const [storePreviewPageOverride, setStorePreviewPageOverride] = useState<string | null>(null);
  
  // Template Preview before Selection State
  const [previewingTemplate, setPreviewingTemplate] = useState<"elegant" | "tech" | null>(null);
  const [previewingDevice, setPreviewingDevice] = useState<"desktop" | "mobile">("desktop");
  
  // Full screen preview modal & domain setup modal
  const [showFullScreenPreview, setShowFullScreenPreview] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDomainModalOpen, setIsDomainModalOpen] = useState(false);

  // Local storage persists only store drafts. Authentication is restored from Laravel's session.
  useEffect(() => {
    const saved = localStorage.getItem("mobtaker_custom_store");
    if (saved) {
      try {
        const parsed = tenantSafeConfig(JSON.parse(saved) as StoreConfig);
        const basePreset = parsed.themeStyle === "tech" ? TECH_PRESET : ELEGANT_PRESET;
        setConfig({
          ...basePreset,
          ...parsed,
          heroBannerImage: parsed.heroBannerImage || basePreset.heroBannerImage,
          showHeroBanner: parsed.showHeroBanner !== false
        });
        setLocalDraft(parsed);
      } catch (e) {
        console.error("Error loading saved config", e);
      }
    }

    localStorage.removeItem("mobtaker_user_registration");
    const initialRoute = parseCentralRoute(window.location.pathname);
    auth.session()
      .then(async (profile) => {
        setAuthUser(profile);
        if (!isCentralFrontendHost(window.location.hostname)) return;
        if (!profile) {
          if (["account", "merchant", "merchant-new", "merchant-store", "merchant-correction", "admin"].includes(initialRoute.name)) {
            window.location.replace(`/login?returnTo=${encodeURIComponent(window.location.pathname)}`);
          }
          return;
        }

        if (initialRoute.name === "auth" || initialRoute.name === "account" || initialRoute.name === "merchant-new") return;

        if (initialRoute.name === "admin") {
          setAdminSection(initialRoute.section);
          setAdminStoreId(initialRoute.storeId);
          setIsAdminAuthModalOpen(false);
          setIsAdminOpen(true);
          return;
        }

        if (canAccessPlatformConsole(profile)) {
          const section = safeAdminSection("overview", profile) ?? "overview";
          setAdminSection(section);
          replaceCentralPath(adminPath(section));
          setIsAdminAuthModalOpen(false);
          setIsAdminOpen(true);
          return;
        }

        const builderSections: MerchantStoreSection[] = ["design", "checkout", "pages"];
        const requestedTenantId = initialRoute.name === "merchant-store" && builderSections.includes(initialRoute.section)
          ? initialRoute.tenantId
          : undefined;
        const outcome = await restoreMerchantState(profile, requestedTenantId);
        if (outcome.status === "error") {
          if (outcome.sessionActive) {
            setView("merchant_dashboard");
            replaceCentralPath("/app");
          }
          return;
        }
        if (initialRoute.name === "merchant-correction") {
          await openMerchantCorrectionById(initialRoute.tenantId, profile);
          return;
        }
        if (initialRoute.name === "merchant-store") {
          const requestedStore = outcome.stores.find((store) => store.id === initialRoute.tenantId) ?? null;
          const requiredCapabilities = requestedStore?.capabilities.workspaceManage;
          if (builderSections.includes(initialRoute.section) && outcome.loadedTenantId === initialRoute.tenantId && requiredCapabilities) {
            setActiveTab(initialRoute.section === "design" ? "branding" : initialRoute.section === "products" ? "products" : initialRoute.section);
            setView("builder");
            replaceCentralPath(merchantStorePath(initialRoute.tenantId, initialRoute.section));
            return;
          }
          const safeSection = builderSections.includes(initialRoute.section) ? "overview" : initialRoute.section;
          setMerchantStoreRoute({ tenantId: initialRoute.tenantId, section: safeSection });
          setView("merchant_store");
          replaceCentralPath(merchantStorePath(initialRoute.tenantId, safeSection));
          return;
        }
        setView("merchant_dashboard");
        replaceCentralPath("/app");
      })
      .catch(() => {
        setAuthUser(null);
        resetTenantOwnedState();
        if (["account", "merchant", "merchant-new", "merchant-store", "merchant-correction", "admin"].includes(initialRoute.name)) {
          window.location.replace(`/login?returnTo=${encodeURIComponent(window.location.pathname)}`);
        }
      })
      .finally(() => setAuthRestoring(false));

    // Dedicated Admin Route Check (/admin or #admin)
    const currentHash = window.location.hash;
    if (isCentralFrontendHost(window.location.hostname)
      && (initialRoute.name === "admin" || currentHash === "#admin")) {
      setIsAdminAuthModalOpen(true);
    }
  }, []);

  const loadPublicStorefront = useCallback(async () => {
    publicStorefrontRequest.current?.abort();
    const controller = new AbortController();
    publicStorefrontRequest.current = controller;
    setView("storefront");
    setPublicStorefront(null);
    setPublicStorefrontError(null);
    setPublicStorefrontLoading(true);

    try {
      const storefront = await loadPublicStorefrontWithRecovery(orderActions.loadStorefront, controller.signal);
      if (publicStorefrontRequest.current !== controller) return;
      setPublicStorefront(storefront);
      setConfig(storefront.config);
    } catch (error) {
      if (publicStorefrontRequest.current !== controller || controller.signal.aborted || isUiError(error, "aborted")) return;
      setPublicStorefrontError(publicStorefrontFailureMessage(error));
    } finally {
      if (publicStorefrontRequest.current === controller) {
        publicStorefrontRequest.current = null;
        setPublicStorefrontLoading(false);
      }
    }
  }, [orderActions]);

  useEffect(() => {
    if (window.location.pathname.startsWith("/admin") || isCentralFrontendHost(window.location.hostname)) return;
    void loadPublicStorefront();
    return () => {
      publicStorefrontRequest.current?.abort();
      publicStorefrontRequest.current = null;
    };
  }, [loadPublicStorefront]);

  const triggerToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const merchantProfile = (user: UserProfile, store: StoreSubmission) => ({
    fullName: user.fullName,
    email: user.email,
    businessName: store.storeName,
    businessType: store.businessType,
  });

  const resetTenantOwnedState = () => {
    workspaceOperationSequence.current += 1;
    merchantRestoreSequence.current += 1;
    merchantLifecycleRefreshSequence.current += 1;
    draftOperationSequence.current += 1;
    workspaceLoads.current.invalidate();
    draftLoads.current.invalidate();
    setWorkspaceLoading(false);
    setWorkspaceSaving(false);
    setWorkspaceConflict(null);
    setWorkspaceConflictReview(null);
    setPendingArchivedProductIds([]);
    setActiveWorkspace(null);
    setActiveDraft(null);
    setDraftLoading(false);
    setDraftSaving(false);
    setMerchantStores([]);
    setMerchantOnboardingDraft(null);
    setMerchantDraftLoading(false);
    setMerchantDraftError(null);
    setMerchantStoresLoading(false);
    setMerchantStoresError(null);
    setMerchantStoreRoute(null);
    setRegisteredUser(null);
    setConfig(tenantSafeConfig(localDraft));
    setCart([]);
    setSelectedCategory("الكل");
    setIsCartDrawerOpen(false);
    setHasOrdered(false);
  };

  const invalidateDraftContext = () => {
    draftOperationSequence.current += 1;
    draftLoads.current.invalidate();
    setDraftLoading(false);
    setDraftSaving(false);
  };

  const enterDraftContext = (draft: StoreDraft | null, user: UserProfile | null = authUser) => {
    invalidateDraftContext();
    workspaceOperationSequence.current += 1;
    workspaceLoads.current.invalidate();
    setWorkspaceLoading(false);
    setWorkspaceSaving(false);
    setWorkspaceConflict(null);
    setWorkspaceConflictReview(null);
    setPendingArchivedProductIds([]);
    setActiveWorkspace(null);
    setActiveDraft(draft);
    setConfig(draft ? tenantSafeConfig(draft.config as unknown as StoreConfig) : ELEGANT_PRESET);
    setCart([]);
    if (user && draft) {
      setRegisteredUser({
        fullName: user.fullName,
        email: user.email,
        businessName: draft.storeName,
        businessType: draft.businessType,
      });
    }
  };

  const applyServerDraft = (draft: StoreDraft, user: UserProfile | null = authUser) => {
    enterDraftContext(draft, user);
  };

  const loadCurrentServerDraft = async (user: UserProfile | null = authUser): Promise<boolean | null> => {
    if (!user || draftLoading) return null;
    const request = draftLoads.current.begin();
    setDraftLoading(true);
    try {
      const draft = await provisioning.currentDraft(request.signal);
      if (!draftLoads.current.isCurrent(request.sequence)) return null;
      if (!draft) {
        enterDraftContext(null, user);
        return false;
      }
      applyServerDraft(draft, user);
      return true;
    } catch (error) {
      if (!draftLoads.current.isCurrent(request.sequence) || isUiError(error, "aborted")) return null;
      triggerToast(uiErrorMessage(error, "تعذر استعادة مسودة المتجر من الخادم."), "error");
      return null;
    } finally {
      if (draftLoads.current.isCurrent(request.sequence)) {
        setDraftLoading(false);
        draftLoads.current.finish(request.sequence);
      }
    }
  };

  const reloadActiveDraft = async (allowDuringFailedSave = false): Promise<void> => {
    if (!authUser || draftLoading || (draftSaving && !allowDuringFailedSave)) return;
    if (activeDraft?.tenantId) {
      await openMerchantCorrectionById(activeDraft.tenantId, authUser);
      return;
    }
    await loadCurrentServerDraft(authUser);
  };

  const loadMerchantWorkspace = async (
    store: StoreSubmission,
    user: UserProfile,
    preserveConflict = false,
  ): Promise<boolean> => {
    invalidateDraftContext();
    const request = workspaceLoads.current.begin();
    const startingEditGeneration = workspaceEditGeneration.current;
    workspaceOperationSequence.current += 1;
    setWorkspaceLoading(true);

    try {
      const workspace = await workspaceActions.load(store.id, request.signal);
      if (!shouldApplyWorkspaceResponse(
        startingEditGeneration,
        workspaceEditGeneration.current,
        workspaceLoads.current.isCurrent(request.sequence),
      )) {
        if (workspaceLoads.current.isCurrent(request.sequence)) {
          triggerToast("لم نطبّق استجابة الخادم لأن المحرر تغيّر أثناء التحميل. أعد المحاولة بعد حفظ تعديلاتك.", "error");
        }
        return false;
      }
      setActiveWorkspace(workspace);
      setConfig(workspace.config);
      setRegisteredUser(merchantProfile(user, store));
      if (preserveConflict && workspaceConflict?.tenantId === workspace.tenantId) {
        setWorkspaceConflict(reloadWorkspaceConflict(workspaceConflict, workspace.config));
      } else {
        setPendingArchivedProductIds([]);
      }
      if (!preserveConflict) {
        setWorkspaceConflict(null);
        setWorkspaceConflictReview(null);
      }
      localStorage.setItem("eoshop.active-tenant-id", store.id);
      return true;
    } finally {
      if (workspaceLoads.current.isCurrent(request.sequence)) {
        setWorkspaceLoading(false);
        workspaceLoads.current.finish(request.sequence);
      }
    }
  };

  const restoreMerchantState = async (
    user: UserProfile,
    requestedTenantId?: string,
  ): Promise<{ status: MerchantRestoreResult; loadedTenantId: string | null; sessionActive: boolean; stores: StoreSubmission[] }> => {
    const restoreSequence = ++merchantRestoreSequence.current;
    setMerchantStoresLoading(true);
    setMerchantStoresError(null);
    setMerchantDraftLoading(true);
    setMerchantDraftError(null);
    void provisioning.currentDraft()
      .then((onboardingDraft) => {
        if (restoreSequence !== merchantRestoreSequence.current) return;
        setMerchantOnboardingDraft(onboardingDraft);
      })
      .catch((draftError: unknown) => {
        if (restoreSequence !== merchantRestoreSequence.current) return;
        if (isUiError(draftError, "unauthenticated")) {
          setAuthUser(null);
          resetTenantOwnedState();
          replaceCentralPath(`/login?returnTo=${encodeURIComponent(window.location.pathname)}`);
          return;
        }
        setMerchantOnboardingDraft(null);
        setMerchantDraftError(uiErrorMessage(draftError, "تعذر استعادة مسودة المتجر المحفوظة."));
      })
      .finally(() => {
        if (restoreSequence === merchantRestoreSequence.current) setMerchantDraftLoading(false);
      });
    try {
      const stores = await provisioning.listStores();
      if (restoreSequence !== merchantRestoreSequence.current) return { status: "error", loadedTenantId: null, sessionActive: true, stores: [] };
      setMerchantStores(stores);
      if (stores.length === 0) return { status: classifyMerchantRestore(0), loadedTenantId: null, sessionActive: true, stores };

      const fallback = stores[0];
      setRegisteredUser(merchantProfile(user, fallback));
      const editable = stores.filter((store) => store.verificationStatus === "approved"
        && store.provisioningStatus === "active"
        && store.capabilities.workspaceManage);
      const preferredId = localStorage.getItem("eoshop.active-tenant-id");
      const selected = editable.find((store) => store.id === requestedTenantId)
        ?? editable.find((store) => store.id === preferredId)
        ?? editable[0];
      let loadedTenantId: string | null = null;
      if (selected) {
        if (await loadMerchantWorkspace(selected, user)) loadedTenantId = selected.id;
        if (restoreSequence !== merchantRestoreSequence.current) return { status: "error", loadedTenantId: null, sessionActive: true, stores: [] };
      }

      return { status: classifyMerchantRestore(stores.length), loadedTenantId, sessionActive: true, stores };
    } catch (requestError) {
      if (restoreSequence !== merchantRestoreSequence.current) return { status: "error", loadedTenantId: null, sessionActive: true, stores: [] };
      const sessionActive = !isUiError(requestError, "unauthenticated");
      if (!sessionActive) {
        setAuthUser(null);
        resetTenantOwnedState();
      }
      const message = uiErrorMessage(requestError, "تعذر استعادة متاجر الحساب من الخادم.");
      setMerchantStoresError(message);
      triggerToast(message, "error");
      return { status: classifyMerchantRestore(0, true), loadedTenantId: null, sessionActive, stores: [] };
    } finally {
      if (restoreSequence === merchantRestoreSequence.current) setMerchantStoresLoading(false);
    }
  };

  const selectMerchantStore = async (tenantId: string): Promise<void> => {
    if (!authUser || workspaceLoading || workspaceSaving || activeWorkspace?.tenantId === tenantId) return;
    const store = merchantStores.find((candidate) => candidate.id === tenantId);
    if (!store) return;
    const confirmed = !recoverableWorkspaceChanges || window.confirm("لديك تعديلات أو لقطة تعارض غير محفوظة. هل تريد تجاهلها والانتقال إلى متجر آخر؟");
    if (!mayDiscardDirtyWorkspace(recoverableWorkspaceChanges, confirmed)) return;
    try {
      const loaded = await loadMerchantWorkspace(store, authUser);
      if (loaded) triggerToast(`تم تحميل بيانات ${store.storeName} من الخادم.`, "info");
    } catch (requestError) {
      if (isUiError(requestError, "aborted")) return;
      triggerToast(uiErrorMessage(requestError, "تعذر تحميل مساحة عمل المتجر."), "error");
    }
  };

  const reloadActiveWorkspace = async (discardConflict = false): Promise<void> => {
    if (!authUser || !activeWorkspace || workspaceLoading || workspaceSaving) return;
    const store = merchantStores.find((candidate) => candidate.id === activeWorkspace.tenantId);
    if (!store) return;
    if (!workspaceConflict && recoverableWorkspaceChanges
      && !window.confirm("سيتم تجاهل التعديلات غير المحفوظة وتحميل نسخة الخادم. هل تريد المتابعة؟")) return;

    const pendingConflict = workspaceConflict;
    try {
      const loaded = await loadMerchantWorkspace(store, authUser, Boolean(pendingConflict) && !discardConflict);
      if (!loaded) return;
      if (!pendingConflict || discardConflict) {
        setWorkspaceConflict(null);
        if (discardConflict) setWorkspaceConflictReview(null);
      }
      triggerToast("تم تحميل أحدث نسخة من الخادم.", "info");
    } catch (requestError) {
      if (isUiError(requestError, "aborted")) return;
      triggerToast(uiErrorMessage(requestError, "تعذر تحميل أحدث نسخة من الخادم."), "error");
    }
  };

  const applyNonConflictingChanges = () => {
    if (!workspaceConflict || !activeWorkspace || activeWorkspace.tenantId !== workspaceConflict.tenantId) return;
    const resolution = resolveWorkspaceConflict(workspaceConflict, activeWorkspace.config);
    if (!resolution) return;
    workspaceEditGeneration.current += 1;
    setConfig(resolution.config);
    setPendingArchivedProductIds([...workspaceConflict.archiveProductIds]);
    const conflictCount = workspaceConflict.conflictingFields.length;
    setWorkspaceConflictReview(resolution.review);
    setWorkspaceConflict(null);
    triggerToast(
      conflictCount === 0
        ? "أعدنا تطبيق تغييراتك غير المتعارضة على أحدث نسخة. راجعها ثم احفظها يدويًا."
        : `أعدنا التغييرات الآمنة، وأبقينا نسخة الخادم في ${conflictCount} حقل متعارض لحمايتها. راجعها يدويًا قبل الحفظ.`,
      "info",
    );
  };

  const archiveConflictDraft = () => {
    if (!workspaceConflictReview) return;
    localStorage.setItem("mobtaker_custom_store", JSON.stringify(workspaceConflictReview.draft));
    setLocalDraft(workspaceConflictReview.draft);
    setWorkspaceConflictReview(null);
    triggerToast("حُفظت لقطة تعديلات التعارض كمسودة محلية صريحة. لن تُرسل للخادم إلا باختيارك.", "info");
  };

  const discardConflictReview = () => {
    if (!workspaceConflictReview) return;
    if (!window.confirm("سيتم تجاهل القيم المتعارضة التي احتفظنا بها، مع بقاء نسخة الخادم. هل تريد المتابعة؟")) return;
    setWorkspaceConflictReview(null);
  };

  // Authenticated workspaces are saved on the server. Browser storage is draft-only.
  const saveStore = async (customConfig?: StoreConfig, importingDraft = false): Promise<boolean> => {
    const configToSave = customConfig || config;
    if (!activeWorkspace) {
      if (!authUser) {
        localStorage.setItem("mobtaker_custom_store", JSON.stringify(configToSave));
        setLocalDraft(configToSave);
        triggerToast("تم حفظ نسخة استعادة محلية. سجّل الدخول لحفظ المسودة على الخادم.", "info");
        return true;
      }
      if (draftLoading || draftSaving) return false;
      const operation = ++draftOperationSequence.current;
      setDraftSaving(true);
      try {
        const input = {
          expectedRevision: activeDraft?.revision ?? 0,
          storeName: configToSave.storeName,
          businessType: registeredUser?.businessType || activeDraft?.businessType || "تجزئة",
          themeStyle: configToSave.themeStyle,
          handle: activeDraft?.handle ?? null,
          planKey: activeDraft?.planKey ?? null,
          config: configToSave as unknown as Record<string, unknown>,
        };
        const saved = activeDraft?.tenantId
          ? await provisioning.saveCorrection(activeDraft.tenantId, input)
          : await provisioning.saveDraft(input);
        if (operation !== draftOperationSequence.current) return false;
        setActiveDraft(saved);
        setConfig(saved.config as unknown as StoreConfig);
        if (importingDraft) {
          localStorage.removeItem("mobtaker_custom_store");
          setLocalDraft(null);
        }
        triggerToast(activeDraft?.tenantId ? "تم حفظ تصحيح الطلب على الخادم." : "تم حفظ مسودة المتجر على الخادم.", "success");
        return true;
      } catch (error) {
        if (operation !== draftOperationSequence.current) return false;
        const revisionConflict = isUiErrorCode(error, "conflict", "draft_revision_conflict");
        triggerToast(
          revisionConflict
            ? "تغيرت المسودة على الخادم. يمكنك الآن تحميل النسخة الأحدث مع بقاء قرار الاستبدال بيدك."
            : uiErrorMessage(error, "تعذر حفظ مسودة المتجر على الخادم."),
          "error",
        );
        if (revisionConflict && window.confirm("توجد نسخة أحدث للمسودة على الخادم. تحميلها الآن سيتجاهل تعديلاتك الحالية. هل تريد المتابعة؟")) {
          await reloadActiveDraft(true);
        }
        return false;
      } finally {
        if (operation === draftOperationSequence.current) setDraftSaving(false);
      }
    }

    if (workspaceLoading || workspaceSaving || workspaceConflict) return false;
    const workspace = activeWorkspace;
    const operation = ++workspaceOperationSequence.current;
    setWorkspaceSaving(true);
    try {
      const saved = await workspaceActions.save(
        workspace.tenantId,
        workspace.revision,
        workspace.catalogRevision,
        configToSave,
        pendingArchivedProductIds,
      );
      if (operation !== workspaceOperationSequence.current) return false;
      setActiveWorkspace(saved);
      setConfig(saved.config);
      setWorkspaceConflict(null);
      setWorkspaceConflictReview(null);
      setPendingArchivedProductIds([]);
      if (importingDraft) {
        localStorage.removeItem("mobtaker_custom_store");
        setLocalDraft(null);
      }
      triggerToast("تم حفظ إعدادات المتجر والمنتجات في الخادم بنجاح. 💾", "success");
      return true;
    } catch (requestError) {
      if (operation !== workspaceOperationSequence.current) return false;
      if (isRevisionConflict(requestError)) {
        setWorkspaceConflict(openWorkspaceConflict(
          workspace.tenantId,
          workspace.config,
          configToSave,
          pendingArchivedProductIds,
        ));
      }
      if (isUiError(requestError, "unauthenticated")) {
        setAuthUser(null);
        resetTenantOwnedState();
      }
      triggerToast(uiErrorMessage(requestError, "تعذر حفظ مساحة عمل المتجر في الخادم."), "error");
      return false;
    } finally {
      if (operation === workspaceOperationSequence.current) setWorkspaceSaving(false);
    }
  };

  const completeStoreCustomization = async (): Promise<void> => {
    await coordinateCustomizationCompletion({
      existingWorkspace: activeWorkspace !== null,
      save: () => saveStore(),
      returnToMerchantPortal: () => {
        setMerchantStoreRoute(null);
        setView("merchant_dashboard");
        pushCentralPath("/app");
      },
      continueNewStoreJourney: () => setIsDomainModalOpen(true),
    });
  };

  // Reset to default
  const resetStore = () => {
    setIsResetConfirmOpen(true);
  };

  const executeResetStore = () => {
    if (workspaceEditorLocked) return;
    workspaceEditGeneration.current += 1;
    const defaultValue = config.themeStyle === "elegant" ? ELEGANT_PRESET : TECH_PRESET;
    setConfig(defaultValue);
    setCart([]);
    setSelectedCategory("الكل");
    setIsResetConfirmOpen(false);
    triggerToast("تمت إعادة التعيين بنجاح 🔄", "info");
  };

  // Handle template selection
  const selectTemplate = (_type: "elegant" | "tech") => {
    const target = "/app/new/design";
    window.location.assign(authUser ? target : `/login?returnTo=${encodeURIComponent(target)}`);
  };

  // Check registration before taking actions
  const checkRegistrationAndExecute = (_type: "templates" | "ai" | "builder", _data?: unknown) => {
    const target = "/app/new";
    window.location.assign(authUser ? target : `/login?returnTo=${encodeURIComponent(target)}`);
  };

  // Unregister / Log out merchant
  const handleLogout = () => {
    setIsLogoutConfirmOpen(true);
  };

  const executeLogout = async () => {
    const confirmed = !recoverableWorkspaceChanges || window.confirm("توجد تعديلات أو قيم تعارض غير محفوظة. تسجيل الخروج الآن سيتجاهلها نهائيًا. هل تريد المتابعة؟");
    if (!mayDiscardDirtyWorkspace(recoverableWorkspaceChanges, confirmed)) return;
    try {
      await auth.logout();
      provisioning.clearPendingForOwner(authUser?.id ?? "");
    } catch {
      triggerToast("تعذر إنهاء الجلسة على الخادم. تحقق من الاتصال ثم حاول مجددًا.", "error");
      return;
    }

    setAuthUser(null);
    resetTenantOwnedState();
    setView("landing");
    replaceCentralPath("/");
    setIsLogoutConfirmOpen(false);
    triggerToast("تم تسجيل الخروج وإنهاء جلسة الحساب بنجاح 🛡️", "info");
  };

  const handleMerchantSessionExpired = () => {
    setAuthUser(null);
    resetTenantOwnedState();
    setView("landing");
    replaceCentralPath("/");
    setIsLogoutConfirmOpen(false);
    triggerToast("انتهت الجلسة. سجّل الدخول مجددًا لمتابعة إدارة متجرك.", "error");
  };

  // Actual backend AI Generation call
  const runAiGenerationDirectly = async (promptText: string) => {
    if (workspaceEditorLocked || workspaceConflictReview) {
      triggerToast("أكمل تحميل مساحة العمل أو معالجة التعارض قبل تشغيل التوليد.", "error");
      return;
    }
    const startingOperation = workspaceOperationSequence.current;
    const startingEditGeneration = workspaceEditGeneration.current;
    setIsAiGenerating(true);
    triggerToast("جاري صياغة الفكرة وتصميم الهوية بالذكاء الاصطناعي... 🧠⚡", "info");

    try {
      const generatedData = await assistant.generateStoreIdeas(promptText);
      if (!isAsyncWorkspaceResultCurrent(
        startingOperation,
        workspaceOperationSequence.current,
        startingEditGeneration,
        workspaceEditGeneration.current,
        false,
      )) {
        triggerToast("لم نطبّق نتيجة الذكاء الاصطناعي لأن مساحة العمل تغيّرت أثناء التوليد.", "error");
        return;
      }
      
      const finalConfig: StoreConfig = {
        storeName: generatedData.storeName || "متجر مبتكر",
        slogan: generatedData.slogan || "بوابتك لكل جديد",
        logoIcon: generatedData.logoIcon || (generatedData.themeStyle === "tech" ? "⚡" : "🌸"),
        primaryColor: generatedData.primaryColor || "#D4AF37",
        secondaryColor: generatedData.secondaryColor || "#1C1917",
        themeStyle: generatedData.themeStyle === "tech" ? "tech" : "elegant",
        bannerText: generatedData.bannerText || "أهلاً بكم في متجرنا الجديد",
        fontFamily: generatedData.themeStyle === "tech" ? "Tajawal" : "Cairo",
        phone: "+966 50 111 2222",
        currency: "YER",
        products: generatedData.products.map((p, idx) => ({
          id: `ai-p-${idx}`,
          name: p.name,
          price: Number(p.price) || 99,
          basePrice: Number(p.price) || 99,
          salePrice: null,
          status: "draft",
          description: p.description,
          category: p.category || "منتجات عامة",
          imageKeyword: p.imageKeyword || "default"
        }))
      };

      workspaceEditGeneration.current += 1;
      setConfig(finalConfig);
      const saved = await saveStore(finalConfig);
      setCart([]);
      setSelectedCategory("الكل");
      setView("builder");
      if (!shouldClaimAiSave(saved)) return;
      triggerToast("نجاح! تم توليد المتجر والمنتجات والألوان بالكامل بالذكاء الاصطناعي 🚀🎉", "success");
    } catch (err: any) {
      console.error(err);
      triggerToast(err.message || "عذراً، حدث خطأ أثناء التوليد. يرجى المحاولة مرة أخرى.", "error");
    } finally {
      setIsAiGenerating(false);
    }
  };

  // AI Generation triggers registration verification first
  const handleAiGeneration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    checkRegistrationAndExecute("ai", aiPrompt);
  };

  // Helper inside the preview store
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    triggerToast(`تمت إضافة "${product.name}" إلى السلة 🛒`, "success");
  };

  const updateQuantity = (productId: string, amount: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + amount;
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0);
    });
  };

  // Store customization edits
  const handleConfigChange = (key: keyof StoreConfig, value: any) => {
    if (workspaceEditorLocked) return;
    workspaceEditGeneration.current += 1;
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Product CRUD
  const handleProductChange = (productId: string, patch: Partial<Product>) => {
    if (workspaceEditorLocked) return;
    workspaceEditGeneration.current += 1;
    setConfig(prev => {
      const index = prev.products.findIndex((product) => product.id === productId);
      if (index < 0) return prev;
      const updatedProducts = [...prev.products];
      updatedProducts[index] = {
        ...updatedProducts[index],
        ...patch,
      };
      return { ...prev, products: updatedProducts };
    });
  };

  const handleProductMediaChange = (productId: string, urls: string[]) => {
    if (workspaceEditorLocked) return;
    workspaceEditGeneration.current += 1;
    setConfig(prev => {
      const index = prev.products.findIndex((product) => product.id === productId);
      if (index < 0) return prev;
      const updatedProducts = [...prev.products];
      const product = updatedProducts[index];
      updatedProducts[index] = {
        ...product,
        imageUrl: product.imageUrl || urls[0],
        imageUrls: urls,
      };
      return { ...prev, products: updatedProducts };
    });
  };

  const addEmptyProduct = () => {
    if (workspaceEditorLocked) return;
    workspaceEditGeneration.current += 1;
    const newProduct: Product = {
      id: `draft:${randomUuid()}`,
      name: "منتج جديد للتعديل",
      price: 150,
      basePrice: 150,
      salePrice: null,
      status: "draft",
      description: "وصف جذاب يوضح تفاصيل منتجك الجديد لتشجيع العملاء على الشراء.",
      category: "منتجات عامة",
      imageKeyword: "default"
    };
    setConfig(prev => ({
        ...prev,
        products: [newProduct, ...prev.products]
      }));
    setSelectedCategory("الكل");
    triggerToast("تمت إضافة المنتج بنجاح في أعلى القائمة! تم فتح شاشة التعديل الخاصة به مباشرة 📦", "success");
  };

  const deleteProduct = (id: string) => {
    if (workspaceEditorLocked) return;
    workspaceEditGeneration.current += 1;
    const persisted = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    if (persisted) {
      setPendingArchivedProductIds((current) => current.includes(id) ? current : [...current, id]);
    }
    setConfig(prev => ({
        ...prev,
        products: prev.products.filter(p => p.id !== id)
    }));
    setCart(prev => prev.filter(item => item.product.id !== id));
    triggerToast(
      persisted
        ? "أُضيفت نية أرشفة المنتج إلى تعديلاتك غير المحفوظة. لن يتغير الخادم قبل نجاح الحفظ."
        : "أُزيل منتج المسودة محليًا. ما زالت تعديلات المتجر غير محفوظة.",
      "info",
    );
  };

  // Simulated Checkout
  const handleCheckout = () => {
    setHasOrdered(true);
    setTimeout(() => {
      setHasOrdered(false);
      setCart([]);
      setIsCartDrawerOpen(false);
    }, 4500);
  };

  const submitLiveOrder = async (
    input: Omit<CreateOrderInput, "workspaceRevision" | "catalogRevision">,
  ): Promise<OrderReceipt> => {
    if (!publicStorefront) throw new Error("بيانات المتجر غير جاهزة. حدّث الصفحة ثم حاول مجددًا.");
    const payload: CreateOrderInput = {
      ...input,
      workspaceRevision: publicStorefront.workspaceRevision,
      catalogRevision: publicStorefront.catalogRevision,
    };
    const serialized = JSON.stringify(payload);
    const fingerprint = await requestFingerprint(serialized);
    const storageKey = `eoshop:checkout:${window.location.host}`;
    let idempotencyKey: string = randomUuid();
    try {
      const pending = JSON.parse(sessionStorage.getItem(storageKey) || "null") as { fingerprint?: string; key?: string } | null;
      if (pending?.fingerprint === fingerprint && typeof pending.key === "string") idempotencyKey = pending.key;
    } catch {
      // A malformed browser entry is replaced with a fresh operation identity.
    }
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ fingerprint, key: idempotencyKey }));
    } catch {
      // Checkout remains available when browser storage is unavailable; no customer data is persisted.
    }
    try {
      const result = await orderActions.create(payload, idempotencyKey);
      try { sessionStorage.removeItem(storageKey); } catch { /* Browser storage is optional. */ }
      return result.order;
    } catch (error) {
      if (!isUiError(error, "network") && !isUiError(error, "server") && !isUiError(error, "aborted")) {
        try { sessionStorage.removeItem(storageKey); } catch { /* Browser storage is optional. */ }
      }
      if (isUiErrorCode(error, "conflict", "order_quote_stale")) {
        const fresh = await orderActions.loadStorefront();
        setPublicStorefront(fresh);
        setConfig(fresh.config);
        setCart((current) => reconcileCartWithStorefront(current, fresh.config.products).items);
        throw new Error("تغير السعر أو محتوى المتجر. تم تحميل النسخة الأحدث؛ راجع السلة ثم أكد الطلب من جديد.");
      }
      throw error;
    }
  };

  const handleOpenCheckoutPreview = () => {
    if (cart.length === 0) {
      if (config.products && config.products.length > 0) {
        addToCart(config.products[0]);
      } else {
        addToCart({
          id: "demo-p-1",
          name: "منتج تجريبي للاختبار",
          price: 120,
          description: "منتج افتراضي لاختبار نافذة الشراء والدفع",
          category: "عام",
          imageKeyword: "default"
        });
      }
    }
    setStorePreviewPageOverride("checkout");
    triggerToast("تم فتح نافذة المعاينة المباشرة لصفحة الشراء والدفع! 💳", "success");
  };

  const discardRecoverableWorkspace = () => {
    workspaceEditGeneration.current += 1;
    if (activeWorkspace) setConfig(activeWorkspace.config);
    else if (activeDraft) setConfig(activeDraft.config as unknown as StoreConfig);
    setPendingArchivedProductIds([]);
    setWorkspaceConflict(null);
    setWorkspaceConflictReview(null);
  };

  const openMerchantPortal = () => {
    if (recoverableWorkspaceChanges) {
      const confirmed = window.confirm("توجد تعديلات غير محفوظة في المحرر. الرجوع إلى بوابة التاجر سيتجاهلها. هل تريد المتابعة؟");
      if (!mayDiscardDirtyWorkspace(true, confirmed)) return;
      discardRecoverableWorkspace();
    }
    invalidateDraftContext();
    setMerchantStoreRoute(null);
    setView("merchant_dashboard");
    pushCentralPath("/app");
  };

  const openMerchantStore = (store: StoreSubmission, section: MerchantStoreSection = "overview") => {
    invalidateDraftContext();
    setMerchantStoreRoute({ tenantId: store.id, section });
    setView("merchant_store");
    pushCentralPath(merchantStorePath(store.id, section));
  };

  const openInventoryFromBuilder = () => {
    if (!activeWorkspace || !canViewInventory) return;
    if (recoverableWorkspaceChanges) {
      const confirmed = window.confirm("الانتقال إلى المخزون سيتجاهل تعديلات المحرر غير المحفوظة. هل تريد المتابعة؟");
      if (!mayDiscardDirtyWorkspace(true, confirmed)) return;
      discardRecoverableWorkspace();
    }
    setMerchantStoreRoute({ tenantId: activeWorkspace.tenantId, section: "inventory" });
    setView("merchant_store");
    pushCentralPath(merchantStorePath(activeWorkspace.tenantId, "inventory"));
  };

  const openMerchantBuilder = async (
    store: StoreSubmission,
    section: Extract<MerchantStoreSection, "products" | "design" | "checkout" | "pages"> = "design",
  ) => {
    const canOpen = section === "products"
      ? store.capabilities.workspaceManage && store.capabilities.catalogManage
      : store.capabilities.workspaceManage;
    if (!authUser || store.verificationStatus !== "approved" || store.provisioningStatus !== "active" || !canOpen) return;
    invalidateDraftContext();
    try {
      const loaded = activeWorkspace?.tenantId === store.id || await loadMerchantWorkspace(store, authUser);
      if (!loaded) return;
      setActiveDraft(null);
      setActiveTab(section === "design" ? "branding" : section === "products" ? "products" : section);
      setMerchantStoreRoute({ tenantId: store.id, section });
      setView("builder");
      pushCentralPath(merchantStorePath(store.id, section));
    } catch (requestError) {
      if (isUiError(requestError, "aborted")) return;
      triggerToast(uiErrorMessage(requestError, "تعذر فتح مساحة عمل المتجر."), "error");
    }
  };

  const openMerchantCorrectionById = async (tenantId: string, user: UserProfile) => {
    const request = draftLoads.current.begin();
    setDraftLoading(true);
    try {
      const draft = await provisioning.correctionDraft(tenantId, request.signal);
      if (!draftLoads.current.isCurrent(request.sequence)) return;
      applyServerDraft(draft, user);
      setView("builder");
      pushCentralPath(`/app/stores/${encodeURIComponent(tenantId)}/correction`);
    } catch (error) {
      if (!draftLoads.current.isCurrent(request.sequence) || isUiError(error, "aborted")) return;
      triggerToast(uiErrorMessage(error, "تعذر فتح طلب المتجر للتصحيح."), "error");
    } finally {
      if (draftLoads.current.isCurrent(request.sequence)) {
        setDraftLoading(false);
        draftLoads.current.finish(request.sequence);
      }
    }
  };

  const openMerchantCorrection = async (store: StoreSubmission) => {
    if (!authUser || !store.capabilities.draftEdit) return;
    await openMerchantCorrectionById(store.id, authUser);
  };

  const replaceMerchantStore = (updated: StoreSubmission) => {
    setMerchantStores((stores) => stores.map((store) => store.id === updated.id ? updated : store));
  };

  const publishMerchantStore = async (store: StoreSubmission) => {
    replaceMerchantStore(await provisioning.publish(store.id));
    triggerToast("تم نشر المتجر وأصبح رابطه العام متاحًا.", "success");
  };

  const unpublishMerchantStore = async (store: StoreSubmission) => {
    replaceMerchantStore(await provisioning.unpublish(store.id));
    triggerToast("تم إيقاف العرض العام للمتجر مع الاحتفاظ ببياناته.", "info");
  };

  const reloadMerchantPortal = async (signal?: AbortSignal): Promise<void> => {
    if (!authUser || merchantStoresLoading) return;
    const refreshSequence = ++merchantLifecycleRefreshSequence.current;
    setMerchantStoresLoading(true);
    setMerchantStoresError(null);
    try {
      await refreshMerchantLifecycleSnapshot({
        signal,
        listStores: provisioning.listStores,
        applyStores: (stores) => {
          if (refreshSequence === merchantLifecycleRefreshSequence.current) setMerchantStores(stores);
        },
      });
    } catch (requestError) {
      if (signal?.aborted || isUiError(requestError, "aborted")) return;
      if (isUiError(requestError, "unauthenticated")) {
        setAuthUser(null);
        resetTenantOwnedState();
        return;
      }
      const message = uiErrorMessage(requestError, "تعذر تحديث حالات متاجرك من الخادم.");
      setMerchantStoresError(message);
      triggerToast(message, "error");
    } finally {
      if (refreshSequence === merchantLifecycleRefreshSequence.current) setMerchantStoresLoading(false);
    }
  };

  const copyPublicStoreUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      triggerToast("تم نسخ رابط المتجر المنشور.", "success");
    } catch {
      triggerToast("تعذر نسخ الرابط تلقائيًا. يمكنك تحديده ونسخه يدويًا.", "error");
    }
  };

  const updateAdminSettingsDirty = useCallback((dirty: boolean) => {
    adminSettingsDirtyRef.current = dirty;
    setAdminSettingsDirty(dirty);
  }, []);

  useEffect(() => {
    if (!adminSettingsDirty) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [adminSettingsDirty]);

  useEffect(() => {
    if (!isCentralFrontendHost(window.location.hostname)) return;
    const handlePopState = () => {
      const currentAdminPath = adminStoreId ? adminStorePath(adminStoreId) : adminPath(adminSection);
      if (isAdminOpen && adminSettingsDirtyRef.current && window.location.pathname !== currentAdminPath) {
        const confirmed = window.confirm("توجد تعديلات غير محفوظة في إعدادات المنصة. مغادرة الصفحة ستتجاهلها. هل تريد المتابعة؟");
        if (!confirmed) {
          pushCentralPath(currentAdminPath);
          return;
        }
        updateAdminSettingsDirty(false);
      }
      const route = parseCentralRoute(window.location.pathname);
      if (route.name === "auth" || route.name === "account" || route.name === "merchant-new") {
        window.location.reload();
        return;
      }
      if (route.name === "admin") {
        setAdminSection(route.section);
        setAdminStoreId(route.storeId);
        if (authUser) {
          setIsAdminAuthModalOpen(false);
          setIsAdminOpen(true);
        } else {
          setIsAdminAuthModalOpen(true);
        }
        return;
      }

      setIsAdminOpen(false);
      if (route.name === "merchant" && authUser) {
        if (recoverableWorkspaceChanges) {
          const confirmed = window.confirm("توجد تعديلات غير محفوظة في المحرر. الرجوع إلى بوابة التاجر سيتجاهلها. هل تريد المتابعة؟");
          if (!mayDiscardDirtyWorkspace(true, confirmed)) {
            if (activeWorkspace) pushCentralPath(`/app/stores/${encodeURIComponent(activeWorkspace.tenantId)}/design`);
            return;
          }
          discardRecoverableWorkspace();
        }
        setView("merchant_dashboard");
      } else if (route.name === "landing") {
        setView(authUser ? "merchant_dashboard" : "landing");
        if (authUser) replaceCentralPath("/app");
      } else if (route.name === "merchant-store" && authUser) {
        const store = merchantStores.find((candidate) => candidate.id === route.tenantId);
        const builderRoute = ["design", "checkout", "pages"].includes(route.section);
        const canOpenBuilder = Boolean(store?.capabilities.workspaceManage);
        if (view === "builder" && recoverableWorkspaceChanges
          && (route.tenantId !== activeWorkspace?.tenantId || !builderRoute)) {
          const confirmed = window.confirm("توجد تعديلات غير محفوظة في المحرر. الانتقال سيهملها. هل تريد المتابعة؟");
          if (!mayDiscardDirtyWorkspace(true, confirmed)) {
            const currentSection = merchantStoreRoute?.section ?? "design";
            pushCentralPath(merchantStorePath(activeWorkspace?.tenantId ?? route.tenantId, currentSection));
            return;
          }
          discardRecoverableWorkspace();
        }
        if (!store) {
          setMerchantStoreRoute({ tenantId: route.tenantId, section: route.section });
          setView("merchant_store");
        } else if (builderRoute && canOpenBuilder
          && store.verificationStatus === "approved" && store.provisioningStatus === "active") {
          void openMerchantBuilder(store, route.section as "products" | "design" | "checkout" | "pages");
        } else {
          const safeSection = builderRoute ? "overview" : route.section;
          setMerchantStoreRoute({ tenantId: store.id, section: safeSection });
          setView("merchant_store");
          if (safeSection !== route.section) replaceCentralPath(merchantStorePath(store.id, safeSection));
        }
      } else if (route.name === "merchant-correction" && authUser) {
        const store = merchantStores.find((candidate) => candidate.id === route.tenantId);
        if (store) void openMerchantCorrection(store);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [adminSection, adminStoreId, authUser, isAdminOpen, merchantStores, activeWorkspace, merchantStoreRoute, recoverableWorkspaceChanges, view]);

  const focusedBuilderTask = activeWorkspace && merchantStoreRoute
    ? ({
      design: ["ملف المتجر والهوية", "عدّل البيانات والمظهر ثم احفظ التغييرات من الأعلى."],
      checkout: ["الدفع وسياسة الطلب", "اضبط الشحن والضرائب ووسائل الدفع الحقيقية ثم اختبر المعاينة."],
      pages: ["المحتوى والتواصل", "حرر نبذة المتجر ووجهات التواصل المحفوظة دون وعود أو نماذج وهمية."],
    } as const)[merchantStoreRoute.section as "design" | "checkout" | "pages"] ?? null
    : null;

  const visiblePlatformNavigation = platformSettings.navigationItems
    .filter((item) => item.isVisible)
    .sort((left, right) => left.position - right.position);

  const followPlatformNavigation = (key: "templates" | "how_it_works" | "pricing") => {
    document.getElementById(key === "templates" ? "templates" : key === "how_it_works" ? "how-it-works" : "pricing")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  const routeOwnedPage = isCentralFrontendHost(window.location.hostname)
    ? parseCentralRoute(window.location.pathname)
    : { name: "unknown" as const };
  const routeSessionExpired = (returnTo: string) => {
    setAuthUser(null);
    resetTenantOwnedState();
    replaceCentralPath(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  };
  if (routeOwnedPage.name === "auth") {
    return <AuthRoutePage mode={routeOwnedPage.mode} currentUser={authUser} restoring={authRestoring} onAuthenticated={setAuthUser} />;
  }
  if (routeOwnedPage.name === "account") {
    if (authRestoring || !authUser) return <div dir="rtl" className="grid min-h-screen place-items-center bg-slate-100 font-bold text-slate-600">جاري التحقق من الجلسة...</div>;
    return <AccountPage user={authUser} onUserChanged={setAuthUser} onLoggedOut={() => { setAuthUser(null); resetTenantOwnedState(); }} onSessionExpired={routeSessionExpired} />;
  }
  if (routeOwnedPage.name === "merchant-new") {
    if (authRestoring || !authUser) return <div dir="rtl" className="grid min-h-screen place-items-center bg-slate-100 font-bold text-slate-600">جاري استعادة حساب التاجر...</div>;
    return <MerchantOnboardingPage user={authUser} requestedStep={routeOwnedPage.step} onSessionExpired={routeSessionExpired} />;
  }

  return (
    <div dir="rtl" className={`bg-slate-50 text-slate-800 flex flex-col font-sans select-none antialiased ${view === "builder" ? "h-screen max-h-screen overflow-hidden" : "min-h-screen"}`}>
      <AppToast toast={toast} />

      {view === "storefront" && (
        <PublicStorefrontScreen
          storefront={publicStorefront}
          error={publicStorefrontError}
          loading={publicStorefrontLoading}
          cart={cart}
          addToCart={addToCart}
          updateQuantity={updateQuantity}
          isCartDrawerOpen={isCartDrawerOpen}
          setIsCartDrawerOpen={setIsCartDrawerOpen}
          hasOrdered={hasOrdered}
          handleCheckout={handleCheckout}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          submitOrder={submitLiveOrder}
          retry={() => void loadPublicStorefront()}
        />
      )}

      {view === "merchant_dashboard" && authUser && (
        <MerchantPortal
          user={authUser}
          stores={merchantStores}
          draft={merchantOnboardingDraft}
          draftLoading={merchantDraftLoading}
          draftError={merchantDraftError}
          loading={merchantStoresLoading}
          error={merchantStoresError}
          onReload={reloadMerchantPortal}
          onCreateStore={() => {
            const nextStep = merchantOnboardingDraft?.nextRequiredStep;
            const path = nextStep === "design"
              ? "/app/new/design"
              : nextStep === "review" || nextStep === "submit"
                ? "/app/new/review"
                : "/app/new";
            window.location.assign(path);
          }}
          onOpenStore={(store, section = "overview") => {
            if (section === "design" || section === "pages") {
              void openMerchantBuilder(store, section);
              return;
            }
            openMerchantStore(store, section);
          }}
          onCorrectStore={(store) => void openMerchantCorrection(store)}
          onPublish={(store) => publishMerchantStore(store)}
          onUnpublish={(store) => unpublishMerchantStore(store)}
          onLogout={handleLogout}
          onCopyPublicUrl={(url) => void copyPublicStoreUrl(url)}
        />
      )}

      {view === "merchant_store" && authUser && merchantStoreRoute && (
        <React.Fragment key={merchantStoreRoute.tenantId}>
          <MerchantStoreOperations
            user={authUser}
            store={merchantStores.find((store) => store.id === merchantStoreRoute.tenantId) ?? null}
            section={merchantStoreRoute.section}
            onBack={openMerchantPortal}
            onNavigate={(section) => {
              setMerchantStoreRoute((current) => current ? { ...current, section } : current);
              pushCentralPath(merchantStorePath(merchantStoreRoute.tenantId, section));
            }}
            onOpenBuilder={(section) => {
              const store = merchantStores.find((candidate) => candidate.id === merchantStoreRoute.tenantId);
              if (store) void openMerchantBuilder(store, section);
            }}
            onPublish={(store) => publishMerchantStore(store)}
            onUnpublish={(store) => unpublishMerchantStore(store)}
            onCopyPublicUrl={(url) => void copyPublicStoreUrl(url)}
            onLogout={handleLogout}
            onSessionExpired={handleMerchantSessionExpired}
          />
        </React.Fragment>
      )}

      <WorkspaceRecoveryOverlays
        activeWorkspace={activeWorkspace}
        conflict={workspaceConflict}
        conflictReview={workspaceConflictReview}
        localDraft={localDraft}
        loading={workspaceLoading}
        saving={workspaceSaving}
        reloadWorkspace={(discardChanges) => void reloadActiveWorkspace(discardChanges)}
        applyNonConflictingChanges={applyNonConflictingChanges}
        archiveConflictDraft={archiveConflictDraft}
        discardConflictReview={discardConflictReview}
        importLocalDraft={(draft) => void saveStore(draft, true)}
        discardLocalDraft={() => {
          localStorage.removeItem("mobtaker_custom_store");
          setLocalDraft(null);
        }}
      />

      {/* ----------------- 1. LANDING PAGE VIEW ----------------- */}
      {view === "landing" && (
        <div className="relative flex flex-1 flex-col overflow-hidden" style={{ backgroundColor: platformSettings.brandSurfaceColor, fontFamily: "var(--platform-brand-font)" }}>
          <PlatformLandingHero
            settings={platformSettings}
            navigation={visiblePlatformNavigation}
            user={authUser}
            onNavigate={followPlatformNavigation}
            onLogin={() => window.location.assign("/login")}
            onRegister={() => window.location.assign("/register")}
            onOpenPortal={() => {
              setView("merchant_dashboard");
              pushCentralPath("/app");
            }}
            onCreateStore={() => window.location.assign("/app/new")}
            onExplainJourney={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
          />

          {platformSettings.showHowItWorks && (
            <PlatformJourneySection
              platformName={platformSettings.platformName}
              ctaLabel={authUser ? "إنشاء متجر جديد" : "أنشئ متجرك"}
              onStart={() => window.location.assign(authUser ? "/app/new" : "/register")}
            />
          )}

          <PlatformCapabilitiesSection />

          <PlatformTemplatesSection onStart={() => checkRegistrationAndExecute("templates")} />

          {/* Pricing & Plans Section (الأسعار والباقات) */}
          {platformSettings.showPricing && <ServerPricingPlans onStart={() => checkRegistrationAndExecute("templates")} />}

          <PlatformLandingClosure
            settings={platformSettings}
            navigation={visiblePlatformNavigation}
            user={authUser}
            onNavigate={followPlatformNavigation}
            onStart={() => window.location.assign(authUser ? "/app/new" : "/register")}
            onLogin={() => window.location.assign("/login")}
          />
        </div>
      )}

      {/* ----------------- 2. TEMPLATES SELECTOR VIEW ----------------- */}
      {view === "templates" && (
        <div className="flex-1 container mx-auto px-6 py-10 flex flex-col justify-center animate-fadeIn">
          <div className="flex items-center justify-between mb-6">
            <button 
              onClick={() => setView("landing")}
              className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 transition font-bold text-sm bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-2xs hover:bg-slate-50"
            >
              <ArrowRight className="w-4 h-4" />
              <span>العودة للرئيسية</span>
            </button>

            {registeredUser && (
              <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl text-emerald-800 text-xs font-bold shadow-2xs animate-fadeIn">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <div className="text-right hidden sm:block">
                  <span className="block text-slate-800 font-extrabold text-xs">{registeredUser.fullName}</span>
                  <span className="text-[9px] text-emerald-700 block -mt-1 font-normal">جلسة حساب موثقة 🚀 {registeredUser.socialPageUrl ? "• صفحة مضافة" : ""}</span>
                </div>
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 px-2 py-1.5 rounded-lg transition text-[10px] font-bold border border-rose-200"
                  title="تسجيل الخروج وإلغاء توثيق النشاط"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>تسجيل خروج</span>
                </button>
              </div>
            )}
          </div>

          <div className="text-center max-w-xl mx-auto space-y-3 mb-10">
            <span className="bg-sky-50 text-sky-700 border border-sky-200 px-3.5 py-1 rounded-full text-xs font-extrabold tracking-wide uppercase inline-block shadow-2xs">
              قوالب التجارة الإلكترونية العصرية 🎨
            </span>
            <h2 className="font-display font-black text-3xl md:text-4xl text-slate-900">اختر القالب الأنسب لتجارتك</h2>
            <p className="text-slate-600 text-sm md:text-base leading-relaxed">
              واجهات متجاوبة، ألوان متناغمة ومريحة للعين بدون ألوان داكنة، مصممة لعرض منتجاتك بأعلى جودة وجذب العملاء.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto w-full">
            {/* Template 1 Card - Elegant */}
            <div className="bg-white rounded-3xl border border-amber-200/80 shadow-lg hover:shadow-xl hover:border-amber-400 transition-all duration-300 overflow-hidden flex flex-col group">
              {/* Light Luxury Header */}
              <div className="bg-gradient-to-br from-amber-500/10 via-amber-100/30 to-orange-50/50 p-6 md:p-8 border-b border-amber-200/60 flex flex-col justify-between relative">
                <div className="flex items-center justify-between mb-4">
                  <span className="bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1 rounded-full text-xs font-black shadow-2xs">
                    سلسة وفاخرة ✨
                  </span>
                  <span className="text-xs font-extrabold text-amber-800 bg-white/80 px-2.5 py-1 rounded-lg border border-amber-200/60">
                    خط القاهرة (Cairo)
                  </span>
                </div>

                <div className="space-y-2 mb-6">
                  <h3 className="font-display font-black text-2xl text-slate-900 group-hover:text-amber-800 transition">
                    قالب الأناقة العصرية
                  </h3>
                  <p className="text-slate-600 text-xs md:text-sm leading-relaxed max-w-md">
                    مثالي للعطور الفاخرة، الأزياء والعبايات، الساعات، مستحضرات التجميل والهدايا ذات القيمة العالية.
                  </p>
                </div>

                {/* Visual Mini Mockup Frame */}
                <div className="bg-white rounded-2xl border border-amber-200/80 p-3 shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between border-b border-amber-100 pb-2 text-xs">
                    <span className="font-bold text-amber-900 flex items-center gap-1.5">
                      <span>🌸</span>
                      <span>نخبة العود والعطور</span>
                    </span>
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      سلة التسوق (2)
                    </span>
                  </div>
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-3 rounded-xl border border-amber-100/80 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-amber-800 font-extrabold block">تشكيلة الصيف</span>
                      <span className="text-xs font-black text-slate-900 block">عطر مسك الغزال الملكي</span>
                    </div>
                    <span className="bg-amber-600 text-white font-black text-xs px-2.5 py-1 rounded-lg shadow-2xs">
                      180 ر.س
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6 md:p-8 flex-1 flex flex-col justify-between space-y-6">
                <div className="space-y-3">
                  <h4 className="font-extrabold text-slate-900 text-xs md:text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>مميزات القالب البصرية:</span>
                  </h4>
                  <ul className="space-y-2.5 text-slate-600 text-xs">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 bg-emerald-50 rounded-full p-0.5" />
                      <span>تخطيط يعتمد على المساحات المريحة لعرض فخامة وشبكة المنتجات</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 bg-emerald-50 rounded-full p-0.5" />
                      <span>تناسق ألوان دافئ وهادئ (ذهبـي ناعم وقرفة مع خلفية فاتحة)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 bg-emerald-50 rounded-full p-0.5" />
                      <span>قوائم تصفية سلسة وسلة تسوق جانبية منبثقة تفاعلية</span>
                    </li>
                  </ul>
                </div>

                {/* Color Swatch Palette Preview */}
                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                  <span className="text-slate-500 font-bold">لوحة الألوان:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-[#D4AF37] border border-white shadow-2xs" title="ذهبي ناعم" />
                    <span className="w-5 h-5 rounded-full bg-[#7c2d12] border border-white shadow-2xs" title="قرفة فاخرة" />
                    <span className="w-5 h-5 rounded-full bg-[#fafbfe] border border-slate-300 shadow-2xs" title="خلفية فاتحة" />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2.5">
                  <button
                    onClick={() => setPreviewingTemplate("elegant")}
                    className="w-full sm:w-1/2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-extrabold py-3.5 rounded-xl transition shadow-2xs flex items-center justify-center gap-2"
                  >
                    <Eye className="w-4 h-4 text-amber-700" />
                    <span>معاينة القالب 👁️</span>
                  </button>
                  <button
                    onClick={() => selectTemplate("elegant")}
                    className="w-full sm:w-1/2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-extrabold py-3.5 rounded-xl transition shadow-md flex items-center justify-center gap-2 group-hover:shadow-amber-600/20"
                  >
                    <span>تفعيل القالب</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Template 2 Card - Tech */}
            <div className="bg-white rounded-3xl border border-sky-200/80 shadow-lg hover:shadow-xl hover:border-sky-400 transition-all duration-300 overflow-hidden flex flex-col group">
              {/* Light Tech Header */}
              <div className="bg-gradient-to-br from-sky-500/10 via-blue-100/30 to-indigo-50/50 p-6 md:p-8 border-b border-sky-200/60 flex flex-col justify-between relative">
                <div className="flex items-center justify-between mb-4">
                  <span className="bg-sky-100 text-sky-900 border border-sky-300 px-3 py-1 rounded-full text-xs font-black shadow-2xs">
                    مستقبلي وعصري ⚡
                  </span>
                  <span className="text-xs font-extrabold text-sky-800 bg-white/80 px-2.5 py-1 rounded-lg border border-sky-200/60">
                    خط تجول (Tajawal)
                  </span>
                </div>

                <div className="space-y-2 mb-6">
                  <h3 className="font-display font-black text-2xl text-slate-900 group-hover:text-sky-800 transition">
                    قالب الابتكار والأجهزة العصرية
                  </h3>
                  <p className="text-slate-600 text-xs md:text-sm leading-relaxed max-w-md">
                    مظهر جديد بالكامل ناصع ومشرق، مخصص للإلكترونيات والأجهزة الذكية، الملحقات عالية الكفاءة، والألعاب.
                  </p>
                </div>

                {/* Visual Mini Mockup Frame */}
                <div className="bg-white rounded-2xl border border-sky-200/80 p-3 shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between border-b border-sky-100 pb-2 text-xs">
                    <span className="font-bold text-sky-900 flex items-center gap-1.5">
                      <span>⚡</span>
                      <span>تِك فيو للأجهزة الذكية</span>
                    </span>
                    <span className="bg-sky-100 text-sky-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      ضمان سنتين 🛡️
                    </span>
                  </div>
                  <div className="bg-gradient-to-r from-sky-50 to-blue-50 p-3 rounded-xl border border-sky-100/80 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-sky-800 font-extrabold block">سماعات ملحقة</span>
                      <span className="text-xs font-black text-slate-900 block">سماعة Pulse Pro ANC اللاسلكية</span>
                    </div>
                    <span className="bg-sky-600 text-white font-black text-xs px-2.5 py-1 rounded-lg shadow-2xs">
                      340 ر.س
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6 md:p-8 flex-1 flex flex-col justify-between space-y-6">
                <div className="space-y-3">
                  <h4 className="font-extrabold text-slate-900 text-xs md:text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-sky-600" />
                    <span>مميزات الهوية والتصميم الجديد:</span>
                  </h4>
                  <ul className="space-y-2.5 text-slate-600 text-xs">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 bg-emerald-50 rounded-full p-0.5" />
                      <span>تصميم ناصع عصري خالٍ من الأكواد الرمادية، يعتمد الواجهات الذكية البسيطة</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 bg-emerald-50 rounded-full p-0.5" />
                      <span>عرض واضح ومفصل لمواصفات المنتجات والضمان مع بطاقات شراء سريعة</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 bg-emerald-50 rounded-full p-0.5" />
                      <span>لوحة ألوان زرقاء حيوية مع خلفية زجاجية مريحة للعين</span>
                    </li>
                  </ul>
                </div>

                {/* Color Swatch Palette Preview */}
                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                  <span className="text-slate-500 font-bold">لوحة الألوان:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-[#0284c7] border border-white shadow-2xs" title="أزرق سماوي" />
                    <span className="w-5 h-5 rounded-full bg-[#0f172a] border border-white shadow-2xs" title="كحلي تقني" />
                    <span className="w-5 h-5 rounded-full bg-[#f8fafc] border border-slate-300 shadow-2xs" title="خلفية ناصعة" />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2.5">
                  <button
                    onClick={() => setPreviewingTemplate("tech")}
                    className="w-full sm:w-1/2 bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-300 font-extrabold py-3.5 rounded-xl transition shadow-2xs flex items-center justify-center gap-2"
                  >
                    <Eye className="w-4 h-4 text-sky-700" />
                    <span>معاينة القالب 👁️</span>
                  </button>
                  <button
                    onClick={() => selectTemplate("tech")}
                    className="w-full sm:w-1/2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white font-extrabold py-3.5 rounded-xl transition shadow-md flex items-center justify-center gap-2 group-hover:shadow-sky-600/20"
                  >
                    <span>تفعيل القالب</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Landing Page Footer */}
          <footer className="bg-slate-900 text-slate-400 py-10 border-t border-slate-800 mt-20 shrink-0">
            <div className="container mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <div className="bg-sky-500 text-slate-950 p-2 rounded-xl font-bold shadow-md shadow-sky-500/20">
                  <Store className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <span className="font-display font-black text-white text-base">{platformSettings.platformName}</span>
                  {platformSettings.tagline && <span className="text-[10px] block text-slate-400">{platformSettings.tagline}</span>}
                  <span className="block text-[10px] text-slate-500">© {new Date().getFullYear()}</span>
                </div>
              </div>

              <div className="space-y-3 text-center text-xs text-slate-500 sm:text-left">
                {(platformSettings.supportEmail || platformSettings.supportPhone || platformSettings.supportWhatsapp) && (
                  <div className="flex flex-wrap justify-center gap-3 sm:justify-end" aria-label="قنوات دعم المنصة">
                    {platformSettings.supportEmail && <a className="hover:text-white" dir="ltr" href={`mailto:${platformSettings.supportEmail}`}>{platformSettings.supportEmail}</a>}
                    {platformSettings.supportPhone && <a className="hover:text-white" dir="ltr" href={`tel:${platformSettings.supportPhone}`}>{platformSettings.supportPhone}</a>}
                    {platformSettings.supportWhatsapp && <a className="hover:text-white" href={`https://wa.me/${platformSettings.supportWhatsapp.slice(1)}`} target="_blank" rel="noreferrer">واتساب الدعم</a>}
                  </div>
                )}
                <div className="font-medium">جميع الحقوق محفوظة لمنصة {platformSettings.platformName}</div>
              </div>
            </div>
          </footer>
        </div>
      )}

      {/* ----------------- 3. BUILDER / CUSTOMIZER VIEW ----------------- */}
      {view === "builder" && (
        <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
          {/* Sub Header for controls */}
          <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-sm">
            <div className="flex items-center gap-3">
              <button 
                onClick={activeWorkspace || activeDraft?.tenantId ? openMerchantPortal : () => setView("templates")}
                className="p-2 hover:bg-slate-100 rounded-lg transition text-slate-500"
                title={activeWorkspace || activeDraft?.tenantId ? "الرجوع إلى بوابة التاجر" : "الرجوع للقوالب"}
              >
                <ArrowRight className="w-5 h-5" />
              </button>
              <div>
                <h1 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                  <span>لوحة تعديل متجر:</span>
                  <span className="text-sky-600 bg-sky-50 px-3 py-1 rounded-full text-xs font-bold border border-sky-100">
                    {config.storeName}
                  </span>
                </h1>
                <p className="text-xs text-slate-400">خصص المحتوى والهوية البصرية ثم عاين التغييرات الحية بالجانب المقابل.</p>
              </div>
            </div>

            {/* Merchant Badge */}
            {activeWorkspace && (
              <div className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-900">
                {merchantStores.filter((store) => store.verificationStatus === "approved" && store.provisioningStatus === "active").length > 1 && (
                  <label className="flex items-center gap-2">
                    <span>المتجر:</span>
                    <select
                      value={activeWorkspace.tenantId}
                      disabled={workspaceLoading || workspaceSaving}
                      onChange={(event) => void selectMerchantStore(event.target.value)}
                      className="rounded-lg border border-sky-200 bg-white px-2 py-1 disabled:opacity-50"
                    >
                      {merchantStores
                        .filter((store) => store.verificationStatus === "approved" && store.provisioningStatus === "active")
                        .map((store) => <option key={store.id} value={store.id}>{store.storeName}</option>)}
                    </select>
                  </label>
                )}
                <button
                  type="button"
                  disabled={workspaceLoading || workspaceSaving}
                  onClick={() => void reloadActiveWorkspace(false)}
                  className="flex items-center gap-1 rounded-lg border border-sky-200 bg-white px-2 py-1 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${workspaceLoading ? "animate-spin" : ""}`} />
                  أحدث نسخة
                </button>
                {recoverableWorkspaceChanges && <span className="text-amber-700">تعديلات أو تعارضات غير محفوظة</span>}
              </div>
            )}
            {registeredUser && (
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl text-emerald-800 text-xs font-bold shadow-sm select-none">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="text-right">
                  <span className="block text-slate-800 font-extrabold text-[11px]">{registeredUser.fullName} (مالك المتجر)</span>
                  <span className="text-[9px] text-emerald-600 block -mt-0.5 font-normal">
                    {registeredUser.socialPageUrl ? `الصفحة: ${registeredUser.socialPageUrl}` : "بريف متقدم بدون سجل تجاري"}
                  </span>
                </div>
                <button 
                  onClick={handleLogout}
                  className="mr-2 bg-rose-50 hover:bg-rose-100 text-rose-700 px-2 py-1 rounded-lg transition text-[10px] font-bold border border-rose-200 flex items-center gap-1 disabled:opacity-50"
                  title="تسجيل الخروج وإلغاء توثيق النشاط"
                >
                  <LogOut className="w-3 h-3 text-rose-500" />
                  <span>خروج</span>
                </button>
              </div>
            )}

            {/* Quick Actions (Finished Customization, Save, Reset, Export, Fullscreen) */}
            <div className="flex items-center flex-wrap gap-2">
              <button
                disabled={workspaceSaving || workspaceLoading || workspaceConflict !== null}
                onClick={() => void completeStoreCustomization()}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-md hover:shadow-emerald-600/30 transition transform active:scale-95 cursor-pointer ring-2 ring-emerald-400/30"
                title="إنهاء التخصيص واختيار الدومين والاستضافة لمتجرك"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>{activeWorkspace ? "حفظ والعودة إلى بوابة التاجر" : "الانتهاء واختيار عنوان المتجر 🚀"}</span>
              </button>

              <button
                data-testid="save-workspace"
                disabled={workspaceSaving || workspaceLoading || workspaceConflict !== null}
                onClick={() => void saveStore()}
                className="bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer"
                title={activeWorkspace ? "حفظ الإعدادات والمنتجات في الخادم" : "حفظ مسودة غير منشورة في الخادم"}
              >
                <Save className="w-4 h-4 text-emerald-600" />
                <span>حفظ التعديلات</span>
              </button>

              <button
                onClick={resetStore}
                className="bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5"
                title="إعادة التعيين للإعدادات الافتراضية"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>إعادة ضبط</span>
              </button>



              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                  isSidebarCollapsed 
                    ? "bg-sky-600 hover:bg-sky-700 text-white shadow" 
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                }`}
                title={isSidebarCollapsed ? "إظهار لوحة التعديل الجانبية" : "إخفاء لوحة التعديل لمعاينة المتجر كزبون حقيقي بملء الشاشة"}
              >
                {isSidebarCollapsed ? (
                  <>
                    <Sliders className="w-3.5 h-3.5 text-white" />
                    <span>إظهار التعديل ⚙️</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                    <span>وضع العميل (كامل الشاشة) 👁️</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setShowFullScreenPreview(true)}
                className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md"
                title="رؤية كشاشة كاملة مستقلة"
              >
                <Eye className="w-4 h-4" />
                <span>شاشة كاملة</span>
              </button>
            </div>
          </header>

          {/* Builder Workplace (Two Columns: controls & preview) */}
          <div className="flex-1 flex flex-col lg:flex-row min-h-0 bg-slate-100 overflow-hidden h-full">
            {/* COLUMN 1: CONTROLS PANEL */}
            {!isSidebarCollapsed && (
              <aside className="w-full lg:w-[460px] h-[50vh] lg:h-full flex flex-col border-l border-slate-200 bg-white shrink-0 animate-fadeIn min-h-0 overflow-hidden shadow-xs">
                {/* Tab navigation headers with mobile touch scroll */}
                <div className="flex items-center overflow-x-auto border-b border-slate-200 shrink-0 bg-slate-50/80 text-xs divide-x divide-x-reverse divide-slate-200/80 scrollbar-none touch-pan-x">
                  {focusedBuilderTask ? (
                    <div className="flex min-h-[48px] w-full items-center justify-between gap-3 bg-white px-4 py-3">
                      <div>
                        <p className="text-sm font-black text-slate-900">{focusedBuilderTask[0]}</p>
                        <p className="mt-0.5 text-[10px] font-bold text-slate-500">{focusedBuilderTask[1]}</p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">متصل بالخادم</span>
                    </div>
                  ) : (<>
                  <button
                    onClick={() => setActiveTab("branding")}
                    className={`py-3.5 px-4 min-h-[44px] font-extrabold text-center border-b-2 transition shrink-0 whitespace-nowrap flex items-center justify-center gap-1.5 touch-manipulation cursor-pointer active:scale-[0.98] ${
                      activeTab === "branding" ? "border-slate-900 text-slate-900 bg-white shadow-2xs" : "border-transparent text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>الاسم والشعار</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("design")}
                    className={`py-3.5 px-4 min-h-[44px] font-extrabold text-center border-b-2 transition shrink-0 whitespace-nowrap flex items-center justify-center gap-1.5 touch-manipulation cursor-pointer active:scale-[0.98] ${
                      activeTab === "design" ? "border-slate-900 text-slate-900 bg-white shadow-2xs" : "border-transparent text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>الهوية والألوان 🎨</span>
                  </button>
                  <button
                    data-testid="products-tab"
                    onClick={() => setActiveTab("products")}
                    className={`py-3.5 px-4 min-h-[44px] font-extrabold text-center border-b-2 transition shrink-0 whitespace-nowrap flex items-center justify-center gap-1.5 touch-manipulation cursor-pointer active:scale-[0.98] ${
                      activeTab === "products" ? "border-slate-900 text-slate-900 bg-white shadow-2xs" : "border-transparent text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>المنتجات المعروضة</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("checkout")}
                    className={`py-3.5 px-4 min-h-[44px] font-extrabold text-center border-b-2 transition shrink-0 whitespace-nowrap flex items-center justify-center gap-1.5 touch-manipulation cursor-pointer active:scale-[0.98] ${
                      activeTab === "checkout" ? "border-emerald-600 text-emerald-900 bg-emerald-50 shadow-2xs" : "border-transparent text-emerald-800 hover:text-emerald-950 font-black"
                    }`}
                  >
                    <span>الدفع والطلب 💳</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("pages")}
                    className={`py-3.5 px-4 min-h-[44px] font-extrabold text-center border-b-2 transition shrink-0 whitespace-nowrap flex items-center justify-center gap-1.5 touch-manipulation cursor-pointer active:scale-[0.98] ${
                      activeTab === "pages" ? "border-slate-900 text-slate-900 bg-white shadow-2xs" : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <span>تعديل الصفحات 📄</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("ai")}
                    className={`py-3.5 px-4 min-h-[44px] font-extrabold text-center border-b-2 transition shrink-0 whitespace-nowrap flex items-center justify-center gap-1.5 touch-manipulation cursor-pointer active:scale-[0.98] ${
                      activeTab === "ai" ? "border-slate-900 text-slate-900 bg-white shadow-2xs" : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <span>مساعد المحتوى ✨</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("export")}
                    className={`py-3.5 px-4 min-h-[44px] font-extrabold text-center border-b-2 transition shrink-0 whitespace-nowrap flex items-center justify-center gap-1.5 touch-manipulation cursor-pointer active:scale-[0.98] ${
                      activeTab === "export" ? "border-emerald-600 text-emerald-800 bg-emerald-50 shadow-2xs" : "border-transparent text-emerald-700 hover:text-emerald-900 font-bold"
                    }`}
                  >
                    <span>طلب اعتماد ونشر المتجر 🚀</span>
                  </button>
                  </>)}
                </div>

                {/* Render dynamic ControlPanel with states - Independent Scrolling */}
                <div
                  aria-disabled={workspaceEditorLocked}
                  className={`flex-1 min-h-0 overflow-hidden h-full ${workspaceEditorLocked ? "pointer-events-none opacity-60" : ""}`}
                >
                  <ControlPanel 
                    config={config}
                    activeTenantId={activeWorkspace?.tenantId ?? null}
                    mediaOwnerKey={authUser?.id ?? null}
                    canViewInventory={canViewInventory}
                    handleConfigChange={handleConfigChange}
                    handleProductChange={handleProductChange}
                    handleProductMediaChange={handleProductMediaChange}
                    addEmptyProduct={addEmptyProduct}
                    deleteProduct={deleteProduct}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    previewDevice={previewDevice}
                    setPreviewDevice={setPreviewDevice}
                    onOpenInventory={activeWorkspace && canViewInventory ? openInventoryFromBuilder : undefined}
                    onOpenCheckoutPreview={handleOpenCheckoutPreview}
                    onOpenDomainModal={activeWorkspace ? undefined : () => setIsDomainModalOpen(true)}
                    onCompleteCustomization={completeStoreCustomization}
                  />
                </div>
              </aside>
            )}

            {/* COLUMN 2: SIMULATED PREVIEW STAGE */}
            <main className={`flex-1 flex items-center justify-center overflow-hidden bg-slate-100 relative transition-all duration-300 min-h-0 h-[55vh] lg:h-full ${
              isSidebarCollapsed && previewDevice === "desktop" ? "p-0" : "p-3 lg:p-6"
            }`}>
              {/* Device container wrap */}
              <div 
                className={`transition-all duration-300 bg-white shadow-2xl relative flex flex-col border border-slate-200 overflow-hidden max-h-full ${
                  previewDevice === "mobile" 
                    ? "w-[360px] h-[660px] rounded-[3rem] border-[10px] border-[#181d2d] bg-[#181d2d] shrink-0 shadow-2xl ring-1 ring-slate-800" 
                    : isSidebarCollapsed 
                      ? "w-full h-full max-w-full rounded-none border-none shadow-none" 
                      : "w-full h-full max-w-7xl rounded-2xl"
                }`}
              >
                {/* Mobile top camera Notch */}
                {previewDevice === "mobile" && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-[#0d111d] h-5 w-32 rounded-b-xl z-30 flex items-center justify-center gap-2 border-b border-slate-800">
                    <div className="w-2 h-2 rounded-full bg-slate-800" />
                    <div className="w-8 h-1 rounded-full bg-slate-800" />
                  </div>
                )}

                {/* Inner simulated Store Component */}
                <StorePreview
                  config={config}
                  cart={cart}
                  addToCart={addToCart}
                  updateQuantity={updateQuantity}
                  calculateTotal={() => {}}
                  isCartDrawerOpen={isCartDrawerOpen}
                  setIsCartDrawerOpen={setIsCartDrawerOpen}
                  hasOrdered={hasOrdered}
                  handleCheckout={handleCheckout}
                  selectedCategory={selectedCategory}
                  setSelectedCategory={setSelectedCategory}
                  externalPage={storePreviewPageOverride || undefined}
                  onResetExternalPage={() => setStorePreviewPageOverride(null)}
                />
              </div>
            </main>
          </div>
        </div>
      )}

      {/* ----------------- 4. FULL SCREEN MODAL PREVIEW ----------------- */}
      <AnimatePresence>
        {showFullScreenPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm p-4 md:p-8 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-6xl h-full max-h-[90vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col"
              style={{ fontFamily: config.fontFamily === "Tajawal" ? "Tajawal, sans-serif" : "Cairo, sans-serif" }}
            >
              {/* Toolbar Header */}
              <div className="bg-slate-100 text-slate-900 border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 select-none">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-100 text-amber-800 p-2 rounded-xl border border-amber-200">
                    <Store className="w-5 h-5 text-amber-700" />
                  </div>
                  <div>
                    <span className="font-extrabold text-sm md:text-base text-slate-900">{config.storeName} (عرض المعاينة الكاملة)</span>
                    <span className="text-[10px] text-slate-500 font-bold block -mt-0.5">تصميم وحفظ عبر منصة {platformSettings.platformName}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="hidden md:flex bg-white border border-slate-200 px-3 py-1 rounded-full text-xs font-bold text-slate-700 shadow-2xs">
                    قالب: {config.themeStyle === "elegant" ? "الأناقة والفخامة" : "التكنولوجيا والابتكار"}
                  </div>
                  <button
                    onClick={() => {
                      const jsonString = JSON.stringify(config, null, 2);
                      navigator.clipboard.writeText(jsonString);
                      triggerToast("تم نسخ مواصفات وملف المتجر بصيغة JSON لترسله لأي شخص! 📋", "success");
                    }}
                    className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-2xs cursor-pointer touch-manipulation min-h-[38px]"
                    title="تصدير كود المتجر"
                  >
                    <span>تصدير كود JSON 📦</span>
                  </button>
                  <button
                    onClick={() => setShowFullScreenPreview(false)}
                    className="bg-rose-600 hover:bg-rose-700 text-white p-2 rounded-xl transition shadow-2xs cursor-pointer touch-manipulation"
                    title="إغلاق المعاينة"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Inside Fullscreen Preview Body */}
              <div className="flex-1 overflow-hidden relative">
                <StorePreview
                  config={config}
                  cart={cart}
                  addToCart={addToCart}
                  updateQuantity={updateQuantity}
                  calculateTotal={() => {}}
                  isCartDrawerOpen={isCartDrawerOpen}
                  setIsCartDrawerOpen={setIsCartDrawerOpen}
                  hasOrdered={hasOrdered}
                  handleCheckout={handleCheckout}
                  selectedCategory={selectedCategory}
                  setSelectedCategory={setSelectedCategory}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive Template Preview Modal before selection */}
      <AnimatePresence>
        {previewingTemplate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[999] flex flex-col"
            dir="rtl"
          >
            {/* Template Preview Top Bar */}
            <div className="bg-white border-b border-slate-200 px-3 md:px-6 py-2.5 flex items-center justify-between gap-2 shadow-sm shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-8 h-8 md:w-9 md:h-9 rounded-xl text-white font-extrabold text-xs md:text-sm flex items-center justify-center shrink-0 ${
                  previewingTemplate === "elegant" ? "bg-amber-600 shadow-amber-600/20 shadow-md" : "bg-sky-600 shadow-sky-600/20 shadow-md"
                }`}>
                  {previewingTemplate === "elegant" ? "✨" : "⚡"}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-extrabold text-slate-900 text-xs md:text-base truncate">معاينة تفاعلية:</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] md:text-xs font-black border truncate ${
                      previewingTemplate === "elegant" 
                        ? "bg-amber-100 text-amber-900 border-amber-300" 
                        : "bg-sky-100 text-sky-900 border-sky-300"
                    }`}>
                      {previewingTemplate === "elegant" ? "قالب الأناقة العصرية" : "قالب التكنولوجيا والابتكار"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 hidden md:block -mt-0.5">
                    يمكنك تصفح المنتجات والفئات وتجربة السلة مباشرة للتأكد من ملاءمة القالب لمشروعك.
                  </p>
                </div>
              </div>

              {/* View mode buttons: Desktop vs Mobile (Visible on desktop viewports) */}
              <div className="hidden lg:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                <button
                  onClick={() => setPreviewingDevice("desktop")}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                    previewingDevice === "desktop" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>سطح المكتب</span>
                </button>
                <button
                  onClick={() => setPreviewingDevice("mobile")}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                    previewingDevice === "mobile" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>الجوال</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                  onClick={() => setPreviewingTemplate(null)}
                  className="px-2.5 sm:px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition text-xs font-bold flex items-center gap-1"
                  title="إغلاق المعاينة"
                >
                  <X className="w-4 h-4" />
                  <span className="hidden sm:inline">إغلاق</span>
                </button>

                <button
                  onClick={() => {
                    const templateToSelect = previewingTemplate;
                    setPreviewingTemplate(null);
                    selectTemplate(templateToSelect);
                  }}
                  className={`px-3 sm:px-4 py-2 text-white font-black rounded-xl transition shadow-md flex items-center gap-1.5 text-xs ${
                    previewingTemplate === "elegant"
                      ? "bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 shadow-amber-600/20"
                      : "bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 shadow-sky-600/20"
                  }`}
                >
                  <span>اعتماد القالب ⚡</span>
                  <ArrowLeft className="w-4 h-4 hidden sm:inline" />
                </button>
              </div>
            </div>

            {/* Template Live Store Body */}
            <div className="flex-1 overflow-auto bg-slate-200/90 p-1 sm:p-4 flex justify-center items-start">
              <div 
                className={`bg-white shadow-2xl overflow-hidden transition-all duration-300 w-full ${
                  previewingDevice === "mobile" 
                    ? "max-w-full sm:max-w-[390px] rounded-none sm:rounded-[32px] border-0 sm:border-[8px] sm:border-slate-800 my-0 sm:my-2 min-h-full sm:min-h-[720px] shadow-2xl" 
                    : "max-w-7xl rounded-none sm:rounded-2xl border-0 sm:border border-slate-300 min-h-full sm:min-h-[85vh]"
                }`}
              >
                <StorePreview
                  config={previewingTemplate === "elegant" ? ELEGANT_PRESET : TECH_PRESET}
                  cart={cart}
                  addToCart={addToCart}
                  updateQuantity={updateQuantity}
                  calculateTotal={() => cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0)}
                  isCartDrawerOpen={isCartDrawerOpen}
                  setIsCartDrawerOpen={setIsCartDrawerOpen}
                  hasOrdered={hasOrdered}
                  handleCheckout={handleCheckout}
                  selectedCategory={selectedCategory}
                  setSelectedCategory={setSelectedCategory}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Route-owned platform administration console */}
      {isAdminOpen && authUser && (
        <PlatformAdminConsole
          user={authUser}
          section={adminSection}
          storeId={adminStoreId}
          onNavigate={(section) => {
            setAdminSection(section);
            setAdminStoreId(undefined);
            pushCentralPath(adminPath(section));
          }}
          onOpenStore={(storeId) => {
            setAdminSection("stores");
            setAdminStoreId(storeId);
            pushCentralPath(adminStorePath(storeId));
          }}
          onCloseStore={() => {
            setAdminStoreId(undefined);
            pushCentralPath(adminPath("stores"));
          }}
          onExit={() => {
            updateAdminSettingsDirty(false);
            setAdminStoreId(undefined);
            setIsAdminOpen(false);
            setView("landing");
            replaceCentralPath("/");
          }}
          onLogout={async () => {
            try {
              await auth.logout();
            } catch (caught) {
              triggerToast("تعذر إنهاء جلسة الإدارة على الخادم. حاول مجددًا.", "error");
              throw caught;
            }
            setAuthUser(null);
            updateAdminSettingsDirty(false);
            setAdminStoreId(undefined);
            setIsAdminOpen(false);
            resetTenantOwnedState();
            setView("landing");
            replaceCentralPath("/");
            triggerToast("تم إنهاء جلسة إدارة المنصة.", "info");
          }}
          onSessionExpired={() => {
            setAuthUser(null);
            updateAdminSettingsDirty(false);
            setIsAdminOpen(false);
            resetTenantOwnedState();
            setIsAdminAuthModalOpen(true);
          }}
          onToast={triggerToast}
          onDirtyChange={updateAdminSettingsDirty}
        />
      )}

      {/* Custom Logout Confirmation Modal */}
      <AnimatePresence>
        {isLogoutConfirmOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-right font-sans"
              dir="rtl"
            >
              <div className="flex items-center gap-3 mb-4 text-rose-600">
                <div className="p-2.5 bg-rose-50 rounded-xl">
                  <LogOut className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-lg text-slate-900">تسجيل الخروج من الحساب</h3>
              </div>

              <p className="text-slate-600 text-sm leading-relaxed mb-6">
                {recoverableWorkspaceChanges
                  ? "توجد تعديلات غير محفوظة. تسجيل الخروج سيحفظ ما سبق إرساله للخادم فقط، وسيتجاهل التعديلات الحالية في المحرر."
                  : "هل أنت متأكد من تسجيل الخروج؟ ستبقى النسخة المحفوظة على الخادم ويمكنك الدخول مجددًا في أي وقت."}
              </p>

              <div className="flex items-center gap-3 justify-end">
                <button
                  onClick={() => setIsLogoutConfirmOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition text-sm font-bold"
                >
                  إلغاء
                </button>
                <button
                  onClick={executeLogout}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition text-sm font-bold shadow-lg shadow-rose-600/10"
                >
                  نعم، تسجيل الخروج
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Reset Store Confirmation Modal */}
      <AnimatePresence>
        {isResetConfirmOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-right font-sans"
              dir="rtl"
            >
              <div className="flex items-center gap-3 mb-4 text-amber-600">
                <div className="p-2.5 bg-amber-50 rounded-xl">
                  <RefreshCw className="w-6 h-6 text-amber-600 animate-spin-slow" />
                </div>
                <h3 className="font-extrabold text-lg text-slate-900">إعادة تعيين المتجر</h3>
              </div>

              <p className="text-slate-600 text-sm leading-relaxed mb-6">
                هل أنت متأكد من إعادة تعيين المتجر إلى الإعدادات الافتراضية؟ ستفقد كافة التعديلات والتغييرات التي قمت بها على هذا القالب بشكل نهائي.
              </p>

              <div className="flex items-center gap-3 justify-end">
                <button
                  onClick={() => setIsResetConfirmOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition text-sm font-bold"
                >
                  إلغاء التراجع
                </button>
                <button
                  onClick={executeResetStore}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition text-sm font-bold shadow-lg shadow-amber-600/10"
                >
                  نعم، إعادة تعيين
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subdomain & Tenant Activation Modal */}
      <DomainSetupModal
        isOpen={isDomainModalOpen}
        onClose={() => setIsDomainModalOpen(false)}
        storeName={config.storeName}
        businessType={registeredUser?.businessType || "retail"}
        themeStyle={config.themeStyle}
        config={config as unknown as Record<string, unknown>}
        ownerId={authUser?.id ?? ""}
        draft={activeDraft}
        onDraftChanged={setActiveDraft}
        onReloadDraft={reloadActiveDraft}
        onSubmitted={(submission) => {
          const domain = submission.requestedDomain ?? "العنوان المحجوز";
          triggerToast(`تم إرسال متجر ${submission.storeName} للمراجعة على العنوان ${domain}. سيبدأ التجهيز بعد الموافقة.`, "success");
          setIsDomainModalOpen(false);
          setActiveDraft(null);
          if (authUser) {
            void restoreMerchantState(authUser).then((outcome) => {
              if (outcome.status === "error" && !outcome.sessionActive) return;
              setView("merchant_dashboard");
              pushCentralPath("/app");
            });
          }
        }}
      />

      {/* Super Admin Protected Auth Gate */}
      <AdminAuthModal
        isOpen={isAdminAuthModalOpen}
        onClose={() => setIsAdminAuthModalOpen(false)}
        onSuccess={(user) => {
          const section = safeAdminSection(adminSection, user) ?? safeAdminSection("overview", user) ?? "overview";
          setAuthUser(user);
          setAdminSection(section);
          replaceCentralPath(adminPath(section));
          setIsAdminOpen(true);
          setIsAdminAuthModalOpen(false);
          triggerToast("مرحباً بك في مركز إدارة المنصة.", "success");
        }}
      />

    </div>
  );
}
