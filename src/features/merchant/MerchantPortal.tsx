import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  Palette,
  Plus,
  RefreshCw,
  Settings2,
  Send,
  PauseCircle,
  ShieldCheck,
  ShoppingBag,
  Store,
  UserRound,
} from "lucide-react";
import type { StoreDraft, StoreSubmission, UserProfile } from "../../adapters/uiAdapters";
import { publicStoreUrl } from "../../utils/publicStoreUrl";
import { deriveMerchantLifecycle, publicationBlockerLabel, type MerchantLifecycleTone } from "./lifecycle";
import { usePlatformSettings } from "../../adapters/PlatformSettingsContext";
import SkipLink from "../../components/SkipLink";
import { shouldPollMerchantLifecycle, useLifecyclePolling } from "../provisioning/useLifecyclePolling";
import type { MerchantStoreSection } from "../../app/centralNavigation";

interface MerchantPortalProps {
  user: UserProfile;
  stores: StoreSubmission[];
  draft: StoreDraft | null;
  draftLoading: boolean;
  draftError: string | null;
  loading: boolean;
  error: string | null;
  onReload: (signal?: AbortSignal) => void | Promise<void>;
  onCreateStore: () => void;
  onOpenStore: (store: StoreSubmission, section?: MerchantStoreSection) => void;
  onCorrectStore: (store: StoreSubmission) => void;
  onPublish: (store: StoreSubmission) => Promise<void>;
  onUnpublish: (store: StoreSubmission) => Promise<void>;
  onLogout: () => void;
  onCopyPublicUrl: (url: string) => void;
}

const toneClasses: Record<MerchantLifecycleTone, string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
  info: "border-sky-200 bg-sky-50 text-sky-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-rose-200 bg-rose-50 text-rose-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

const stageNames = ["تقديم الطلب", "المراجعة", "التجهيز", "النشر"];

function formatDate(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : new Intl.DateTimeFormat("ar-YE", { dateStyle: "medium" }).format(parsed);
}

