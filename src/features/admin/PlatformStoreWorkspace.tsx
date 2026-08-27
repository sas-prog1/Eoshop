import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  FileCheck2,
  FileWarning,
  Globe2,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  Store,
  XCircle,
} from "lucide-react";
import type { UiAdapters } from "../../adapters/uiAdapters";
import {
  isUiError,
  uiErrorMessage,
  type PlatformStoreDetail,
  type UserProfile,
  type VerificationStatus,
} from "../../adapters/uiAdapters";
import { publicStoreUrl } from "../../utils/publicStoreUrl";

interface Props {
  administration: UiAdapters["administration"];
  storeId: string;
  user: UserProfile;
  onBack: () => void;
  onSessionExpired: () => void;
  onToast: (message: string, type?: "success" | "error" | "info") => void;
}

const blockerLabels: Record<string, string> = {
  review_not_approved: "قرار المراجعة لم يعتمد بعد",
  provisioning_not_ready: "قاعدة بيانات المتجر أو التجهيز غير جاهز",
  workspace_not_ready: "مساحة عمل المتجر لم تكتمل",
  publication_request_not_open: "طلب النشر غير مفتوح",
  domain_not_reserved: "عنوان المتجر غير محجوز",
  subscription_not_active: "الاشتراك غير فعّال",
};

const evidenceStatus = {
  missing: { label: "غير مرفق", className: "bg-slate-100 text-slate-700" },
  pending: { label: "بانتظار المراجعة", className: "bg-amber-100 text-amber-800" },
  accepted: { label: "مقبول", className: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "بحاجة استكمال", className: "bg-rose-100 text-rose-800" },
} as const;

const correctionOptions = [
  ["business.store_name", "اسم المتجر"],
  ["business.business_type", "نوع النشاط"],
  ["design.appearance", "التصميم والمحتوى"],
  ["publication.handle", "عنوان المتجر"],
  ["subscription.plan", "الباقة"],
  ["documents.owner_identity", "إثبات هوية المالك"],
  ["documents.commercial_registration", "السجل أو الترخيص التجاري"],
] as const;

function configText(config: Record<string, unknown>, key: string, fallback: string): string {
  return typeof config[key] === "string" && (config[key] as string).trim() ? config[key] as string : fallback;
}

