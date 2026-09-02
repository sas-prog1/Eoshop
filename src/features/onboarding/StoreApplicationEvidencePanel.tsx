import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, Download, FileText, RefreshCw, UploadCloud } from "lucide-react";
import { isUiError, uiErrorMessage, type StoreApplicationDossier } from "../../adapters/uiAdapters";

interface StoreApplicationEvidencePanelProps {
  application: StoreApplicationDossier;
  disabled?: boolean;
  onUploadEvidence: (requirementKey: string, file: File, signal: AbortSignal) => Promise<StoreApplicationDossier>;
  onDeclareExemption: (requirementKey: string, reason: string, signal: AbortSignal) => Promise<StoreApplicationDossier>;
  onApplicationChanged: (application: StoreApplicationDossier) => void;
  onBusyChange?: (busy: boolean) => void;
  onReloadDraft?: () => Promise<void>;
  onSessionExpired?: () => void;
}

const allowedDocumentTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const maxDocumentBytes = 5 * 1024 * 1024;

function validateDocument(file: File): string | null {
  if (!allowedDocumentTypes.has(file.type)) return "صيغة الملف غير مدعومة. استخدم PDF أو JPG أو PNG.";
  if (file.size > maxDocumentBytes) return "حجم الملف أكبر من 5 ميجابايت. اختر ملفًا أصغر.";
  return null;
}

function formatBytes(value: number | null): string {
  if (value === null) return "";
  if (value < 1024) return `${value.toLocaleString("ar-SA")} بايت`;
  if (value < 1024 * 1024) return `${(value / 1024).toLocaleString("ar-SA", { maximumFractionDigits: 1 })} كيلوبايت`;
  return `${(value / (1024 * 1024)).toLocaleString("ar-SA", { maximumFractionDigits: 1 })} ميجابايت`;
}

const reviewStatusLabel = {
  pending: "بانتظار مراجعة المنصة",
  accepted: "مقبول",
  rejected: "مرفوض — استبدل المستند",
} as const;

