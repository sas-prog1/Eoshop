import React from "react";
import { CheckCircle2, Send } from "lucide-react";

interface StoreSubmissionPanelProps {
  storeName: string;
  slogan: string;
  productCount: number;
  onOpen: (() => void) | undefined;
  existingWorkspace?: boolean;
  onReturnToPortal?: (() => void | Promise<void>) | undefined;
}

export default function StoreSubmissionPanel({
  storeName,
  slogan,
  productCount,
  onOpen,
  existingWorkspace = false,
  onReturnToPortal,
}: StoreSubmissionPanelProps) {
  const action = existingWorkspace ? onReturnToPortal : onOpen;

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
        <h4 className="flex items-center gap-2 text-sm font-black text-slate-950"><CheckCircle2 className="h-5 w-5 text-sky-700" /> {existingWorkspace ? "حفظ المتجر والعودة" : "مراجعة المتجر والنشر"}</h4>
        <p className="mt-2 text-xs leading-relaxed text-slate-700">{existingWorkspace ? "راجع التغييرات في المعاينة ثم احفظها. ستدير حالة النشر والرابط العام من مساحة التاجر." : "راجع محتوى المتجر ومنتجاته أولًا. عند المتابعة ستختار عنوانًا متاحًا وباقة، ثم ترسل الطلب إلى دورة المراجعة والنشر المحمية."}</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">ملخص التصميم الحالي</span>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div>
            <h5 className="text-sm font-extrabold text-slate-900">{storeName}</h5>
            <p className="text-xs text-slate-500">{slogan}</p>
          </div>
          <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-bold text-sky-800">{productCount} منتج</span>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-700">{existingWorkspace ? "الحفظ يحدّث مساحة العمل فقط ولا يغيّر حالة النشر تلقائيًا." : "تُدار مستندات التحقق ضمن دورة إنشاء المتجر عند الحاجة. المعاينة ليست نشرًا؛ ستظهر للعملاء النسخة التي تعتمدها المنصة فقط."}</div>
      <button type="button" onClick={() => void action?.()} disabled={!action} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-3 text-sm font-extrabold text-white shadow-md transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
        <Send className="h-5 w-5 text-sky-300" /> {existingWorkspace ? "حفظ والعودة إلى مساحة التاجر" : "اختيار العنوان والباقة"}
      </button>
    </div>
  );
}
