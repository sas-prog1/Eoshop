import React, { useEffect, useRef, useState } from "react";
import { Image, RefreshCw, Upload } from "lucide-react";
import { isUiError, uiErrorMessage, type PlatformAssetPurpose, type UiAdapters } from "../../adapters/uiAdapters";
import { randomUuid } from "../../utils/randomUuid";

const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
const maxBytes = 5 * 1024 * 1024;

export interface PlatformImageDimensions { width: number; height: number }

export function validPlatformImageFile(file: File, dimensions: PlatformImageDimensions): string | null {
  if (!allowedTypes.includes(file.type) || file.size <= 0 || file.size > maxBytes) {
    return "اختر صورة JPEG أو PNG أو WebP بحجم لا يتجاوز 5 MiB.";
  }
  if (dimensions.width < 320 || dimensions.height < 180 || dimensions.width > 6000 || dimensions.height > 6000
    || dimensions.width * dimensions.height > 25_000_000) {
    return "يجب أن تكون الأبعاد بين 320×180 و6000×6000 وألا تتجاوز 25 مليون بكسل.";
  }
  return null;
}

function loadDimensions(url: string): Promise<PlatformImageDimensions> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("invalid-image"));
    image.src = url;
  });
}

interface Props {
  administration: UiAdapters["administration"];
  purpose: PlatformAssetPurpose;
  label: string;
  value: string | null;
  committedValue: string | null;
  placeholder: string;
  disabled: boolean;
  invalid: boolean;
  onChange: (value: string | null) => void;
  onPreviewChange: (value: string | null) => void;
}

export default function PlatformIdentityAssetField({ administration, purpose, label, value, committedValue, placeholder, disabled, invalid, onChange, onPreviewChange }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const mounted = useRef(true);
  const previewRef = useRef<string | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => () => {
    mounted.current = false;
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  useEffect(() => {
    if (!previewRef.current || value !== committedValue) return;
    URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    idempotencyKeyRef.current = null;
    setPreviewUrl(null);
    onPreviewChange(null);
  }, [committedValue, onPreviewChange, value]);

  const choose = async (next: File | undefined) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    idempotencyKeyRef.current = null;
    onPreviewChange(null);
    setFile(null);
    setPreviewUrl(null);
    setError(null);
    if (!next) return;
    if (!allowedTypes.includes(next.type) || next.size <= 0 || next.size > maxBytes) {
      setError("اختر صورة JPEG أو PNG أو WebP بحجم لا يتجاوز 5 MiB.");
      return;
    }
    const objectUrl = URL.createObjectURL(next);
    try {
      const dimensions = await loadDimensions(objectUrl);
      const validation = validPlatformImageFile(next, dimensions);
      if (validation) {
        URL.revokeObjectURL(objectUrl);
        setError(validation);
        return;
      }
      if (mounted.current) {
        setFile(next);
        setPreviewUrl(objectUrl);
        previewRef.current = objectUrl;
        onPreviewChange(objectUrl);
      }
    } catch {
      URL.revokeObjectURL(objectUrl);
      if (mounted.current) setError("تعذر قراءة الصورة المختارة. اختر ملف صورة صالحًا.");
    }
  };

  const upload = async () => {
    if (!file || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const idempotencyKey = idempotencyKeyRef.current ?? randomUuid();
      idempotencyKeyRef.current = idempotencyKey;
      const asset = await administration.uploadPlatformAsset(purpose, file, { idempotencyKey });
      if (!mounted.current) return;
      onChange(asset.url);
      setFile(null);
    } catch (caught) {
      if (!mounted.current) return;
      setError(uiErrorMessage(caught, "تعذر رفع الصورة. يمكنك إعادة المحاولة."));
      if (isUiError(caught, "unauthenticated") || isUiError(caught, "forbidden")) setFile(null);
    } finally {
      if (mounted.current) setUploading(false);
    }
  };

  const changeUrl = (next: string | null) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    idempotencyKeyRef.current = null;
    setPreviewUrl(null);
    setFile(null);
    onPreviewChange(null);
    onChange(next);
  };

  return (
    <div className="space-y-2 rounded-2xl border border-slate-200 p-3">
      <label className="block text-xs font-bold">
        <span className="flex items-center gap-2"><Image className="h-4 w-4" />{label}</span>
        <input aria-label={`رابط ${label}`} dir="ltr" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" value={value ?? ""} maxLength={2048} onChange={(event) => changeUrl(event.target.value || null)} placeholder={placeholder} />
      </label>
      <label className="block cursor-pointer rounded-xl border border-dashed border-sky-300 bg-sky-50 px-3 py-2 text-center text-xs font-bold text-sky-800">
        اختر صورة من الجهاز
        <input aria-label={`رفع ${label} من الجهاز`} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled || uploading} onChange={(event) => void choose(event.target.files?.[0])} />
      </label>
      {previewUrl && <img src={previewUrl} alt={`معاينة ${label} قبل الحفظ`} className="h-32 w-full rounded-xl object-cover" />}
      {file && <button type="button" disabled={disabled || uploading} onClick={() => void upload()} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-sky-700 px-3 py-2 text-xs font-black text-white disabled:opacity-50">{uploading ? <RefreshCw className="h-4 w-4 animate-spin" /> : error ? <RefreshCw className="h-4 w-4" /> : <Upload className="h-4 w-4" />}{uploading ? "جارٍ الرفع..." : error ? "إعادة محاولة الرفع" : "رفع واستخدام الأصل"}</button>}
      {error && <p role="alert" className="text-xs font-bold text-rose-700">{error}</p>}
      {invalid && <p className="text-xs font-bold text-rose-700">رابط {label} غير آمن؛ استخدم أصل منصة مُدارًا أو HTTPS خارجيًا دون بيانات دخول أو fragment.</p>}
      <p className="text-[10px] leading-5 text-slate-500">JPEG/PNG/WebP، حتى 5 MiB، من 320×180 إلى 6000×6000. الرفع يجهز الأصل؛ زر حفظ الإعدادات يطبقه على المنصة.</p>
    </div>
  );
}