export default function StoreApplicationEvidencePanel({
  application,
  disabled = false,
  onUploadEvidence,
  onDeclareExemption,
  onApplicationChanged,
  onBusyChange,
  onReloadDraft,
  onSessionExpired,
}: StoreApplicationEvidencePanelProps) {
  const [busyRequirement, setBusyRequirement] = useState<string | null>(null);
  const [exemptionReasons, setExemptionReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const operationSequence = useRef(0);
  const operationController = useRef<AbortController | null>(null);
  const busyCallback = useRef(onBusyChange);

  useEffect(() => {
    busyCallback.current = onBusyChange;
  }, [onBusyChange]);

  useEffect(() => () => {
    operationController.current?.abort();
    operationSequence.current += 1;
    busyCallback.current?.(false);
  }, []);

  const setBusy = (requirementKey: string | null) => {
    setBusyRequirement(requirementKey);
    busyCallback.current?.(requirementKey !== null);
  };

  const beginOperation = (requirementKey: string) => {
    operationController.current?.abort();
    const controller = new AbortController();
    operationController.current = controller;
    setError("");
    setConflict(false);
    setBusy(requirementKey);
    return { controller, sequence: ++operationSequence.current };
  };

  const finishOperation = (sequence: number) => {
    if (sequence !== operationSequence.current) return;
    operationController.current = null;
    setBusy(null);
  };

  const handleFailure = (caught: unknown, fallback: string, sequence: number) => {
    if (sequence !== operationSequence.current || isUiError(caught, "aborted")) return;
    if (isUiError(caught, "unauthenticated") && onSessionExpired) {
      onSessionExpired();
      return;
    }
    setError(uiErrorMessage(caught, fallback));
    setConflict(isUiError(caught, "conflict"));
  };

  const uploadEvidence = async (requirementKey: string, file: File) => {
    const validationError = validateDocument(file);
    if (validationError) {
      setError(validationError);
      setConflict(false);
      return;
    }
    const { controller, sequence } = beginOperation(requirementKey);
    try {
      const next = await onUploadEvidence(requirementKey, file, controller.signal);
      if (sequence === operationSequence.current) onApplicationChanged(next);
    } catch (caught) {
      handleFailure(caught, "تعذر رفع المستند. حاول مرة أخرى.", sequence);
    } finally {
      finishOperation(sequence);
    }
  };

  const declareExemption = async (requirementKey: string) => {
    const reason = exemptionReasons[requirementKey]?.trim() ?? "";
    if (reason.length < 10) {
      setError("اكتب سبب إعفاء واضحًا من 10 أحرف على الأقل.");
      setConflict(false);
      return;
    }
    const { controller, sequence } = beginOperation(requirementKey);
    try {
      const next = await onDeclareExemption(requirementKey, reason, controller.signal);
      if (sequence === operationSequence.current) onApplicationChanged(next);
    } catch (caught) {
      handleFailure(caught, "تعذر تسجيل إفادة الإعفاء.", sequence);
    } finally {
      finishOperation(sequence);
    }
  };

  const reloadDraft = async () => {
    if (!onReloadDraft) return;
    const { sequence } = beginOperation("reload");
    try {
      await onReloadDraft();
      if (sequence === operationSequence.current) {
        setError("");
        setConflict(false);
      }
    } catch (caught) {
      handleFailure(caught, "تعذر تحميل أحدث نسخة من الطلب.", sequence);
    } finally {
      finishOperation(sequence);
    }
  };

  return (
    <section aria-labelledby="store-application-evidence-title" className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="store-application-evidence-title" className="flex items-center gap-2 text-sm font-black text-slate-950"><FileText className="h-5 w-5 text-indigo-600" /> وثائق طلب المتجر</h2>
          <p className="mt-1 text-xs leading-6 text-slate-600">المتطلبات يحددها الخادم حسب نوع النشاط. الملفات خاصة ولا تظهر في المتجر العام.</p>
          <p className="text-[11px] font-bold text-slate-500">الصيغ المدعومة: PDF وJPG وPNG — الحد الأقصى 5 ميجابايت للملف.</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-black ${application.ready ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          {application.ready ? "ملف الطلب مكتمل" : `${application.blockers.length} متطلب غير مكتمل`}
        </span>
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
          <span className="flex items-start gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{error}</span>
          {conflict && onReloadDraft && <button type="button" disabled={busyRequirement !== null} onClick={() => void reloadDraft()} className="rounded-xl border border-rose-300 bg-white px-3 py-2 text-rose-800 disabled:opacity-50">تحميل أحدث نسخة</button>}
        </div>
      )}

      {application.correctionRequest && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950">
          <p className="font-black">طلب استكمال من إدارة المنصة</p>
          <p className="mt-2 leading-6">{application.correctionRequest.reason}</p>
          <div className="mt-3 flex flex-wrap gap-2">{application.correctionRequest.requestedFieldLabels.map((label) => <span key={label} className="rounded-full bg-white px-3 py-1 font-bold">{label}</span>)}</div>
        </div>
      )}

      <div className="space-y-3">
        {application.requirements.length === 0 && <p className="rounded-2xl border border-emerald-200 bg-white p-4 text-xs font-bold text-emerald-800">لا توجد وثائق إضافية مطلوبة لهذا النشاط.</p>}
        {application.requirements.map((requirement) => {
          const evidence = requirement.evidence;
          const evidenceAccepted = evidence?.reviewStatus === "accepted";
          const evidenceRejected = evidence?.reviewStatus === "rejected";
          return (
            <article key={requirement.key} className={`rounded-2xl border bg-white p-4 ${evidenceRejected ? "border-rose-200" : requirement.resolved ? "border-emerald-200" : "border-slate-200"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="flex items-center gap-2 text-sm font-black text-slate-900">{requirement.resolved && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}{requirement.label}</h3>
                  <p className="mt-1 text-xs leading-6 text-slate-500">{requirement.description}</p>
                  {evidence && (
                    <div className={`mt-2 text-[11px] font-bold ${evidenceRejected ? "text-rose-700" : evidenceAccepted ? "text-emerald-700" : "text-sky-700"}`}>
                      <p>{evidence.resolution === "uploaded" ? `مرفوع: ${evidence.originalName ?? "مستند"}${evidence.byteSize === null ? "" : ` (${formatBytes(evidence.byteSize)})`}` : "تم تسجيل إفادة إعفاء صريحة"}</p>
                      <p className="mt-1">{reviewStatusLabel[evidence.reviewStatus]}</p>
                      {evidence.downloadUrl && <a href={evidence.downloadUrl} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-current px-2 py-1" target="_blank" rel="noreferrer"><Download className="h-3.5 w-3.5" />تنزيل النسخة المرفوعة</a>}
                    </div>
                  )}
                </div>
                <label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white ${disabled || busyRequirement !== null ? "pointer-events-none opacity-50" : ""}`}>
                  {busyRequirement === requirement.key ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                  {evidence?.resolution === "uploaded" ? "استبدال المستند" : "رفع المستند"}
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    aria-label={`رفع مستند ${requirement.label}`}
                    className="sr-only"
                    disabled={disabled || busyRequirement !== null}
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      event.currentTarget.value = "";
                      if (file) void uploadEvidence(requirement.key, file);
                    }}
                  />
                </label>
              </div>
              {requirement.allowExemption && (
                <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-[1fr_auto]">
                  <label className="sr-only" htmlFor={`exemption-${requirement.key}`}>سبب إعفاء {requirement.label}</label>
                  <input
                    id={`exemption-${requirement.key}`}
                    value={exemptionReasons[requirement.key] ?? evidence?.exemptionReason ?? ""}
                    disabled={disabled || busyRequirement !== null}
                    onChange={(event) => setExemptionReasons((current) => ({ ...current, [requirement.key]: event.target.value }))}
                    placeholder="سبب عدم توفر المستند حاليًا (إفادة صريحة)"
                    maxLength={1000}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-amber-500 disabled:bg-slate-100"
                  />
                  <button type="button" disabled={disabled || busyRequirement !== null} onClick={() => void declareExemption(requirement.key)} className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-black text-amber-900 disabled:opacity-50">تسجيل الإعفاء</button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <div className="rounded-2xl bg-white p-4">
        <h3 className="text-xs font-black text-slate-900">سجل الطلب</h3>
        {application.timeline.length === 0
          ? <p className="mt-3 text-[11px] text-slate-500">لا توجد أحداث مسجلة بعد.</p>
          : <ol className="mt-3 space-y-2">{application.timeline.slice(-5).reverse().map((item) => <li key={item.id} className="flex items-start gap-2 text-[11px] leading-5 text-slate-600"><Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" /><span>{item.message}</span></li>)}</ol>}
      </div>
    </section>
  );
}
