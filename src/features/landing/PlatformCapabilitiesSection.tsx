import { useState, type ReactNode } from "react";
import {
  Boxes,
  CheckCircle2,
  ClipboardList,
  Eye,
  LayoutTemplate,
  Package,
  Palette,
  ReceiptText,
  Send,
  ShoppingBag,
} from "lucide-react";

type CapabilityId = "catalog" | "orders" | "storefront";

const capabilities = [
  {
    id: "catalog" as const,
    label: "المنتجات والمخزون",
    title: "كتالوج منظم ومخزون تحت السيطرة",
    description: "أضف المنتجات والأسعار والعروض، وراجع حالة النشر والرصيد الفعلي والمحجوز من مساحة واحدة.",
    icon: Package,
    points: ["إضافة المنتجات وتعديل بياناتها", "أسعار أساسية وعروض بيع واضحة", "متابعة الرصيد والمتاح والمحجوز"],
  },
  {
    id: "orders" as const,
    label: "الطلبات والعملاء",
    title: "كل طلب واضح من لحظة استلامه",
    description: "اطّلع على العميل والعناصر والمبلغ وطريقة الدفع، ثم حدّث حالة الطلب وفق انتقالات محفوظة على الخادم.",
    icon: ClipboardList,
    points: ["تفاصيل العميل والتسليم", "عناصر الطلب والتسعير النهائي", "سجل زمني لحالة الطلب"],
  },
  {
    id: "storefront" as const,
    label: "الهوية والنشر",
    title: "واجهة تعبّر عن متجرك قبل نشرها",
    description: "عدّل الهوية والمحتوى وترتيب الأقسام، وشاهد النتيجة قبل حفظها ثم انشر الرابط بعد اكتمال الاعتماد والتجهيز.",
    icon: Palette,
    points: ["هوية وألوان ومحتوى المتجر", "معاينة متجاوبة قبل الحفظ", "رابط عام بعد الاعتماد والنشر"],
  },
] as const;

