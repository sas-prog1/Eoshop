import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Globe2,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  ScrollText,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Store,
  UsersRound,
  XCircle,
} from "lucide-react";
import { useUiAdapters } from "../adapters/UiAdaptersContext";
import {
  isUiError,
  uiErrorMessage,
  type AdminAuditEvent,
  type AdminAuditQuery,
  type PaginatedResult,
  type PlatformAttentionQueue,
  type PlatformOverview,
  type PlatformStore,
  type PlatformStoreQuery,
  type UserProfile,
  type VerificationStatus,
} from "../adapters/uiAdapters";
import { publicStoreUrl } from "../utils/publicStoreUrl";
import {
  authorizedAdminSections,
  canManagePlatformSettings,
  canManagePlatformUsers,
  canViewPlatformAudit,
  canViewPlatformStores,
  safeAdminSection,
  type AdminSection,
} from "../features/admin/adminAccess";
import PlatformUsersPanel from "../features/admin/PlatformUsersPanel";
import PlatformSettingsPanel from "../features/admin/PlatformSettingsPanel";
import { usePlatformSettings } from "../adapters/PlatformSettingsContext";
import SkipLink from "./SkipLink";
import { isProvisioningTransition, useLifecyclePolling } from "../features/provisioning/useLifecyclePolling";

interface PlatformAdminConsoleProps {
  user: UserProfile;
  section: AdminSection;
  onNavigate: (section: AdminSection) => void;
  onExit: () => void;
  onLogout: () => Promise<void>;
  onSessionExpired: () => void;
  onToast: (message: string, type?: "success" | "error" | "info") => void;
  onDirtyChange?: (dirty: boolean) => void;
}

const noopDirtyChange = () => undefined;

const emptyPagination = { currentPage: 1, lastPage: 1, perPage: 25, total: 0 };
const emptyStores: PaginatedResult<PlatformStore> = { items: [], pagination: emptyPagination };
const emptyAudit: PaginatedResult<AdminAuditEvent> = { items: [], pagination: emptyPagination };

const verificationLabel: Record<VerificationStatus, string> = {
  pending: "قيد المراجعة",
  changes_requested: "استكمال مطلوب",
  approved: "مقبول",
  rejected: "مرفوض",
  suspended: "موقوف",
};

const verificationClass: Record<VerificationStatus, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  changes_requested: "border-orange-200 bg-orange-50 text-orange-800",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
  rejected: "border-rose-200 bg-rose-50 text-rose-800",
  suspended: "border-slate-300 bg-slate-100 text-slate-800",
};

const correctionFieldOptions = [
  ["business.store_name", "اسم المتجر"],
  ["business.business_type", "نوع النشاط"],
  ["design.appearance", "التصميم والمحتوى"],
  ["publication.handle", "عنوان المتجر"],
  ["subscription.plan", "الباقة"],
  ["documents.owner_identity", "إثبات هوية المالك"],
  ["documents.commercial_registration", "السجل أو الترخيص التجاري"],
] as const;

const provisioningLabel: Record<PlatformStore["provisioningStatus"], string> = {
  not_started: "لم يبدأ",
  queued: "في الطابور",
  provisioning: "جارٍ التجهيز",
  retrying: "إعادة محاولة",
  active: "جاهز",
  failed: "فشل",
};

const queueCopy: Record<PlatformAttentionQueue, { title: string; description: string }> = {
  review: { title: "مراجعات تنتظر قرارًا", description: "طلبات متاجر بحالة قيد المراجعة" },
  provisioning: { title: "تجهيزات فاشلة", description: "حالة المستأجر المركزية تحتاج إعادة محاولة" },
  subscription: { title: "استحقاقات تحتاج إجراءً", description: "تفعيل يدوي أو استحقاق منتهي" },
  publication: { title: "نشر يحتاج فحصًا", description: "متاجر جاهزة تقنيًا وغير منشورة" },
};

const actionLabel: Record<string, string> = {
  "platform.store.verification_status.changed": "تغيير حالة مراجعة متجر",
  "platform.store.metadata.changed": "تعديل بيانات متجر",
  "platform.store.subscription.activated": "تفعيل اشتراك متجر",
  "platform.store.subscription.renewed": "تجديد اشتراك متجر",
  "platform.store.publication.published": "نشر متجر",
  "platform.store.publication.unpublished": "إيقاف نشر متجر",
  "platform.store.provisioning.retried": "إعادة تجهيز متجر",
};

function localizedAction(action: string): string {
  return actionLabel[action] ?? action;
}

