import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowDown, ArrowUp, Eye, EyeOff, Image, LayoutList, Loader2, Megaphone, Palette, Store, Trash2, Type, Upload } from "lucide-react";
import type { StoreAssetUpload } from "../../adapters/uiAdapters";
import { uiErrorMessage } from "../../contracts/uiError";
import type { StoreConfig } from "../../types";
import { STOREFRONT_SECTION_LABELS, storefrontSectionsOrDefault } from "../../contracts/storefrontSections";
import MerchantMarketingBlocksEditor from "./MerchantMarketingBlocksEditor";
import MerchantTechBentoBlocksEditor from "./MerchantTechBentoBlocksEditor";

type ProfileSection = "identity" | "appearance" | "hero" | "campaigns" | "layout";
type AssetField = "logoUrl" | "heroBannerImage" | "heroBannerMobileImage";

const ASSET_LIMITS: Record<AssetField, number> = {
  logoUrl: 5 * 1024 * 1024,
  heroBannerImage: 2 * 1024 * 1024,
  heroBannerMobileImage: 1024 * 1024,
};

interface MerchantStoreProfileEditorProps {
  config: StoreConfig;
  activeTenantId: string | null;
  mediaOwnerKey: string | null;
  initialSection: ProfileSection;
  onChange: (key: keyof StoreConfig, value: unknown) => void;
  uploadAsset: (tenantId: string, file: File, signal?: AbortSignal) => Promise<StoreAssetUpload>;
}

const SECTIONS: Array<{ key: ProfileSection; label: string; icon: typeof Store }> = [
  { key: "identity", label: "هوية المتجر", icon: Store },
  { key: "appearance", label: "الألوان والخط", icon: Palette },
  { key: "hero", label: "واجهة الترحيب", icon: Image },
  { key: "campaigns", label: "القصص والمختارات", icon: Megaphone },
  { key: "layout", label: "ترتيب الأقسام", icon: LayoutList },
];

const COLORS: Array<{ key: keyof StoreConfig; label: string; fallback: string }> = [
  { key: "primaryColor", label: "اللون الرئيسي", fallback: "#0F172A" },
  { key: "secondaryColor", label: "اللون الثانوي", fallback: "#334155" },
  { key: "textColor", label: "لون النص", fallback: "#334155" },
  { key: "bgColor", label: "خلفية المتجر", fallback: "#F8FAFC" },
  { key: "cardBgColor", label: "خلفية البطاقات", fallback: "#FFFFFF" },
  { key: "borderColor", label: "لون الحدود", fallback: "#E2E8F0" },
];

function isLocalPreview(value: string | undefined): boolean {
  return Boolean(value && /^(?:data|blob):/i.test(value.trim()));
}

