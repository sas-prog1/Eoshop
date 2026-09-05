import React from "react";
import { CheckCircle2, FileCheck2, Monitor, Smartphone } from "lucide-react";
import type { PreviewDevice } from "./controlPanelTypes";

interface PreviewDeviceSelectorProps {
  device: PreviewDevice;
  onChange: (device: PreviewDevice) => void;
}

export function PreviewDeviceSelector({ device, onChange }: PreviewDeviceSelectorProps) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
      <div>
        <h3 className="text-xs font-black text-slate-900">عرض المعاينة</h3>
        <p className="mt-0.5 hidden text-[10px] font-medium text-slate-500 sm:block">بدّل المقاس دون التأثير على المتجر المنشور.</p>
      </div>
      <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100 p-1" role="group" aria-label="مقاس المعاينة">
        <button
          type="button"
          onClick={() => onChange("desktop")}
          aria-pressed={device === "desktop"}
          className={`px-3.5 py-2 min-h-[40px] rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition touch-manipulation cursor-pointer active:scale-95 ${
            device === "desktop" ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-950"
          }`}
        >
          <Monitor className="w-4 h-4" />
          <span>سطح المكتب</span>
        </button>
        <button
          type="button"
          onClick={() => onChange("mobile")}
          aria-pressed={device === "mobile"}
          className={`px-3.5 py-2 min-h-[40px] rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition touch-manipulation cursor-pointer active:scale-95 ${
            device === "mobile" ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-950"
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>جوال</span>
        </button>
      </div>
    </div>
  );
}

interface CustomizationCompletionBarProps {
  onComplete: () => void;
  existingWorkspace?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

export function CustomizationCompletionBar({
  onComplete,
  existingWorkspace = false,
  disabled = false,
  loading = false,
}: CustomizationCompletionBarProps) {
  const helper = existingWorkspace ? "احفظ آخر التعديلات وارجع إلى مساحة التاجر." : "احفظ الإعدادات ثم اختر عنوان المتجر.";
  const label = loading ? "جارٍ الحفظ…" : existingWorkspace ? "حفظ والعودة" : "متابعة إلى العنوان";

  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 bg-white p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.05)]">
      <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-bold text-slate-600">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-sky-700" />
        <span className="line-clamp-2">{helper}</span>
      </div>
      <button
        type="button"
        onClick={onComplete}
        disabled={disabled || loading}
        className="flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-950 px-4 py-2 text-xs font-black text-white transition hover:bg-slate-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span>{label}</span>
        <FileCheck2 className="h-3.5 w-3.5 text-sky-300" />
      </button>
    </div>
  );
}
