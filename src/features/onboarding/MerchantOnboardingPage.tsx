import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Globe2,
  LayoutTemplate,
  Loader2,
  Palette,
  PencilLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useUiAdapters } from "../../adapters/UiAdaptersContext";
import { isUiError, uiErrorMessage, type StoreApplicationDossier, type StoreDraft, type StorePlan, type UserProfile } from "../../adapters/uiAdapters";
import { storeOnboardingAppearance } from "../../contracts/storeOnboardingAppearance";
import type { StoreConfig } from "../../types";
import OnboardingStorePreview from "./OnboardingStorePreview";
import StoreApplicationEvidencePanel from "./StoreApplicationEvidencePanel";
import { createTemplateConfig, createTemplatePreviewConfig, ONBOARDING_TEMPLATES, type OnboardingTemplateKey } from "./storeTemplates";

type Step = "business" | "design" | "review";

interface MerchantOnboardingPageProps {
  user: UserProfile;
  requestedStep: Step;
  onSessionExpired: (returnTo: string) => void;
}

const stepPath: Record<Step, string> = { business: "/app/new", design: "/app/new/design", review: "/app/new/review" };
const stepRank: Record<Step, number> = { business: 1, design: 2, review: 3 };
const fontOptions = ["Cairo", "Tajawal", "Almarai", "Alexandria", "IBM Plex Sans Arabic"];

