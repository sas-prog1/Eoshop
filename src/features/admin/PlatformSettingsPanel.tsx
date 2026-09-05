import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Eye, Palette, RefreshCw, RotateCcw, Save, Type } from "lucide-react";
import {
  isUiError,
  isUiErrorCode,
  uiErrorMessage,
  type AdminPlatformSettings,
  type PlatformNavigationKey,
  type PlatformSettings,
  type UiAdapters,
} from "../../adapters/uiAdapters";
import { isSafePlatformLogoUrl } from "../../utils/platformLogoUrl";
import { isSafePlatformIdentityImageUrl } from "../../utils/platformIdentityImageUrl";
import PlatformIdentityPreview, { type PlatformIdentityPreviewMode } from "./PlatformIdentityPreview";
import PlatformIdentityAssetField from "./PlatformIdentityAssetField";

interface PlatformSettingsPanelProps {
  administration: UiAdapters["administration"];
  refreshSignal: number;
  onSessionExpired: () => void;
  onForbiddenChange: (forbidden: boolean) => void;
  onLoadingChange: (loading: boolean) => void;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: (settings: PlatformSettings) => void;
  onToast: (message: string, type: "success" | "error" | "info") => void;
}

const input = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100";
const colorPattern = /^#[0-9A-F]{6}$/;
const brandFonts: PlatformSettings["brandFontFamily"][] = ["Tajawal", "Cairo", "IBM Plex Sans Arabic"];

function visualIdentityError(settings: PlatformSettings): string | null {
  if (![settings.brandPrimaryColor, settings.brandAccentColor, settings.brandSurfaceColor].every((color) => colorPattern.test(color))) {
    return "ألوان الهوية يجب أن تكون بصيغة #RRGGBB.";
  }
  if (!isSafePlatformIdentityImageUrl(settings.landingHeroImageUrl) || !isSafePlatformIdentityImageUrl(settings.authImageUrl)) {
    return "صور الهوية تقبل أصل منصة مُدارًا أو رابط HTTPS خارجيًا وآمنًا.";
  }
  return null;
}

function editable(settings: AdminPlatformSettings): PlatformSettings {
  const { updatedAt: _updatedAt, updatedByUserId: _updatedByUserId, ...value } = settings;
  return structuredClone(value);
}

function same(left: PlatformSettings | null, right: PlatformSettings | null): boolean {
  return left !== null && right !== null && JSON.stringify(left) === JSON.stringify(right);
}

