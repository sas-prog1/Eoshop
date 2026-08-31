import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowDown, ArrowUp, Copy, Image, Loader2, Plus, Trash2, Upload } from "lucide-react";
import type { StoreAssetUpload } from "../../adapters/uiAdapters";
import type { StorefrontMarketingBlock, StorefrontMarketingPlacement } from "../../contracts/storefrontMarketingBlocks";
import { uiErrorMessage } from "../../contracts/uiError";
import type { StoreConfig } from "../../types";
import { randomUuid } from "../../utils/randomUuid";

interface Props {
  config: StoreConfig;
  activeTenantId: string | null;
  mediaOwnerKey: string | null;
  onChange: (key: keyof StoreConfig, value: unknown) => void;
  uploadAsset: (tenantId: string, file: File, signal?: AbortSignal) => Promise<StoreAssetUpload>;
}

type EditablePlacement = Extract<StorefrontMarketingPlacement, "editorial_story" | "discovery">;
type ImageField = "imageUrl" | "mobileImageUrl";

const GROUPS: Array<{ placement: EditablePlacement; title: string; help: string; limit: number }> = [
  { placement: "editorial_story", title: "قصص الموسم", help: "بطاقات عمودية مستقلة؛ يبرز القالب البطاقة الوسطى تلقائيًا.", limit: 5 },
  { placement: "discovery", title: "مختارات المحرر", help: "صور اكتشاف مستقلة بلا سعر أو زر سلة.", limit: 10 },
];

const FILE_LIMITS: Record<EditablePlacement, Record<ImageField, number>> = {
  editorial_story: { imageUrl: 900 * 1024, mobileImageUrl: 500 * 1024 },
  discovery: { imageUrl: 350 * 1024, mobileImageUrl: 350 * 1024 },
};

function placementBlocks(config: StoreConfig, placement: EditablePlacement): StorefrontMarketingBlock[] {
  return (config.marketingBlocks ?? [])
    .filter((block) => block.placement === placement)
    .sort((left, right) => left.position - right.position);
}

function statusLabel(block: StorefrontMarketingBlock, now = Date.now()): string {
  if (!block.enabled) return "معطلة";
  if (block.startsAt && Date.parse(block.startsAt) > now) return "مجدولة";
  if (block.endsAt && Date.parse(block.endsAt) <= now) return "منتهية";
  return "نشطة";
}

