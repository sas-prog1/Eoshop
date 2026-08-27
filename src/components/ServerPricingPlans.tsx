import React, { useEffect } from "react";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  RefreshCw,
  ShieldCheck,
  Store,
} from "lucide-react";

import { usePlatformSettings } from "../adapters/PlatformSettingsContext";
import { useUiAdapters } from "../adapters/UiAdaptersContext";
import type { StorePlan } from "../adapters/uiAdapters";
import { useApiTask } from "../hooks/useApiTask";

interface ServerPricingPlansProps {
  onStart: () => void;
}

const verifiedFeatureLabels: Partial<Record<string, string>> = {
  platform_subdomain: "رابط متجر داخل نطاق المنصة",
  basic_theme: "قالب أساسي قابل للتخصيص",
};

function storeLimitLabel(plan: StorePlan) {
  if (plan.maxStores === 1) return "متجر واحد";
  return `حتى ${plan.maxStores.toLocaleString("ar-SA")} متاجر`;
}

function productLimitLabel(plan: StorePlan) {
  if (plan.maxProducts === null) return "منتجات غير محدودة";
  return `حتى ${plan.maxProducts.toLocaleString("ar-SA")} منتجات`;
}

function planPriceLabel(plan: StorePlan) {
  if (plan.priceMinor === 0) return "مجانًا";

  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: plan.currency,
    maximumFractionDigits: 0,
  }).format(plan.priceMinor / 100);
}

function activationLabel(plan: StorePlan) {
  return plan.activationMode === "automatic"
    ? "تفعيل الباقة آلي بعد إنشاء الطلب؛ نشر المتجر يبقى خاضعًا للمراجعة والتجهيز."
    : "تفعيل الباقة يتم بعد موافقة الإدارة؛ اختيارها لا يعني اكتمال دفع إلكتروني."
}

