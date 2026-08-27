import React, { useEffect, useState } from "react";
import { RefreshCw, Search, ShoppingBag } from "lucide-react";
import type { MerchantOrderStatus } from "../adapters/uiAdapters";
import MerchantOrderDetail from "../features/orders/MerchantOrderDetail";
import MerchantOrdersPanel from "../features/orders/MerchantOrdersPanel";
import { useMerchantOrders } from "../hooks/useMerchantOrders";

interface MerchantOrdersWorkspaceProps {
  tenantId: string;
  canView: boolean;
  onSessionExpired?: () => void;
}

export default function MerchantOrdersWorkspace({ tenantId, canView, onSessionExpired }: MerchantOrdersWorkspaceProps) {
  const orders = useMerchantOrders(tenantId, canView, onSessionExpired);
  const [status, setStatus] = useState<MerchantOrderStatus | "">("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    setStatus(orders.filters.status ?? "");
    setQuery(orders.filters.query);
  }, [orders.filters.query, orders.filters.status]);

  if (!canView) {
    return <div role="alert" className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm font-bold text-amber-900">لا يملك هذا الحساب صلاحية عرض الطلبات.</div>;
  }

  return (
    <section className="space-y-4" aria-labelledby="orders-heading">
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
        <div><h2 id="orders-heading" className="flex items-center gap-2 text-xl font-black"><ShoppingBag className="h-5 w-5 text-sky-600" /> الطلبات</h2><p className="mt-1 text-sm text-slate-500">{orders.total === null ? "قائمة الخادم الحالية" : `${orders.total} طلب مسجل على الخادم`}</p></div>
        <button type="button" disabled={orders.loading || orders.pendingOrderIds.size > 0} onClick={() => void orders.load()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-black disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${orders.loading ? "animate-spin" : ""}`} /> تحديث القائمة</button>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); orders.applyFilters(status || null, query); }} className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_220px_auto]">
        <label className="relative"><span className="sr-only">ابحث برقم الطلب</span><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} dir="ltr" placeholder="EO-..." className="w-full rounded-xl border border-slate-200 py-2.5 pr-10 pl-3 text-sm outline-none focus:border-sky-400" /></label>
        <label><span className="sr-only">حالة الطلب</span><select value={status} onChange={(event) => setStatus(event.target.value as MerchantOrderStatus | "")} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold"><option value="">كل الحالات</option><option value="submitted">جديد</option><option value="accepted">مقبول</option><option value="processing">قيد التجهيز</option><option value="completed">مكتمل</option><option value="cancelled">ملغي</option><option value="expired">منتهي</option></select></label>
        <div className="flex gap-2"><button type="submit" disabled={orders.loading} className="flex-1 rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-black text-white disabled:opacity-50">تطبيق</button>{(status || query) && <button type="button" onClick={() => { setStatus(""); setQuery(""); orders.applyFilters(null, ""); }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black">مسح</button>}</div>
      </form>
      <MerchantOrdersPanel
        orders={orders.items}
        loading={orders.loading}
        error={orders.error}
        onOpen={(order) => void orders.openDetail(order)}
      />
      {orders.total !== null && orders.lastPage > 1 && <nav aria-label="صفحات الطلبات" className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-3"><button type="button" disabled={orders.loading || orders.page <= 1} onClick={() => orders.goToPage(orders.page - 1)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black disabled:opacity-40">السابق</button><span className="text-xs font-bold text-slate-600">صفحة {orders.page} من {orders.lastPage}</span><button type="button" disabled={orders.loading || orders.page >= orders.lastPage} onClick={() => orders.goToPage(orders.page + 1)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black disabled:opacity-40">التالي</button></nav>}
      {(orders.detailLoading || orders.detailError || orders.selected) && <MerchantOrderDetail order={orders.selected} loading={orders.detailLoading} error={orders.detailError} pending={orders.pendingOrderIds.size > 0} onClose={orders.closeDetail} onAdvance={(order, nextStatus) => void orders.advance(order, nextStatus)} />}
    </section>
  );
}
