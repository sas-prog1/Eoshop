import { useState } from "react";
import { ArrowLeft, Menu, Store, X } from "lucide-react";

import heroImage from "../../assets/images/hero_banner_perfume_1785918166890.jpg";

type PlatformNavigationKey = "templates" | "how_it_works" | "pricing";

interface LandingNavigationItem {
  key: PlatformNavigationKey;
  label: string;
  isVisible: boolean;
  position: number;
}

interface LandingSettingsProjection {
  platformName: string;
  tagline: string | null;
  logoUrl: string | null;
  landingHeadline: string;
  landingDescription: string;
  announcementEnabled: boolean;
  announcementText: string | null;
}

interface PlatformLandingHeroProps {
  settings: LandingSettingsProjection;
  navigation: LandingNavigationItem[];
  user: { fullName: string } | null;
  onNavigate: (key: PlatformNavigationKey) => void;
  onLogin: () => void;
  onRegister: () => void;
  onOpenPortal: () => void;
  onCreateStore: () => void;
  onExplainJourney: () => void;
}

const navigationButtonClass = "min-h-11 px-3 text-sm font-semibold text-slate-700 transition hover:text-slate-950";

export default function PlatformLandingHero({
  settings,
  navigation,
  user,
  onNavigate,
  onLogin,
  onRegister,
  onOpenPortal,
  onCreateStore,
  onExplainJourney,
}: PlatformLandingHeroProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const firstName = user?.fullName.trim().split(/\s+/)[0] || "التاجر";

  const selectNavigation = (key: PlatformNavigationKey) => {
    setMobileMenuOpen(false);
    onNavigate(key);
  };

  return (
    <>
      {settings.announcementEnabled && settings.announcementText && (
        <div className="bg-[#091827] px-6 py-2.5 text-center text-xs font-bold tracking-wide text-[#f4efe5]">
          {settings.announcementText}
        </div>
      )}

      <header className="relative z-30 border-b border-[#ded8cc] bg-[#f8f6f1]/95 text-slate-950 backdrop-blur-xl">
        <div className="mx-auto flex min-h-20 max-w-[1440px] items-center justify-between gap-5 px-5 sm:px-8 lg:px-12">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex min-h-11 items-center gap-3 text-right" aria-label={`العودة إلى بداية منصة ${settings.platformName}`}>
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt={`شعار ${settings.platformName}`} className="h-11 w-11 border border-[#d8d1c4] bg-white object-contain p-1" referrerPolicy="no-referrer" />
            ) : (
              <span className="grid h-11 w-11 place-items-center bg-[#091827] text-[#d5bd87]"><Store className="h-5 w-5" aria-hidden="true" /></span>
            )}
            <span>
              <span className="block font-display text-xl font-black tracking-tight">{settings.platformName}</span>
              {settings.tagline && <span className="mt-0.5 block text-[10px] font-semibold tracking-[0.08em] text-slate-500">{settings.tagline}</span>}
            </span>
          </button>

          <nav aria-label="التنقل الرئيسي" className="hidden items-center gap-2 lg:flex">
            {navigation.map((item) => (
              <button key={item.key} type="button" onClick={() => selectNavigation(item.key)} className={navigationButtonClass}>
                {item.label}
              </button>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            {user ? (
              <>
                <button type="button" onClick={onOpenPortal} className="min-h-11 border border-[#cfc7b8] bg-transparent px-5 text-sm font-bold text-slate-800 transition hover:bg-white">
                  بوابة {firstName}
                </button>
                <button type="button" onClick={onCreateStore} className="min-h-11 bg-[#091827] px-5 text-sm font-bold text-white transition hover:bg-[#142b40]">
                  متجر جديد
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={onLogin} className="min-h-11 border border-[#cfc7b8] bg-transparent px-5 text-sm font-bold text-slate-800 transition hover:bg-white">
                  تسجيل الدخول
                </button>
                <button type="button" onClick={onRegister} className="min-h-11 bg-[#091827] px-5 text-sm font-bold text-white transition hover:bg-[#142b40]">
                  أنشئ متجرك
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((current) => !current)}
            className="grid h-11 w-11 place-items-center border border-[#cfc7b8] text-slate-900 lg:hidden"
            aria-expanded={mobileMenuOpen}
            aria-controls="platform-mobile-navigation"
            aria-label={mobileMenuOpen ? "إغلاق قائمة التنقل" : "فتح قائمة التنقل"}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div id="platform-mobile-navigation" className="border-t border-[#ded8cc] bg-[#f8f6f1] px-5 py-5 lg:hidden">
            <nav aria-label="التنقل الرئيسي للجوال" className="grid gap-1">
              {navigation.map((item) => (
                <button key={item.key} type="button" onClick={() => selectNavigation(item.key)} className="min-h-11 border-b border-[#e6e0d6] px-2 text-right text-sm font-bold text-slate-800">
                  {item.label}
                </button>
              ))}
            </nav>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {user ? (
                <>
                  <button type="button" onClick={onOpenPortal} className="min-h-11 border border-[#cfc7b8] bg-white px-3 text-sm font-bold">بوابة التاجر</button>
                  <button type="button" onClick={onCreateStore} className="min-h-11 bg-[#091827] px-3 text-sm font-bold text-white">متجر جديد</button>
                </>
              ) : (
                <>
                  <button type="button" onClick={onLogin} className="min-h-11 border border-[#cfc7b8] bg-white px-3 text-sm font-bold">تسجيل الدخول</button>
                  <button type="button" onClick={onRegister} className="min-h-11 bg-[#091827] px-3 text-sm font-bold text-white">أنشئ متجرك</button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="relative isolate flex min-h-[720px] items-stretch overflow-hidden bg-[#d9d2c7] lg:min-h-[760px]" aria-labelledby="platform-hero-title">
        <img
          src={heroImage}
          alt="واجهة متجر عربي فاخر تعرض منتجات محلية"
          className="absolute inset-0 h-full w-full object-cover object-center"
          fetchPriority="high"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-[#081725]/40 via-[#081725]/10 to-[#081725]/25" aria-hidden="true" />
        <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#071522]/45 to-transparent" aria-hidden="true" />

        <div className="relative z-10 mx-auto flex w-full max-w-[1440px] items-center px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
          <section className="w-full border-r-4 border-[#b79a61] bg-[#f5f1e8]/94 px-7 py-10 text-right shadow-[0_30px_80px_rgba(5,18,31,0.24)] backdrop-blur-md sm:max-w-[660px] sm:px-12 sm:py-14 lg:px-16 lg:py-16">
            <p className="text-xs font-bold tracking-[0.12em] text-[#806a42]">منصة متاجر إلكترونية لأصحاب الأعمال</p>
            <h1 id="platform-hero-title" className="mt-5 font-display text-4xl font-black leading-[1.2] tracking-tight text-[#081725] sm:text-5xl lg:text-6xl">
              {settings.landingHeadline}
            </h1>
            <p className="mt-6 max-w-xl text-base font-medium leading-8 text-slate-700 sm:text-lg">
              {settings.landingDescription}
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={user ? onOpenPortal : onRegister}
                className="group inline-flex min-h-13 items-center justify-center gap-3 bg-[#081725] px-7 text-sm font-black text-white transition hover:bg-[#142c40] sm:text-base"
              >
                <span>{user ? "الانتقال إلى بوابة التاجر" : "ابدأ إنشاء متجرك"}</span>
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onExplainJourney}
                className="inline-flex min-h-13 items-center justify-center border border-[#9d927e] bg-white/35 px-7 text-sm font-black text-[#081725] transition hover:bg-white/70 sm:text-base"
              >
                اكتشف كيف تعمل المنصة
              </button>
            </div>

            <div className="mt-9 flex flex-wrap gap-x-5 gap-y-2 border-t border-[#cfc5b3] pt-5 text-xs font-bold text-slate-600" aria-label="مزايا المنصة الأساسية">
              <span>مصممة للعربية والجوال</span>
              <span className="before:ml-5 before:text-[#b79a61] before:content-['•']">لا تحتاج خبرة تقنية</span>
              <span className="before:ml-5 before:text-[#b79a61] before:content-['•']">مسار واضح حتى النشر</span>
            </div>
          </section>
        </div>

        <p className="absolute bottom-6 left-6 z-10 hidden max-w-xs border-l border-white/50 pl-4 text-left text-xs font-semibold leading-6 text-white/90 lg:block">
          حضور رقمي يليق بتجارتك، وإدارة يومية من مكان واحد.
        </p>
      </main>
    </>
  );
}