function CatalogPreview() {
  const products = [
    { name: "عطر ريالي صنعاء", price: "18,500 YER", stock: "24", status: "منشور" },
    { name: "مبخرة حجرية", price: "12,500 YER", stock: "8", status: "منشور" },
    { name: "صندوق هدية فاخر", price: "22,000 YER", stock: "—", status: "مسودة" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          ["المنتجات", "كتالوج مركزي"],
          ["المخزون", "فعلي ومحجوز"],
          ["النشر", "مسودة أو منشور"],
        ].map(([label, value]) => (
          <div key={label} className="border border-[#d9d2c6] bg-white px-3 py-4 text-right sm:px-4">
            <p className="text-[10px] font-bold text-slate-500 sm:text-xs">{label}</p>
            <p className="mt-2 text-xs font-black text-[#081725] sm:text-sm">{value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden border border-[#d9d2c6] bg-white">
        <div className="flex items-center justify-between border-b border-[#e4ded3] px-4 py-4">
          <div className="text-right">
            <p className="text-sm font-black text-[#081725]">المنتجات</p>
            <p className="mt-1 text-[10px] font-semibold text-slate-500">بيانات توضيحية لواجهة الإدارة</p>
          </div>
          <span className="grid h-9 w-9 place-items-center bg-[#081725] text-[#d5bd87]" aria-hidden="true"><Boxes className="h-4 w-4" /></span>
        </div>
        <div className="divide-y divide-[#ece7de]">
          {products.map((product) => (
            <div key={product.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_110px_70px_70px]">
              <div className="flex min-w-0 items-center gap-3 text-right">
                <span className="grid h-9 w-9 shrink-0 place-items-center bg-[#eee9df] text-[#806a42]" aria-hidden="true"><ShoppingBag className="h-4 w-4" /></span>
                <span className="truncate text-xs font-black text-[#081725] sm:text-sm">{product.name}</span>
              </div>
              <span className="text-left text-[10px] font-black text-slate-700 sm:text-right sm:text-xs" dir="ltr">{product.price}</span>
              <span className="hidden text-center text-xs font-bold text-slate-600 sm:block">{product.stock}</span>
              <span className={`hidden border px-2 py-1 text-center text-[10px] font-black sm:block ${product.status === "منشور" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{product.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OrdersPreview() {
  return (
    <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
      <div className="border border-[#d9d2c6] bg-white p-4 text-right">
        <div className="flex items-center justify-between border-b border-[#ece7de] pb-4">
          <div>
            <p className="text-sm font-black text-[#081725]">تفاصيل الطلب</p>
            <p className="mt-1 text-[10px] font-semibold text-slate-500">نموذج توضيحي</p>
          </div>
          <ReceiptText className="h-5 w-5 text-[#806a42]" aria-hidden="true" />
        </div>
        <dl className="mt-4 space-y-3 text-xs">
          {[
            ["رقم الطلب", "#1042"],
            ["العميل", "محمد أحمد"],
            ["طريقة الدفع", "الدفع عند الاستلام"],
            ["الإجمالي", "31,000 YER"],
          ].map(([term, value]) => (
            <div key={term} className="flex items-center justify-between gap-4">
              <dt className="font-semibold text-slate-500">{term}</dt>
              <dd className="font-black text-[#081725]" dir={term === "الإجمالي" ? "ltr" : undefined}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="border border-[#d9d2c6] bg-white p-4 text-right">
        <p className="text-sm font-black text-[#081725]">مسار الحالة</p>
        <ol className="mt-5 space-y-0">
          {[
            ["طلب جديد", "تم استلام الطلب من المتجر"],
            ["قيد التجهيز", "أكد التاجر بدء تجهيز المنتجات"],
            ["جاهز للتسليم", "الخطوة التالية المتاحة"],
          ].map(([title, description], index) => (
            <li key={title} className="relative flex gap-3 pb-6 last:pb-0">
              {index < 2 && <span className="absolute right-[11px] top-6 h-full w-px bg-[#d8d1c4]" aria-hidden="true" />}
              <span className={`relative z-10 mt-0.5 grid h-6 w-6 shrink-0 place-items-center border ${index < 2 ? "border-[#b79a61] bg-[#081725] text-[#d5bd87]" : "border-[#b79a61] bg-[#f8f6f1] text-[#806a42]"}`} aria-hidden="true">
                {index < 2 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Send className="h-3 w-3" />}
              </span>
              <div>
                <p className="text-xs font-black text-[#081725]">{title}</p>
                <p className="mt-1 text-[10px] font-semibold leading-5 text-slate-500">{description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function StorefrontPreview() {
  return (
    <div className="overflow-hidden border border-[#d9d2c6] bg-white">
      <div className="flex items-center justify-between border-b border-[#d9d2c6] bg-[#f2ede4] px-4 py-3">
        <div className="flex gap-1.5" aria-hidden="true"><span className="h-2 w-2 rounded-full bg-[#b79a61]" /><span className="h-2 w-2 rounded-full bg-[#cfc6b6]" /><span className="h-2 w-2 rounded-full bg-[#cfc6b6]" /></div>
        <p className="text-[10px] font-black text-slate-600">معاينة المتجر</p>
      </div>
      <div className="grid min-h-[310px] sm:grid-cols-[150px_minmax(0,1fr)]">
        <aside className="hidden border-l border-[#e4ded3] bg-[#faf8f3] p-4 text-right sm:block" aria-label="نموذج أدوات التخصيص">
          <p className="text-xs font-black text-[#081725]">الهوية</p>
          <div className="mt-5 space-y-5">
            <div><p className="text-[9px] font-bold text-slate-500">اللون الرئيسي</p><div className="mt-2 flex gap-2"><span className="h-7 flex-1 bg-[#081725]" /><span className="h-7 flex-1 bg-[#b79a61]" /><span className="h-7 flex-1 bg-[#ece5d8]" /></div></div>
            <div><p className="text-[9px] font-bold text-slate-500">نمط الخط</p><div className="mt-2 border border-[#ddd5c8] bg-white px-3 py-2 text-[10px] font-black">خط عربي واضح</div></div>
            <div><p className="text-[9px] font-bold text-slate-500">ترتيب الأقسام</p><div className="mt-2 space-y-1.5"><span className="block h-7 border border-[#ddd5c8] bg-white" /><span className="block h-7 border border-[#ddd5c8] bg-white" /></div></div>
          </div>
        </aside>
        <div className="bg-[#eee9df] p-4 sm:p-5">
          <div className="flex items-center justify-between border-b border-[#d8d1c4] bg-white px-4 py-3">
            <span className="text-[10px] font-black text-[#081725]">متجر نُور</span>
            <div className="flex gap-3 text-[9px] font-bold text-slate-500"><span>الرئيسية</span><span>المنتجات</span><span>عن المتجر</span></div>
          </div>
          <div className="relative min-h-44 bg-[#081725] px-5 py-8 text-right text-white sm:px-7">
            <span className="text-[9px] font-black tracking-wider text-[#d5bd87]">اختيارات منتقاة بعناية</span>
            <p className="mt-3 max-w-xs font-display text-2xl font-black leading-tight sm:text-3xl">واجهة تليق بقصة متجرك</p>
            <p className="mt-3 text-[10px] font-medium text-slate-300">معاينة فورية قبل الحفظ والنشر</p>
            <span className="absolute bottom-0 left-0 h-20 w-24 bg-gradient-to-tr from-[#b79a61]/35 to-transparent" aria-hidden="true" />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2"><span className="h-10 bg-white" /><span className="h-10 bg-white" /><span className="h-10 bg-white" /></div>
        </div>
      </div>
    </div>
  );
}

const previews: Record<CapabilityId, () => ReactNode> = {
  catalog: CatalogPreview,
  orders: OrdersPreview,
  storefront: StorefrontPreview,
};

export default function PlatformCapabilitiesSection() {
  const [activeId, setActiveId] = useState<CapabilityId>("catalog");
  const activeCapability = capabilities.find((capability) => capability.id === activeId) ?? capabilities[0];
  const ActivePreview = previews[activeId];

  return (
    <section className="bg-[#081725] px-5 py-20 text-white sm:px-8 sm:py-24 lg:px-12 lg:py-28" aria-labelledby="platform-capabilities-title">
      <div className="mx-auto max-w-[1440px]">
        <div className="grid items-end gap-8 border-b border-white/20 pb-10 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.58fr)]">
          <div className="text-right">
            <p className="text-xs font-black tracking-[0.14em] text-[#d5bd87]">إمكانات مبنية للعمل الحقيقي</p>
            <h2 id="platform-capabilities-title" className="mt-4 max-w-3xl font-display text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              كل ما تحتاجه لإدارة متجرك من مكان واحد
            </h2>
          </div>
          <p className="max-w-xl text-sm font-medium leading-7 text-slate-300 sm:text-base lg:justify-self-end">
            من إدارة الكتالوج والطلبات إلى تخصيص الواجهة ونشر الرابط، تبقى عمليات متجرك الأساسية داخل مساحة عمل واضحة.
          </p>
        </div>

        <div className="mt-12 grid gap-7 xl:grid-cols-[390px_minmax(0,1fr)] xl:items-start">
          <div className="grid gap-2" role="tablist" aria-label="إمكانات إدارة المتجر">
            {capabilities.map(({ id, label, icon: Icon }) => {
              const selected = id === activeId;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  id={`capability-tab-${id}`}
                  aria-selected={selected}
                  aria-controls={`capability-panel-${id}`}
                  onClick={() => setActiveId(id)}
                  className={`flex min-h-16 items-center justify-between gap-4 border px-5 text-right text-sm font-black transition ${selected ? "border-[#b79a61] bg-[#f4efe5] text-[#081725]" : "border-white/15 bg-white/[0.04] text-white hover:border-white/35 hover:bg-white/[0.08]"}`}
                >
                  <span>{label}</span>
                  <Icon className={`h-5 w-5 ${selected ? "text-[#806a42]" : "text-[#d5bd87]"}`} strokeWidth={1.6} aria-hidden="true" />
                </button>
              );
            })}
          </div>

          <article
            key={activeId}
            id={`capability-panel-${activeId}`}
            role="tabpanel"
            aria-labelledby={`capability-tab-${activeId}`}
            className="grid gap-7 bg-[#f4efe5] p-5 text-[#081725] sm:p-7 lg:grid-cols-[minmax(250px,0.52fr)_minmax(0,1fr)] lg:p-9"
          >
            <div className="order-2 text-right lg:order-1">
              <p className="text-[10px] font-black tracking-[0.12em] text-[#806a42]">{activeCapability.label}</p>
              <h3 className="mt-4 font-display text-2xl font-black leading-tight sm:text-3xl">{activeCapability.title}</h3>
              <p className="mt-5 text-sm font-medium leading-7 text-slate-600">{activeCapability.description}</p>
              <ul className="mt-7 space-y-4">
                {activeCapability.points.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm font-bold text-slate-700">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center border border-[#b79a61] text-[#806a42]" aria-hidden="true"><CheckCircle2 className="h-3 w-3" /></span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="order-1 min-w-0 lg:order-2">
              <div className="mb-3 flex items-center justify-between text-[10px] font-bold text-slate-500">
                <span className="inline-flex items-center gap-2"><Eye className="h-3.5 w-3.5" aria-hidden="true" /> معاينة توضيحية</span>
                <span className="inline-flex items-center gap-2"><LayoutTemplate className="h-3.5 w-3.5" aria-hidden="true" /> مساحة التاجر</span>
              </div>
              <ActivePreview />
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
