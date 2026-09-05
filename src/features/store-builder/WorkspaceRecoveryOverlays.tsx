import type { StoreWorkspace } from "../../adapters/uiAdapters";
import type { StoreConfig } from "../../types";
import type { WorkspaceConflictReviewState, WorkspaceConflictState } from "../../workflows/merchantWorkspaceState";

interface WorkspaceRecoveryOverlaysProps {
  activeWorkspace: StoreWorkspace | null;
  conflict: WorkspaceConflictState | null;
  conflictReview: WorkspaceConflictReviewState | null;
  localDraft: StoreConfig | null;
  loading: boolean;
  saving: boolean;
  reloadWorkspace: (discardChanges: boolean) => void;
  applyNonConflictingChanges: () => void;
  archiveConflictDraft: () => void;
  discardConflictReview: () => void;
  importLocalDraft: (draft: StoreConfig) => void;
  discardLocalDraft: () => void;
}

export default function WorkspaceRecoveryOverlays({
  activeWorkspace,
  conflict,
  conflictReview,
  localDraft,
  loading,
  saving,
  reloadWorkspace,
  applyNonConflictingChanges,
  archiveConflictDraft,
  discardConflictReview,
  importLocalDraft,
  discardLocalDraft,
}: WorkspaceRecoveryOverlaysProps) {
  if (!activeWorkspace) return null;

  return (
    <>
      {conflict && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md rounded-2xl border border-rose-300 bg-white p-4 shadow-2xl">
          <p className="text-sm font-black text-slate-900">تعارضت تعديلاتك مع نسخة أحدث</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            جمّدنا المحرر واحتفظنا بلقطة تعديلاتك. حمّل نسخة الخادم، وسنعيد فقط الحقول غير المتعارضة؛ الحقول التي عدّلها الطرفان تبقى كما هي على الخادم حتى تراجعها يدويًا.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading || saving}
              onClick={() => reloadWorkspace(false)}
              className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              تحميل نسخة الخادم
            </button>
            <button
              type="button"
              disabled={!conflict.serverReloaded || loading || saving}
              onClick={applyNonConflictingChanges}
              className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-800 disabled:opacity-40"
            >
              تطبيق التغييرات الآمنة
            </button>
            <button
              type="button"
              disabled={loading || saving}
              onClick={() => reloadWorkspace(true)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-50"
            >
              تجاهل تعديلاتي
            </button>
          </div>
        </div>
      )}

      {conflictReview?.tenantId === activeWorkspace.tenantId && (
        <div className="fixed bottom-5 right-5 z-50 max-h-[70vh] w-[min(34rem,calc(100vw-2rem))] overflow-auto rounded-2xl border border-amber-300 bg-white p-4 shadow-2xl">
          <p className="text-sm font-black text-slate-900">قيم تحتاج مراجعة يدوية</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            طبّقنا الحقول الآمنة فقط. الحقول التالية عدّلها الطرفان، لذلك أبقينا قيمة الخادم في المحرر واحتفظنا بقيمتك هنا دون إرسال تلقائي.
          </p>
          <div className="mt-3 space-y-3">
            {conflictReview.conflictingFields.map((field) => (
              <div key={String(field)} className="rounded-xl border border-slate-200 p-3 text-xs">
                <p className="font-black text-slate-800">{String(field)}</p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <div>
                    <p className="mb-1 font-bold text-amber-700">نسختك المحلية</p>
                    <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-amber-50 p-2 text-[10px]">
                      {JSON.stringify(conflictReview.draft[field], null, 2)}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-1 font-bold text-sky-700">النسخة المحفوظة على الخادم</p>
                    <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-sky-50 p-2 text-[10px]">
                      {JSON.stringify(conflictReview.server[field], null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={archiveConflictDraft} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white">
              حفظ لقطتي كمسودة محلية
            </button>
            <button type="button" onClick={discardConflictReview} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">
              الاحتفاظ بنسخة الخادم
            </button>
          </div>
        </div>
      )}

      {localDraft && (
        <div className="fixed bottom-5 left-5 z-50 max-w-md rounded-2xl border border-amber-300 bg-white p-4 shadow-2xl">
          <p className="text-sm font-black text-slate-900">توجد مسودة محلية غير مطبّقة</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            بيانات الخادم معروضة الآن. لن نستبدلها بالمسودة إلا بعد اختيارك الصريح.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={saving || loading || conflict !== null}
              onClick={() => importLocalDraft(localDraft)}
              className="rounded-lg bg-sky-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              تطبيق المسودة في المحرر
            </button>
            <button type="button" onClick={discardLocalDraft} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">
              تجاهل المسودة
            </button>
          </div>
        </div>
      )}
    </>
  );
}