function Pagination({
  value,
  onPage,
}: {
  value: PaginatedResult<unknown>["pagination"];
  onPage: (page: number) => void;
}) {
  if (value.lastPage <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4 text-xs text-slate-600">
      <span>صفحة {value.currentPage} من {value.lastPage} · {value.total} سجل</span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={value.currentPage <= 1}
          onClick={() => onPage(value.currentPage - 1)}
          className="rounded-xl border border-slate-200 bg-white p-2 disabled:opacity-40"
          aria-label="الصفحة السابقة"
        ><ChevronRight className="h-4 w-4" /></button>
        <button
          type="button"
          disabled={value.currentPage >= value.lastPage}
          onClick={() => onPage(value.currentPage + 1)}
          className="rounded-xl border border-slate-200 bg-white p-2 disabled:opacity-40"
          aria-label="الصفحة التالية"
        ><ChevronLeft className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

export default function PlatformAdminConsole({
  user,
  section,
  onNavigate,
  onExit,
  onLogout,
  onSessionExpired,
  onToast,
  onDirtyChange = noopDirtyChange,
}: PlatformAdminConsoleProps) {
  const { administration } = useUiAdapters();
  const { settings: publicSettings, replace: replacePublicSettings } = usePlatformSettings();
  const mounted = useRef(true);
  const overviewSequence = useRef(0);
  const storesSequence = useRef(0);
  const auditSequence = useRef(0);
  const storesForbiddenRef = useRef(false);
  const auditForbiddenRef = useRef(false);
  const mutationInFlight = useRef(false);
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [stores, setStores] = useState<PaginatedResult<PlatformStore>>(emptyStores);
  const [storesLoading, setStoresLoading] = useState(false);
  const [storesError, setStoresError] = useState<string | null>(null);
  const [storeQuery, setStoreQuery] = useState<PlatformStoreQuery>({ page: 1, perPage: 25 });
  const [storeSearch, setStoreSearch] = useState("");
  const [audit, setAudit] = useState<PaginatedResult<AdminAuditEvent>>(emptyAudit);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditQuery, setAuditQuery] = useState<AdminAuditQuery>({ page: 1, perPage: 25 });
  const [auditSearch, setAuditSearch] = useState("");
  const [storesForbidden, setStoresForbidden] = useState(false);
  const [auditForbidden, setAuditForbidden] = useState(false);
  const [mutationPending, setMutationPending] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [usersRefreshSignal, setUsersRefreshSignal] = useState(0);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersForbidden, setUsersForbidden] = useState(false);
  const [settingsRefreshSignal, setSettingsRefreshSignal] = useState(0);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsForbidden, setSettingsForbidden] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [reasonDecision, setReasonDecision] = useState<{ store: PlatformStore; status: "changes_requested" | "rejected" | "suspended" } | null>(null);
  const [reason, setReason] = useState("");
  const [requestedFields, setRequestedFields] = useState<string[]>([]);
  const [activationStore, setActivationStore] = useState<PlatformStore | null>(null);
  const [subscriptionEndsAt, setSubscriptionEndsAt] = useState("");

  const canStores = canViewPlatformStores(user);
  const canAudit = canViewPlatformAudit(user);
  const canUsers = canManagePlatformUsers(user);
  const canSettings = canManagePlatformSettings(user);
  const canReview = user.platformPermissions.includes("platform.stores.review");
  const canManage = user.platformPermissions.includes("platform.stores.manage");
  const permissionSignature = [...user.platformPermissions].sort().join("|");
  const allowedSections = useMemo(() => authorizedAdminSections(user), [user]);
  const activeSection = safeAdminSection(section, user);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      overviewSequence.current += 1;
      storesSequence.current += 1;
      auditSequence.current += 1;
    };
  }, []);

  useEffect(() => {
    storesForbiddenRef.current = false;
    auditForbiddenRef.current = false;
    setStoresForbidden(false);
    setAuditForbidden(false);
    setUsersForbidden(false);
    setSettingsForbidden(false);
  }, [permissionSignature, user.id]);

  useEffect(() => {
    if (activeSection && activeSection !== section) onNavigate(activeSection);
  }, [activeSection, onNavigate, section]);

  const revokeStoresAccess = () => {
    storesForbiddenRef.current = true;
    overviewSequence.current += 1;
    storesSequence.current += 1;
    setOverview(null);
    setStores(emptyStores);
    setOverviewLoading(false);
    setStoresLoading(false);
    setOverviewError(null);
    setStoresError(null);
    setReasonDecision(null);
    setReason("");
    setRequestedFields([]);
    setActivationStore(null);
    setSubscriptionEndsAt("");
    setStoresForbidden(true);
  };

  const revokeAuditAccess = () => {
    auditForbiddenRef.current = true;
    auditSequence.current += 1;
    setAudit(emptyAudit);
    setAuditLoading(false);
    setAuditError(null);
    setAuditForbidden(true);
  };

  const handleReadError = (
    error: unknown,
    scope: "stores" | "audit",
    fallback: string,
    setError: (message: string) => void,
  ) => {
    if (isUiError(error, "unauthenticated")) {
      onSessionExpired();
      return;
    }
    if (isUiError(error, "forbidden")) {
      if (scope === "stores") revokeStoresAccess();
      else revokeAuditAccess();
      return;
    }
    setError(uiErrorMessage(error, fallback));
  };

  const loadOverview = async () => {
    if (!canStores || storesForbiddenRef.current) return;
    const sequence = ++overviewSequence.current;
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const next = await administration.overview();
      if (mounted.current && sequence === overviewSequence.current) setOverview(next);
    } catch (error) {
      if (mounted.current && sequence === overviewSequence.current) {
        handleReadError(error, "stores", "تعذر تحميل الملخص التشغيلي.", setOverviewError);
      }
    } finally {
      if (mounted.current && sequence === overviewSequence.current) setOverviewLoading(false);
    }
  };

  const loadStores = async (query: PlatformStoreQuery = storeQuery, signal?: AbortSignal) => {
    if (!canStores || storesForbiddenRef.current) return;
    const sequence = ++storesSequence.current;
    setStoresLoading(true);
    setStoresError(null);
    try {
      const next = signal
        ? await administration.listStores(query, signal)
        : await administration.listStores(query);
      if (mounted.current && sequence === storesSequence.current) setStores(next);
    } catch (error) {
      if (mounted.current && sequence === storesSequence.current) {
        if (isUiError(error, "aborted")) return;
        handleReadError(error, "stores", "تعذر تحميل متاجر المنصة.", setStoresError);
      }
    } finally {
      if (mounted.current && sequence === storesSequence.current) setStoresLoading(false);
    }
  };

  const transitioningStoreIds = stores.items
    .filter((store) => store.verificationStatus === "approved" && isProvisioningTransition(store.provisioningStatus))
    .map((store) => store.id)
    .sort();

  useLifecyclePolling({
    enabled: activeSection === "stores" && canStores && !storesForbidden && transitioningStoreIds.length > 0,
    pollKey: `platform:${user.id}:${transitioningStoreIds.join(",")}`,
    refresh: async (signal) => {
      if (mutationInFlight.current || storesLoading) return;
      await loadStores(storeQuery, signal);
    },
  });

  const loadAudit = async (query: AdminAuditQuery = auditQuery) => {
    if (!canAudit || auditForbiddenRef.current) return;
    const sequence = ++auditSequence.current;
    setAuditLoading(true);
    setAuditError(null);
    try {
      const next = await administration.listAuditLogs(query);
      if (mounted.current && sequence === auditSequence.current) setAudit(next);
    } catch (error) {
      if (mounted.current && sequence === auditSequence.current) {
        handleReadError(error, "audit", "تعذر تحميل سجل الإدارة.", setAuditError);
      }
    } finally {
      if (mounted.current && sequence === auditSequence.current) setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (canStores) {
      void loadOverview();
      void loadStores(storeQuery);
    }
  }, [canStores, permissionSignature, storeQuery, user.id]);

  useEffect(() => {
    if (canAudit && activeSection === "audit") void loadAudit(auditQuery);
  }, [activeSection, auditQuery, canAudit, permissionSignature, user.id]);

  const refreshAfterMutation = async () => {
    await Promise.all([loadOverview(), loadStores(storeQuery)]);
  };

  const runMutation = async (
    storeRecord: PlatformStore,
    operation: () => Promise<PlatformStore>,
    success: string,
  ) => {
    if (mutationInFlight.current || storesForbiddenRef.current) return;
    mutationInFlight.current = true;
    setMutationPending(true);
    setStoresError(null);
    try {
      await operation();
      await refreshAfterMutation();
      onToast(success, "success");
    } catch (error) {
      if (isUiError(error, "unauthenticated")) onSessionExpired();
      else if (isUiError(error, "forbidden")) revokeStoresAccess();
      else setStoresError(uiErrorMessage(error, "تعذر تنفيذ العملية الإدارية."));
      throw error;
    } finally {
      mutationInFlight.current = false;
      if (mounted.current) setMutationPending(false);
    }
  };

  const updateStatus = async (storeRecord: PlatformStore, status: VerificationStatus, decisionReason?: string, fields?: string[]) => {
    await runMutation(
      storeRecord,
      () => administration.updateStoreStatus(storeRecord.id, status, decisionReason, fields),
      "تم تحديث حالة المتجر وتسجيل العملية.",
    );
    setReasonDecision(null);
    setReason("");
    setRequestedFields([]);
  };

  const openQueue = (attention: PlatformAttentionQueue) => {
    setStoreQuery({ page: 1, perPage: storeQuery.perPage ?? 25, attention });
    setStoreSearch("");
    onNavigate("stores");
  };

  const confirmSettingsDiscard = (): boolean => !settingsDirty || window.confirm("توجد تعديلات غير محفوظة في إعدادات المنصة. مغادرة القسم ستتجاهلها. هل تريد المتابعة؟");
  const navigateSection = (next: AdminSection) => {
    if (next === activeSection || !confirmSettingsDiscard()) return;
    setSettingsDirty(false);
    onDirtyChange(false);
    onNavigate(next);
  };
  const exitConsole = () => {
    if (!confirmSettingsDiscard()) return;
    setSettingsDirty(false);
    onDirtyChange(false);
    onExit();
  };
  const logout = () => {
    if (!confirmSettingsDiscard() || logoutPending) return;
    setLogoutPending(true);
    void onLogout()
      .then(() => {
        if (!mounted.current) return;
        setSettingsDirty(false);
        onDirtyChange(false);
      })
      .catch(() => undefined)
      .finally(() => mounted.current && setLogoutPending(false));
  };

  if (!activeSection) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950 p-6 text-white" dir="rtl">
        <div className="max-w-lg rounded-3xl border border-rose-800 bg-slate-900 p-8 text-center shadow-2xl">
          <ShieldAlert className="mx-auto h-12 w-12 text-rose-400" />
          <h1 className="mt-4 text-xl font-black">لا تملك صلاحية دخول إدارة المنصة</h1>
          <p className="mt-2 text-sm leading-7 text-slate-400">تم التعرف على الجلسة، لكن الخادم لم يمنح هذا الحساب أي صلاحية لإدارة المنصة.</p>
          <button type="button" onClick={exitConsole} className="mt-6 rounded-xl bg-white px-5 py-3 text-xs font-black text-slate-950">العودة للموقع</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex overflow-hidden bg-slate-100 text-slate-900" dir="rtl">
      <SkipLink targetId="platform-admin-main" />
      <aside className="hidden w-72 shrink-0 flex-col bg-slate-950 text-white lg:flex">
        <div className="border-b border-slate-800 p-6">
          <div className="flex items-center gap-3">
            {publicSettings.logoUrl ? <img src={publicSettings.logoUrl} referrerPolicy="no-referrer" alt="" className="h-12 w-12 rounded-2xl bg-white object-contain p-1" /> : <span style={{ backgroundColor: publicSettings.primaryColor }} className="rounded-2xl p-3"><ShieldCheck className="h-6 w-6" /></span>}
            <div><strong className="block text-lg">{publicSettings.platformName}</strong><span className="text-xs text-slate-400">مركز إدارة المنصة</span></div>
          </div>
        </div>
        <nav className="flex-1 space-y-2 p-4" aria-label="أقسام إدارة المنصة">
          {allowedSections.map((item) => {
            const Icon = item === "overview" ? LayoutDashboard : item === "stores" ? Store : item === "users" ? UsersRound : item === "settings" ? Settings : ScrollText;
            const label = item === "overview" ? "نظرة تشغيلية" : item === "stores" ? "المتاجر" : item === "users" ? "المستخدمون" : item === "settings" ? "إعدادات المنصة" : "سجل التدقيق";
            return (
              <button key={item} type="button" onClick={() => navigateSection(item)} aria-current={activeSection === item ? "page" : undefined} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold ${activeSection === item ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-900"}`}>
                <Icon className="h-5 w-5" /> {label}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-slate-800 p-4 text-xs">
          <strong className="block truncate">{user.fullName}</strong>
          <span className="mt-1 block truncate text-slate-400" dir="ltr">{user.email}</span>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={exitConsole} className="rounded-xl border border-slate-700 px-3 py-2 text-slate-300">الموقع</button>
            <button type="button" disabled={logoutPending} onClick={logout} className="flex items-center justify-center gap-1 rounded-xl bg-rose-600 px-3 py-2 font-bold disabled:opacity-50"><LogOut className="h-4 w-4" /> خروج</button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-black">{activeSection === "overview" ? "النظرة التشغيلية" : activeSection === "stores" ? "إدارة المتاجر" : activeSection === "users" ? "إدارة مستخدمي المنصة" : activeSection === "settings" ? "إعدادات المنصة" : "سجل التدقيق"}</h1>
              <p className="mt-1 text-xs text-slate-500">بيانات مركزية محمية بصلاحيات الخادم</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" disabled={(activeSection === "audit" && auditForbidden) || (activeSection === "users" && usersForbidden) || (activeSection === "settings" && (settingsForbidden || settingsDirty)) || ((activeSection === "overview" || activeSection === "stores") && storesForbidden)} onClick={() => activeSection === "audit" ? void loadAudit() : activeSection === "users" ? setUsersRefreshSignal((value) => value + 1) : activeSection === "settings" ? setSettingsRefreshSignal((value) => value + 1) : activeSection === "stores" ? void loadStores() : void loadOverview()} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50 sm:px-4">
                <RefreshCw className={`h-4 w-4 ${(overviewLoading || storesLoading || auditLoading || usersLoading || settingsLoading) ? "animate-spin" : ""}`} /><span className="hidden sm:inline">تحديث</span>
              </button>
              <button type="button" onClick={exitConsole} aria-label="العودة إلى الموقع" className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 lg:hidden"><ExternalLink className="h-4 w-4" /></button>
              <button type="button" disabled={logoutPending} onClick={logout} aria-label="تسجيل الخروج" className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-700 disabled:opacity-50 lg:hidden"><LogOut className="h-4 w-4" /></button>
            </div>
          </div>
          <nav className="mt-4 flex gap-2 overflow-x-auto lg:hidden" aria-label="أقسام إدارة المنصة للجوال">
            {allowedSections.map((item) => (
              <button key={item} type="button" onClick={() => navigateSection(item)} aria-current={activeSection === item ? "page" : undefined} className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold ${activeSection === item ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                {item === "overview" ? "النظرة" : item === "stores" ? "المتاجر" : item === "users" ? "المستخدمون" : item === "settings" ? "الإعدادات" : "التدقيق"}
              </button>
            ))}
          </nav>
        </header>

        <main id="platform-admin-main" tabIndex={-1} className="flex-1 overflow-auto p-4 sm:p-6">
          {((activeSection === "overview" || activeSection === "stores") && storesForbidden) && <AccessDeniedState />}
          {(activeSection === "audit" && auditForbidden) && <AccessDeniedState />}
          {(activeSection === "settings" && settingsForbidden) && <AccessDeniedState />}

          {activeSection === "overview" && canStores && !storesForbidden && (
            <section className="mx-auto max-w-7xl space-y-6">
              {overviewError && <ErrorState message={overviewError} onRetry={() => void loadOverview()} />}
              {!overview && overviewLoading && <LoadingState label="تحميل الملخص التشغيلي..." />}
              {overview && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Metric title="كل المتاجر" value={overview.stores.total} tone="indigo" />
                    <Metric title="منشورة" value={overview.stores.publication.published} tone="emerald" />
                    <Metric title="قيد المراجعة" value={overview.stores.verification.pending} tone="amber" />
                    <Metric title="فشل التجهيز" value={overview.stores.provisioning.failed} tone="rose" />
                  </div>
                  <div>
                    <div className="mb-3"><h2 className="font-black">طوابير تحتاج انتباهًا</h2><p className="text-xs text-slate-500">كل رقم يستخدم نفس مرشح قائمة المتاجر على الخادم.</p></div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      {(Object.keys(queueCopy) as PlatformAttentionQueue[]).map((queue) => (
                        <button key={queue} type="button" onClick={() => openQueue(queue)} className="rounded-2xl border border-slate-200 bg-white p-5 text-right shadow-sm transition hover:border-indigo-300 hover:shadow-md">
                          <span className="text-3xl font-black text-slate-950">{overview.attention[queue]}</span>
                          <strong className="mt-3 block text-sm">{queueCopy[queue].title}</strong>
                          <span className="mt-1 block text-xs leading-6 text-slate-500">{queueCopy[queue].description}</span>
                          <span className="mt-4 flex items-center gap-1 text-xs font-bold text-indigo-600">فتح الطابور <ArrowLeft className="h-4 w-4" /></span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400">آخر لقطة مركزية: {new Date(overview.generatedAt).toLocaleString("ar-YE")}</p>
                </>
              )}
            </section>
          )}

          {activeSection === "stores" && canStores && !storesForbidden && (
            <section className="mx-auto max-w-7xl space-y-4">
              <form onSubmit={(event) => { event.preventDefault(); setStoreQuery((current) => ({ ...current, search: storeSearch.trim() || undefined, page: 1 })); }} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-5">
                <label className="relative md:col-span-2">
                  <span className="sr-only">البحث عن متجر</span><Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                  <input value={storeSearch} minLength={2} maxLength={100} onChange={(event) => setStoreSearch(event.target.value)} placeholder="المتجر أو المالك أو البريد" className="w-full rounded-xl border border-slate-200 py-2.5 pr-10 pl-3 text-sm outline-none focus:border-indigo-400" />
                </label>
                <select aria-label="حالة المراجعة" value={storeQuery.verification ?? ""} onChange={(event) => setStoreQuery((current) => ({ ...current, verification: (event.target.value || undefined) as VerificationStatus | undefined, page: 1 }))} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">
                  <option value="">كل حالات المراجعة</option><option value="pending">قيد المراجعة</option><option value="changes_requested">استكمال مطلوب</option><option value="approved">مقبول</option><option value="rejected">مرفوض</option><option value="suspended">موقوف</option>
                </select>
                <select aria-label="طابور الانتباه" value={storeQuery.attention ?? ""} onChange={(event) => setStoreQuery((current) => ({ ...current, attention: (event.target.value || undefined) as PlatformAttentionQueue | undefined, page: 1 }))} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">
                  <option value="">كل الطوابير</option><option value="review">المراجعة</option><option value="provisioning">التجهيز</option><option value="subscription">الاشتراك</option><option value="publication">النشر</option>
                </select>
                <div className="flex gap-2"><button type="submit" className="flex-1 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white">بحث</button><button type="button" onClick={() => { setStoreSearch(""); setStoreQuery({ page: 1, perPage: 25 }); }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">مسح</button></div>
              </form>
              {storeQuery.attention && <p className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs font-bold text-indigo-800">الطابور الحالي: {queueCopy[storeQuery.attention].title}</p>}
              {storesError && <ErrorState message={storesError} onRetry={() => void loadStores()} />}
              {!storesError && storesLoading && stores.items.length === 0 && <LoadingState label="تحميل المتاجر..." />}
              {!storesLoading && !storesError && stores.items.length === 0 && <EmptyState icon={Store} label="لا توجد متاجر مطابقة للمرشحات الحالية." />}
              <div className="grid gap-4 xl:grid-cols-2">
                {stores.items.map((storeRecord) => (
                  <React.Fragment key={storeRecord.id}>
                    <StoreCard
                      store={storeRecord}
                      busy={mutationPending}
                      canReview={canReview}
                      canManage={canManage}
                      onStatus={(status, decisionReason) => updateStatus(storeRecord, status, decisionReason)}
                      onReason={(status) => { setReasonDecision({ store: storeRecord, status }); setRequestedFields(status === "changes_requested" ? ["business.store_name"] : []); }}
                      onRetry={() => runMutation(storeRecord, () => administration.retryProvisioning(storeRecord.id), "تمت جدولة إعادة تجهيز المتجر.")}
                      onActivate={() => setActivationStore(storeRecord)}
                      onPublish={() => runMutation(storeRecord, () => administration.publish(storeRecord.id), "تم نشر المتجر بعد اجتياز الشروط.")}
                      onUnpublish={() => runMutation(storeRecord, () => administration.unpublish(storeRecord.id), "تم إيقاف نشر المتجر مع الاحتفاظ ببياناته.")}
                    />
                  </React.Fragment>
                ))}
              </div>
              <Pagination value={stores.pagination} onPage={(page) => setStoreQuery((current) => ({ ...current, page }))} />
            </section>
          )}

          {activeSection === "users" && canUsers && (
            <PlatformUsersPanel
              administration={administration}
              currentUser={user}
              onSessionExpired={onSessionExpired}
              onToast={onToast}
              refreshSignal={usersRefreshSignal}
              onLoadingChange={setUsersLoading}
              onForbiddenChange={setUsersForbidden}
            />
          )}

          {activeSection === "settings" && canSettings && !settingsForbidden && (
            <PlatformSettingsPanel
              administration={administration}
              refreshSignal={settingsRefreshSignal}
              onSessionExpired={onSessionExpired}
              onForbiddenChange={setSettingsForbidden}
              onLoadingChange={setSettingsLoading}
              onDirtyChange={(dirty) => { setSettingsDirty(dirty); onDirtyChange(dirty); }}
              onSaved={replacePublicSettings}
              onToast={(message, type) => onToast(message, type)}
            />
          )}

          {activeSection === "audit" && canAudit && !auditForbidden && (
            <section className="mx-auto max-w-6xl space-y-4">
              <form onSubmit={(event) => { event.preventDefault(); setAuditQuery((current) => ({ ...current, search: auditSearch.trim() || undefined, page: 1 })); }} className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <label className="relative min-w-64 flex-1"><span className="sr-only">البحث في سجل التدقيق</span><Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" /><input value={auditSearch} minLength={2} maxLength={100} onChange={(event) => setAuditSearch(event.target.value)} placeholder="الإجراء أو المتجر أو الطلب" className="w-full rounded-xl border border-slate-200 py-2.5 pr-10 pl-3 text-sm outline-none focus:border-indigo-400" /></label>
                <button type="submit" className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white">بحث</button>
                <button type="button" onClick={() => { setAuditSearch(""); setAuditQuery({ page: 1, perPage: 25 }); }} className="rounded-xl border border-slate-200 px-4 py-2 text-xs">مسح</button>
              </form>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">هذا السجل للقراءة فقط. تعرض القائمة الحقول التي تغيّرت دون القيم الخام أو بيانات المتصفح.</div>
              {auditError && <ErrorState message={auditError} onRetry={() => void loadAudit()} />}
              {!auditError && auditLoading && audit.items.length === 0 && <LoadingState label="تحميل سجل التدقيق..." />}
              {!auditLoading && !auditError && audit.items.length === 0 && <EmptyState icon={ScrollText} label="لا توجد أحداث تدقيق مطابقة." />}
              <div className="space-y-3">
                {audit.items.map((event) => <React.Fragment key={event.id}><AuditEvent event={event} /></React.Fragment>)}
              </div>
              <Pagination value={audit.pagination} onPage={(page) => setAuditQuery((current) => ({ ...current, page }))} />
            </section>
          )}
        </main>
      </div>

      {reasonDecision && (
        <DecisionDialog
          title={`${reasonDecision.status === "changes_requested" ? "طلب استكمال" : reasonDecision.status === "rejected" ? "رفض نهائي" : "سبب تعليق"} ${reasonDecision.store.storeName}`}
          hint={reasonDecision.status === "changes_requested" ? "حدد البنود المطلوبة فقط، واكتب توجيهًا يستطيع التاجر تنفيذه دون إعادة الرحلة." : reasonDecision.status === "rejected" ? "قرار نهائي منفصل عن طلب الاستكمال؛ اكتب سببًا مهنيًا واضحًا." : "سجّل سببًا تشغيليًا واضحًا."}
          value={reason}
          requestedFields={reasonDecision.status === "changes_requested" ? requestedFields : undefined}
          busy={mutationPending}
          onChange={setReason}
          onRequestedFieldsChange={setRequestedFields}
          onCancel={() => { setReasonDecision(null); setReason(""); setRequestedFields([]); }}
          onConfirm={() => { void updateStatus(reasonDecision.store, reasonDecision.status, reason.trim(), requestedFields).catch(() => undefined); }}
        />
      )}

      {activationStore && (
        <ActivationDialog
          store={activationStore}
          value={subscriptionEndsAt}
          busy={mutationPending}
          onChange={setSubscriptionEndsAt}
          onCancel={() => { setActivationStore(null); setSubscriptionEndsAt(""); }}
          onConfirm={() => {
            const endsAt = new Date(`${subscriptionEndsAt}T23:59:59`).toISOString();
            void runMutation(activationStore, () => administration.activateSubscription(activationStore.id, endsAt), "تم تفعيل استحقاق المتجر.")
              .then(() => { setActivationStore(null); setSubscriptionEndsAt(""); })
              .catch(() => undefined);
          }}
        />
      )}
    </div>
  );
}

function Metric({ title, value, tone }: { title: string; value: number; tone: "indigo" | "emerald" | "amber" | "rose" }) {
  const tones = { indigo: "border-indigo-200 bg-indigo-50 text-indigo-800", emerald: "border-emerald-200 bg-emerald-50 text-emerald-800", amber: "border-amber-200 bg-amber-50 text-amber-800", rose: "border-rose-200 bg-rose-50 text-rose-800" };
  return <article className={`rounded-2xl border p-5 ${tones[tone]}`}><span className="text-3xl font-black">{value}</span><strong className="mt-2 block text-sm">{title}</strong></article>;
}

function LoadingState({ label }: { label: string }) {
  return <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-12 text-sm text-slate-500"><RefreshCw className="h-5 w-5 animate-spin" /> {label}</div>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><span className="flex items-center gap-2 font-bold"><AlertTriangle className="h-5 w-5" /> {message}</span><button type="button" onClick={onRetry} className="rounded-xl bg-white px-4 py-2 text-xs font-bold">إعادة التحميل</button></div>;
}

function AccessDeniedState() {
  return <div className="mx-auto grid max-w-2xl place-items-center rounded-3xl border border-rose-200 bg-rose-50 p-12 text-center text-rose-900"><ShieldAlert className="mb-4 h-11 w-11" /><h2 className="text-lg font-black">تم سحب صلاحية هذا القسم</h2><p className="mt-2 text-sm leading-7">رفض الخادم الوصول، لذلك أُزيلت البيانات السابقة وأُخفيت جميع الإجراءات. أعد تسجيل الدخول إذا تم منح الصلاحية مجددًا.</p></div>;
}

function EmptyState({ icon: Icon, label }: { icon: typeof Store; label: string }) {
  return <div className="grid place-items-center rounded-2xl border border-dashed border-slate-300 bg-white p-14 text-sm text-slate-500"><Icon className="mb-3 h-9 w-9" /> {label}</div>;
}

function AuditEvent({ event }: { event: AdminAuditEvent }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><strong className="text-sm">{localizedAction(event.action)}</strong><p className="mt-1 text-[11px] text-slate-500" dir="ltr">{event.action}</p></div><time className="text-xs text-slate-500">{event.occurredAt ? new Date(event.occurredAt).toLocaleString("ar-YE") : "—"}</time></div>
      <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4"><span>الممثل: <b dir="ltr">{event.actorUserId ?? "نظام"}</b></span><span>المتجر: <b dir="ltr">{event.tenantId ?? "—"}</b></span><span>الموضوع: <b dir="ltr">{event.subjectId}</b></span><span>الطلب: <b dir="ltr">{event.requestId ?? "—"}</b></span></div>
      <div className="mt-3 flex flex-wrap gap-2">{event.changedFields.length === 0 ? <span className="text-xs text-slate-400">لا توجد حقول قيمية معروضة.</span> : event.changedFields.map((field) => <span key={field} dir="ltr" className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] text-slate-700">{field}</span>)}</div>
    </article>
  );
}

interface StoreCardProps {
  store: PlatformStore;
  busy: boolean;
  canReview: boolean;
  canManage: boolean;
  onStatus: (status: VerificationStatus, reason?: string) => Promise<void>;
  onReason: (status: "changes_requested" | "rejected" | "suspended") => void;
  onRetry: () => Promise<void>;
  onActivate: () => void;
  onPublish: () => Promise<void>;
  onUnpublish: () => Promise<void>;
}

function StoreCard({ store, busy, canReview, canManage, onStatus, onReason, onRetry, onActivate, onPublish, onUnpublish }: StoreCardProps) {
  const subscriptionNeedsAction = store.subscription?.status === "pending_activation" || store.subscription?.status === "expired" || (store.subscription?.status === "active" && Boolean(store.subscription.endsAt) && new Date(store.subscription.endsAt as string).getTime() <= Date.now());
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4"><div><h2 className="font-black">{store.storeName}</h2><p className="mt-1 text-xs text-slate-500">{store.ownerName} · <span dir="ltr">{store.ownerEmail}</span></p><p className="mt-1 text-xs text-slate-500">{store.businessType}</p></div><span className={`rounded-full border px-3 py-1 text-[11px] font-black ${verificationClass[store.verificationStatus]}`}>{verificationLabel[store.verificationStatus]}</span></div>
      <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-3"><div><b className="block">التجهيز</b><span>{provisioningLabel[store.provisioningStatus]}</span></div><div><b className="block">النشر</b><span>{store.publicationStatus}</span></div><div><b className="block">الاشتراك</b><span>{store.subscription?.plan.name ?? "—"} · {store.subscription?.status ?? "—"}</span></div></div>
      {store.latestProvisioningRun?.lastErrorMessage && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-800">{store.latestProvisioningRun.lastErrorMessage}</p>}
      {store.publicationBlockers.length > 0 && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">موانع النشر: {store.publicationBlockers.join("، ")}</p>}
      {store.rejectionReason && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-800">السبب: {store.rejectionReason}</p>}
      {store.publicDomain && store.publicationStatus === "published" && <a href={publicStoreUrl(store.publicDomain)} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-1 text-xs font-bold text-emerald-700"><ExternalLink className="h-4 w-4" /> فتح المتجر المنشور</a>}
      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        {store.verificationStatus === "pending" && canReview && <><button disabled={busy} type="button" onClick={() => { void onStatus("approved").catch(() => undefined); }} className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" /> قبول</button><button disabled={busy} type="button" onClick={() => onReason("changes_requested")} className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50">طلب استكمال</button><button disabled={busy} type="button" onClick={() => onReason("rejected")} className="flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><XCircle className="h-4 w-4" /> رفض نهائي</button></>}
        {store.verificationStatus === "approved" && canManage && <button disabled={busy} type="button" onClick={() => onReason("suspended")} className="flex items-center gap-1 rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Ban className="h-4 w-4" /> تعليق</button>}
        {store.verificationStatus === "suspended" && canManage && <button disabled={busy} type="button" onClick={() => { void onStatus("approved").catch(() => undefined); }} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">إعادة التفعيل</button>}
        {store.verificationStatus === "rejected" && canManage && <button disabled={busy} type="button" onClick={() => { void onStatus("pending").catch(() => undefined); }} className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold disabled:opacity-50">إعادة للمراجعة</button>}
        {store.provisioningStatus === "failed" && canManage && <button disabled={busy} type="button" onClick={() => { void onRetry().catch(() => undefined); }} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">إعادة التجهيز</button>}
        {subscriptionNeedsAction && canManage && <button disabled={busy} type="button" onClick={onActivate} className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold disabled:opacity-50">{store.subscription?.status === "active" ? "تجديد الاستحقاق" : "تفعيل الاستحقاق"}</button>}
        {store.publicationStatus !== "published" && store.publicationBlockers.length === 0 && canManage && <button disabled={busy} type="button" onClick={() => { void onPublish().catch(() => undefined); }} className="flex items-center gap-1 rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Globe2 className="h-4 w-4" /> نشر</button>}
        {store.publicationStatus === "published" && canManage && <button disabled={busy} type="button" onClick={() => { void onUnpublish().catch(() => undefined); }} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold disabled:opacity-50">إيقاف النشر</button>}
        {!canReview && !canManage && <span className="text-xs text-slate-500">عرض فقط حسب صلاحيات الحساب.</span>}
      </div>
    </article>
  );
}

function DecisionDialog({ title, hint, value, requestedFields, busy, onChange, onRequestedFieldsChange, onCancel, onConfirm }: { title: string; hint: string; value: string; requestedFields?: string[]; busy: boolean; onChange: (value: string) => void; onRequestedFieldsChange: (value: string[]) => void; onCancel: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/70 p-4" dir="rtl"><div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"><h2 className="font-black">{title}</h2><p className="mt-2 text-xs leading-6 text-slate-500">{hint}</p>{requestedFields && <fieldset className="mt-4 rounded-2xl border border-slate-200 p-4"><legend className="px-2 text-xs font-black">البنود المطلوب تصحيحها</legend><div className="grid gap-2 sm:grid-cols-2">{correctionFieldOptions.map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold"><input type="checkbox" checked={requestedFields.includes(key)} onChange={(event) => onRequestedFieldsChange(event.target.checked ? [...requestedFields, key] : requestedFields.filter((item) => item !== key))} />{label}</label>)}</div></fieldset>}<textarea required maxLength={1000} value={value} onChange={(event) => onChange(event.target.value)} className="mt-4 min-h-32 w-full rounded-xl border border-slate-200 p-3 text-sm" /><div className="mt-4 flex gap-2"><button type="button" disabled={busy || !value.trim() || (requestedFields !== undefined && requestedFields.length === 0)} onClick={onConfirm} className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">تأكيد</button><button type="button" onClick={onCancel} className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold">إلغاء</button></div></div></div>;
}

function ActivationDialog({ store, value, busy, onChange, onCancel, onConfirm }: { store: PlatformStore; value: string; busy: boolean; onChange: (value: string) => void; onCancel: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/70 p-4" dir="rtl"><div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><h2 className="font-black">تفعيل استحقاق {store.storeName}</h2><p className="mt-2 text-xs leading-6 text-slate-500">إجراء إداري يمنح الاستحقاق ولا يمثل تحصيل دفعة إلكترونية.</p><label className="mt-4 block text-xs font-bold">تاريخ الانتهاء</label><input type="date" required value={value} min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm" /><div className="mt-4 flex gap-2"><button type="button" disabled={busy || !value} onClick={onConfirm} className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold disabled:opacity-50">تأكيد الاستحقاق</button><button type="button" onClick={onCancel} className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold">إلغاء</button></div></div></div>;
}
