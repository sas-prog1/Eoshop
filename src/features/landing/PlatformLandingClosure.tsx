import {
  ArrowLeft,
  ChevronDown,
  LogIn,
  Mail,
  MessageCircle,
  Phone,
  Store,
} from "lucide-react";

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
  supportEmail: string | null;
  supportPhone: string | null;
  supportWhatsapp: string | null;
}

interface PlatformLandingClosureProps {
  settings: LandingSettingsProjection;
  navigation: LandingNavigationItem[];
  user: { fullName: string } | null;
  onNavigate: (key: PlatformNavigationKey) => void;
  onStart: () => void;
  onLogin: () => void;
}

const faqItems = [
  {
    question: "هل أستطيع حفظ التجهيز والعودة إليه لاحقًا؟",
    answer: "نعم. تحفظ رحلة إنشاء المتجر مسودتك على الخادم، ويمكنك متابعتها من بوابة التاجر دون بدء الطلب من جديد.",
  },
  {
    question: "متى يظهر متجري لإدارة المنصة؟",
    answer: "بعد استكمال البيانات والتصميم والعنوان والباقة ومتطلبات ملف الطلب، ثم إرسال الطلب للمراجعة من الخطوة الأخيرة.",
  },
  {
    question: "متى أحصل على رابط المتجر العام؟",
    answer: "تختار عنوان المتجر أثناء التجهيز. يصبح الرابط متاحًا للعملاء بعد الاعتماد واكتمال التجهيز وقيام التاجر بالنشر.",
  },
  {
    question: "هل يتم دفع قيمة الباقة إلكترونيًا الآن؟",
    answer: "لا. اختيار الباقة يسجلها ضمن طلب المتجر. الباقات التي تتطلب تفعيلًا إداريًا لا تُعد مدفوعة أو مفعلة بمجرد اختيارها.",
  },
  {
    question: "ماذا أستطيع إدارة بعد نشر المتجر؟",
    answer: "بحسب صلاحيات حسابك، تستطيع إدارة هوية المتجر ومحتواه ومنتجاته ومخزونه وطلباته، ومتابعة حالة النشر من بوابة التاجر.",
  },
] as const;

function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] || "التاجر";
}

