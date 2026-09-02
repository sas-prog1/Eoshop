import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, Globe, RefreshCw, ShieldCheck, X, XCircle } from "lucide-react";
import { useUiAdapters } from "../adapters/UiAdaptersContext";
import { isUiError, uiErrorMessage, type StoreApplicationDossier, type StoreDraft, type StorePlan, type StoreSubmission } from "../adapters/uiAdapters";
import StoreApplicationEvidencePanel from "../features/onboarding/StoreApplicationEvidencePanel";

interface DomainSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeName: string;
  businessType: string;
  themeStyle: "elegant" | "tech";
  config: Record<string, unknown>;
  ownerId: string;
  draft?: StoreDraft | null;
  onDraftChanged?: (draft: StoreDraft) => void;
  onReloadDraft?: () => Promise<void>;
  onSubmitted?: (submission: StoreSubmission) => void;
}

interface Availability {
  domain: string;
  available: boolean;
}

const tenantBaseDomain = import.meta.env.VITE_TENANT_BASE_DOMAIN || "eoshop.local";

const featureLabels: Record<string, string> = {
  platform_subdomain: "عنوان متجر داخل منصة Eoshop",
  basic_theme: "القالب الأساسي",
  unlimited_products: "منتجات غير محدودة بحسب الباقة",
  priority_review: "أولوية في المراجعة",
  multi_store: "إدارة أكثر من متجر",
};