export default function ServerPricingPlans({ onStart }: ServerPricingPlansProps) {
  const { plans: planActions } = useUiAdapters();
  const { settings: platformSettings } = usePlatformSettings();
  const plansTask = useApiTask<StorePlan[], []>(planActions.list, { retry: "safe" });
  const plans = plansTask.data ?? [];

  useEffect(() => {
    void plansTask.execute();
  }, [plansTask.execute]);

  return (
    <section
      id="pricing"
      className="scroll-mt-6 border-y border-[#d9d1c3] bg-[#eee9df] px-5 py-20 text-[#081725] sm:px-8 sm:py-24 lg:px-12 lg:py-28"
      aria-labelledby="platform-pricing-title"
    >
      <div className="mx-auto max-w-[1440px]">
        <div className="grid items-end gap-8 border-b border-[#c4b9a7] pb-10 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.58fr)]">
          <div className="text-right">
            <p className="text-xs font-black tracking-[0.14em] text-[#806a42]">اختر ما يناسب مرحلة نشاطك</p>
            <h2 id="platform-pricing-title" className="mt-4 max-w-3xl font-display text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              باقات واضحة تبدأ مع حجم متجرك
            </h2>
          </div>
          <div className="max-w-xl text-right lg:justify-self-end">
            <p className="text-sm font-medium leading-7 text-slate-600 sm:text-base">
              الأسعار والحدود أدناه تأتي مباشرة من خادم {platformSettings.platformName}. اختر الباقة المناسبة داخل رحلة إنشاء المتجر قبل إرسال الطلب.
            </p>
            <span className="mt-4 inline-flex items-center gap-2 border border-[#bfa875] bg-[#f8f6f1] px-3 py-2 text-[11px] font-black text-[#6f592f]">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" /> المزايا المعروضة هي المطبقة حاليًا
            </span>
          </div>
        </div>

        {plansTask.loading && (
          <div className="grid gap-5 py-12 lg:grid-cols-3" aria-label="جارٍ تحميل الباقات">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-[410px] animate-pulse border border-[#d4ccbf] bg-[#f8f6f1]" />
            ))}
          </div>
        )}

        {plansTask.error && (
          <div className="mx-auto my-12 flex max-w-2xl flex-col items-center gap-4 border border-rose-200 bg-rose-50 px-6 py-8 text-center text-sm font-bold text-rose-800">
            <CircleAlert className="h-7 w-7" aria-hidden="true" />
            <p>{plansTask.error.message}</p>
            {plansTask.canRetry && (
              <button type="button" onClick={() => void plansTask.retry()} className="inline-flex min-h-11 items-center gap-2 bg-rose-800 px-5 text-xs text-white transition hover:bg-rose-900">
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> إعادة المحاولة
              </button>
            )}
          </div>
        )}

        {!plansTask.loading && !plansTask.error && plans.length === 0 && (
          <div className="mx-auto my-12 max-w-2xl border border-[#cfc6b6] bg-[#f8f6f1] px-6 py-10 text-center">
            <Store className="mx-auto h-8 w-8 text-[#806a42]" aria-hidden="true" />
            <h3 className="mt-4 text-lg font-black">الباقات قيد التجهيز</h3>
            <p className="mt-2 text-sm font-medium leading-7 text-slate-600">لم ينشر مدير المنصة باقات متاحة بعد. يمكنك العودة لاحقًا أو التواصل مع الدعم.</p>
          </div>
        )}

        {!plansTask.loading && !plansTask.error && plans.length > 0 && (
          <>
            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {plans.map((plan, index) => {
                const verifiedFeatures = plan.features
                  .map((feature) => verifiedFeatureLabels[feature])
                  .filter((feature): feature is string => Boolean(feature));
                const isGrowthPlan = plan.key === "pro";

                return (
                  <article
                    key={plan.key}
                    className={`relative flex min-h-[430px] flex-col border p-7 text-right sm:p-8 ${isGrowthPlan ? "border-[#b79a61] bg-[#081725] text-white shadow-[0_24px_60px_rgba(8,23,37,0.18)]" : "border-[#cec5b6] bg-[#f8f6f1] text-[#081725]"}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className={`text-[10px] font-black tracking-[0.12em] ${isGrowthPlan ? "text-[#d5bd87]" : "text-[#806a42]"}`}>الباقة {String(index + 1).padStart(2, "0")}</p>
                        <h3 className="mt-3 text-2xl font-black">{plan.name}</h3>
                      </div>
                      {isGrowthPlan && <span className="border border-[#d5bd87] px-3 py-1.5 text-[10px] font-black text-[#e4cf9f]">للمتجر المتنامي</span>}
                    </div>

                    <div className={`my-7 border-y py-5 ${isGrowthPlan ? "border-white/15" : "border-[#ded6ca]"}`}>
                      <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
                        <span className="font-display text-4xl font-black leading-none sm:text-5xl">{planPriceLabel(plan)}</span>
                        {plan.priceMinor > 0 && <span className={`pb-1 text-xs font-bold ${isGrowthPlan ? "text-slate-300" : "text-slate-500"}`}>شهريًا</span>}
                      </div>
                    </div>

                    <ul className={`flex-1 space-y-4 text-sm font-bold ${isGrowthPlan ? "text-slate-200" : "text-slate-700"}`}>
                      {[storeLimitLabel(plan), productLimitLabel(plan), ...verifiedFeatures].map((item) => (
                        <li key={item} className="flex items-start gap-3">
                          <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center border ${isGrowthPlan ? "border-[#d5bd87] text-[#d5bd87]" : "border-[#b79a61] text-[#806a42]"}`}>
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>

                    <p className={`mt-7 border-r-2 px-4 py-1 text-[11px] font-bold leading-6 ${isGrowthPlan ? "border-[#d5bd87] text-slate-300" : "border-[#b79a61] text-slate-600"}`}>
                      {activationLabel(plan)}
                    </p>
                  </article>
                );
              })}
            </div>

            <div className="mt-8 flex flex-col items-start justify-between gap-5 border border-[#cfc6b6] bg-[#f8f6f1] px-6 py-6 sm:flex-row sm:items-center sm:px-8">
              <div className="text-right">
                <p className="text-base font-black">ستختار الباقة وتراجع شروطها داخل رحلة إنشاء المتجر.</p>
                <p className="mt-1 text-xs font-medium leading-6 text-slate-500">لا يتم تحصيل دفع إلكتروني من هذه الصفحة، ولا يصبح المتجر منشورًا بمجرد اختيار الباقة.</p>
              </div>
              <button type="button" onClick={onStart} className="group inline-flex min-h-12 shrink-0 items-center justify-center gap-3 bg-[#b18a46] px-6 text-sm font-black text-white transition hover:bg-[#957239]">
                <span>ابدأ إنشاء متجرك</span>
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" aria-hidden="true" />
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