export default function MerchantPortal({
  user,
  stores,
  draft,
  draftLoading,
  draftError,
  loading,
  error,
  onReload,
  onCreateStore,
  onOpenStore,
  onCorrectStore,
  onPublish,
  onUnpublish,
  onLogout,
  onCopyPublicUrl,
}: MerchantPortalProps) {
  const { settings: platformSettings } = usePlatformSettings();
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(stores[0]?.id ?? null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const storesSectionRef = useRef<HTMLDivElement>(null);
  const lifecyclePollIds = stores
    .filter((store) => shouldPollMerchantLifecycle(store.verificationStatus, store.provisioningStatus))
    .map((store) => store.id)
    .sort();

  useLifecyclePolling({
    enabled: lifecyclePollIds.length > 0,
    pollKey: `merchant:${lifecyclePollIds.join(",")}`,
    refresh: onReload,
  });

  useEffect(() => {
    if (!stores.length) {
      setSelectedStoreId(null);
      return;
    }
    if (!stores.some((store) => store.id === selectedStoreId)) setSelectedStoreId(stores[0].id);
  }, [selectedStoreId, stores]);

  const selectedStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;
  const selectedLifecycle = selectedStore ? deriveMerchantLifecycle(selectedStore) : null;
  const creationActionLabel = draft
    ? "متابعة إنشاء المتجر"
    : draftLoading
      ? "جاري استعادة رحلة الإنشاء"
    : draftError
      ? "استعادة رحلة إنشاء المتجر"
      : "إنشاء متجر جديد";
  const draftStep = draft?.nextRequiredStep === "design"
    ? "اختيار القالب والتخصيص"
    : draft?.nextRequiredStep === "review"
      ? "العنوان والباقة ثم الإرسال"
      : draft?.nextRequiredStep === "submit"
        ? draft.application?.ready ? "تأكيد الإرسال النهائي" : "استكمال وثائق الطلب"
        : "بيانات النشاط";
  const draftProgress = draft?.nextRequiredStep === "submit"
    ? 3
    : draft?.onboardingReadiness?.design
      ? 2
      : draft?.onboardingReadiness?.business
        ? 1
        : 0;
  const totals = useMemo(() => ({
    published: stores.filter((store) => deriveMerchantLifecycle(store).isPublished).length,
    attention: stores.filter((store) => ["danger", "warning"].includes(deriveMerchantLifecycle(store).tone)).length,
    ready: stores.filter((store) => deriveMerchantLifecycle(store).canOpenBuilder).length,
  }), [stores]);

  let publicUrl: string | null = null;
  if (selectedStore && selectedLifecycle?.isPublished && selectedStore.publicDomain) {
    try {
      publicUrl = publicStoreUrl(selectedStore.publicDomain);
    } catch {
      publicUrl = null;
    }
  }

  const runAction = async (key: string, action: () => Promise<void>) => {
    if (busyAction) return;
    setBusyAction(key);
    setActionError(null);
    try {
      await action();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "تعذر تنفيذ الإجراء. حدّث الحالة ثم حاول مجددًا.");
    } finally {
      setBusyAction(null);
    }
  };

  const focusStoreList = () => {
    storesSectionRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    storesSectionRef.current?.focus({ preventScroll: true });
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <SkipLink targetId="merchant-portal-main" />
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            {platformSettings.logoUrl ? (
              <img src={platformSettings.logoUrl} alt="" className="h-10 w-10 rounded-2xl border border-slate-200 bg-white object-contain p-1" referrerPolicy="no-referrer" />
            ) : (
              <div className="rounded-2xl p-2.5 text-white shadow-lg" style={{ backgroundColor: platformSettings.primaryColor }}><Store className="h-5 w-5" /></div>
            )}
            <div>
              <p className="text-base font-black tracking-tight">{platformSettings.platformName}</p>
              <p className="text-[11px] font-bold text-slate-500">بوابة التاجر</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void onReload()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">تحديث</span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[250px_minmax(0,1fr)] lg:px-8">
        <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-2 shadow-sm sm:p-4 lg:sticky lg:top-24">
          <div className="mb-5 hidden rounded-2xl bg-slate-950 p-4 text-white lg:block">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
              <UserRound className="h-5 w-5" />
            </div>
            <p className="truncate text-sm font-black">{user.fullName}</p>
            <p className="mt-1 truncate text-[11px] text-slate-300">{user.email}</p>
          </div>
          <nav aria-label="تنقل بوابة التاجر" className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1.5 lg:overflow-visible lg:pb-0">
            <div aria-current="page" className="flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl bg-sky-50 px-3 py-2.5 text-sm font-black text-sky-800 lg:w-full">
              <LayoutDashboard className="h-4 w-4" /> نظرة عامة
            </div>
            <button
              type="button"
              onClick={focusStoreList}
              disabled={stores.length === 0}
              aria-controls="merchant-store-list"
              className="flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-right text-sm font-bold text-slate-600 transition hover:bg-sky-50 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-40 lg:w-full"
            >
              <ShoppingBag className="h-4 w-4" /> متاجري
            </button>
            <button type="button" disabled={draftLoading} onClick={onCreateStore} className="flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-right text-sm font-bold text-slate-600 transition hover:bg-sky-50 hover:text-sky-700 disabled:cursor-wait disabled:opacity-60 lg:w-full">
              <Plus className="h-4 w-4" /> {creationActionLabel}
            </button>
            <a href="/app/account" className="flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 hover:text-sky-700 lg:w-full">
              <Settings2 className="h-4 w-4" /> الحساب والأمان
            </a>
          </nav>
        </aside>

        <main id="merchant-portal-main" tabIndex={-1} className="min-w-0 space-y-6">
          <section className="overflow-hidden rounded-3xl bg-gradient-to-l from-slate-950 via-slate-900 to-sky-950 p-6 text-white shadow-xl shadow-slate-900/10 sm:p-8">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
              <div>
                <p className="mb-2 text-xs font-bold text-sky-300">مساحة العمل الرئيسية</p>
                <h1 className="text-2xl font-black sm:text-3xl">مرحبًا {user.fullName.split(" ")[0] || "بك"}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                  تابع رحلة كل متجر من الطلب حتى النشر، واعرف الإجراء التالي والمسؤول عنه دون تخمين.
                </p>
              </div>
              <button
                type="button"
                disabled={draftLoading}
                onClick={onCreateStore}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-sky-500 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-sky-500/20 transition hover:bg-sky-400 disabled:cursor-wait disabled:opacity-70"
              >
                <Plus className="h-4 w-4" /> {creationActionLabel}
              </button>
            </div>
          </section>

          {draft && (
            <section aria-label="المسودة غير المكتملة" className="overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-sm">
              <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black text-amber-900">مسودة محفوظة — لم تُرسل للمراجعة</span>
                    <span className="text-xs font-bold text-slate-500">آخر حفظ: {formatDate(draft.savedAt)}</span>
                  </div>
                  <h2 className="mt-3 text-xl font-black">{draft.storeName || "متجر غير مكتمل"}</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">الخطوة التالية: <strong className="text-slate-900">{draftStep}</strong>. لن يظهر المتجر لدى إدارة المنصة حتى تؤكد الإرسال وتحصل على نتيجة نجاح من الخادم.</p>
                  <div className="mt-4 grid grid-cols-3 gap-2" aria-label={`اكتملت ${draftProgress} من 3 مراحل`}>
                    {["بيانات النشاط", "التصميم", "المراجعة والإرسال"].map((label, index) => (
                      <div key={label} className={`rounded-xl border px-3 py-2 text-center text-[11px] font-bold ${index < draftProgress ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                        {index < draftProgress && <Check className="mx-auto mb-1 h-3.5 w-3.5" />}{label}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl bg-amber-50 p-4 text-center">
                  <Clock3 className="mx-auto h-7 w-7 text-amber-700" />
                  <p className="mt-2 text-xs leading-6 text-amber-950">يمكنك الخروج والعودة لاحقًا؛ سنفتح آخر خطوة مطلوبة بدل بدء الرحلة من جديد.</p>
                  <button type="button" onClick={onCreateStore} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white">
                    متابعة إنشاء المتجر <ArrowLeft className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </section>
          )}

          {draftLoading && (
            <section aria-live="polite" className="flex items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-bold text-sky-900">
              <RefreshCw className="h-5 w-5 animate-spin" /> جاري التحقق من وجود مسودة محفوظة، بينما تبقى متاجرك المرسلة متاحة أدناه.
            </section>
          )}

          {draftError && (
            <section role="alert" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
              <div><p className="font-black">تعذر التحقق من المسودة المحفوظة</p><p className="mt-1 text-sm">{draftError} المتاجر المرسلة أدناه ما زالت متاحة.</p></div>
              <button type="button" onClick={() => void onReload()} className="rounded-xl bg-white px-3 py-2 text-xs font-black shadow-sm">إعادة المحاولة</button>
            </section>
          )}

          <section aria-label="ملخص الحساب" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "إجمالي المتاجر", value: stores.length, icon: Store, color: "text-sky-700 bg-sky-50" },
              { label: "متاجر منشورة", value: totals.published, icon: CheckCircle2, color: "text-emerald-700 bg-emerald-50" },
              { label: "جاهزة للإدارة", value: totals.ready, icon: Settings2, color: "text-indigo-700 bg-indigo-50" },
              { label: "تحتاج متابعة", value: totals.attention, icon: AlertTriangle, color: "text-amber-700 bg-amber-50" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${color}`}><Icon className="h-4 w-4" /></div>
                <p className="text-2xl font-black">{value}</p>
                <p className="text-xs font-bold text-slate-500">{label}</p>
              </div>
            ))}
          </section>

          {error && (
            <section role="alert" className="flex items-start justify-between gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
              <div><p className="font-black">تعذر تحميل متاجرك</p><p className="mt-1 text-sm">{error}</p></div>
              <button type="button" onClick={() => void onReload()} className="rounded-xl bg-white px-3 py-2 text-xs font-black shadow-sm">إعادة المحاولة</button>
            </section>
          )}

          {!loading && !error && stores.length === 0 && !draft && !draftLoading && !draftError && (
            <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-700"><Store className="h-7 w-7" /></div>
              <h2 className="text-xl font-black">ابدأ متجرك الأول</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-slate-500">لا توجد متاجر مرتبطة بحسابك حتى الآن. ابدأ الإنشاء وسنحفظ رحلة المتجر وحالته في هذه الصفحة.</p>
              <button type="button" onClick={onCreateStore} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white"><Plus className="h-4 w-4" /> إنشاء متجر</button>
            </section>
          )}

          {loading && stores.length === 0 && (
            <section aria-live="polite" className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-500 shadow-sm">
              <RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin text-sky-600" /> جارٍ تحميل متاجرك من الخادم…
            </section>
          )}

          {stores.length > 0 && selectedStore && selectedLifecycle && (
            <div
              id="merchant-store-list"
              ref={storesSectionRef}
              tabIndex={-1}
              className="scroll-mt-24 grid grid-cols-1 gap-6 outline-none xl:grid-cols-[330px_minmax(0,1fr)]"
            >
              <section aria-label="قائمة المتاجر" className="h-fit rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div><h2 className="font-black">متاجري</h2><p className="text-[11px] text-slate-500">اختر متجرًا لعرض رحلته</p></div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{stores.length}</span>
                </div>
                <div className="space-y-2">
                  {stores.map((store) => {
                    const state = deriveMerchantLifecycle(store);
                    const selected = store.id === selectedStore.id;
                    return (
                      <button
                        key={store.id}
                        type="button"
                        onClick={() => setSelectedStoreId(store.id)}
                        aria-current={selected ? "true" : undefined}
                        className={`w-full rounded-2xl border p-3 text-right transition ${selected ? "border-sky-300 bg-sky-50 shadow-sm" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${toneClasses[state.tone]}`}><Store className="h-4 w-4" /></div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-black">{store.storeName}</p>
                            <p className="mt-1 truncate text-[11px] text-slate-500">{store.requestedDomain || store.internalDomain || "لم يخصص عنوان بعد"}</p>
                          </div>
                          <ArrowLeft className="mt-2 h-4 w-4 text-slate-400" />
                        </div>
                        <span className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black ${toneClasses[state.tone]}`}>{state.label}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="min-w-0 space-y-5">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-black">{selectedStore.storeName}</h2>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black ${toneClasses[selectedLifecycle.tone]}`}>{selectedLifecycle.label}</span>
                      </div>
                      <p className="text-sm text-slate-500">{selectedStore.businessType} · أُنشئ في {formatDate(selectedStore.createdAt)}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      {selectedStore.capabilities.draftEdit && (
                        <button type="button" disabled={Boolean(busyAction)} onClick={() => onCorrectStore(selectedStore)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">
                          <Settings2 className="h-4 w-4" /> تصحيح الطلب
                        </button>
                      )}
                      <button type="button" disabled={Boolean(busyAction)} onClick={() => onOpenStore(selectedStore, "overview")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white transition hover:bg-slate-800 disabled:opacity-50">
                        <Settings2 className="h-4 w-4" /> إدارة وتعديل المتجر
                      </button>
                      {selectedStore.capabilities.publish && (
                        <button type="button" disabled={Boolean(busyAction)} onClick={() => void runAction(`publish:${selectedStore.id}`, () => onPublish(selectedStore))} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">
                          <Send className="h-4 w-4" /> {busyAction === `publish:${selectedStore.id}` ? "جارٍ النشر…" : "نشر المتجر"}
                        </button>
                      )}
                      {selectedStore.capabilities.unpublish && (
                        <button type="button" disabled={Boolean(busyAction)} onClick={() => void runAction(`unpublish:${selectedStore.id}`, () => onUnpublish(selectedStore))} className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-black text-amber-900 disabled:opacity-50">
                          <PauseCircle className="h-4 w-4" /> {busyAction === `unpublish:${selectedStore.id}` ? "جارٍ الإيقاف…" : "إلغاء النشر"}
                        </button>
                      )}
                    </div>
                  </div>

                  {actionError && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{actionError}</p>}

                  {selectedStore.verificationStatus === "approved" && selectedStore.provisioningStatus === "active" && (
                    <nav aria-label="اختصارات إدارة المتجر" className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                      {selectedStore.capabilities.catalogManage && (
                        <button type="button" onClick={() => onOpenStore(selectedStore, "products")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800">
                          <Package className="h-4 w-4" /> المنتجات
                        </button>
                      )}
                      {selectedStore.capabilities.ordersView && (
                        <button type="button" onClick={() => onOpenStore(selectedStore, "orders")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800">
                          <ShoppingBag className="h-4 w-4" /> الطلبات
                        </button>
                      )}
                      {selectedStore.capabilities.workspaceManage && (
                        <>
                          <button type="button" onClick={() => onOpenStore(selectedStore, "design")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800">
                            <Palette className="h-4 w-4" /> التصميم والهوية
                          </button>
                          <button type="button" onClick={() => onOpenStore(selectedStore, "pages")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800">
                            <FileText className="h-4 w-4" /> صفحات المتجر
                          </button>
                        </>
                      )}
                    </nav>
                  )}

                  <div className="mt-6 grid grid-cols-4 gap-2" aria-label="مراحل تجهيز المتجر">
                    {stageNames.map((name, index) => {
                      const complete = index < selectedLifecycle.completedSteps;
                      const current = index === Math.min(selectedLifecycle.completedSteps, 3) && !selectedLifecycle.isPublished;
                      return (
                        <div key={name} className="min-w-0 text-center">
                          <div className="flex items-center">
                            <span className={`h-px flex-1 ${index === 0 ? "bg-transparent" : complete ? "bg-emerald-400" : "bg-slate-200"}`} />
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${complete ? "border-emerald-500 bg-emerald-500 text-white" : current ? "border-sky-500 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-400"}`}>
                              {complete ? <Check className="h-4 w-4" /> : current ? <Clock3 className="h-4 w-4" /> : <Circle className="h-3 w-3" />}
                            </span>
                            <span className={`h-px flex-1 ${index === stageNames.length - 1 ? "bg-transparent" : index + 1 < selectedLifecycle.completedSteps ? "bg-emerald-400" : "bg-slate-200"}`} />
                          </div>
                          <p className="mt-2 truncate text-[10px] font-bold text-slate-500 sm:text-xs">{name}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className={`rounded-3xl border p-5 sm:p-6 ${toneClasses[selectedLifecycle.tone]}`}>
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      <p className="text-xs font-black opacity-75">الحالة الحالية</p>
                      <h3 className="mt-1 text-lg font-black">{selectedLifecycle.headline}</h3>
                      <p className="mt-2 text-sm leading-7 opacity-90">{selectedLifecycle.explanation}</p>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-3 rounded-2xl bg-white/70 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div><p className="text-[11px] font-black opacity-70">الخطوة التالية</p><p className="mt-1 text-sm font-bold">{selectedLifecycle.nextAction}</p></div>
                    <div className="rounded-xl border border-current/10 bg-white px-3 py-2 text-center"><p className="text-[10px] font-bold opacity-60">المسؤول</p><p className="text-xs font-black">{selectedLifecycle.actionOwnerLabel}</p></div>
                  </div>
                </div>

                {selectedStore.reviewFeedback && ["changes_requested", "rejected"].includes(selectedStore.verificationStatus) && (
                  <div className={`rounded-2xl border bg-white p-4 ${selectedStore.verificationStatus === "changes_requested" ? "border-amber-200" : "border-rose-200"}`}><p className={`text-xs font-black ${selectedStore.verificationStatus === "changes_requested" ? "text-amber-800" : "text-rose-700"}`}>{selectedStore.verificationStatus === "changes_requested" ? "بنود الاستكمال المطلوبة" : "سبب الرفض النهائي"}</p><p className="mt-2 text-sm leading-7 text-slate-700">{selectedStore.reviewFeedback}</p>{selectedStore.application?.correctionRequest && <div className="mt-3 flex flex-wrap gap-2">{selectedStore.application.correctionRequest.requestedFieldLabels.map((label) => <span key={label} className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-black text-amber-900">{label}</span>)}</div>}</div>
                )}

                {selectedStore.application && selectedStore.application.timeline.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-black text-slate-700">سجل رحلة الطلب</p><ol className="mt-3 space-y-2">{selectedStore.application.timeline.slice(-5).reverse().map((event) => <li key={event.id} className="flex items-start gap-2 text-xs leading-6 text-slate-600"><Clock3 className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-400" /><span>{event.message}</span></li>)}</ol></div>
                )}

                {selectedStore.publicationBlockers.length > 0 && !selectedLifecycle.isPublished && (
                  <div className="rounded-2xl border border-amber-200 bg-white p-4">
                    <p className="text-xs font-black text-amber-800">متطلبات النشر غير المكتملة</p>
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {selectedStore.publicationBlockers.map((blocker) => <li key={blocker} className="flex items-center gap-2 text-xs font-bold text-slate-600"><AlertTriangle className="h-3.5 w-3.5 text-amber-500" />{publicationBlockerLabel(blocker)}</li>)}
                    </ul>
                  </div>
                )}

                {publicUrl && (
                  <div className="rounded-3xl border border-emerald-200 bg-emerald-950 p-5 text-white shadow-lg shadow-emerald-950/10 sm:p-6">
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                      <div className="min-w-0"><p className="text-xs font-black text-emerald-300">رابط المتجر المنشور</p><p dir="ltr" className="mt-2 truncate text-left text-sm font-bold text-white">{publicUrl}</p></div>
                      <div className="flex shrink-0 gap-2">
                        <button type="button" onClick={() => onCopyPublicUrl(publicUrl!)} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-black hover:bg-white/20"><Copy className="h-4 w-4" /> نسخ</button>
                        <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-3 py-2 text-xs font-black text-emerald-950 hover:bg-emerald-300"><ExternalLink className="h-4 w-4" /> فتح</a>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4"><Package className="mb-3 h-4 w-4 text-sky-600" /><p className="text-[10px] font-bold text-slate-400">الباقة</p><p className="mt-1 text-sm font-black">{selectedStore.plan?.name || "غير محددة"}</p></div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4"><CheckCircle2 className="mb-3 h-4 w-4 text-emerald-600" /><p className="text-[10px] font-bold text-slate-400">تاريخ التفعيل</p><p className="mt-1 text-sm font-black">{formatDate(selectedStore.activeAt)}</p></div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4"><ExternalLink className="mb-3 h-4 w-4 text-indigo-600" /><p className="text-[10px] font-bold text-slate-400">تاريخ النشر</p><p className="mt-1 text-sm font-black">{formatDate(selectedStore.publishedAt)}</p></div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-black text-slate-700">صلاحيات هذا الحساب داخل المتجر</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {([
                      ["إعدادات وتصميم المتجر", selectedStore.capabilities.workspaceManage],
                      ["المنتجات", selectedStore.capabilities.catalogManage],
                      ["عرض المخزون", selectedStore.capabilities.inventoryView],
                      ["تعديل المخزون", selectedStore.capabilities.inventoryManage],
                      ["عرض الطلبات", selectedStore.capabilities.ordersView],
                      ["إدارة الطلبات", selectedStore.capabilities.ordersManage],
                      ["تصحيح الطلب", selectedStore.capabilities.draftEdit],
                      ["النشر", selectedStore.capabilities.publish || selectedStore.capabilities.unpublish],
                    ] as const).map(([label, allowed]) => (
                      <span key={String(label)} className={`rounded-full border px-3 py-1.5 text-[11px] font-black ${allowed ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-400"}`}>
                        {allowed ? "متاح: " : "غير متاح: "}{label}
                      </span>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