export default function DomainSetupModal({
  isOpen,
  onClose,
  storeName,
  businessType,
  themeStyle,
  config,
  ownerId,
  draft,
  onDraftChanged,
  onReloadDraft,
  onSubmitted,
}: DomainSetupModalProps) {
  const { plans: planActions, provisioning } = useUiAdapters();
  const [plans, setPlans] = useState<StorePlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState("starter");
  const [handle, setHandle] = useState("");
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [checkingHandle, setCheckingHandle] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [draftConflict, setDraftConflict] = useState(false);
  const [preparedDraft, setPreparedDraft] = useState<StoreDraft | null>(null);
  const [application, setApplication] = useState<StoreApplicationDossier | null>(null);
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const plansRequest = useRef(0);
  const availabilityRequest = useRef(0);

  useEffect(() => {
    if (!isOpen) return;
    const request = ++plansRequest.current;
    const controller = new AbortController();
    setError("");
    setLoadingPlans(true);
    planActions.list(controller.signal)
      .then((items) => {
        if (request !== plansRequest.current) return;
        setPlans(items);
        if (!items.some((plan) => plan.key === selectedPlan)) {
          setSelectedPlan(items[0]?.key ?? "");
        }
      })
      .catch((caught) => {
        if (request === plansRequest.current && !isUiError(caught, "aborted")) {
          setError(uiErrorMessage(caught, "تعذر تحميل الباقات من الخادم."));
        }
      })
      .finally(() => {
        if (request === plansRequest.current) setLoadingPlans(false);
      });

    return () => {
      controller.abort();
      if (request === plansRequest.current) plansRequest.current += 1;
    };
  }, [isOpen, planActions]);

  useEffect(() => {
    if (!isOpen) return;
    setDraftConflict(false);
    setPreparedDraft(null);
    setApplication(draft?.application ?? null);
    setEvidenceBusy(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || preparedDraft) return;
    if (draft) {
      setHandle(draft.handle ?? "");
      if (draft.planKey) setSelectedPlan(draft.planKey);
    }
  }, [isOpen, draft?.id, draft?.revision, preparedDraft]);

  useEffect(() => {
    if (!isOpen) return;
    const request = ++availabilityRequest.current;
    const controller = new AbortController();
    const normalized = handle.trim().toLowerCase();
    setAvailability(null);
    if (normalized.length < 3) {
      setCheckingHandle(false);
      return;
    }

    setCheckingHandle(true);
    const timer = window.setTimeout(() => {
      planActions.domainAvailability(normalized, controller.signal)
        .then((result) => {
          if (request === availabilityRequest.current) {
            setAvailability({ domain: result.domain, available: result.available });
          }
        })
        .catch(() => {
          if (request === availabilityRequest.current) setAvailability(null);
        })
        .finally(() => {
          if (request === availabilityRequest.current) setCheckingHandle(false);
        });
    }, 450);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
      if (request === availabilityRequest.current) availabilityRequest.current += 1;
    };
  }, [handle, isOpen, planActions]);

  const plan = useMemo(() => plans.find((item) => item.key === selectedPlan) ?? null, [plans, selectedPlan]);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!preparedDraft && (!plan || !availability?.available)) {
      setError("اختر باقة وعنوان متجر متاحًا قبل إرسال الطلب.");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      if (!preparedDraft) {
        const savedDraft = draft?.tenantId
        ? await provisioning.saveCorrection(draft.tenantId, {
            expectedRevision: draft.revision,
            storeName,
            businessType,
            themeStyle,
            handle: handle.trim().toLowerCase(),
            planKey: plan!.key,
            config,
          })
        : await provisioning.saveDraft({
            expectedRevision: draft?.revision ?? 0,
            storeName,
            businessType,
            themeStyle,
            handle: handle.trim().toLowerCase(),
            planKey: plan!.key,
            config,
          });
        onDraftChanged?.(savedDraft);
        setPreparedDraft(savedDraft);
        setApplication(savedDraft.application ?? null);
        return;
      }
      if (!application?.ready) {
        setError("أكمل الوثائق المطلوبة أو سجّل الإعفاء المسموح قبل إرسال الطلب.");
        return;
      }
      const response = preparedDraft.tenantId
        ? await provisioning.resubmit(preparedDraft.tenantId, preparedDraft.revision, ownerId)
        : await provisioning.submit({
          storeName: preparedDraft.storeName,
          businessType: preparedDraft.businessType,
          themeStyle: preparedDraft.themeStyle,
          handle: preparedDraft.handle!,
          planKey: preparedDraft.planKey!,
          config: preparedDraft.config,
          draftId: preparedDraft.id,
          expectedDraftRevision: preparedDraft.revision,
        }, ownerId);
      setPreparedDraft(null);
      onSubmitted?.(response.data);
      onClose();
    } catch (caught) {
      setError(uiErrorMessage(caught, "تعذر إرسال طلب المتجر. حاول مرة أخرى."));
      if (isUiError(caught, "conflict")) {
        setAvailability(null);
        setPreparedDraft(null);
        setDraftConflict(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const applyApplication = (next: StoreApplicationDossier) => {
    setApplication(next);
    setPreparedDraft((current) => {
      if (!current) return current;
      const updated = { ...current, revision: next.draftRevision, application: next };
      onDraftChanged?.(updated);
      return updated;
    });
  };

  const reloadPreparedDraft = async () => {
    if (!preparedDraft) return;
    const latest = await provisioning.currentDraft();
    if (!latest || latest.id !== preparedDraft.id) throw new Error("The current draft changed.");
    setPreparedDraft(latest);
    setApplication(latest.application ?? null);
    onDraftChanged?.(latest);
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm" dir="rtl">
      <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="relative bg-gradient-to-l from-sky-600 via-indigo-600 to-slate-900 p-6 text-white">
          <button onClick={onClose} type="button" className="absolute left-4 top-4 rounded-full bg-white/10 p-2 hover:bg-white/20" aria-label="إغلاق"><X className="h-5 w-5" /></button>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/30 bg-white/15 p-3"><Globe className="h-6 w-6" /></div>
            <div>
              <h3 className="text-lg font-black">اختيار العنوان والباقة ثم إرسال المتجر</h3>
              <p className="mt-1 text-xs text-sky-100">يُحجز العنوان مع الطلب، ولا يصبح المتجر عامًا إلا بعد الموافقة والتجهيز وتفعيل الاشتراك ثم النشر.</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          {error && <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700"><span className="flex items-start gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{error}</span>{draftConflict && onReloadDraft && <button type="button" onClick={() => void onReloadDraft()} className="shrink-0 rounded-lg border border-rose-300 bg-white px-3 py-1.5">تحميل نسخة الخادم</button>}</div>}
          {preparedDraft && <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs font-bold leading-6 text-sky-900">تم حفظ العنوان والباقة في المسودة. أكمل ملف الوثائق أدناه، ثم راجع الإشارة الخضراء قبل الإرسال النهائي.</div>}

          <section>
            <label htmlFor="store-handle" className="mb-2 block text-sm font-black text-slate-900">عنوان المتجر داخل المنصة</label>
            <div className="flex overflow-hidden rounded-2xl border border-slate-300 bg-white focus-within:border-indigo-500">
              <input
                id="store-handle"
                value={handle}
                disabled={preparedDraft !== null}
                onChange={(event) => setHandle(event.target.value.replace(/[^A-Za-z0-9-]/g, "").toLowerCase())}
                minLength={3}
                maxLength={50}
                required
                dir="ltr"
                placeholder="my-shop"
                className="min-w-0 flex-1 px-4 py-3 text-left font-bold outline-none"
              />
              <span className="grid place-items-center border-r border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-500" dir="ltr">.{tenantBaseDomain}</span>
            </div>
            <div className="mt-2 min-h-5 text-xs font-bold">
              {checkingHandle && <span className="flex items-center gap-2 text-slate-500"><RefreshCw className="h-3.5 w-3.5 animate-spin" /> جارٍ التحقق من الخادم…</span>}
              {!checkingHandle && availability?.available && <span className="flex items-center gap-2 text-emerald-700"><CheckCircle2 className="h-4 w-4" /> {availability.domain} متاح ويمكن حجزه.</span>}
              {!checkingHandle && availability && !availability.available && <span className="flex items-center gap-2 text-rose-700"><XCircle className="h-4 w-4" /> هذا العنوان محجوز، اختر عنوانًا آخر.</span>}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="text-sm font-black text-slate-900">الباقة المطلوبة</h4>
              {loadingPlans && <RefreshCw className="h-4 w-4 animate-spin text-indigo-600" />}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {plans.map((item) => {
                const selected = selectedPlan === item.key;
                const price = item.priceMinor === 0 ? "مجانية" : `${((item.priceMinor ?? 0) / 100).toLocaleString("ar-SA")} ${item.currency} / شهر`;
                return (
                  <button
                    key={item.key}
                    type="button"
                    disabled={preparedDraft !== null}
                    onClick={() => setSelectedPlan(item.key)}
                    className={`rounded-2xl border p-4 text-right transition ${selected ? "border-indigo-600 bg-indigo-50 ring-2 ring-indigo-100" : "border-slate-200 bg-white hover:border-indigo-300"}`}
                  >
                    <span className="block text-sm font-black text-slate-950">{item.name}</span>
                    <span className="mt-1 block text-xs font-black text-indigo-700">{price}</span>
                    <span className="mt-2 block text-[11px] text-slate-500">حتى {item.maxStores} {item.maxStores === 1 ? "متجر" : "متاجر"}</span>
                    <span className="mt-3 block space-y-1 text-[10px] text-slate-600">
                      {item.features.slice(0, 3).map((feature) => <span key={feature} className="block">• {featureLabels[feature] ?? feature}</span>)}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {plan && (
            <div className={`rounded-2xl border p-4 text-xs ${plan.activationMode === "automatic" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
              {plan.activationMode === "automatic" ? (
                <p className="flex items-center gap-2 font-bold"><ShieldCheck className="h-4 w-4" /> الباقة المجانية تُفعّل آليًا، لكن النشر يظل مشروطًا بالموافقة واكتمال التجهيز.</p>
              ) : (
                <p className="flex items-center gap-2 font-bold"><Clock3 className="h-4 w-4" /> هذه باقة مدفوعة بطلب تفعيل يدوي من الإدارة. لا يُعد اختيارها دفعًا أو تفعيلًا، ولم تُربط بوابة دفع بعد.</p>
              )}
            </div>
          )}

          {preparedDraft && application && <StoreApplicationEvidencePanel application={application} disabled={submitting} onUploadEvidence={(requirementKey, file, signal) => provisioning.uploadApplicationEvidence(preparedDraft.id, requirementKey, preparedDraft.revision, file, signal)} onDeclareExemption={(requirementKey, reason, signal) => provisioning.exemptApplicationRequirement(preparedDraft.id, requirementKey, preparedDraft.revision, reason, signal)} onApplicationChanged={applyApplication} onBusyChange={setEvidenceBusy} onReloadDraft={reloadPreparedDraft} />}

          <button disabled={submitting || evidenceBusy || loadingPlans || (!preparedDraft && (!availability?.available || !plan)) || Boolean(preparedDraft && !application?.ready)} type="submit" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-sky-600 to-indigo-700 px-5 py-4 text-sm font-black text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50">
            {submitting && <RefreshCw className="h-5 w-5 animate-spin" />}
            {submitting ? "جارٍ حفظ العملية بأمان…" : preparedDraft ? "إرسال ملف الطلب للمراجعة" : "حفظ العنوان والباقة والانتقال للوثائق"}
          </button>
        </form>
      </div>
    </div>
  );
}