export default function MerchantOnboardingPage({ user, requestedStep, onSessionExpired }: MerchantOnboardingPageProps) {
  const { provisioning, plans: planActions } = useUiAdapters();
  const [step, setStep] = useState<Step>(requestedStep);
  const [draft, setDraft] = useState<StoreDraft | null>(null);
  const [storeName, setStoreName] = useState("");
  const [businessType, setBusinessType] = useState("تجزئة");
  const [theme, setTheme] = useState<OnboardingTemplateKey>("elegant");
  const [config, setConfig] = useState<StoreConfig>(() => createTemplateConfig(ONBOARDING_TEMPLATES[0], ""));
  const [plans, setPlans] = useState<StorePlan[]>([]);
  const [planKey, setPlanKey] = useState("");
  const [handle, setHandle] = useState("");
  const [availability, setAvailability] = useState<{ handle: string; available: boolean; domain: string } | null>(null);
  const [availabilityError, setAvailabilityError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [pendingSubmission, setPendingSubmission] = useState(false);
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const loadSequence = useRef(0);
  const operationSequence = useRef(0);
  const operationController = useRef<AbortController | null>(null);
  const availabilitySequence = useRef(0);
  const leavingForPortal = useRef(false);

  const applyDraft = (value: StoreDraft, availablePlans: StorePlan[] = plans) => {
    setDraft(value);
    setStoreName(value.storeName);
    setBusinessType(value.businessType);
    setTheme(value.themeStyle);
    const template = ONBOARDING_TEMPLATES.find((candidate) => candidate.key === value.themeStyle) ?? ONBOARDING_TEMPLATES[0];
    setConfig(value.onboardingStage === "business"
      ? createTemplateConfig(template, value.storeName, value.config)
      : value.config);
    setHandle(value.handle ?? "");
    setPlanKey(value.planKey && availablePlans.some((plan) => plan.key === value.planKey)
      ? value.planKey
      : (availablePlans[0]?.key ?? ""));
  };

  const selectedTemplate = useMemo(
    () => ONBOARDING_TEMPLATES.find((template) => template.key === theme) ?? ONBOARDING_TEMPLATES[0],
    [theme],
  );
  const persistedConfig = useMemo(() => ({
    ...config,
    storeName: storeName.trim() || config.storeName,
    themeStyle: theme,
  }), [config, storeName, theme]);
  const previewConfig = useMemo(
    () => createTemplatePreviewConfig(selectedTemplate, persistedConfig),
    [persistedConfig, selectedTemplate],
  );
  const selectedPlan = useMemo(() => plans.find((plan) => plan.key === planKey) ?? null, [plans, planKey]);
  const normalizedHandle = handle.trim().toLowerCase();
  const reviewBlockers = useMemo(() => {
    if (pendingSubmission) return [];
    const blockers: string[] = [];
    if (normalizedHandle.length < 3) blockers.push("اكتب عنوانًا للمتجر من 3 أحرف على الأقل.");
    else if (checking) blockers.push("انتظر حتى يكتمل التحقق من توفر العنوان.");
    else if (availabilityError) blockers.push(availabilityError);
    else if (!availability || availability.handle !== normalizedHandle) blockers.push("يجب التحقق من توفر عنوان المتجر قبل الإرسال.");
    else if (!availability.available) blockers.push("عنوان المتجر مستخدم؛ اختر عنوانًا مختلفًا.");
    if (!selectedPlan) blockers.push("اختر باقة متاحة قبل الإرسال.");
    if (!draft?.application?.ready) blockers.push("أكمل وثائق طلب المتجر أو سجّل الإعفاءات المسموحة قبل الإرسال.");
    return blockers;
  }, [availability, availabilityError, checking, draft?.application?.ready, normalizedHandle, pendingSubmission, selectedPlan]);

  const dirty = useMemo(() => {
    if (!draft) return storeName.trim() !== "";
    if (step === "business") return storeName.trim() !== draft.storeName || businessType !== draft.businessType;
    if (step === "design") return theme !== draft.themeStyle || JSON.stringify(persistedConfig) !== JSON.stringify(draft.config);
    return handle.trim().toLowerCase() !== (draft.handle ?? "") || planKey !== (draft.planKey ?? "");
  }, [businessType, draft, handle, persistedConfig, planKey, step, storeName, theme]);

  const navigate = (target: Step, persisted = false) => {
    if (!persisted && dirty && !window.confirm("توجد تعديلات غير محفوظة في هذه الخطوة. هل تريد تجاهلها؟")) return;
    setStep(target);
    setError("");
    window.history.pushState({}, "", stepPath[target]);
  };

  const beginOperation = () => {
    operationController.current?.abort();
    const controller = new AbortController();
    operationController.current = controller;
    return { sequence: ++operationSequence.current, controller };
  };

  const handleFailure = (caught: unknown, fallback: string, sequence: number) => {
    if (sequence !== operationSequence.current || isUiError(caught, "aborted")) return;
    if (isUiError(caught, "unauthenticated")) {
      onSessionExpired(stepPath[step]);
      return;
    }
    setError(uiErrorMessage(caught, fallback));
  };

  useEffect(() => {
    const sequence = ++loadSequence.current;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    provisioning.recoverCommittedSubmission(user.id, controller.signal)
      .then(async (recovered) => {
        if (sequence !== loadSequence.current) return;
        if (recovered) {
          window.location.assign(`/app/stores/${encodeURIComponent(recovered.id)}/overview`);
          return;
        }
        const [current, availablePlans] = await Promise.all([
          provisioning.currentDraft(controller.signal),
          planActions.list(controller.signal),
        ]);
        if (sequence !== loadSequence.current) return;
        setPlans(availablePlans);
        if (!current) {
          setStep("business");
          window.history.replaceState({}, "", stepPath.business);
          return;
        }
        applyDraft(current, availablePlans);
        const required = current.nextRequiredStep === "business" || current.nextRequiredStep === "design" || current.nextRequiredStep === "review"
          ? current.nextRequiredStep
          : requestedStep;
        const resumeStep = current.nextRequiredStep === "submit" ? "review" : required;
        const target = requestedStep === "business" && resumeStep !== "business"
          ? resumeStep
          : (stepRank[requestedStep] > stepRank[resumeStep] ? resumeStep : requestedStep);
        if (target !== requestedStep) {
          setStep(target);
          window.history.replaceState({}, "", stepPath[target]);
        }
      })
      .catch((caught) => {
        if (sequence !== loadSequence.current || isUiError(caught, "aborted")) return;
        if (isUiError(caught, "unauthenticated")) onSessionExpired(stepPath[requestedStep]);
        else setError(uiErrorMessage(caught, "تعذر تحميل مسودة التهيئة من الخادم."));
      })
      .finally(() => {
        if (sequence === loadSequence.current) setLoading(false);
      });
    return () => {
      controller.abort();
      operationController.current?.abort();
      loadSequence.current += 1;
      operationSequence.current += 1;
    };
  }, [user.id]);

  useEffect(() => {
    const sequence = ++availabilitySequence.current;
    setAvailability(null);
    setAvailabilityError("");
    setChecking(false);
    if (step !== "review" || normalizedHandle.length < 3 || pendingSubmission) return;
    const controller = new AbortController();
    setChecking(true);
    const timer = window.setTimeout(() => {
      planActions.domainAvailability(normalizedHandle, controller.signal)
        .then((result) => {
          if (sequence === availabilitySequence.current && result.handle === normalizedHandle) setAvailability(result);
        })
        .catch((caught) => {
          if (sequence !== availabilitySequence.current) return;
          if (isUiError(caught, "unauthenticated")) onSessionExpired(stepPath.review);
          else if (!isUiError(caught, "aborted")) setAvailabilityError("تعذر التحقق من عنوان المتجر. تحقق من الاتصال ثم حاول مجددًا.");
        })
        .finally(() => {
          if (sequence === availabilitySequence.current) setChecking(false);
        });
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
      if (sequence === availabilitySequence.current) availabilitySequence.current += 1;
    };
  }, [normalizedHandle, pendingSubmission, planActions, step]);

  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (leavingForPortal.current || (!saving && !dirty)) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty, saving]);

  const leaveForPortal = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (dirty && !window.confirm("توجد بيانات في هذه الخطوة لم تُحفظ بعد. الخروج سيحتفظ بآخر نسخة محفوظة فقط. هل تريد المتابعة؟")) {
      event.preventDefault();
      return;
    }
    leavingForPortal.current = true;
  };

  const selectTemplate = (key: OnboardingTemplateKey) => {
    if (saving) return;
    const template = ONBOARDING_TEMPLATES.find((candidate) => candidate.key === key) ?? ONBOARDING_TEMPLATES[0];
    setTheme(key);
    setConfig((current) => createTemplateConfig(template, storeName, current));
  };

  const updateConfig = <K extends keyof StoreConfig>(key: K, value: StoreConfig[K]) => {
    if (saving) return;
    setConfig((current) => ({ ...current, [key]: value, storeName: storeName.trim() || current.storeName, themeStyle: theme }));
  };

  const saveBusiness = async (event: React.FormEvent) => {
    event.preventDefault();
    const { sequence, controller } = beginOperation();
    setSaving(true);
    setError("");
    try {
      const saved = await provisioning.saveBusiness({ expectedRevision: draft?.revision ?? 0, storeName, businessType }, controller.signal);
      if (sequence !== operationSequence.current) return;
      applyDraft(saved);
      navigate("design", true);
    } catch (caught) {
      handleFailure(caught, "تعذر حفظ بيانات النشاط.", sequence);
    } finally {
      if (sequence === operationSequence.current) setSaving(false);
    }
  };

  const saveDesign = async () => {
    if (!draft) return;
    const { sequence, controller } = beginOperation();
    setSaving(true);
    setError("");
    try {
      const saved = await provisioning.saveDesign({
        expectedRevision: draft.revision,
        themeStyle: theme,
        config: storeOnboardingAppearance(persistedConfig),
      }, controller.signal);
      if (sequence !== operationSequence.current) return;
      applyDraft(saved);
      navigate("review", true);
    } catch (caught) {
      handleFailure(caught, "تعذر حفظ تصميم المتجر.", sequence);
    } finally {
      if (sequence === operationSequence.current) setSaving(false);
    }
  };

  const applyApplication = (application: StoreApplicationDossier) => {
    setDraft((current) => current && current.id === application.draftId
      ? { ...current, revision: application.draftRevision, application }
      : current);
    setError("");
  };

  const reloadDraftForEvidence = async () => {
    const latest = await provisioning.currentDraft();
    if (!latest || latest.id !== draft?.id) throw new Error("The current draft changed.");
    applyDraft(latest);
    setAvailability(null);
  };

  const submit = async () => {
    if (!draft) {
      setError("لا توجد مسودة محفوظة يمكن إرسالها.");
      return;
    }
    if (evidenceBusy) {
      setError("انتظر حتى يكتمل رفع المستند الحالي قبل إرسال الطلب.");
      return;
    }
    if (!pendingSubmission && reviewBlockers.length > 0) {
      setError(reviewBlockers[0]);
      return;
    }
    const { sequence, controller } = beginOperation();
    setSaving(true);
    setError("");
    try {
      const ready = pendingSubmission ? draft : await provisioning.saveReview({
        expectedRevision: draft.revision,
        handle: handle.trim().toLowerCase(),
        planKey,
      }, controller.signal);
      if (sequence !== operationSequence.current) return;
      applyDraft(ready);
      setPendingSubmission(true);
      const submitted = await provisioning.submit({
        storeName: ready.storeName,
        businessType: ready.businessType,
        themeStyle: ready.themeStyle,
        handle: ready.handle!,
        planKey: ready.planKey!,
        config: ready.config,
        draftId: ready.id,
        expectedDraftRevision: ready.revision,
      }, user.id, controller.signal);
      if (sequence !== operationSequence.current) return;
      setPendingSubmission(false);
      window.location.assign(`/app/stores/${encodeURIComponent(submitted.data.id)}/overview`);
    } catch (caught) {
      handleFailure(caught, pendingSubmission
        ? "تعذر تأكيد نتيجة الإرسال. أعد المحاولة لاستعادة العملية نفسها دون تكرار المتجر."
        : "تعذر حفظ المراجعة أو إرسال المتجر.", sequence);
      if (!isUiError(caught, "network") && !isUiError(caught, "server") && !isUiError(caught, "unexpected")) setPendingSubmission(false);
    } finally {
      if (sequence === operationSequence.current) setSaving(false);
    }
  };

  const inputClass = "mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100";

  if (loading) return <LoadingScreen />;

  return (
    <main dir="rtl" className="min-h-screen bg-slate-100 px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-6 rounded-3xl bg-slate-950 p-6 text-white shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div><p className="text-xs font-bold text-sky-300">تهيئة متجر جديد</p><h1 className="mt-1 text-2xl font-black">شاهد متجرك وخصصه قبل إرسال الطلب</h1></div>
            <a href="/app" onClick={leaveForPortal} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold"><ArrowRight className="h-4 w-4" />الخروج إلى بوابة التاجر</a>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {(["business", "design", "review"] as Step[]).map((item, index) => (
              <div key={item} className={`rounded-2xl border p-3 ${item === step ? "border-sky-400 bg-sky-500/20" : stepRank[item] < stepRank[step] ? "border-emerald-400/40 bg-emerald-400/10" : "border-white/10 bg-white/5"}`}>
                <span className="flex items-center gap-1 text-xs text-slate-300">{stepRank[item] < stepRank[step] && <Check className="h-3.5 w-3.5 text-emerald-300" />}الخطوة {index + 1}</span>
                <p className="mt-1 font-black">{item === "business" ? "بيانات النشاط" : item === "design" ? "القالب والتخصيص" : "المعاينة والإرسال"}</p>
              </div>
            ))}
          </div>
        </header>

        {error && <div role="alert" className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}

        {step === "business" && (
          <form onSubmit={saveBusiness} className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <SectionTitle icon={Building2} title="عرّفنا بالنشاط" text="سنستخدم هذه البيانات لبناء مسودة متجرك. تُحفظ على الخادم ويمكنك استكمالها لاحقًا من أي جهاز." />
            <label className="mt-7 block text-sm font-bold">اسم المتجر أو النشاط<input value={storeName} onChange={(event) => setStoreName(event.target.value)} required minLength={2} maxLength={255} className={inputClass} /></label>
            <label className="mt-5 block text-sm font-bold">نوع النشاط<select value={businessType} onChange={(event) => setBusinessType(event.target.value)} className={inputClass}>{["تجزئة", "أغذية ومشروبات", "أزياء", "عطور وبخور", "إلكترونيات", "خدمات", "أخرى"].map((item) => <option key={item}>{item}</option>)}</select></label>
            <div className="mt-6 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-xs leading-6 text-sky-900"><Sparkles className="mb-2 h-5 w-5" />في الخطوة التالية ستختار قالبًا وتشاهد متجرًا فعليًا وتعدل هويته قبل الإرسال.</div>
            <button disabled={saving} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-5 py-3.5 text-sm font-black text-white disabled:opacity-50">حفظ واختيار القالب<ArrowLeft className="h-4 w-4" /></button>
          </form>
        )}

        {step === "design" && (
          <section className="space-y-6">
            <div className="grid items-start gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
              <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 xl:sticky xl:top-5">
                <SectionTitle icon={LayoutTemplate} title="اختر القالب الحقيقي" text="كل خيار أدناه يشغّل واجهته الفعلية في المعاينة المقابلة، وليس رسمًا تقريبيًا للقالب." compact />
                <div className="mt-6 space-y-4" aria-label="قوالب المتاجر المتاحة">
                  {ONBOARDING_TEMPLATES.map((template) => <TemplateCard key={template.key} template={template} selected={theme === template.key} onSelect={() => selectTemplate(template.key)} />)}
                </div>
                <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-xs leading-6 text-sky-950">
                  <p className="font-black">المعروض الآن: {selectedTemplate.layoutLabel}</p>
                  <p className="mt-1 text-sky-800">المحتوى والصور داخل المعاينة تجريبية فقط، بينما بنية القالب والتنقل حقيقيان.</p>
                </div>
              </aside>
              <React.Fragment key={`design-${selectedTemplate.key}`}>
                <OnboardingStorePreview config={previewConfig} />
              </React.Fragment>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <SectionTitle icon={Palette} title="خصص هوية متجرك" text="غيّر العناصر الأساسية وشاهد النتيجة فورًا في المعاينة الحقيقية أعلاه." compact />
              <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                <label className="block text-sm font-bold">الشعار النصي أو الرمز<input value={config.logoIcon} onChange={(event) => updateConfig("logoIcon", event.target.value.slice(0, 8))} maxLength={8} className={inputClass} /></label>
                <label className="block text-sm font-bold">العبارة التعريفية<input value={config.slogan} onChange={(event) => updateConfig("slogan", event.target.value)} maxLength={160} className={inputClass} /></label>
                <label className="block text-sm font-bold">شريط الإعلان<input value={config.bannerText} onChange={(event) => updateConfig("bannerText", event.target.value)} maxLength={180} className={inputClass} /></label>
                <div className="grid grid-cols-2 gap-3">
                  <ColorField label="اللون الرئيسي" value={config.primaryColor} onChange={(value) => updateConfig("primaryColor", value)} />
                  <ColorField label="اللون المساند" value={config.secondaryColor} onChange={(value) => updateConfig("secondaryColor", value)} />
                </div>
                <label className="block text-sm font-bold">الخط<select value={config.fontFamily} onChange={(event) => updateConfig("fontFamily", event.target.value)} className={inputClass}>{fontOptions.map((font) => <option key={font}>{font}</option>)}</select></label>
                <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4 text-sm font-bold"><span>إظهار واجهة ترحيبية كبيرة</span><input type="checkbox" checked={config.showHeroBanner === true} onChange={(event) => updateConfig("showHeroBanner", event.target.checked)} className="h-5 w-5 accent-sky-600" /></label>
                {config.showHeroBanner && <label className="block text-sm font-bold">عنوان الواجهة الترحيبية<input value={config.heroBannerTitle ?? ""} onChange={(event) => updateConfig("heroBannerTitle", event.target.value)} maxLength={180} className={inputClass} /></label>}
              </div>
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">إضافة المنتجات ورفع ملفات الشعار وإعداد الدفع تتم بعد تجهيز المتجر، حتى تبقى البيانات مرتبطة بقاعدة متجر جاهزة.</div>
            </div>

            <div className="flex flex-wrap gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <button type="button" disabled={saving} onClick={() => navigate("business")} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold">السابق</button>
              <button type="button" disabled={saving} onClick={() => void saveDesign()} className="flex-1 rounded-2xl bg-sky-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{saving ? "جاري حفظ التصميم..." : "حفظ التصميم والانتقال للمعاينة النهائية"}</button>
            </div>
          </section>
        )}

        {step === "review" && (
          <section className="space-y-6">
            <div className="grid items-start gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
              <div className="space-y-5">
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <SectionTitle icon={Globe2} title="راجع الطلب قبل الإرسال" text="تأكد من الهوية والعنوان والباقة. لن يصبح المتجر عامًا بمجرد الإرسال." compact />
                  <div className="mt-6 space-y-3">
                    <SummaryRow label="اسم المتجر" value={storeName} onEdit={() => navigate("business")} />
                    <SummaryRow label="نوع النشاط" value={businessType} onEdit={() => navigate("business")} />
                    <SummaryRow label="القالب" value={selectedTemplate.name} onEdit={() => navigate("design")} />
                    <SummaryRow label="الخط" value={config.fontFamily} onEdit={() => navigate("design")} />
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-black">العنوان والباقة</h2>
                  <label className="mt-5 block text-sm font-bold">معرّف عنوان المتجر <span className="text-rose-600">*</span><input aria-describedby="store-handle-status" disabled={pendingSubmission} value={handle} onChange={(event) => { setHandle(event.target.value.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase()); setError(""); }} minLength={3} maxLength={50} dir="ltr" className={`${inputClass} text-left`} /></label>
                  <p id="store-handle-status" aria-live="polite" className={`mt-2 text-xs font-bold ${availability?.available ? "text-emerald-700" : availability || availabilityError ? "text-rose-700" : "text-slate-500"}`}>{checking ? "جاري التحقق من العنوان..." : availabilityError || (availability ? availability.available ? `متاح الآن: ${availability.domain}` : "العنوان مستخدم؛ جرّب اسمًا مختلفًا." : "3–50 حرفًا إنجليزيًا صغيرًا أو رقمًا أو شرطة داخلية.")}</p>
                  <label className="mt-5 block text-sm font-bold">الباقة <span className="text-rose-600">*</span><select disabled={pendingSubmission || plans.length === 0} value={planKey} onChange={(event) => { setPlanKey(event.target.value); setError(""); }} className={inputClass}>{plans.map((plan) => <option key={plan.key} value={plan.key}>{plan.name}</option>)}</select></label>
                  {selectedPlan && <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-600"><p className="font-black text-slate-900">{selectedPlan.name}</p><p>{selectedPlan.maxProducts === null ? "منتجات غير محدودة" : `حتى ${selectedPlan.maxProducts} منتجات`} — {selectedPlan.activationMode === "automatic" ? "تفعيل تلقائي بعد الموافقة" : "يتطلب تفعيل الإدارة"}</p>{selectedPlan.features.length > 0 && <ul className="mt-2 list-inside list-disc">{selectedPlan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>}</div>}
                </div>

                {draft?.application && <StoreApplicationEvidencePanel application={draft.application} disabled={saving || pendingSubmission} onUploadEvidence={(requirementKey, file, signal) => provisioning.uploadApplicationEvidence(draft.id, requirementKey, draft.revision, file, signal)} onDeclareExemption={(requirementKey, reason, signal) => provisioning.exemptApplicationRequirement(draft.id, requirementKey, draft.revision, reason, signal)} onApplicationChanged={applyApplication} onBusyChange={setEvidenceBusy} onReloadDraft={reloadDraftForEvidence} onSessionExpired={() => onSessionExpired(stepPath.review)} />}

                {!pendingSubmission && <div aria-live="polite" className={`rounded-2xl border p-4 text-xs leading-6 ${reviewBlockers.length === 0 ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-950"}`}><p className="font-black">{reviewBlockers.length === 0 ? "الطلب جاهز للإرسال" : "أكمل المطلوب قبل الإرسال"}</p>{reviewBlockers.length > 0 && <ul className="mt-2 list-inside list-disc">{reviewBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>}</div>}
                <div className="flex gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-xs leading-6 text-indigo-900"><ShieldCheck className="h-5 w-5 shrink-0" /><p>الإرسال ينشئ طلب مراجعة فقط. بعد الموافقة يبدأ تجهيز قاعدة المتجر، ثم يظهر لك إجراء النشر والرابط من بوابة التاجر.</p></div>
                {pendingSubmission && <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-900">نتيجة المحاولة السابقة غير مؤكدة. الضغط مرة أخرى يستعيد العملية نفسها دون إنشاء متجر مكرر.</p>}
              </div>
              <React.Fragment key={`review-${selectedTemplate.key}`}>
                <OnboardingStorePreview config={previewConfig} compact />
              </React.Fragment>
            </div>

            <div className="flex flex-wrap gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <button type="button" disabled={saving || pendingSubmission} onClick={() => navigate("design")} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold">السابق</button>
              <button type="button" disabled={saving || evidenceBusy} onClick={() => void submit()} className="flex-1 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{saving ? "جاري الحفظ والإرسال..." : pendingSubmission ? "استعادة نتيجة الإرسال" : evidenceBusy ? "جاري رفع المستند..." : "تأكيد التصميم وإرسال طلب المراجعة"}</button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function TemplateCard({ template, selected, onSelect }: { key?: React.Key; template: (typeof ONBOARDING_TEMPLATES)[number]; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected} className={`w-full rounded-2xl border-2 p-4 text-right transition ${selected ? "border-sky-500 bg-sky-50 ring-4 ring-sky-100" : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className={`text-[10px] font-black tracking-[0.08em] ${selected ? "text-sky-700" : "text-slate-500"}`}>{template.layoutLabel}</span>
          <div className="mt-1 flex flex-wrap items-center gap-2"><h3 className="font-black text-slate-950">{template.name}</h3><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{template.category}</span></div>
        </div>
        <span className={`rounded-full p-1.5 ${selected ? "bg-sky-600 text-white" : "border border-slate-200 text-slate-400"}`}>{selected ? <Check className="h-4 w-4" /> : <LayoutTemplate className="h-4 w-4" />}</span>
      </div>
      <p className="mt-3 text-xs leading-6 text-slate-600">{template.description}</p>
      <span role="list" className="mt-3 block space-y-1.5 border-t border-slate-200 pt-3 text-[11px] font-bold text-slate-700">
        {template.layoutFeatures.map((feature) => <span role="listitem" key={feature} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-sky-500" />{feature}</span>)}
      </span>
      <p className="mt-3 text-[10px] font-bold leading-5 text-slate-500">مناسب لـ: {template.bestFor}</p>
    </button>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-xs font-bold">{label}<span className="mt-2 flex items-center gap-2 rounded-2xl border border-slate-200 p-2"><input type="color" value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} className="h-9 w-12 cursor-pointer rounded-lg border-0 bg-transparent" /><span dir="ltr" className="text-[11px] text-slate-500">{value}</span></span></label>;
}

function SummaryRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3"><div><p className="text-[10px] font-bold text-slate-500">{label}</p><p className="mt-1 text-sm font-black">{value || "—"}</p></div><button type="button" onClick={onEdit} className="rounded-xl p-2 text-sky-700 hover:bg-sky-100" aria-label={`تعديل ${label}`}><PencilLine className="h-4 w-4" /></button></div>;
}

function SectionTitle({ icon: Icon, title, text, compact = false }: { icon: React.ComponentType<{ className?: string }>; title: string; text: string; compact?: boolean }) {
  return <div className="flex items-start gap-4"><span className="rounded-2xl bg-sky-100 p-3 text-sky-700"><Icon className="h-6 w-6" /></span><div><h2 className={`${compact ? "text-lg" : "text-xl"} font-black text-slate-950`}>{title}</h2><p className="mt-1 text-sm leading-7 text-slate-500">{text}</p></div></div>;
}

function LoadingScreen() {
  return <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-100"><div className="flex items-center gap-3 rounded-2xl bg-white px-6 py-4 font-bold text-slate-700 shadow"><Loader2 className="h-5 w-5 animate-spin text-sky-600" />جاري استعادة مسودة المتجر من الخادم...</div></main>;
}
