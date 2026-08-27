import React from "react";
import { Clock3, CreditCard, MapPin, PackageCheck, Phone, UserRound, X } from "lucide-react";
import type { OrderDetail, OrderReceipt } from "../../adapters/uiAdapters";
import { merchantOrderActions, merchantOrderReasonLabel, merchantOrderStatusLabel, merchantPaymentMethodLabel } from "../../workflows/orderState";

interface MerchantOrderDetailProps {
  order: OrderDetail | null;
  loading: boolean;
  error: string | null;
  pending: boolean;
  onClose: () => void;
  onAdvance: (order: OrderReceipt, status: OrderReceipt["status"]) => void;
}

const money = (minor: number, currency: string) => `${(minor / 100).toFixed(2)} ${currency}`;

export default function MerchantOrderDetail({ order, loading, error, pending, onClose, onAdvance }: MerchantOrderDetailProps) {
  const handleAdvance = (status: OrderReceipt["status"], tone: "primary" | "danger") => {
    if (!order) return;
    if (tone === "danger" && !window.confirm("هل أنت متأكد من إلغاء الطلب؟ سيُعاد المخزون المحجوز ولا يمكن متابعة الطلب بعد الإلغاء.")) return;
    onAdvance(order, status);
  };

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-slate-950/60" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="merchant-order-detail-title" className="h-full w-full max-w-3xl overflow-y-auto bg-slate-50 shadow-2xl" dir="rtl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 p-5 backdrop-blur">
          <div><p className="text-xs font-bold text-sky-700">ملف الطلب الخادمي</p><h2 id="merchant-order-detail-title" className="mt-1 text-xl font-black">{order?.number ?? "تفاصيل الطلب"}</h2></div>
          <button type="button" onClick={onClose} aria-label="إغلاق تفاصيل الطلب" className="rounded-xl border border-slate-200 p-2 text-slate-600"><X className="h-5 w-5" /></button>
        </header>

        <div className="space-y-4 p-5">
          {loading && <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500">جارٍ تحميل ملف الطلب...</div>}
          {error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">{error}</div>}
          {order && (
            <>
              <section className="rounded-3xl bg-slate-950 p-5 text-white">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-slate-300">الحالة الحالية</p><p className="mt-1 text-xl font-black">{merchantOrderStatusLabel(order.status)}</p></div><div className="text-left"><p className="text-xs text-slate-300">الإجمالي النهائي</p><p className="mt-1 font-mono text-xl font-black">{money(order.totals.grandTotalMinor, order.currencyCode)}</p></div></div>
                {merchantOrderActions(order).length > 0 && <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">{merchantOrderActions(order).map((action) => <button key={action.status} type="button" disabled={pending} onClick={() => handleAdvance(action.status, action.tone)} className={action.tone === "danger" ? "rounded-xl border border-rose-300/40 bg-rose-500/10 px-4 py-2 text-xs font-black text-rose-100 disabled:opacity-50" : "rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-50"}>{action.label}</button>)}</div>}
              </section>

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-3xl border border-slate-200 bg-white p-5"><h3 className="flex items-center gap-2 font-black"><UserRound className="h-4 w-4 text-sky-600" /> العميل</h3><div className="mt-4 space-y-2 text-sm"><p className="font-black">{order.customer.name}</p><a href={`tel:${order.customer.phone}`} dir="ltr" className="flex items-center justify-end gap-2 text-sky-700"><Phone className="h-4 w-4" />{order.customer.phone}</a>{order.customer.email && <a href={`mailto:${order.customer.email}`} className="block text-sky-700">{order.customer.email}</a>}{order.customer.notes && <p className="rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-950">{order.customer.notes}</p>}</div></section>
                <section className="rounded-3xl border border-slate-200 bg-white p-5"><h3 className="flex items-center gap-2 font-black"><MapPin className="h-4 w-4 text-sky-600" /> عنوان التسليم</h3>{order.address ? <div className="mt-4 space-y-1 text-sm leading-7"><p className="font-black">{order.address.city} · {order.address.area}</p>{order.address.street && <p>{order.address.street}</p>}{order.address.details && <p className="text-slate-600">{order.address.details}</p>}</div> : <p className="mt-4 text-sm text-slate-500">لا يوجد عنوان مسجل.</p>}</section>
              </div>

              <section className="rounded-3xl border border-slate-200 bg-white p-5"><h3 className="flex items-center gap-2 font-black"><PackageCheck className="h-4 w-4 text-sky-600" /> المنتجات</h3><div className="mt-4 divide-y divide-slate-100">{order.items.map((item) => <div key={item.productId} className="grid grid-cols-[1fr_auto] gap-3 py-3 text-sm"><div><p className="font-black">{item.name}</p><p className="text-xs text-slate-500">{item.sku || "بدون SKU"} · الكمية {item.quantity}{item.tracked ? " · مخزون متتبع" : ""}</p></div><p className="font-mono font-black">{money(item.lineTotalMinor, order.currencyCode)}</p></div>)}</div><div className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-xs"><div className="flex justify-between"><span>قيمة المنتجات</span><strong>{money(order.totals.itemsSubtotalMinor, order.currencyCode)}</strong></div><div className="flex justify-between"><span>الخصم</span><strong>{money(order.totals.discountMinor, order.currencyCode)}</strong></div><div className="flex justify-between"><span>التوصيل والرسوم</span><strong>{money(order.totals.shippingMinor + order.totals.taxMinor + order.totals.paymentFeeMinor, order.currencyCode)}</strong></div><div className="flex justify-between text-sm"><span className="font-black">الإجمالي</span><strong>{money(order.totals.grandTotalMinor, order.currencyCode)}</strong></div></div></section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5"><h3 className="flex items-center gap-2 font-black"><CreditCard className="h-4 w-4 text-sky-600" /> الدفع</h3><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">الوسيلة</p><p className="mt-1 text-sm font-black">{merchantPaymentMethodLabel(order.payment?.method ?? order.paymentMethod)}</p></div><div className="rounded-2xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">الحالة</p><p className="mt-1 text-sm font-black">{order.paymentState === "due_on_delivery" ? "مستحق عند التسليم" : "تحويل مسجل غير متحقق"}</p></div>{order.payment?.channelLabel && <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">القناة</p><p className="mt-1 text-sm font-black">{order.payment.channelLabel}</p></div>}{order.payment?.reference && <div className="rounded-2xl bg-amber-50 p-3"><p className="text-[11px] text-amber-700">مرجع العميل — غير متحقق</p><p dir="ltr" className="mt-1 text-sm font-black text-amber-950">{order.payment.reference}</p></div>}</div></section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5"><h3 className="flex items-center gap-2 font-black"><Clock3 className="h-4 w-4 text-sky-600" /> سجل الحالة</h3><ol className="mt-4 space-y-3">{[...order.history].reverse().map((event, index) => <li key={`${event.createdAt}-${index}`} className="relative border-r-2 border-sky-100 pr-4"><span className="absolute -right-[5px] top-1 h-2 w-2 rounded-full bg-sky-500" /><p className="text-sm font-black">{merchantOrderStatusLabel(event.to)}</p><p className="text-[11px] text-slate-500">{new Date(event.createdAt).toLocaleString("ar-SA")} · {merchantOrderReasonLabel(event.reasonCode)}</p></li>)}</ol></section>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
