import { LockKeyhole, Store } from "lucide-react";

import defaultIdentityImage from "../../assets/images/hero_banner_perfume_1785918166890.jpg";
import type { PlatformSettings } from "../../services/platformSettingsApi";
import { isSafePlatformLogoUrl } from "../../utils/platformLogoUrl";
import { readableForeground } from "../../utils/readableForeground";

export type PlatformIdentityPreviewMode = "landing" | "auth";

interface PlatformIdentityPreviewProps {
  settings: PlatformSettings;
  mode: PlatformIdentityPreviewMode;
}

const colorPattern = /^#[0-9A-F]{6}$/;

export default function PlatformIdentityPreview({ settings, mode }: PlatformIdentityPreviewProps) {
  const primary = colorPattern.test(settings.brandPrimaryColor) ? settings.brandPrimaryColor : "#081725";
  const accent = colorPattern.test(settings.brandAccentColor) ? settings.brandAccentColor : "#B18A46";
  const surface = colorPattern.test(settings.brandSurfaceColor) ? settings.brandSurfaceColor : "#F8F6F1";
  const landingImage = isSafePlatformLogoUrl(settings.landingHeroImageUrl) && settings.landingHeroImageUrl ? settings.landingHeroImageUrl : defaultIdentityImage;
  const authImage = isSafePlatformLogoUrl(settings.authImageUrl) && settings.authImageUrl ? settings.authImageUrl : landingImage;
  const fontFamily = `"${settings.brandFontFamily}", "Cairo", sans-serif`;

  if (mode === "auth") {
    return (
      <div data-testid="platform-auth-preview" className="overflow-hidden rounded-2xl border border-slate-200" style={{ backgroundColor: surface, fontFamily }}>
        <div className="grid min-h-80 grid-cols-[.88fr_1.12fr] bg-white" dir="ltr">
          <div className="relative overflow-hidden">
            <img src={authImage} alt="" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0" style={{ backgroundColor: `${primary}D9` }} />
            <div className="relative flex h-full flex-col justify-between p-4 text-white" dir="rtl">
              <PreviewBrand settings={settings} primary={primary} accent={accent} inverse />
              <div><p className="text-[9px] font-black" style={{ color: accent }}>مسار واضح من الحساب إلى النشر</p><p className="mt-2 text-base font-black leading-6">{settings.landingHeadline}</p></div>
              <p className="flex items-center gap-2 text-[8px] text-white/70"><LockKeyhole className="h-3 w-3" /> دخول محمي من الخادم</p>
            </div>
          </div>
          <div className="flex items-center p-5" dir="rtl">
            <div className="w-full"><span className="border px-2 py-1 text-[8px] font-black" style={{ borderColor: `${accent}66`, color: accent }}>دخول آمن</span><h3 className="mt-3 text-lg font-black" style={{ color: primary }}>تسجيل الدخول</h3><p className="mt-1 text-[9px] leading-4 text-slate-500">أدخل بيانات حسابك للعودة إلى بوابة التاجر.</p><div className="mt-4 space-y-2"><span className="block h-8 rounded-lg border border-slate-200 bg-slate-50" /><span className="block h-8 rounded-lg border border-slate-200 bg-slate-50" /><span className="block h-8" style={{ backgroundColor: accent }} /></div></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="platform-landing-preview" className="overflow-hidden rounded-2xl border border-slate-200" style={{ backgroundColor: surface, fontFamily }}>
      {settings.announcementEnabled && settings.announcementText && <p className="px-3 py-1.5 text-center text-[8px] font-bold" style={{ backgroundColor: primary, color: readableForeground(primary) }}>{settings.announcementText}</p>}
      <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3"><PreviewBrand settings={settings} primary={primary} accent={accent} /><span className="h-7 px-3 text-[8px] font-black leading-7" style={{ backgroundColor: primary, color: readableForeground(primary) }}>أنشئ متجرك</span></div>
      <div className="relative min-h-72 overflow-hidden">
        <img src={landingImage} alt="" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0" style={{ backgroundColor: `${primary}33` }} />
        <div className="relative m-5 max-w-[78%] border-r-2 p-5 shadow-xl backdrop-blur-sm" style={{ borderRightColor: accent, backgroundColor: `${surface}F2` }} dir="rtl"><p className="text-[8px] font-black" style={{ color: accent }}>منصة متاجر إلكترونية لأصحاب الأعمال</p><h3 className="mt-2 text-xl font-black leading-7" style={{ color: primary }}>{settings.landingHeadline}</h3><p className="mt-2 line-clamp-3 text-[9px] leading-4 text-slate-600">{settings.landingDescription}</p><span className="mt-4 inline-block px-4 py-2 text-[8px] font-black" style={{ backgroundColor: primary, color: readableForeground(primary) }}>ابدأ إنشاء متجرك</span></div>
      </div>
    </div>
  );
}

function PreviewBrand({ settings, primary, accent, inverse = false }: { settings: PlatformSettings; primary: string; accent: string; inverse?: boolean }) {
  const safeLogo = isSafePlatformLogoUrl(settings.logoUrl) && settings.logoUrl ? settings.logoUrl : null;
  return <div className="flex items-center gap-2" dir="rtl">{safeLogo ? <img src={safeLogo} alt="" referrerPolicy="no-referrer" className="h-8 w-8 bg-white object-contain p-1" /> : <span className="grid h-8 w-8 place-items-center" style={{ backgroundColor: inverse ? "#FFFFFF1F" : primary, color: inverse ? "#FFFFFF" : accent }}><Store className="h-3.5 w-3.5" /></span>}<span><strong className={`block text-[10px] font-black ${inverse ? "text-white" : ""}`} style={inverse ? undefined : { color: primary }}>{settings.platformName}</strong>{settings.tagline && <span className={`block text-[7px] ${inverse ? "text-white/65" : "text-slate-500"}`}>{settings.tagline}</span>}</span></div>;
}
