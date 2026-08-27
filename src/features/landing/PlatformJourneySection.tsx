import { ArrowLeft, Eye, LayoutTemplate, Send, ShieldCheck, Store, UserRoundCheck } from "lucide-react";

interface PlatformJourneySectionProps {
  platformName: string;
  ctaLabel: string;
  onStart: () => void;
}

const trustItems = [
  {
    icon: ShieldCheck,
    title: "مساحة مستقلة لكل متجر",
    description: "بيانات وإدارة كل متجر مرتبطة بصاحبها داخل حسابه.",
  },
  {
    icon: Eye,
    title: "معاينة قبل الإرسال",
    description: "شاهد الهوية والقالب قبل أن يصل طلبك إلى المراجعة.",
  },
  {
    icon: UserRoundCheck,
    title: "مسار مراجعة واضح",
    description: "تابع حالة الطلب حتى الاعتماد والتجهيز والنشر.",
  },
] as const;

const journeySteps = [
  {
    number: "01",
    icon: UserRoundCheck,
    title: "أنشئ حسابك",
    description: "سجّل بياناتك الأساسية، ثم عرّف نشاطك التجاري من خلال رحلة قصيرة وواضحة.",
  },
  {
    number: "02",
    icon: LayoutTemplate,
    title: "صمّم واجهة متجرك",
    description: "اختر نقطة البداية المناسبة، وخصّص هوية المتجر مع معاينة النتيجة قبل الإرسال.",
  },
  {
    number: "03",
    icon: Send,
    title: "أرسل الطلب للمراجعة",
    description: "راجع البيانات والعنوان والباقات، ثم تابع حالة الطلب من بوابة التاجر.",
  },
  {
    number: "04",
    icon: Store,
    title: "أدر متجرك وانشره",
    description: "بعد الاعتماد والتجهيز، أضف منتجاتك وأدر طلباتك وانشر الرابط المخصص لعملائك.",
  },
] as const;

export default function PlatformJourneySection({ platformName, ctaLabel, onStart }: PlatformJourneySectionProps) {
  return (
    <section id="how-it-works" className="scroll-mt-6 bg-[#f8f6f1] text-[#081725]" aria-labelledby="platform-journey-title">
      <div className="border-y border-[#d8d1c4] bg-[#eee9df]">
        <div className="mx-auto grid max-w-[1440px] divide-y divide-[#d8d1c4] px-5 sm:px-8 md:grid-cols-3 md:divide-x md:divide-x-reverse md:divide-y-0 lg:px-12">
          {trustItems.map(({ icon: Icon, title, description }) => (
            <article key={title} className="flex min-h-32 items-start gap-4 px-1 py-7 md:px-6 lg:px-9">
              <span className="grid h-11 w-11 shrink-0 place-items-center border border-[#b79a61] text-[#806a42]" aria-hidden="true">
                <Icon className="h-5 w-5" strokeWidth={1.6} />
              </span>
              <div className="text-right">
                <h2 className="text-sm font-black text-[#081725] sm:text-base">{title}</h2>
                <p className="mt-2 text-xs font-medium leading-6 text-slate-600 sm:text-sm">{description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28">
        <div className="grid items-end gap-8 border-b border-[#cbc2b2] pb-10 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.58fr)]">
          <div className="text-right">
            <p className="text-xs font-black tracking-[0.14em] text-[#806a42]">من الفكرة إلى رابط جاهز لعملائك</p>
            <h2 id="platform-journey-title" className="mt-4 max-w-3xl font-display text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              كيف تبدأ متجرك على {platformName}؟
            </h2>
          </div>
          <p className="max-w-xl text-sm font-medium leading-7 text-slate-600 sm:text-base lg:justify-self-end">
            رحلة واحدة مرتبة تحفظ تقدمك، وتوضح لك الإجراء التالي من التسجيل حتى إدارة المتجر بعد نشره.
          </p>
        </div>

        <ol className="mt-12 grid gap-px overflow-hidden border border-[#cbc2b2] bg-[#cbc2b2] md:grid-cols-2 xl:grid-cols-4">
          {journeySteps.map(({ number, icon: Icon, title, description }) => (
            <li key={number} className="group relative min-h-72 bg-[#f8f6f1] px-7 py-8 text-right transition-colors hover:bg-[#f2ede3] sm:px-8">
              <div className="flex items-start justify-between gap-4" aria-hidden="true">
                <span className="grid h-12 w-12 place-items-center bg-[#081725] text-[#d5bd87] transition-transform group-hover:-translate-y-1">
                  <Icon className="h-5 w-5" strokeWidth={1.6} />
                </span>
                <span className="font-display text-4xl font-black tracking-tight text-[#c8bda9]">{number}</span>
              </div>
              <h3 className="mt-9 text-xl font-black text-[#081725]">{title}</h3>
              <p className="mt-4 text-sm font-medium leading-7 text-slate-600">{description}</p>
              <span className="absolute inset-x-7 bottom-0 h-1 origin-right scale-x-0 bg-[#b79a61] transition-transform duration-300 group-hover:scale-x-100" aria-hidden="true" />
            </li>
          ))}
        </ol>

        <div className="mt-10 flex flex-col items-start justify-between gap-6 border-r-4 border-[#b79a61] bg-[#081725] px-7 py-7 text-white sm:flex-row sm:items-center sm:px-9">
          <div className="text-right">
            <p className="text-lg font-black">ابدأ بخطوة واضحة، وأكمل الباقي من بوابة واحدة.</p>
            <p className="mt-1 text-sm font-medium leading-6 text-slate-300">لن تحتاج إلى بناء تقني أو التنقل بين أدوات منفصلة لبدء متجرك.</p>
          </div>
          <button type="button" onClick={onStart} className="group inline-flex min-h-12 shrink-0 items-center justify-center gap-3 bg-[#f4efe5] px-6 text-sm font-black text-[#081725] transition hover:bg-white">
            <span>{ctaLabel}</span>
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
