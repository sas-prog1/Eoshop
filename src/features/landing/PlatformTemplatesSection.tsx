import { useState } from "react";
import { ArrowLeft, Check, Monitor, ShoppingBag, Smartphone, Store } from "lucide-react";

import heroImage from "../../assets/images/hero_banner_perfume_1785918166890.jpg";
import { ONBOARDING_TEMPLATES, type OnboardingTemplateKey } from "../onboarding/storeTemplates";

interface PlatformTemplatesSectionProps {
  onStart: () => void;
}

type PreviewDevice = "desktop" | "mobile";

export default function PlatformTemplatesSection({ onStart }: PlatformTemplatesSectionProps) {
  const [selectedKey, setSelectedKey] = useState<OnboardingTemplateKey>("elegant");
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const selectedTemplate = ONBOARDING_TEMPLATES.find((template) => template.key === selectedKey) ?? ONBOARDING_TEMPLATES[0];
  const { appearance } = selectedTemplate;

  return (
    <section id="templates" className="scroll-mt-6 bg-[#f8f6f1] px-5 py-20 text-[#081725] sm:px-8 sm:py-24 lg:px-12 lg:py-28" aria-labelledby="platform-templates-title">
      <div className="mx-auto max-w-[1440px]">
        <div className="grid items-end gap-8 border-b border-[#cbc2b2] pb-10 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.58fr)]">
          <div className="text-right">
            <p className="text-xs font-black tracking-[0.14em] text-[#806a42]">قوالب تبدأ منها وتبني عليها</p>
            <h2 id="platform-templates-title" className="mt-4 max-w-3xl font-display text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              اختر نقطة البداية الأقرب إلى نشاطك
            </h2>
          </div>
          <p className="max-w-xl text-sm font-medium leading-7 text-slate-600 sm:text-base lg:justify-self-end">
            القالب يحدد الانطباع الأول فقط؛ تستطيع تعديل الهوية والمحتوى والأقسام أثناء تجهيز متجرك وقبل إرساله للمراجعة.
          </p>
        </div>

        <div className="mt-12 grid gap-7 xl:grid-cols-[360px_minmax(0,1fr)] xl:items-start">
          <div className="space-y-3" aria-label="قوالب المتاجر المتاحة">
            {ONBOARDING_TEMPLATES.map((template) => {
              const selected = template.key === selectedKey;
              return (
                <button
                  key={template.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelectedKey(template.key)}
                  className={`w-full border p-5 text-right transition ${selected ? "border-[#b79a61] bg-[#081725] text-white shadow-[0_20px_50px_rgba(8,23,37,0.16)]" : "border-[#d8d1c4] bg-white text-[#081725] hover:border-[#b79a61]"}`}
                >
                  <span className="flex items-start justify-between gap-4">
                    <span>
                      <span className={`block text-[10px] font-black tracking-[0.1em] ${selected ? "text-[#d5bd87]" : "text-[#806a42]"}`}>{template.category}</span>
                      <span className="mt-2 block text-lg font-black">{template.name}</span>
                    </span>
                    <span className={`grid h-9 w-9 shrink-0 place-items-center border ${selected ? "border-[#d5bd87] bg-[#d5bd87] text-[#081725]" : "border-[#cfc6b6] text-[#806a42]"}`} aria-hidden="true">
                      {selected ? <Check className="h-4 w-4" /> : <Store className="h-4 w-4" />}
                    </span>
                  </span>
                  <span className={`mt-4 block text-xs font-medium leading-6 ${selected ? "text-slate-300" : "text-slate-600"}`}>{template.description}</span>
                  <span className={`mt-4 block border-t pt-4 text-[11px] font-bold leading-5 ${selected ? "border-white/15 text-slate-300" : "border-[#e7e1d7] text-slate-500"}`}>مناسب لـ: {template.bestFor}</span>
                </button>
              );
            })}

            <div className="border-r-4 border-[#b79a61] bg-[#eee9df] px-5 py-5 text-right">
              <p className="text-sm font-black">التخصيص لا يتوقف عند القالب</p>
              <p className="mt-2 text-xs font-medium leading-6 text-slate-600">بعد الاختيار تستطيع تغيير الألوان والخط والمحتوى وترتيب الأقسام من محرر المتجر.</p>
            </div>
          </div>

          <div className="min-w-0 border border-[#cfc6b6] bg-[#eee9df] p-3 sm:p-5">
            <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="text-right">
                <p className="text-sm font-black text-[#081725]">معاينة قالب {selectedTemplate.name}</p>
                <p className="mt-1 text-[10px] font-bold text-slate-500">محتوى تجريبي للعرض فقط — لا ينشئ طلبات فعلية</p>
              </div>
              <div className="inline-flex self-start border border-[#cfc6b6] bg-white p-1" aria-label="حجم معاينة القالب">
                <button type="button" onClick={() => setDevice("desktop")} aria-pressed={device === "desktop"} className={`inline-flex min-h-10 items-center gap-2 px-3 text-xs font-black ${device === "desktop" ? "bg-[#081725] text-white" : "text-slate-600"}`}><Monitor className="h-4 w-4" aria-hidden="true" /> كمبيوتر</button>
                <button type="button" onClick={() => setDevice("mobile")} aria-pressed={device === "mobile"} className={`inline-flex min-h-10 items-center gap-2 px-3 text-xs font-black ${device === "mobile" ? "bg-[#081725] text-white" : "text-slate-600"}`}><Smartphone className="h-4 w-4" aria-hidden="true" /> جوال</button>
              </div>
            </div>

            <div className={`mx-auto overflow-hidden bg-white shadow-[0_24px_70px_rgba(8,23,37,0.14)] transition-[max-width] duration-300 ${device === "mobile" ? "max-w-[390px]" : "max-w-none"}`} data-testid="template-preview" data-device={device}>
              <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: appearance.secondaryColor, color: "white" }}>
                <div className="flex items-center gap-2 text-right">
                  <span className="grid h-8 w-8 place-items-center border border-white/25"><Store className="h-4 w-4" aria-hidden="true" /></span>
                  <span><span className="block text-xs font-black">{selectedTemplate.name}</span><span className="block text-[8px] text-white/65">{appearance.slogan}</span></span>
                </div>
                <div className={`items-center gap-4 text-[9px] font-bold text-white/75 ${device === "mobile" ? "hidden" : "flex"}`}><span>الرئيسية</span><span>المنتجات</span><span>عن المتجر</span><span>التواصل</span></div>
                <span className="inline-flex items-center gap-1.5 border border-white/20 px-2.5 py-1.5 text-[9px] font-black"><ShoppingBag className="h-3 w-3" aria-hidden="true" /> السلة</span>
              </div>

              <div
                className={`relative isolate overflow-hidden px-6 py-10 text-right text-white sm:px-9 ${device === "mobile" ? "min-h-56" : "min-h-64"}`}
                style={selectedKey === "elegant"
                  ? { backgroundImage: `linear-gradient(90deg, ${appearance.secondaryColor}E6, ${appearance.primaryColor}8C), url(${heroImage})`, backgroundSize: "cover", backgroundPosition: "center" }
                  : { background: `linear-gradient(135deg, ${appearance.secondaryColor} 0%, ${appearance.primaryColor} 72%, #38BDF8 150%)` }}
              >
                {selectedKey === "tech" && <div className="absolute inset-0 -z-10 opacity-20" aria-hidden="true" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />}
                <span className="inline-block border border-white/35 bg-black/15 px-3 py-1 text-[9px] font-black">{appearance.heroBannerBadge}</span>
                <h3 className={`mt-5 max-w-2xl font-display font-black leading-tight ${device === "mobile" ? "text-2xl" : "text-3xl sm:text-4xl"}`}>{appearance.heroBannerTitle}</h3>
                <p className={`mt-3 max-w-xl font-medium leading-6 text-white/80 ${device === "mobile" ? "text-[10px]" : "text-xs"}`}>{appearance.heroBannerSubtitle}</p>
                <span className="mt-6 inline-block px-4 py-2 text-[10px] font-black" style={{ backgroundColor: appearance.primaryColor, color: "white" }}>{appearance.heroBannerButtonText}</span>
              </div>

              <div className={`grid gap-3 p-4 sm:p-5 ${device === "mobile" ? "grid-cols-1" : "grid-cols-3"}`} style={{ backgroundColor: appearance.bgColor }}>
                {selectedTemplate.sampleProducts.map((product, index) => (
                  <article key={product.id} className="overflow-hidden border bg-white text-right" style={{ borderColor: appearance.borderColor }}>
                    <div className="relative h-24 overflow-hidden" style={{ background: `linear-gradient(135deg, ${selectedTemplate.previewProducts[index]} 0%, ${appearance.cardBgColor} 100%)` }}>
                      <span className="absolute bottom-3 left-3 h-14 w-14 rounded-full border border-white/60 bg-white/30" aria-hidden="true" />
                      <span className="absolute right-4 top-4 text-[9px] font-black" style={{ color: appearance.secondaryColor }}>منتج مختار</span>
                    </div>
                    <div className="p-3">
                      <h4 className="truncate text-xs font-black" style={{ color: appearance.textColor }}>{product.name}</h4>
                      <div className="mt-3 flex items-center justify-between gap-2"><span className="text-[10px] font-black" style={{ color: appearance.primaryColor }} dir="ltr">{product.price.toLocaleString("en-US")} YER</span><span className="px-2 py-1 text-[9px] font-black text-white" style={{ backgroundColor: appearance.primaryColor }}>إضافة</span></div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-5 border border-[#cfc6b6] bg-white px-6 py-6 sm:flex-row sm:items-center sm:px-8">
          <div className="text-right"><p className="text-base font-black">اختر القالب النهائي داخل رحلة إنشاء المتجر.</p><p className="mt-1 text-xs font-medium leading-6 text-slate-500">ستتمكن من معاينته وتخصيصه قبل إرسال طلبك للمراجعة.</p></div>
          <button type="button" onClick={onStart} className="group inline-flex min-h-12 shrink-0 items-center justify-center gap-3 bg-[#081725] px-6 text-sm font-black text-white transition hover:bg-[#142c40]">
            <span>ابدأ إنشاء متجرك</span><ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