export default function PlatformSettingsPanel({
  administration,
  refreshSignal,
  onSessionExpired,
  onForbiddenChange,
  onLoadingChange,
  onDirtyChange,
  onSaved,
  onToast,
}: PlatformSettingsPanelProps) {
  const mounted = useRef(true);
  const sequence = useRef(0);
  const [server, setServer] = useState<AdminPlatformSettings | null>(null);
  const [draft, setDraft] = useState<PlatformSettings | null>(null);
  const [conflictDraft, setConflictDraft] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<PlatformIdentityPreviewMode>("landing");
  const [identityPreviewUrls, setIdentityPreviewUrls] = useState<{ landing: string | null; auth: string | null }>({ landing: null, auth: null });
  const setLandingPreview = useCallback((value: string | null) => setIdentityPreviewUrls((current) => ({ ...current, landing: value })), []);
  const setAuthPreview = useCallback((value: string | null) => setIdentityPreviewUrls((current) => ({ ...current, auth: value })), []);
  const dirty = useMemo(() => server !== null && draft !== null && !same(editable(server), draft), [draft, server]);
  const protectedDirty = dirty || conflictDraft !== null;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      sequence.current += 1;
      onDirtyChange(false);
      onLoadingChange(false);
    };
  }, []);

  useEffect(() => onDirtyChange(protectedDirty), [onDirtyChange, protectedDirty]);

  const revoke = () => {
    sequence.current += 1;
    setServer(null);
    setDraft(null);
    setConflictDraft(null);
    setLoading(false);
    setSaving(false);
    setError(null);
    setIdentityPreviewUrls({ landing: null, auth: null });
    setForbidden(true);
    onForbiddenChange(true);
    onDirtyChange(false);
    onLoadingChange(false);
  };

  const load = async (discardLocal = false) => {
    if (saving || forbidden) return;
    if (protectedDirty && !discardLocal) {
      setError("توجد تعديلات غير محفوظة. احفظها أو تجاهلها قبل تحديث نسخة الخادم.");
      return;
    }
    const current = ++sequence.current;
    setLoading(true);
    onLoadingChange(true);
    setError(null);
    try {
      const next = await administration.getPlatformSettings();
      if (!mounted.current || current !== sequence.current) return;
      setServer(next);
      setDraft(editable(next));
      setIdentityPreviewUrls({ landing: null, auth: null });
      setForbidden(false);
      onForbiddenChange(false);
    } catch (caught) {
      if (!mounted.current || current !== sequence.current) return;
      if (isUiError(caught, "unauthenticated")) {
        onSessionExpired();
        return;
      }
      if (isUiError(caught, "forbidden")) {
        revoke();
        return;
      }
      setError(uiErrorMessage(caught, "تعذر تحميل إعدادات المنصة."));
    } finally {
      if (mounted.current && current === sequence.current) {
        setLoading(false);
        onLoadingChange(false);
      }
    }
  };

  useEffect(() => {
    void load(false);
    // A parent-owned monotonic signal deliberately requests a refresh.
  }, [refreshSignal]);

  const change = <Key extends keyof PlatformSettings>(key: Key, value: PlatformSettings[Key]) => {
    setDraft((current) => current ? { ...current, [key]: value } : current);
    setError(null);
  };

  const toggleSection = (key: "showHowItWorks" | "showPricing", navigationKey: PlatformNavigationKey, value: boolean) => {
    setDraft((current) => current ? {
      ...current,
      [key]: value,
      navigationItems: value
        ? current.navigationItems
        : current.navigationItems.map((item) => item.key === navigationKey ? { ...item, isVisible: false } : item),
    } : current);
  };

  const updateNavigation = (key: PlatformNavigationKey, patch: Partial<PlatformSettings["navigationItems"][number]>) => {
    setDraft((current) => current ? {
      ...current,
      navigationItems: current.navigationItems.map((item) => item.key === key ? { ...item, ...patch } : item),
    } : current);
  };

  const moveNavigation = (key: PlatformNavigationKey, direction: -1 | 1) => {
    setDraft((current) => {
      if (!current) return current;
      const ordered = [...current.navigationItems].sort((a, b) => a.position - b.position);
      const index = ordered.findIndex((item) => item.key === key);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= ordered.length) return current;
      [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
      return { ...current, navigationItems: ordered.map((item, position) => ({ ...item, position: position + 1 })) };
    });
  };

  const save = async () => {
    if (!server || !draft || saving || loading || forbidden || !dirty) return;
    const identityError = visualIdentityError(draft);
    if (identityError) {
      setError(identityError);
      return;
    }
    const current = ++sequence.current;
    setSaving(true);
    onLoadingChange(true);
    setError(null);
    try {
      const { revision: _draftRevision, ...editableDraft } = draft;
      const saved = await administration.updatePlatformSettings({ ...editableDraft, expectedRevision: server.revision });
      if (!mounted.current || current !== sequence.current) return;
      setServer(saved);
      setDraft(editable(saved));
      setIdentityPreviewUrls({ landing: null, auth: null });
      setConflictDraft(null);
      onSaved(editable(saved));
      onToast("تم حفظ إعدادات المنصة وتطبيق الهوية العامة.", "success");
    } catch (caught) {
      if (!mounted.current || current !== sequence.current) return;
      if (isUiError(caught, "unauthenticated")) {
        onSessionExpired();
        return;
      }
      if (isUiError(caught, "forbidden")) {
        revoke();
        return;
      }
      if (isUiErrorCode(caught, "conflict", "platform_settings_revision_conflict")) {
        setConflictDraft(structuredClone(draft));
        setError("حفظ مدير آخر نسخة أحدث. احتفظنا بمسودتك؛ حمّل نسخة الخادم ثم راجع قبل أي حفظ جديد.");
        return;
      }
      setError(uiErrorMessage(caught, "تعذر حفظ إعدادات المنصة."));
    } finally {
      if (mounted.current && current === sequence.current) {
        setSaving(false);
        onLoadingChange(false);
      }
    }
  };

  if (forbidden) {
    return <section className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center"><AlertTriangle className="mx-auto h-9 w-9 text-amber-700" /><h2 className="mt-3 font-black text-amber-950">تم سحب صلاحية إعدادات المنصة</h2><p className="mt-2 text-xs text-amber-800">أزيلت البيانات المحمية وأُخفيت أدوات التعديل.</p></section>;
  }
  if (!server && loading) return <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500">تحميل إعدادات المنصة...</p>;
  if (!server || !draft) {
    return <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center"><p className="text-sm font-bold text-rose-800">{error ?? "إعدادات المنصة غير متاحة."}</p><button type="button" onClick={() => void load(true)} className="mt-4 rounded-xl bg-rose-700 px-4 py-2 text-xs font-bold text-white">إعادة المحاولة</button></section>;
  }

  const orderedNavigation = [...draft.navigationItems].sort((a, b) => a.position - b.position);
  const disabled = loading || saving;
  const editorDisabled = disabled || conflictDraft !== null;
  const safeLogoUrl = isSafePlatformLogoUrl(draft.logoUrl) ? draft.logoUrl : null;
  const identityError = visualIdentityError(draft);
  const landingImageInvalid = draft.landingHeroImageUrl !== null && !isSafePlatformIdentityImageUrl(draft.landingHeroImageUrl);
  const authImageInvalid = draft.authImageUrl !== null && !isSafePlatformIdentityImageUrl(draft.authImageUrl);

  return (
    <section className="mx-auto max-w-7xl space-y-5">
      {error && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900"><AlertTriangle className="ml-2 inline h-4 w-4" />{error}</div>}
      {conflictDraft && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-xs text-indigo-900">
          <p>مسودة التعارض محفوظة في الذاكرة فقط حتى تغادر الصفحة.</p>
          <div className="flex gap-2"><button type="button" disabled={disabled} onClick={() => void load(true)} className="rounded-lg bg-indigo-700 px-3 py-2 font-bold text-white">تحميل نسخة الخادم</button><button type="button" disabled={disabled} onClick={() => setDraft(structuredClone(conflictDraft))} className="rounded-lg border border-indigo-300 bg-white px-3 py-2 font-bold">استعادة مسودتي للمراجعة</button></div>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
        <div className="space-y-5">
          <fieldset disabled={editorDisabled} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <legend className="px-2 text-sm font-black">الهوية العامة</legend>
            <div className="grid gap-4 md:grid-cols-2"><label className="text-xs font-bold">اسم المنصة<input className={`${input} mt-2`} value={draft.platformName} maxLength={80} onChange={(event) => change("platformName", event.target.value)} /></label><label className="text-xs font-bold">الوصف المختصر<input className={`${input} mt-2`} value={draft.tagline ?? ""} maxLength={160} onChange={(event) => change("tagline", event.target.value || null)} /></label></div>
            <label className="block text-xs font-bold">رابط شعار HTTPS خارجي<input dir="ltr" className={`${input} mt-2`} value={draft.logoUrl ?? ""} maxLength={2048} onChange={(event) => change("logoUrl", event.target.value || null)} placeholder="https://cdn.example.com/logo.png" /></label>
            {draft.logoUrl && !safeLogoUrl && <p className="text-xs font-bold text-rose-700">لن تُعرض معاينة الشعار حتى يكون الرابط HTTPS خارجيًا وآمنًا.</p>}
            <label className="flex items-center gap-3 text-xs font-bold">اللون الأساسي<input type="color" value={draft.primaryColor} onChange={(event) => change("primaryColor", event.target.value.toUpperCase())} className="h-10 w-16 rounded-lg border border-slate-200 bg-white p-1" /><code dir="ltr">{draft.primaryColor}</code></label>
          </fieldset>

          <fieldset disabled={editorDisabled} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <legend className="flex items-center gap-2 px-2 text-sm font-black"><Palette className="h-4 w-4" /> الهوية البصرية للمنصة</legend>
            <p className="text-xs leading-6 text-slate-500">هذه القيم تطبق على الصفحة الرئيسية ونوافذ الدخول والتسجيل فقط، ولا تغير هوية متاجر المستأجرين.</p>
            <div className="grid gap-4 md:grid-cols-3">
              <VisualColorField label="اللون الرئيسي" value={draft.brandPrimaryColor} onChange={(value) => change("brandPrimaryColor", value)} />
              <VisualColorField label="اللون المساند" value={draft.brandAccentColor} onChange={(value) => change("brandAccentColor", value)} />
              <VisualColorField label="لون الخلفية" value={draft.brandSurfaceColor} onChange={(value) => change("brandSurfaceColor", value)} />
            </div>
            <label className="block text-xs font-bold"><span className="flex items-center gap-2"><Type className="h-4 w-4" /> خط المنصة</span><select aria-label="خط المنصة" className={`${input} mt-2`} value={draft.brandFontFamily} onChange={(event) => change("brandFontFamily", event.target.value as PlatformSettings["brandFontFamily"])}>{brandFonts.map((font) => <option key={font} value={font}>{font}</option>)}</select></label>
            <div className="grid gap-4 lg:grid-cols-2">
              <PlatformIdentityAssetField administration={administration} purpose="landing_hero" label="صورة الصفحة الرئيسية" value={draft.landingHeroImageUrl} committedValue={server.landingHeroImageUrl} placeholder="https://cdn.example.com/landing.jpg" disabled={editorDisabled} invalid={landingImageInvalid} onChange={(value) => change("landingHeroImageUrl", value)} onPreviewChange={setLandingPreview} />
              <PlatformIdentityAssetField administration={administration} purpose="authentication" label="صورة نافذة الدخول" value={draft.authImageUrl} committedValue={server.authImageUrl} placeholder="اختياري — ترث صورة الرئيسية" disabled={editorDisabled} invalid={authImageInvalid} onChange={(value) => change("authImageUrl", value)} onPreviewChange={setAuthPreview} />
            </div>
            {!landingImageInvalid && !authImageInvalid && <p className="text-[11px] leading-5 text-slate-500">ترك صورة الدخول فارغة يجعلها تستخدم صورة الرئيسية، وترك الصورتين فارغتين يبقي الصورة الافتراضية المعتمدة.</p>}
          </fieldset>

          <fieldset disabled={editorDisabled} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <legend className="px-2 text-sm font-black">الصفحة الرئيسية والتنقل</legend>
            <label className="block text-xs font-bold">العنوان الرئيسي<input className={`${input} mt-2`} value={draft.landingHeadline} maxLength={160} onChange={(event) => change("landingHeadline", event.target.value)} /></label>
            <label className="block text-xs font-bold">الوصف<textarea className={`${input} mt-2`} rows={3} value={draft.landingDescription} maxLength={500} onChange={(event) => change("landingDescription", event.target.value)} /></label>
            <div className="grid gap-3 sm:grid-cols-2"><label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-xs font-bold"><input type="checkbox" checked={draft.showHowItWorks} onChange={(event) => toggleSection("showHowItWorks", "how_it_works", event.target.checked)} /> إظهار قسم كيف تعمل المنصة</label><label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-xs font-bold"><input type="checkbox" checked={draft.showPricing} onChange={(event) => toggleSection("showPricing", "pricing", event.target.checked)} /> إظهار قسم الباقات</label></div>
            <div className="space-y-2"><p className="text-xs font-black">عناصر التنقل الثابتة</p>{orderedNavigation.map((item, index) => {
              const targetHidden = (item.key === "how_it_works" && !draft.showHowItWorks) || (item.key === "pricing" && !draft.showPricing);
              return <div key={item.key} className="grid items-center gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_auto_auto]"><input className={input} value={item.label} maxLength={40} onChange={(event) => updateNavigation(item.key, { label: event.target.value })} /><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={item.isVisible} disabled={targetHidden} onChange={(event) => updateNavigation(item.key, { isVisible: event.target.checked })} /> ظاهر</label><div className="flex gap-1"><button type="button" aria-label={`رفع ${item.label}`} disabled={index === 0} onClick={() => moveNavigation(item.key, -1)} className="rounded-lg border p-2"><ArrowUp className="h-4 w-4" /></button><button type="button" aria-label={`خفض ${item.label}`} disabled={index === orderedNavigation.length - 1} onClick={() => moveNavigation(item.key, 1)} className="rounded-lg border p-2"><ArrowDown className="h-4 w-4" /></button></div></div>;
            })}</div>
          </fieldset>

          <fieldset disabled={editorDisabled} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <legend className="px-2 text-sm font-black">الإعلان والدعم</legend>
            <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={draft.announcementEnabled} onChange={(event) => change("announcementEnabled", event.target.checked)} /> تفعيل شريط الإعلان</label>
            <input className={input} value={draft.announcementText ?? ""} maxLength={240} onChange={(event) => change("announcementText", event.target.value || null)} placeholder="نص الإعلان العام" />
            <div className="grid gap-3 md:grid-cols-3"><input dir="ltr" type="email" className={input} value={draft.supportEmail ?? ""} onChange={(event) => change("supportEmail", event.target.value || null)} placeholder="support@example.com" /><input dir="ltr" className={input} value={draft.supportPhone ?? ""} onChange={(event) => change("supportPhone", event.target.value || null)} placeholder="+967... هاتف" /><input dir="ltr" className={input} value={draft.supportWhatsapp ?? ""} onChange={(event) => change("supportWhatsapp", event.target.value || null)} placeholder="+967... WhatsApp" /></div>
          </fieldset>

          <fieldset disabled={editorDisabled} className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <legend className="px-2 text-sm font-black">نسبة المتاجر للمنصة</legend>
            <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={draft.storefrontAttributionEnabled} onChange={(event) => change("storefrontAttributionEnabled", event.target.checked)} /> إظهار النسبة في تذييل المتاجر</label>
            <input className={input} value={draft.storefrontAttributionText ?? ""} maxLength={180} onChange={(event) => change("storefrontAttributionText", event.target.value || null)} />
          </fieldset>
        </div>

        <aside className="h-fit space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-4">
          <p className="flex items-center gap-2 text-sm font-black"><Eye className="h-4 w-4" /> معاينة الهوية</p>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1" role="group" aria-label="نوع معاينة الهوية"><button type="button" aria-pressed={previewMode === "landing"} onClick={() => setPreviewMode("landing")} className={`min-h-10 rounded-lg px-3 text-xs font-black ${previewMode === "landing" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>الصفحة الرئيسية</button><button type="button" aria-pressed={previewMode === "auth"} onClick={() => setPreviewMode("auth")} className={`min-h-10 rounded-lg px-3 text-xs font-black ${previewMode === "auth" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>تسجيل الدخول</button></div>
          <PlatformIdentityPreview settings={{ ...draft, logoUrl: safeLogoUrl }} mode={previewMode} landingImageOverride={identityPreviewUrls.landing} authImageOverride={identityPreviewUrls.auth} />
          <p className="text-[11px] leading-5 text-slate-500">معاينة مباشرة قبل الحفظ. لا تقبل اللوحة HTML أو CSS أو خطوطًا وروابط حرة.</p>
          <p className="text-[11px] text-slate-400">Revision {server.revision} · {server.updatedAt ? new Date(server.updatedAt).toLocaleString("ar-YE") : "الإعدادات الافتراضية"}</p>
        </aside>
      </div>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur"><p className={`text-xs font-bold ${identityError ? "text-rose-700" : protectedDirty ? "text-amber-700" : "text-emerald-700"}`}>{identityError ?? (conflictDraft ? "مسودة تعارض محفوظة وتحتاج قرارًا قبل المغادرة." : dirty ? "لديك تعديلات غير محفوظة." : "الإعدادات مطابقة لنسخة الخادم.")}</p><div className="flex gap-2"><button type="button" disabled={disabled || !protectedDirty} onClick={() => { setDraft(editable(server)); setConflictDraft(null); setError(null); setIdentityPreviewUrls({ landing: null, auth: null }); }} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold disabled:opacity-40"><RotateCcw className="h-4 w-4" /> تجاهل</button><button type="button" disabled={disabled || !dirty || identityError !== null} onClick={() => void save()} style={{ backgroundColor: draft.primaryColor }} className="flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-black text-white disabled:opacity-40"><Save className="h-4 w-4" /> {saving ? "جارٍ الحفظ..." : "حفظ الإعدادات"}</button><button type="button" disabled={disabled || protectedDirty} onClick={() => void load(true)} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold disabled:opacity-40"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> تحديث</button></div></div>
    </section>
  );
}

function VisualColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const valid = colorPattern.test(value);
  return <label className="block text-xs font-bold">{label}<span className="mt-2 flex items-center gap-2"><input aria-label={`${label} — منتقي اللون`} type="color" value={valid ? value : "#000000"} onChange={(event) => onChange(event.target.value.toUpperCase())} className="h-11 w-14 shrink-0 rounded-lg border border-slate-200 bg-white p-1" /><input aria-label={`${label} — رمز اللون`} dir="ltr" value={value} maxLength={7} onChange={(event) => onChange(event.target.value.trim().toUpperCase())} className={`${input} font-mono ${valid ? "" : "border-rose-300 bg-rose-50"}`} /></span>{!valid && <span className="mt-1 block text-[10px] text-rose-700">استخدم مثالًا مثل #081725</span>}</label>;
}