export default function PlatformLandingClosure({
  settings,
  navigation,
  user,
  onNavigate,
  onStart,
  onLogin,
}: PlatformLandingClosureProps) {
  const supportAvailable = Boolean(settings.supportEmail || settings.supportPhone || settings.supportWhatsapp);

  return (
    <>
      <section className="bg-[#f8f6f1] px-5 py-20 text-[#081725] sm:px-8 sm:py-24 lg:px-12 lg:py-28" aria-labelledby="platform-faq-title">
        <div className="mx-auto grid max-w-[1440px] gap-12 xl:grid-cols-[minmax(280px,0.62fr)_minmax(0,1fr)] xl:gap-20">
          <div className="text-right xl:sticky xl:top-8 xl:self-start">
            <p className="text-xs font-black tracking-[0.14em] text-[#806a42]">إجابات قبل أن تبدأ</p>
            <h2 id="platform-faq-title" className="mt-4 max-w-xl font-display text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              أسئلة واضحة عن إنشاء متجرك
            </h2>
            <p className="mt-6 max-w-lg text-sm font-medium leading-7 text-slate-600 sm:text-base">
              هذه الإجابات تصف المسار التشغيلي الحالي للمنصة، من حفظ المسودة حتى حصول متجرك على رابط منشور.
            </p>
          </div>

          <div className="border-t border-[#cfc6b6]">
            {faqItems.map((item, index) => (
              <details key={item.question} className="group border-b border-[#cfc6b6]" open={index === 0 ? true : undefined}>
                <summary className="flex min-h-20 cursor-pointer list-none items-center justify-between gap-5 py-5 text-right marker:content-none">
                  <span className="text-base font-black leading-7 sm:text-lg">{item.question}</span>
                  <span className="grid h-9 w-9 shrink-0 place-items-center border border-[#b79a61] text-[#806a42] transition group-open:bg-[#081725] group-open:text-[#d5bd87]" aria-hidden="true">
                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                  </span>
                </summary>
                <p className="max-w-3xl pb-7 pl-12 text-sm font-medium leading-7 text-slate-600 sm:text-base">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f8f6f1] px-5 pb-20 sm:px-8 sm:pb-24 lg:px-12 lg:pb-28" aria-labelledby="platform-final-cta-title">
        <div className="relative mx-auto max-w-[1440px] overflow-hidden bg-[#081725] px-7 py-12 text-white sm:px-10 sm:py-16 lg:px-16 lg:py-20">
          <div className="absolute inset-y-0 left-0 w-1/3 bg-[linear-gradient(135deg,transparent_15%,rgba(213,189,135,0.11)_15%,rgba(213,189,135,0.11)_16%,transparent_16%,transparent_42%,rgba(213,189,135,0.08)_42%,rgba(213,189,135,0.08)_43%,transparent_43%)]" aria-hidden="true" />
          <div className="relative grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="max-w-3xl text-right">
              <p className="text-xs font-black tracking-[0.14em] text-[#d5bd87]">ابدأ بخطوة واحدة واضحة</p>
              <h2 id="platform-final-cta-title" className="mt-4 font-display text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                حوّل نشاطك إلى متجر تستطيع إدارته ومشاركته
              </h2>
              <p className="mt-5 max-w-2xl text-sm font-medium leading-7 text-slate-300 sm:text-base">
                أنشئ حسابك، جهّز متجرك على مراحل، وراجع النتيجة قبل أن ترسل طلبك إلى إدارة المنصة.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <button type="button" onClick={onStart} className="group inline-flex min-h-12 items-center justify-center gap-3 bg-[#b18a46] px-7 text-sm font-black text-white transition hover:bg-[#957239]">
                <span>{user ? "إنشاء متجر جديد" : "ابدأ إنشاء متجرك"}</span>
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" aria-hidden="true" />
              </button>
              {!user && (
                <button type="button" onClick={onLogin} className="inline-flex min-h-12 items-center justify-center gap-3 border border-white/25 px-7 text-sm font-black text-white transition hover:border-[#d5bd87] hover:text-[#e4cf9f]">
                  <LogIn className="h-4 w-4" aria-hidden="true" /> لدي حساب بالفعل
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#050e18] px-5 py-12 text-slate-400 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[1440px]">
          <div className={`grid gap-10 ${supportAvailable ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
            <div className="text-right">
              <div className="flex items-center gap-3">
                {settings.logoUrl ? (
                  <img src={settings.logoUrl} alt={`شعار ${settings.platformName}`} className="h-11 w-11 border border-white/15 bg-white object-contain p-1" referrerPolicy="no-referrer" />
                ) : (
                  <span className="grid h-11 w-11 place-items-center border border-[#d5bd87]/50 text-[#d5bd87]"><Store className="h-5 w-5" aria-hidden="true" /></span>
                )}
                <span><span className="block font-display text-xl font-black text-white">{settings.platformName}</span>{settings.tagline && <span className="mt-1 block text-[11px] font-semibold text-slate-400">{settings.tagline}</span>}</span>
              </div>
              <p className="mt-5 max-w-sm text-xs font-medium leading-6 text-slate-500">منصة تساعد أصحاب الأنشطة على إنشاء متاجر رقمية وإدارتها ضمن رحلة واضحة ومراجعة منظمة.</p>
            </div>

            <nav aria-label="روابط أقسام الصفحة" className="text-right">
              <h2 className="text-xs font-black tracking-[0.12em] text-[#d5bd87]">استكشف المنصة</h2>
              <div className="mt-5 flex flex-col items-start gap-3">
                {navigation.map((item) => (
                  <button key={item.key} type="button" onClick={() => onNavigate(item.key)} className="min-h-8 text-sm font-bold text-slate-300 transition hover:text-white">
                    {item.label}
                  </button>
                ))}
              </div>
            </nav>

            {supportAvailable && (
              <div className="text-right">
                <h2 className="text-xs font-black tracking-[0.12em] text-[#d5bd87]">تواصل مع الدعم</h2>
                <div className="mt-5 flex flex-col items-start gap-3 text-sm font-bold" aria-label="قنوات دعم المنصة">
                  {settings.supportEmail && <a className="inline-flex min-h-8 items-center gap-2 transition hover:text-white" dir="ltr" href={`mailto:${settings.supportEmail}`}><Mail className="h-4 w-4" aria-hidden="true" />{settings.supportEmail}</a>}
                  {settings.supportPhone && <a className="inline-flex min-h-8 items-center gap-2 transition hover:text-white" dir="ltr" href={`tel:${settings.supportPhone}`}><Phone className="h-4 w-4" aria-hidden="true" />{settings.supportPhone}</a>}
                  {settings.supportWhatsapp && <a className="inline-flex min-h-8 items-center gap-2 transition hover:text-white" href={`https://wa.me/${settings.supportWhatsapp.slice(1)}`} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" aria-hidden="true" />واتساب الدعم</a>}
                </div>
              </div>
            )}
          </div>

          <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-[11px] font-medium text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>© {new Date().getFullYear()} {settings.platformName}. جميع الحقوق محفوظة.</span>
            {user && <span>مرحبًا {firstName(user.fullName)}، يمكنك متابعة متاجرك من بوابة التاجر.</span>}
          </div>
        </div>
      </footer>
    </>
  );
}