function configColor(config: Record<string, unknown>, key: string, fallback: string): string {
  const value = configText(config, key, fallback);
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

export default function PlatformStoreWorkspace({ administration, storeId, user, onBack, onSessionExpired, onToast }: Props) {
  const [store, setStore] = useState<PlatformStoreDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectingEvidence, setRejectingEvidence] = useState<string | null>(null);
  const [evidenceNote, setEvidenceNote] = useState("");
  const [decision, setDecision] = useState<"changes_requested" | "rejected" | "suspended" | null>(null);
  const [decisionReason, setDecisionReason] = useState("");
  const [requestedFields, setRequestedFields] = useState<string[]>([]);
  const [activationOpen, setActivationOpen] = useState(false);
  const [activationEndsAt, setActivationEndsAt] = useState("");
  const canReview = user.platformPermissions.includes("platform.stores.review");
  const canManage = user.platformPermissions.includes("platform.stores.manage");

  const handleError = useCallback((caught: unknown, fallback: string) => {
    if (isUiError(caught, "unauthenticated")) {
      onSessionExpired();
      return;
    }
    setError(uiErrorMessage(caught, fallback));
  }, [onSessionExpired]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      setStore(await administration.getStore(storeId, signal));
    } catch (caught) {
      if (!isUiError(caught, "aborted")) handleError(caught, "تعذر تحميل ملف المتجر التشغيلي.");
    } finally {
      setLoading(false);
    }
  }, [administration, handleError, storeId]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const mutate = async (operation: () => Promise<unknown>, message: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await operation();
      await load();
      onToast(message, "success");
    } catch (caught) {
      handleError(caught, "تعذر تنفيذ الإجراء على المتجر.");
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (status: VerificationStatus, reason?: string, fields?: string[]) => {
    await mutate(
      () => administration.updateStoreStatus(storeId, status, reason, fields),
      status === "approved" ? "تم اعتماد الطلب وبدأ تجهيز المتجر." : "تم حفظ قرار المراجعة وإبلاغ التاجر.",
    );
    setDecision(null);
    setDecisionReason("");
    setRequestedFields([]);
  };

  if (loading && !store) {
    return <div className="grid min-h-[55vh] place-items-center rounded-3xl bg-white"><span className="flex items-center gap-3 text-sm text-slate-500"><RefreshCw className="h-5 w-5 animate-spin" /> تحميل ملف المتجر...</span></div>;
  }
  if (!store) {
    return <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center"><AlertTriangle className="mx-auto h-10 w-10 text-rose-600" /><p className="mt-3 font-bold text-rose-900">{error ?? "ملف المتجر غير متاح."}</p><button type="button" onClick={() => void load()} className="mt-4 rounded-xl bg-slate-950 px-5 py-3 text-xs font-bold text-white">إعادة المحاولة</button></div>;
  }

  const workspace = store.applicationWorkspace;
  const snapshot = workspace?.snapshot;
  const config = snapshot?.config ?? {};
  const rejectedDocumentFields = workspace?.dossier.requirements
    .filter((requirement) => requirement.evidence?.reviewStatus === "rejected")
    .map((requirement) => `documents.${requirement.key}`) ?? [];
  const openDecision = (mode: "changes_requested" | "rejected" | "suspended") => {
    setDecision(mode);
    setRequestedFields(mode === "changes_requested"
      ? (rejectedDocumentFields.length > 0 ? rejectedDocumentFields : ["business.store_name"])
      : []);
  };

  return (
    <section className="mx-auto max-w-7xl space-y-5" aria-label={`مساحة عمل ${store.storeName}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold"><ArrowRight className="h-4 w-4" /> العودة إلى المتاجر</button>
        <button type="button" disabled={loading || busy} onClick={() => void load()} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> تحديث الملف</button>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">{error}</div>}

      <header className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div><span className="text-xs font-bold text-sky-300">ملف موحد للمراجعة والتشغيل</span><h1 className="mt-2 text-3xl font-black">{store.storeName}</h1><p className="mt-2 text-sm text-slate-300">{store.businessType} · {store.ownerName} · <span dir="ltr">{store.ownerEmail}</span></p></div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs"><StatusBox label="المراجعة" value={store.verificationStatus} /><StatusBox label="التجهيز" value={store.provisioningStatus} /><StatusBox label="النشر" value={store.publicationStatus} /></div>
        </div>
      </header>

      {workspace ? (
        <>
          <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
            <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-5"><span className="flex items-center gap-2 text-sm font-black"><Store className="h-5 w-5 text-indigo-600" /> نسخة الطلب المقدمة</span><p className="mt-1 text-xs text-slate-500">نسخة الخادم المرسلة للمراجعة · المراجعة {snapshot.revision} · {snapshot.submittedAt ? new Date(snapshot.submittedAt).toLocaleString("ar-YE") : "—"}</p></div>
              <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
                <Data label="اسم النشاط" value={snapshot.storeName} />
                <Data label="نوع النشاط" value={snapshot.businessType} />
                <Data label="الباقة" value={snapshot.planName ?? snapshot.planKey} />
                <Data label="العنوان المطلوب" value={snapshot.handle} ltr />
                <Data label="قالب الواجهة" value={snapshot.themeStyle === "elegant" ? "الأناقة العصرية" : "التقنية والابتكار"} />
                <Data label="هاتف المالك" value={store.ownerPhone ?? "غير مسجل"} ltr />
              </div>
              <div className="border-t border-slate-100 p-5">
                <h2 className="text-sm font-black">المعاينة المجمدة عند الإرسال</h2>
                <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200" style={{ backgroundColor: configColor(config, "bgColor", "#f8fafc") }}>
                  <div className="flex items-center justify-between px-5 py-3 text-white" style={{ backgroundColor: configColor(config, "secondaryColor", "#0f172a") }}><strong>{configText(config, "storeName", snapshot.storeName)}</strong><span className="text-xs">{configText(config, "bannerText", "واجهة المتجر المقدمة")}</span></div>
                  <div className="p-7 sm:p-10" style={{ color: configColor(config, "textColor", "#0f172a") }}><span className="rounded-full px-3 py-1 text-[11px] font-bold text-white" style={{ backgroundColor: configColor(config, "primaryColor", "#4f46e5") }}>{configText(config, "heroBannerBadge", "اختيارات مميزة")}</span><h3 className="mt-4 text-2xl font-black">{configText(config, "heroBannerTitle", configText(config, "slogan", snapshot.storeName))}</h3><p className="mt-2 text-sm opacity-75">{configText(config, "heroBannerSubtitle", "هذه هي الهوية التي قدمها التاجر للمراجعة.")}</p><button type="button" disabled className="mt-5 rounded-xl px-5 py-2 text-xs font-bold text-white" style={{ backgroundColor: configColor(config, "primaryColor", "#4f46e5") }}>شاهد المنتجات</button></div>
                </div>
              </div>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-sm font-black"><FileCheck2 className="h-5 w-5 text-indigo-600" /> قائمة قرار المراجعة</h2><span className={`rounded-full px-3 py-1 text-[11px] font-black ${workspace.decisionReady ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{workspace.decisionReady ? "جاهز للقرار" : "يتطلب مراجعة"}</span></div>
              <div className="mt-4 space-y-3">{workspace.checklist.map((item) => <div key={item.key} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-xs"><span className="font-bold">{item.label}</span><span className={`rounded-full px-2 py-1 font-bold ${evidenceStatus[item.status].className}`}>{evidenceStatus[item.status].label}</span></div>)}</div>
              {store.verificationStatus === "pending" && canReview && <div className="mt-5 grid gap-2 border-t border-slate-100 pt-4"><button type="button" disabled={busy || !workspace.decisionReady} onClick={() => void updateStatus("approved")} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle2 className="h-4 w-4" /> اعتماد وبدء التجهيز</button>{!workspace.decisionReady && <p className="text-center text-[11px] leading-5 text-amber-700">اعتمد أو أعد كل وثيقة أولًا؛ الخادم يمنع القرار غير المكتمل.</p>}<button type="button" disabled={busy} onClick={() => openDecision("changes_requested")} className="rounded-xl bg-amber-400 px-4 py-3 text-xs font-black">طلب استكمال محدد</button><button type="button" disabled={busy} onClick={() => openDecision("rejected")} className="rounded-xl border border-rose-200 px-4 py-3 text-xs font-black text-rose-700">رفض نهائي</button></div>}
            </article>
          </div>

          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-black"><ShieldCheck className="h-5 w-5 text-indigo-600" /> الوثائق والإفادات</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">{workspace.dossier.requirements.map((requirement) => {
              const evidence = requirement.evidence;
              const status = evidence?.reviewStatus ?? "missing";
              return <div key={requirement.key} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-black">{requirement.label}</h3><p className="mt-1 text-xs leading-6 text-slate-500">{requirement.description}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${evidenceStatus[status].className}`}>{evidenceStatus[status].label}</span></div>{evidence && <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{evidence.resolution === "uploaded" ? <><p>{evidence.originalName} · {evidence.byteSize ? `${Math.ceil(evidence.byteSize / 1024)} KB` : "—"}</p>{evidence.downloadUrl && <a href={evidence.downloadUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 font-bold text-indigo-700"><Download className="h-4 w-4" /> فتح المستند الخاص</a>}</> : <p><b>إفادة إعفاء:</b> {evidence.exemptionReason}</p>}</div>}{evidence && store.verificationStatus === "pending" && canReview && <div className="mt-3 flex gap-2"><button type="button" disabled={busy || status === "accepted"} onClick={() => void mutate(() => administration.reviewStoreEvidence(storeId, evidence.id, "accepted"), `تم اعتماد ${requirement.label}.`)} className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><Check className="h-4 w-4" /> قبول</button><button type="button" disabled={busy || status === "rejected"} onClick={() => { setRejectingEvidence(evidence.id); setEvidenceNote(""); }} className="flex items-center gap-1 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-40"><FileWarning className="h-4 w-4" /> يحتاج استكمال</button></div>}</div>;
            })}</div>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-black"><Clock3 className="h-5 w-5 text-indigo-600" /> تسلسل الطلب</h2>
            <ol className="mt-4 grid gap-3 lg:grid-cols-2">{workspace.dossier.timeline.slice().reverse().map((event) => <li key={event.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-xs font-bold">{event.message}</p><p className="mt-1 text-[11px] text-slate-500">{event.actorType === "merchant" ? "التاجر" : event.actorType === "platform" ? "إدارة المنصة" : "النظام"} · {event.occurredAt ? new Date(event.occurredAt).toLocaleString("ar-YE") : "—"}</p></li>)}</ol>
          </article>
        </>
      ) : <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">هذا متجر قديم بلا ملف تقديم تفصيلي؛ تبقى إجراءات تشغيله متاحة، ويُعرض غياب الملف بوضوح للمشغّل.</div>}

      <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-sm font-black"><ServerCog className="h-5 w-5 text-indigo-600" /> صحة المتجر وتشغيله</h2><p className="mt-1 text-xs text-slate-500">حالة المستأجر وقاعدة البيانات والنطاق والاشتراك والنشر من الخادم.</p></div><code dir="ltr" className="rounded-lg bg-slate-100 px-3 py-2 text-[11px]">{store.operations.tenant.schemaName}</code></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Health label="المراجعة" ok={store.operations.health.review} /><Health label="قاعدة المتجر" ok={store.operations.health.provisioning} /><Health label="النطاق" ok={store.operations.health.domain} /><Health label="الاشتراك" ok={store.operations.health.subscription} /><Health label="النشر" ok={store.operations.health.publication} /></div>
        {store.operations.blockers.length > 0 && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><h3 className="text-xs font-black text-amber-900">لماذا لا يمكن النشر الآن؟</h3><ul className="mt-2 grid gap-1 text-xs text-amber-800">{store.operations.blockers.map((blocker) => <li key={blocker}>• {blockerLabels[blocker] ?? blocker}</li>)}</ul></div>}
        {store.operations.provisioning && <div className="mt-4"><h3 className="text-xs font-black">خطوات آخر تجهيز — المحاولة {store.operations.provisioning.runNumber}</h3><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{store.operations.provisioning.steps.map((step) => <div key={step.step} className="rounded-xl bg-slate-50 p-3 text-xs"><b dir="ltr">{step.step}</b><span className={`mt-2 block font-bold ${step.status === "succeeded" || step.status === "retained" ? "text-emerald-700" : step.status === "failed" ? "text-rose-700" : "text-amber-700"}`}>{step.status}</span></div>)}</div></div>}
        {canManage && <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">{store.verificationStatus === "approved" && <button type="button" disabled={busy} onClick={() => openDecision("suspended")} className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white">تعليق المتجر</button>}{store.verificationStatus === "suspended" && <button type="button" disabled={busy} onClick={() => void updateStatus("approved")} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white">إعادة التفعيل</button>}{store.provisioningStatus === "failed" && <button type="button" disabled={busy} onClick={() => void mutate(() => administration.retryProvisioning(storeId), "تمت جدولة إعادة التجهيز.")} className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white">إعادة التجهيز</button>}{store.subscription && (store.subscription.status === "pending_activation" || store.subscription.status === "expired") && <button type="button" disabled={busy} onClick={() => setActivationOpen(true)} className="rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold">تفعيل الاستحقاق</button>}{store.publicationStatus !== "published" && store.publicationBlockers.length === 0 && <button type="button" disabled={busy} onClick={() => void mutate(() => administration.publish(storeId), "تم نشر المتجر.")} className="flex items-center gap-1 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white"><Globe2 className="h-4 w-4" /> نشر المتجر</button>}{store.publicationStatus === "published" && <button type="button" disabled={busy} onClick={() => void mutate(() => administration.unpublish(storeId), "تم إيقاف نشر المتجر.")} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold">إيقاف النشر</button>}{store.publicDomain && <a href={publicStoreUrl(store.publicDomain)} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-xl border border-emerald-200 px-4 py-2 text-xs font-bold text-emerald-700"><ExternalLink className="h-4 w-4" /> فتح المتجر</a>}</div>}
      </article>

      {rejectingEvidence && <Dialog title="إعادة الوثيقة للاستكمال" onClose={() => setRejectingEvidence(null)}><p className="text-xs leading-6 text-slate-500">اكتب ملاحظة تشغيلية واضحة. سيُسجل القرار في سجل التدقيق، ثم استخدم «طلب استكمال محدد» لإرسال المطلوب للتاجر.</p><textarea value={evidenceNote} onChange={(event) => setEvidenceNote(event.target.value)} maxLength={1000} className="mt-3 min-h-28 w-full rounded-xl border border-slate-200 p-3 text-sm" /><button type="button" disabled={busy || !evidenceNote.trim()} onClick={() => void mutate(() => administration.reviewStoreEvidence(storeId, rejectingEvidence, "rejected", evidenceNote), "تمت إعادة الوثيقة للاستكمال.").then(() => setRejectingEvidence(null))} className="mt-3 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">تأكيد مراجعة الوثيقة</button></Dialog>}
      {decision && <Dialog title={decision === "changes_requested" ? "طلب استكمال محدد" : decision === "rejected" ? "رفض الطلب نهائيًا" : "تعليق المتجر"} onClose={() => setDecision(null)}>{decision === "changes_requested" && <div className="grid gap-2 sm:grid-cols-2">{correctionOptions.map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs font-bold"><input type="checkbox" checked={requestedFields.includes(key)} onChange={(event) => setRequestedFields(event.target.checked ? [...requestedFields, key] : requestedFields.filter((item) => item !== key))} /> {label}</label>)}</div>}<textarea value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} maxLength={1000} placeholder="السبب والتعليمات القابلة للتنفيذ" className="mt-3 min-h-28 w-full rounded-xl border border-slate-200 p-3 text-sm" /><button type="button" disabled={busy || !decisionReason.trim() || (decision === "changes_requested" && requestedFields.length === 0)} onClick={() => void updateStatus(decision, decisionReason.trim(), requestedFields)} className="mt-3 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">تأكيد القرار</button></Dialog>}
      {activationOpen && <Dialog title="تفعيل استحقاق المتجر" onClose={() => setActivationOpen(false)}><label className="text-xs font-bold">تاريخ الانتهاء</label><input type="date" value={activationEndsAt} min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)} onChange={(event) => setActivationEndsAt(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm" /><button type="button" disabled={busy || !activationEndsAt} onClick={() => void mutate(() => administration.activateSubscription(storeId, new Date(`${activationEndsAt}T23:59:59`).toISOString()), "تم تفعيل استحقاق المتجر.").then(() => setActivationOpen(false))} className="mt-3 rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold disabled:opacity-40">تأكيد التفعيل</button></Dialog>}
    </section>
  );
}

function StatusBox({ label, value }: { label: string; value: string }) {
  return <span className="rounded-xl bg-white/10 px-3 py-2"><b className="block text-[10px] text-slate-400">{label}</b><span className="mt-1 block font-bold">{value}</span></span>;
}

function Data({ label, value, ltr = false }: { label: string; value: string; ltr?: boolean }) {
  return <div className="rounded-xl bg-slate-50 p-3"><span className="text-[11px] text-slate-500">{label}</span><strong className="mt-1 block text-sm" dir={ltr ? "ltr" : undefined}>{value}</strong></div>;
}

function Health({ label, ok }: { label: string; ok: boolean }) {
  return <div className={`rounded-xl border p-3 text-center text-xs font-black ${ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{ok ? <CheckCircle2 className="mx-auto mb-2 h-5 w-5" /> : <XCircle className="mx-auto mb-2 h-5 w-5" />}{label}</div>;
}

function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/70 p-4" dir="rtl"><div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between gap-3"><h2 className="font-black">{title}</h2><button type="button" onClick={onClose} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold">إغلاق</button></div><div className="mt-4">{children}</div></div></div>;
}
