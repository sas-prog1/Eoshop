import React from "react";
import { Check, LockKeyhole, Store } from "lucide-react";

import { usePlatformSettings } from "../../adapters/PlatformSettingsContext";
import defaultIdentityImage from "../../assets/images/hero_banner_perfume_1785918166890.jpg";

interface PlatformAuthShellProps {
  modeLabel: string;
  title: string;
  description: string;
  children: React.ReactNode;
}

const trustPoints = [
  "جلسة حساب محمية من الخادم",
  "مسودة متجرك محفوظة وقابلة للاستئناف",
  "مراجعة وتجهيز ونشر بحالات واضحة",
] as const;

export default function PlatformAuthShell({ modeLabel, title, description, children }: PlatformAuthShellProps) {
  const { settings } = usePlatformSettings();
  const identityImage = settings.authImageUrl ?? settings.landingHeroImageUrl ?? defaultIdentityImage;

  return (
    <main
      dir="rtl"
      className="min-h-screen px-3 py-3 text-slate-900 sm:px-6 sm:py-6"
      style={{ backgroundColor: settings.brandSurfaceColor, fontFamily: "var(--platform-brand-font)" }}
    >
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1440px] overflow-hidden border border-black/10 bg-white shadow-[0_28px_90px_rgba(8,23,37,0.16)] sm:min-h-[calc(100vh-3rem)] lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.78fr)]" dir="ltr">
        <section className="relative hidden min-h-[720px] overflow-hidden lg:block" aria-label="هوية المنصة">
          <img src={identityImage} alt="" className="absolute inset-0 h-full w-full object-cover" referrerPolicy="no-referrer" />
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(130deg, ${settings.brandPrimaryColor}F5 0%, ${settings.brandPrimaryColor}D9 48%, ${settings.brandPrimaryColor}59 100%)` }}
          />
          <div className="absolute inset-y-0 right-0 w-px bg-white/20" />

          <div className="relative flex h-full flex-col justify-between p-10 text-white xl:p-14" dir="rtl">
            <a href="/" className="inline-flex w-fit items-center gap-3" aria-label={`العودة إلى ${settings.platformName}`}>
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt={`شعار ${settings.platformName}`} className="h-12 w-12 border border-white/25 bg-white object-contain p-1.5" referrerPolicy="no-referrer" />
              ) : (
                <span className="grid h-12 w-12 place-items-center border border-white/30 bg-white/10"><Store className="h-5 w-5" aria-hidden="true" /></span>
              )}
              <span>
                <strong className="block text-xl font-black">{settings.platformName}</strong>
                {settings.tagline && <span className="mt-1 block text-xs font-semibold text-white/70">{settings.tagline}</span>}
              </span>
            </a>

            <div className="max-w-xl py-14">
              <p className="text-xs font-black tracking-[0.14em]" style={{ color: settings.brandAccentColor }}>مسار واضح من الحساب إلى النشر</p>
              <h2 className="mt-5 text-4xl font-black leading-[1.2] xl:text-5xl">{settings.landingHeadline}</h2>
              <p className="mt-5 max-w-lg text-sm font-medium leading-7 text-white/75 xl:text-base">{settings.landingDescription}</p>
              <ul className="mt-9 space-y-4">
                {trustPoints.map((point) => (
                  <li key={point} className="flex items-center gap-3 text-sm font-bold text-white/90">
                    <span className="grid h-7 w-7 shrink-0 place-items-center border border-white/20 bg-white/10" aria-hidden="true"><Check className="h-3.5 w-3.5" /></span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center gap-3 border-t border-white/15 pt-6 text-xs font-semibold text-white/65">
              <LockKeyhole className="h-4 w-4" aria-hidden="true" />
              لن نطلب بيانات دفع أثناء إنشاء الحساب أو تسجيل الدخول.
            </div>
          </div>
        </section>

        <section className="flex min-h-[calc(100vh-1.5rem)] items-center px-6 py-9 sm:min-h-[calc(100vh-3rem)] sm:px-10 lg:min-h-[720px] lg:px-12 xl:px-16" dir="rtl" aria-labelledby="platform-auth-title">
          <div className="mx-auto w-full max-w-md">
            <a href="/" className="mb-10 flex w-fit items-center gap-3 lg:hidden" aria-label={`العودة إلى ${settings.platformName}`}>
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt={`شعار ${settings.platformName}`} className="h-11 w-11 border border-slate-200 bg-white object-contain p-1" referrerPolicy="no-referrer" />
              ) : (
                <span className="grid h-11 w-11 place-items-center text-white" style={{ backgroundColor: settings.brandPrimaryColor }}><Store className="h-5 w-5" aria-hidden="true" /></span>
              )}
              <span><strong className="block text-lg font-black" style={{ color: settings.brandPrimaryColor }}>{settings.platformName}</strong>{settings.tagline && <span className="text-[11px] font-semibold text-slate-500">{settings.tagline}</span>}</span>
            </a>

            <span className="inline-flex min-h-8 items-center border px-3 text-[11px] font-black" style={{ borderColor: `${settings.brandAccentColor}66`, color: settings.brandAccentColor }}>{modeLabel}</span>
            <h1 id="platform-auth-title" className="mt-5 text-3xl font-black leading-tight sm:text-4xl" style={{ color: settings.brandPrimaryColor }}>{title}</h1>
            <p className="mt-3 text-sm font-medium leading-7 text-slate-500">{description}</p>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
