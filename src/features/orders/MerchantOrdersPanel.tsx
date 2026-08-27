import React from "react";
import { ChevronLeft, UserRound } from "lucide-react";
import type { OrderReceipt } from "../../adapters/uiAdapters";
import { merchantOrderStatusLabel, merchantPaymentMethodLabel } from "../../workflows/orderState";

interface MerchantOrdersPanelProps {
  orders: OrderReceipt[];
  loading: boolean;
  error: string | null;
  onOpen: (order: OrderReceipt) => void;
}

export default function MerchantOrdersPanel({ orders, loading, error, onOpen }: MerchantOrdersPanelProps) {
  return (
    <div className="space-y-4 p-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="font-black text-slate-900">الطلبات المسجلة على الخادم</h3>
        <p className="mt-1 text-xs text-slate-500">الأسعار والحالات وحركات المخزون المعروضة هنا مصدرها الخادم.</p>
      </div>
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</div>}
      {loading && <div className="p-4 text-center text-xs font-bold text-slate-500">جارٍ تحميل الطلبات...</div>}
      {!loading && orders.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">لا توجد طلبات مسجلة بعد.</div>}
      {orders.map((order) => {
        return (
          <article key={order.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2"><p className="font-mono text-sm font-black text-slate-900">{order.number}</p><span className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-black text-sky-700">{merchantOrderStatusLabel(order.status)}</span></div>
                <p className="text-[11px] text-slate-500">{new Date(order.createdAt).toLocaleString("ar-SA")}</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700"><UserRound className="h-4 w-4 text-slate-400" />{order.customerName || "عميل المتجر"}</div>
            </div>
            <div className="mt-3 flex flex-col justify-between gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center">
              <div><span className="font-mono text-sm font-black">{(order.totals.grandTotalMinor / 100).toFixed(2)} {order.currencyCode}</span><p className="mt-1 text-[11px] text-slate-500">{merchantPaymentMethodLabel(order.paymentMethod)}</p></div>
              <button type="button" disabled={loading} onClick={() => onOpen(order)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white disabled:opacity-50">فتح تفاصيل الطلب <ChevronLeft className="h-4 w-4" /></button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