export default function MerchantStoreProfileEditor({
  config,
  activeTenantId,
  mediaOwnerKey,
  initialSection,
  onChange,
  uploadAsset,
}: MerchantStoreProfileEditorProps) {
  const [section, setSection] = useState<ProfileSection>(initialSection);
  const [uploading, setUploading] = useState<AssetField | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const contextRef = useRef({ tenantId: activeTenantId, ownerKey: mediaOwnerKey });
  const uploadRef = useRef<{ controller: AbortController; generation: number } | null>(null);
  const generationRef = useRef(0);

  contextRef.current = { tenantId: activeTenantId, ownerKey: mediaOwnerKey };

  useEffect(() => setSection(initialSection), [initialSection]);
  useEffect(() => {
    generationRef.current += 1;
    uploadRef.current?.controller.abort();
    uploadRef.current = null;
    setUploading(null);
    setUploadError(null);

    return () => uploadRef.current?.controller.abort();
  }, [activeTenantId, mediaOwnerKey, config.logoUrl, config.heroBannerImage, config.heroBannerMobileImage]);

  const set = <Key extends keyof StoreConfig>(key: Key, value: StoreConfig[Key]) => onChange(key, value);
  const layout = storefrontSectionsOrDefault(config.homeSections);
  const moveSection = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= layout.length) return;
    const next = layout.map((item) => ({ ...item }));
    [next[index], next[target]] = [next[target], next[index]];
    set("homeSections", next);
  };
  const toggleSection = (index: number) => {
    const currentlyVisible = layout.filter((item) => item.visible).length;
    if (layout[index].visible && currentlyVisible === 1) return;
    set("homeSections", layout.map((item, itemIndex) => itemIndex === index
      ? { ...item, visible: !item.visible }
      : { ...item }));
  };
  const replaceAsset = (field: AssetField, value: string) => {
    generationRef.current += 1;
    uploadRef.current?.controller.abort();
    uploadRef.current = null;
    setUploading(null);
    setUploadError(null);
    set(field, value);
  };

  const handleUpload = async (field: AssetField, file: File | undefined, input: HTMLInputElement) => {
    input.value = "";
    if (!file) return;
    if (!activeTenantId || !mediaOwnerKey) {
      setUploadError("احفظ مسودة المتجر وأكمل اعتماده أولاً؛ الرفع من الجهاز متاح للمتاجر القائمة فقط.");
      return;
    }
    const limit = ASSET_LIMITS[field];
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size <= 0 || file.size > limit) {
      const limitLabel = limit >= 1024 * 1024 ? `${Math.round(limit / (1024 * 1024))} ميجابايت` : `${Math.round(limit / 1024)} كيلوبايت`;
      setUploadError(`استخدم صورة JPEG أو PNG أو WebP بحجم لا يتجاوز ${limitLabel} لهذه الخانة.`);
      return;
    }

    uploadRef.current?.controller.abort();
    const controller = new AbortController();
    const generation = ++generationRef.current;
    const tenantAtStart = activeTenantId;
    const ownerAtStart = mediaOwnerKey;
    uploadRef.current = { controller, generation };
    setUploading(field);
    setUploadError(null);
    try {
      const asset = await uploadAsset(tenantAtStart, file, controller.signal);
      const current = contextRef.current;
      if (controller.signal.aborted || generation !== generationRef.current
        || current.tenantId !== tenantAtStart || current.ownerKey !== ownerAtStart) return;
      set(field, asset.url);
      if (field === "logoUrl") set("logoType", "image");
      if (field === "heroBannerImage" || field === "heroBannerMobileImage") set("showHeroBanner", true);
    } catch (error) {
      if (!controller.signal.aborted && generation === generationRef.current) {
        setUploadError(uiErrorMessage(error, "تعذر رفع الصورة. حاول مرة أخرى دون مغادرة هذه الصفحة."));
      }
    } finally {
      if (generation === generationRef.current) {
        uploadRef.current = null;
        setUploading(null);
      }
    }
  };

  const publishedProducts = config.products.filter((product) => product.status === "published");
  const publishedCategories = Array.from(new Set(publishedProducts.map((product) => product.category.trim()).filter(Boolean)));
  const heroTargetType = config.heroBannerTargetType ?? "products";
  const setHeroTargetType = (targetType: NonNullable<StoreConfig["heroBannerTargetType"]>) => {
    set("heroBannerTargetType", targetType);
    set("heroBannerTargetValue", undefined);
  };

  const assetField = (field: AssetField, label: string) => {
    const value = config[field] ?? "";
    const hasSafePreview = Boolean(value) && !isLocalPreview(value);
    return (
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black text-slate-800">{label}</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">ارفع صورة مُدارة أو استخدم رابط HTTPS موثوقًا.</p>
          </div>
          <div className="flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
            {hasSafePreview ? <img src={value} alt="" className="h-full w-full object-contain" referrerPolicy="no-referrer" /> : <Image className="h-5 w-5 text-slate-300" />}
          </div>
        </div>
        <input
          type="url"
          dir="ltr"
          value={isLocalPreview(value) ? "" : value}
          onChange={(event) => replaceAsset(field, event.target.value)}
          placeholder="https://example.com/image.png"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-sky-500"
        />
        <div className="flex flex-wrap gap-2">
          <label className={`relative inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black ${activeTenantId && !uploading ? "cursor-pointer bg-slate-900 text-white" : "cursor-not-allowed bg-slate-200 text-slate-500"}`}>
            {uploading === field ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading === field ? "جارٍ الرفع..." : "رفع من الجهاز"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={!activeTenantId || Boolean(uploading)}
              className="absolute inset-0 opacity-0"
              onChange={(event) => void handleUpload(field, event.target.files?.[0], event.currentTarget)}
            />
          </label>
          {value && (
            <button type="button" onClick={() => replaceAsset(field, "")} className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">
              <Trash2 className="h-4 w-4" /> إزالة
            </button>
          )}
        </div>
        {!activeTenantId && <p className="text-[11px] font-bold text-amber-700">في مرحلة الإنشاء استخدم رابط HTTPS أو الرمز؛ الرفع يصبح متاحًا بعد إنشاء المتجر.</p>}
      </div>
    );
  };

  return (
    <div className="space-y-5" dir="rtl">
      <div className="rounded-2xl border border-slate-200 bg-white p-1.5">
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-5">
          {SECTIONS.map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" onClick={() => setSection(key)} className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[11px] font-black transition ${section === key ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      {uploadError && <div role="alert" className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700"><AlertCircle className="h-4 w-4 shrink-0" />{uploadError}</div>}

      {section === "identity" && (
        <div className="space-y-4">
          <header><h3 className="text-base font-black text-slate-900">ملف المتجر</h3><p className="mt-1 text-xs leading-5 text-slate-500">المعلومات التي يتعرف بها العميل على متجرك.</p></header>
          <label className="block space-y-1.5"><span className="text-xs font-bold text-slate-700">اسم المتجر</span><input value={config.storeName} onChange={(event) => set("storeName", event.target.value)} maxLength={255} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-500" /></label>
          <label className="block space-y-1.5"><span className="text-xs font-bold text-slate-700">الوصف المختصر</span><textarea value={config.slogan} onChange={(event) => set("slogan", event.target.value)} maxLength={500} rows={3} className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-500" /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5"><span className="text-xs font-bold text-slate-700">رقم التواصل</span><input dir="ltr" value={config.phone} onChange={(event) => set("phone", event.target.value)} maxLength={50} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-500" /></label>
            <label className="block space-y-1.5"><span className="text-xs font-bold text-slate-700">العملة</span><input value={config.currency} readOnly={Boolean(activeTenantId)} onChange={(event) => set("currency", event.target.value)} className={`w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm ${activeTenantId ? "cursor-not-allowed bg-slate-100 text-slate-500" : "bg-white"}`} /><span className="text-[10px] text-slate-500">{activeTenantId ? "تُدار عملة المتجر القائم عبر عقد الكتالوج ولا تتغير من هنا." : "يمكن تثبيتها قبل إنشاء المتجر."}</span></label>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
            <button type="button" onClick={() => { set("logoType", "icon"); replaceAsset("logoUrl", ""); }} className={`rounded-lg py-2 text-xs font-black ${config.logoType !== "image" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>رمز بسيط</button>
            <button type="button" onClick={() => set("logoType", "image")} className={`rounded-lg py-2 text-xs font-black ${config.logoType === "image" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>صورة شعار</button>
          </div>
          {config.logoType === "image" ? assetField("logoUrl", "صورة شعار المتجر") : (
            <label className="block space-y-1.5"><span className="text-xs font-bold text-slate-700">رمز الشعار</span><input value={config.logoIcon} onChange={(event) => set("logoIcon", event.target.value)} maxLength={32} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-center text-2xl outline-none focus:border-sky-500" /></label>
          )}
          <label className="block space-y-1.5"><span className="text-xs font-bold text-slate-700">حجم الشعار: {config.logoSize ?? 40}px</span><input type="range" min="24" max="120" value={config.logoSize ?? 40} onChange={(event) => set("logoSize", Number(event.target.value))} className="w-full" /></label>
        </div>
      )}

      {section === "appearance" && (
        <div className="space-y-4">
          <header><h3 className="text-base font-black text-slate-900">نظام المظهر</h3><p className="mt-1 text-xs leading-5 text-slate-500">ألوان محددة وواضحة تنعكس مباشرة على المعاينة.</p></header>
          <div className="grid grid-cols-2 gap-3">{COLORS.map(({ key, label, fallback }) => { const value = String(config[key] ?? fallback); return <label key={key} className="space-y-1.5 rounded-xl border border-slate-200 p-3"><span className="block text-[11px] font-bold text-slate-600">{label}</span><div className="flex items-center gap-2"><input type="color" value={value} onChange={(event) => onChange(key, event.target.value)} className="h-9 w-10 cursor-pointer rounded border-0 bg-transparent" /><input dir="ltr" value={value} onChange={(event) => onChange(key, event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-2 text-[11px]" /></div></label>; })}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5"><span className="text-xs font-bold text-slate-700">نمط القالب</span><select value={config.themeStyle} onChange={(event) => set("themeStyle", event.target.value as StoreConfig["themeStyle"])} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="elegant">أنيق وهادئ</option><option value="tech">حديث وتقني</option></select></label>
            <label className="space-y-1.5"><span className="text-xs font-bold text-slate-700">الخط</span><select value={config.fontFamily} onChange={(event) => set("fontFamily", event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="Cairo">Cairo</option><option value="Tajawal">Tajawal</option><option value="IBM Plex Sans Arabic">IBM Plex Sans Arabic</option></select></label>
          </div>
          <label className="block space-y-1.5"><span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700"><Type className="h-4 w-4" />شريط الإعلان</span><textarea value={config.bannerText} onChange={(event) => set("bannerText", event.target.value)} maxLength={1000} rows={3} className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>
        </div>
      )}

      {section === "hero" && (
        <div className="space-y-4">
          <header className="flex items-start justify-between gap-3"><div><h3 className="text-base font-black text-slate-900">واجهة الترحيب</h3><p className="mt-1 text-xs leading-5 text-slate-500">حرر الرسالة ووجهة زرها. يتحكم تبويب ترتيب الأقسام بظهور واجهة الترحيب كاملة.</p></div><button type="button" role="switch" aria-label="إظهار صورة واجهة الترحيب" aria-checked={config.showHeroBanner ?? false} onClick={() => set("showHeroBanner", !(config.showHeroBanner ?? false))} className={`rounded-full px-3 py-1.5 text-xs font-black ${config.showHeroBanner ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{config.showHeroBanner ? "الصورة مفعلة" : "الصورة مخفية"}</button></header>
          {config.themeStyle === "elegant" && (config.marketingBlocks ?? []).some((block) => block.placement === "editorial_story" && block.enabled) ? (
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-[11px] font-bold leading-6 text-violet-900">في قالب القصص الأنيق، صور المشهد الرئيسية تأتي من تبويب «القصص والمختارات». صورة الغلاف أدناه تبقى بديلًا آمنًا عندما لا توجد قصص مفعلة.</div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            {assetField("heroBannerImage", "صورة الغلاف لسطح المكتب")}
            {assetField("heroBannerMobileImage", "صورة مستقلة للجوال")}
          </div>
          <label className="block space-y-1.5"><span className="text-xs font-bold text-slate-700">العنوان</span><input value={config.heroBannerTitle ?? ""} onChange={(event) => set("heroBannerTitle", event.target.value)} maxLength={500} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>
          <label className="block space-y-1.5"><span className="text-xs font-bold text-slate-700">النص المساند</span><textarea value={config.heroBannerSubtitle ?? ""} onChange={(event) => set("heroBannerSubtitle", event.target.value)} maxLength={1000} rows={3} className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1.5"><span className="text-xs font-bold text-slate-700">الشارة</span><input value={config.heroBannerBadge ?? ""} onChange={(event) => set("heroBannerBadge", event.target.value)} maxLength={255} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label><label className="space-y-1.5"><span className="text-xs font-bold text-slate-700">نص الزر</span><input value={config.heroBannerButtonText ?? ""} onChange={(event) => set("heroBannerButtonText", event.target.value)} maxLength={255} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5"><span className="text-xs font-bold text-slate-700">وجهة الزر</span><select aria-label="وجهة زر واجهة الترحيب" value={heroTargetType} onChange={(event) => setHeroTargetType(event.target.value as NonNullable<StoreConfig["heroBannerTargetType"]>)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="products">كل المنتجات</option><option value="category">تصنيف محدد</option><option value="product">منتج محدد</option></select></label>
            {heroTargetType === "category" ? <label className="space-y-1.5"><span className="text-xs font-bold text-slate-700">التصنيف المستهدف</span><select aria-label="التصنيف المستهدف لواجهة الترحيب" value={config.heroBannerTargetValue ?? ""} onChange={(event) => set("heroBannerTargetValue", event.target.value || undefined)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">اختر تصنيفًا منشورًا</option>{publishedCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label> : null}
            {heroTargetType === "product" ? <label className="space-y-1.5"><span className="text-xs font-bold text-slate-700">المنتج المستهدف</span><select aria-label="المنتج المستهدف لواجهة الترحيب" value={config.heroBannerTargetValue ?? ""} onChange={(event) => set("heroBannerTargetValue", event.target.value || undefined)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">اختر منتجًا منشورًا</option>{publishedProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label> : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1.5"><span className="text-xs font-bold text-slate-700">ارتفاع الواجهة</span><select value={config.heroBannerHeight ?? "medium"} onChange={(event) => set("heroBannerHeight", event.target.value as StoreConfig["heroBannerHeight"])} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="compact">مدمج</option><option value="medium">متوسط</option><option value="large">كبير</option></select></label><label className="space-y-1.5"><span className="text-xs font-bold text-slate-700">تعتيم الصورة: {config.heroBannerOverlayOpacity ?? 35}%</span><input type="range" min="0" max="100" value={config.heroBannerOverlayOpacity ?? 35} onChange={(event) => set("heroBannerOverlayOpacity", Number(event.target.value))} className="w-full" /></label></div>
          <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1.5"><span className="text-xs font-bold text-slate-700">موضع الصورة أفقيًا: {config.heroBannerFocalPointX ?? 50}%</span><input aria-label="موضع صورة واجهة الترحيب أفقيًا" type="range" min="0" max="100" value={config.heroBannerFocalPointX ?? 50} onChange={(event) => set("heroBannerFocalPointX", Number(event.target.value))} className="w-full" /></label><label className="space-y-1.5"><span className="text-xs font-bold text-slate-700">موضع الصورة عموديًا: {config.heroBannerFocalPointY ?? 50}%</span><input aria-label="موضع صورة واجهة الترحيب عموديًا" type="range" min="0" max="100" value={config.heroBannerFocalPointY ?? 50} onChange={(event) => set("heroBannerFocalPointY", Number(event.target.value))} className="w-full" /></label></div>
        </div>
      )}

      {section === "campaigns" && (
        config.themeStyle === "tech" ? (
          <MerchantTechBentoBlocksEditor
            config={config}
            activeTenantId={activeTenantId}
            mediaOwnerKey={mediaOwnerKey}
            onChange={onChange}
            uploadAsset={uploadAsset}
          />
        ) : (
          <MerchantMarketingBlocksEditor
            config={config}
            activeTenantId={activeTenantId}
            mediaOwnerKey={mediaOwnerKey}
            onChange={onChange}
            uploadAsset={uploadAsset}
          />
        )
      )}

      {section === "layout" && (
        <div className="space-y-4">
          <header>
            <h3 className="text-base font-black text-slate-900">ترتيب الصفحة الرئيسية</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">رتب الأقسام أو أخفِ ما لا تحتاجه. لن يؤثر ذلك في صفحات المنتجات ومن نحن.</p>
          </header>
          <div className="space-y-2">
            {layout.map((item, index) => (
              <div key={item.id} className={`flex items-center gap-3 rounded-2xl border p-3 ${item.visible ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 opacity-70"}`}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xs font-black text-white">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-slate-800">{STOREFRONT_SECTION_LABELS[item.id]}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">{item.visible ? "ظاهر في واجهة المتجر" : "مخفي من الصفحة الرئيسية"}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" aria-label={`نقل ${STOREFRONT_SECTION_LABELS[item.id]} للأعلى`} disabled={index === 0} onClick={() => moveSection(index, -1)} className="rounded-lg border border-slate-200 p-1.5 text-slate-600 disabled:cursor-not-allowed disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" aria-label={`نقل ${STOREFRONT_SECTION_LABELS[item.id]} للأسفل`} disabled={index === layout.length - 1} onClick={() => moveSection(index, 1)} className="rounded-lg border border-slate-200 p-1.5 text-slate-600 disabled:cursor-not-allowed disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" aria-label={`${item.visible ? "إخفاء" : "إظهار"} ${STOREFRONT_SECTION_LABELS[item.id]}`} disabled={item.visible && layout.filter((sectionItem) => sectionItem.visible).length === 1} onClick={() => toggleSection(index)} className={`rounded-lg p-1.5 disabled:cursor-not-allowed disabled:opacity-30 ${item.visible ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{item.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
                </div>
              </div>
            ))}
          </div>
          <p className="rounded-xl bg-sky-50 p-3 text-[11px] font-bold leading-5 text-sky-800">يجب إبقاء قسم واحد على الأقل ظاهرًا. الترتيب المحفوظ يظهر نفسه للعميل على رابط المتجر.</p>
        </div>
      )}
    </div>
  );
}