export default function MerchantMarketingBlocksEditor({ config, activeTenantId, mediaOwnerKey, onChange, uploadAsset }: Props) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uploadRef = useRef<AbortController | null>(null);

  useEffect(() => {
    uploadRef.current?.abort();
    uploadRef.current = null;
    setUploading(null);
    setError(null);
    return () => uploadRef.current?.abort();
  }, [activeTenantId, mediaOwnerKey]);

  const replacePlacement = (placement: EditablePlacement, next: StorefrontMarketingBlock[]) => {
    const retained = (config.marketingBlocks ?? []).filter((block) => block.placement !== placement);
    onChange("marketingBlocks", [
      ...retained,
      ...next.map((block, index) => ({ ...block, placement, position: index + 1 })),
    ]);
  };

  const patchBlock = (placement: EditablePlacement, id: string, patch: Partial<StorefrontMarketingBlock>) => {
    replacePlacement(placement, placementBlocks(config, placement).map((block) => block.id === id ? { ...block, ...patch } : block));
  };

  const addBlock = (placement: EditablePlacement) => {
    const blocks = placementBlocks(config, placement);
    const limit = GROUPS.find((group) => group.placement === placement)?.limit ?? 0;
    if (blocks.length >= limit) return;
    replacePlacement(placement, [...blocks, {
      id: randomUuid(),
      placement,
      position: blocks.length + 1,
      enabled: false,
      contentType: "campaign",
      title: placement === "editorial_story" ? "قصة جديدة" : "مختار جديد",
      ctaLabel: "استكشف الآن",
      imageUrl: "",
      altText: "أضف وصفًا دقيقًا للصورة",
      targetType: "products",
      disclosure: "none",
    }]);
  };

  const moveBlock = (placement: EditablePlacement, index: number, direction: -1 | 1) => {
    const blocks = placementBlocks(config, placement);
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    replacePlacement(placement, blocks);
  };

  const duplicateBlock = (placement: EditablePlacement, block: StorefrontMarketingBlock) => {
    const blocks = placementBlocks(config, placement);
    const limit = GROUPS.find((group) => group.placement === placement)?.limit ?? 0;
    if (blocks.length >= limit) return;
    const index = blocks.findIndex((candidate) => candidate.id === block.id);
    blocks.splice(index + 1, 0, { ...block, id: randomUuid(), enabled: false, title: `${block.title} — نسخة` });
    replacePlacement(placement, blocks);
  };

  const handleUpload = async (placement: EditablePlacement, block: StorefrontMarketingBlock, field: ImageField, file?: File) => {
    if (!file) return;
    if (!activeTenantId) {
      setError("يصبح رفع صور القصص متاحًا بعد إنشاء المتجر وحفظه على الخادم.");
      return;
    }
    const limit = FILE_LIMITS[placement][field];
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size <= 0 || file.size > limit) {
      setError(`استخدم JPEG أو PNG أو WebP بحجم لا يتجاوز ${Math.round(limit / 1024)} كيلوبايت لهذه الخانة.`);
      return;
    }
    uploadRef.current?.abort();
    const controller = new AbortController();
    uploadRef.current = controller;
    const key = `${block.id}:${field}`;
    setUploading(key);
    setError(null);
    try {
      const asset = await uploadAsset(activeTenantId, file, controller.signal);
      if (!controller.signal.aborted) patchBlock(placement, block.id, { [field]: asset.url });
    } catch (uploadError) {
      if (!controller.signal.aborted) setError(uiErrorMessage(uploadError, "تعذر رفع صورة المساحة. حاول مرة أخرى."));
    } finally {
      if (uploadRef.current === controller) uploadRef.current = null;
      if (!controller.signal.aborted) setUploading(null);
    }
  };

  if (config.themeStyle !== "elegant") {
    return <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs font-bold leading-6 text-sky-900">محتوى Elegant محفوظ ولن يُحذف. اختر القالب الأنيق لتعديل قصص الموسم ومختارات المحرر.</div>;
  }

  const categories = Array.from(new Set(config.products.filter((product) => product.status === "published").map((product) => product.category.trim()).filter(Boolean)));
  const products = config.products.filter((product) => product.status === "published");

  return (
    <div className="space-y-6">
      <header><h3 className="text-base font-black text-slate-900">القصص والمختارات</h3><p className="mt-1 text-xs leading-6 text-slate-500">كل صورة مساحة مستقلة تُرفع وتُرتب وتفتح هدفًا حقيقيًا. لا تُحفظ الأسعار داخل هذه المساحات.</p></header>
      {error && <div role="alert" className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
      {GROUPS.map(({ placement, title, help, limit }) => {
        const blocks = placementBlocks(config, placement);
        return (
          <section key={placement} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4" aria-labelledby={`marketing-${placement}`}>
            <div className="flex items-start justify-between gap-3">
              <div><h4 id={`marketing-${placement}`} className="text-sm font-black text-slate-900">{title}</h4><p className="mt-1 text-[11px] leading-5 text-slate-500">{help} ({blocks.length}/{limit})</p></div>
              <button type="button" disabled={blocks.length >= limit} onClick={() => addBlock(placement)} className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-slate-900 px-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-4 w-4" /> إضافة</button>
            </div>
            {blocks.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-xs font-bold text-slate-500">لا توجد مساحات في هذه المجموعة بعد.</div> : null}
            {blocks.map((block, index) => (
              <details key={block.id} className="rounded-2xl border border-slate-200 bg-white p-3" open={index === 0}>
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">{block.imageUrl ? <img src={block.imageUrl} alt="" className="h-full w-full object-cover" /> : <Image className="h-4 w-4 text-slate-400" />}</span>
                  <span className="min-w-0 flex-1"><strong className="block truncate text-xs text-slate-900">{index + 1}. {block.title}</strong><small className="text-[10px] font-bold text-slate-500">{statusLabel(block)}</small></span>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-black ${block.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{block.enabled ? "ظاهرة" : "مخفية"}</span>
                </summary>
                <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" role="switch" aria-checked={block.enabled} onClick={() => patchBlock(placement, block.id, { enabled: !block.enabled })} className="rounded-lg bg-slate-100 px-3 py-2 text-[11px] font-black">{block.enabled ? "تعطيل" : "تفعيل"}</button>
                    <button type="button" aria-label={`نقل ${block.title} للأعلى`} disabled={index === 0} onClick={() => moveBlock(placement, index, -1)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" aria-label={`نقل ${block.title} للأسفل`} disabled={index === blocks.length - 1} onClick={() => moveBlock(placement, index, 1)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                    <button type="button" aria-label={`نسخ ${block.title}`} disabled={blocks.length >= limit} onClick={() => duplicateBlock(placement, block)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-30"><Copy className="h-4 w-4" /></button>
                    <button type="button" aria-label={`حذف ${block.title}`} onClick={() => replacePlacement(placement, blocks.filter((candidate) => candidate.id !== block.id))} className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1"><span className="text-[11px] font-bold text-slate-600">العنوان</span><input value={block.title} maxLength={80} onChange={(event) => patchBlock(placement, block.id, { title: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" /></label>
                    <label className="space-y-1"><span className="text-[11px] font-bold text-slate-600">نص الزر</span><input value={block.ctaLabel} maxLength={40} onChange={(event) => patchBlock(placement, block.id, { ctaLabel: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" /></label>
                  </div>
                  <label className="block space-y-1"><span className="text-[11px] font-bold text-slate-600">الوصف المساند</span><textarea value={block.subtitle ?? ""} maxLength={180} rows={2} onChange={(event) => patchBlock(placement, block.id, { subtitle: event.target.value || undefined })} className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-xs" /></label>
                  <label className="block space-y-1"><span className="text-[11px] font-bold text-slate-600">وصف الصورة لذوي الإعاقة</span><input value={block.altText} maxLength={160} onChange={(event) => patchBlock(placement, block.id, { altText: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" /></label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(["imageUrl", "mobileImageUrl"] as const).map((field) => <label key={field} className={`relative flex min-h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 text-xs font-black ${activeTenantId ? "cursor-pointer bg-white" : "cursor-not-allowed bg-slate-100 text-slate-400"}`}>{uploading === `${block.id}:${field}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{field === "imageUrl" ? "رفع الصورة الأساسية" : "رفع صورة الجوال"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={!activeTenantId || Boolean(uploading)} className="absolute inset-0 opacity-0" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void handleUpload(placement, block, field, file); }} /></label>)}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1"><span className="text-[11px] font-bold text-slate-600">الهدف</span><select value={block.targetType} onChange={(event) => { const targetType = event.target.value as StorefrontMarketingBlock["targetType"]; patchBlock(placement, block.id, { targetType, targetValue: targetType === "products" ? undefined : "", contentType: targetType === "external" ? "campaign" : block.contentType, disclosure: targetType === "external" && block.disclosure === "none" ? "sponsored" : block.disclosure }); }} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"><option value="products">كل المنتجات</option><option value="category">تصنيف</option><option value="product">منتج</option><option value="external">رابط راعٍ خارجي</option></select></label>
                    {block.targetType === "category" ? <label className="space-y-1"><span className="text-[11px] font-bold text-slate-600">التصنيف</span><select value={block.targetValue ?? ""} onChange={(event) => patchBlock(placement, block.id, { targetValue: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"><option value="">اختر</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label> : null}
                    {block.targetType === "product" ? <label className="space-y-1"><span className="text-[11px] font-bold text-slate-600">المنتج</span><select value={block.targetValue ?? ""} onChange={(event) => patchBlock(placement, block.id, { targetValue: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"><option value="">اختر</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label> : null}
                    {block.targetType === "external" ? <label className="space-y-1"><span className="text-[11px] font-bold text-slate-600">رابط HTTPS</span><input dir="ltr" type="url" value={block.targetValue ?? ""} onChange={(event) => patchBlock(placement, block.id, { targetValue: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" /></label> : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="space-y-1"><span className="text-[11px] font-bold text-slate-600">الإفصاح</span><select value={block.disclosure} onChange={(event) => patchBlock(placement, block.id, { disclosure: event.target.value as StorefrontMarketingBlock["disclosure"] })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"><option value="none">لا يوجد</option><option value="ad">إعلان</option><option value="sponsored">برعاية</option></select></label>
                    <label className="space-y-1"><span className="text-[11px] font-bold text-slate-600">اسم الراعي</span><input value={block.sponsorName ?? ""} maxLength={80} onChange={(event) => patchBlock(placement, block.id, { sponsorName: event.target.value || undefined })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" /></label>
                    <label className="space-y-1"><span className="text-[11px] font-bold text-slate-600">الشارة</span><input value={block.badge ?? ""} maxLength={40} onChange={(event) => patchBlock(placement, block.id, { badge: event.target.value || undefined })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" /></label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="space-y-1"><span className="text-[11px] font-bold text-slate-600">التعتيم: {block.overlayOpacity ?? 44}%</span><input type="range" min="0" max="100" value={block.overlayOpacity ?? 44} onChange={(event) => patchBlock(placement, block.id, { overlayOpacity: Number(event.target.value) })} className="w-full" /></label>
                    <label className="space-y-1"><span className="text-[11px] font-bold text-slate-600">موضع أفقي: {block.focalPointX ?? 50}%</span><input type="range" min="0" max="100" value={block.focalPointX ?? 50} onChange={(event) => patchBlock(placement, block.id, { focalPointX: Number(event.target.value) })} className="w-full" /></label>
                    <label className="space-y-1"><span className="text-[11px] font-bold text-slate-600">موضع عمودي: {block.focalPointY ?? 50}%</span><input type="range" min="0" max="100" value={block.focalPointY ?? 50} onChange={(event) => patchBlock(placement, block.id, { focalPointY: Number(event.target.value) })} className="w-full" /></label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1"><span className="text-[11px] font-bold text-slate-600">يبدأ (UTC RFC3339)</span><input dir="ltr" value={block.startsAt ?? ""} placeholder="2026-09-01T00:00:00Z" onChange={(event) => patchBlock(placement, block.id, { startsAt: event.target.value || undefined })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" /></label><label className="space-y-1"><span className="text-[11px] font-bold text-slate-600">ينتهي (UTC RFC3339)</span><input dir="ltr" value={block.endsAt ?? ""} placeholder="2026-10-01T00:00:00Z" onChange={(event) => patchBlock(placement, block.id, { endsAt: event.target.value || undefined })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" /></label></div>
                </div>
              </details>
            ))}
          </section>
        );
      })}
    </div>
  );
}
