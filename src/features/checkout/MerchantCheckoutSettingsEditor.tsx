import React, { useMemo, useState } from "react";
import { BadgePercent, CreditCard, Eye, Plus, ReceiptText, Trash2, Truck } from "lucide-react";
import { canonicalWalletId } from "../../contracts/checkoutPolicy";
import type { Coupon, EWallet, StoreConfig } from "../../types";
import { randomUuid } from "../../utils/randomUuid";

interface Props {
  config: StoreConfig;
  onChange: (key: keyof StoreConfig, value: unknown) => void;
  onOpenPreview?: () => void;
}

const input = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15";
const card = "space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return <button type="button" role="switch" aria-label={label} aria-checked={checked} onClick={() => onChange(!checked)} className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-xs font-black transition ${checked ? "border-sky-200 bg-sky-50 text-sky-900" : "border-slate-200 bg-slate-50 text-slate-600"}`}><span>{label}</span><span>{checked ? "مفعّل" : "متوقف"}</span></button>;
}

export default function MerchantCheckoutSettingsEditor({ config, onChange, onOpenPreview }: Props) {
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(10);
  const [wallet, setWallet] = useState({ name: "", accountNumber: "", accountName: "" });
  const coupons = config.customCoupons ?? [];
  const wallets = config.customWallets ?? [];
  const walletIds = useMemo(() => new Set(wallets.map((item) => item.id)), [wallets]);
  const set = <Key extends keyof StoreConfig>(key: Key, value: StoreConfig[Key]) => onChange(key, value);

  const addCoupon = () => {
    const code = couponCode.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{1,50}$/.test(code) || coupons.some((item) => item.code === code)) return;
    set("customCoupons", [...coupons, { code, discountPercent: couponDiscount, active: true }]);
    setCouponCode("");
  };
  const updateCoupon = (index: number, patch: Partial<Coupon>) => set("customCoupons", coupons.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const addWallet = () => {
    if (!wallet.name.trim() || !wallet.accountNumber.trim() || !wallet.accountName.trim()) return;
    let id = canonicalWalletId(`wallet-${randomUuid()}`) ?? `wallet-${Date.now()}`;
    while (walletIds.has(id)) id = `wallet-${randomUuid()}`;
    const next: EWallet = { id, name: wallet.name.trim(), accountNumber: wallet.accountNumber.trim(), accountName: wallet.accountName.trim(), active: true, icon: "💳" };
    set("customWallets", [...wallets, next]);
    setWallet({ name: "", accountNumber: "", accountName: "" });
  };
  const updateWallet = (index: number, patch: Partial<EWallet>) => set("customWallets", wallets.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));

  return <div className="space-y-5" dir="rtl">
    <header className="rounded-2xl bg-gradient-to-l from-sky-950 to-slate-950 p-5 text-white">
      <div className="flex items-start justify-between gap-3"><div><h3 className="text-base font-black">الدفع والتوصيل</h3><p className="mt-1 text-xs leading-6 text-sky-100">فعّل الوسائل المتاحة فعليًا، وحدد الرسوم وسياسة استلام الطلب.</p></div>{onOpenPreview && <button type="button" onClick={onOpenPreview} className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-black transition hover:bg-white/20"><Eye className="h-4 w-4" /> معاينة الدفع</button>}</div>
    </header>

    <section className={card}><h4 className="flex items-center gap-2 text-sm font-black"><ReceiptText className="h-4 w-4 text-sky-700" /> نصوص صفحة الطلب</h4>
      <label className="block space-y-1"><span className="text-xs font-bold">العنوان</span><input className={input} value={config.checkoutTitle ?? ""} maxLength={500} onChange={(e) => set("checkoutTitle", e.target.value)} /></label>
      <label className="block space-y-1"><span className="text-xs font-bold">النص المساند</span><textarea className={input} rows={2} value={config.checkoutSubtitle ?? ""} maxLength={1000} onChange={(e) => set("checkoutSubtitle", e.target.value)} /></label>
      <label className="block space-y-1"><span className="text-xs font-bold">تنبيه العميل</span><textarea className={input} rows={2} value={config.checkoutNotice ?? ""} maxLength={1000} onChange={(e) => set("checkoutNotice", e.target.value)} /></label>
      <div className="grid gap-2 sm:grid-cols-3"><Toggle checked={config.requireEmail === true} label="البريد مطلوب" onChange={(value) => set("requireEmail", value)} /><Toggle checked={config.requireAddressDetails !== false} label="العنوان التفصيلي مطلوب" onChange={(value) => set("requireAddressDetails", value)} /><Toggle checked={config.enableCustomerNotes !== false} label="ملاحظات العميل" onChange={(value) => set("enableCustomerNotes", value)} /></div>
    </section>

    <section className={card}><h4 className="flex items-center gap-2 text-sm font-black"><Truck className="h-4 w-4 text-sky-600" /> التسعير والشحن</h4>
      <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1"><span className="text-xs font-bold">الحد الأدنى للطلب</span><input type="number" min="0" step="0.01" className={input} value={config.minOrderAmount ?? 0} onChange={(e) => set("minOrderAmount", Number(e.target.value))} /></label><label className="space-y-1"><span className="text-xs font-bold">رسوم الشحن</span><input type="number" min="0" step="0.01" className={input} value={config.shippingFee ?? 0} onChange={(e) => set("shippingFee", Number(e.target.value))} /></label><label className="space-y-1"><span className="text-xs font-bold">الشحن المجاني يبدأ من</span><input type="number" min="0" step="0.01" className={input} value={config.freeShippingThreshold ?? 0} onChange={(e) => set("freeShippingThreshold", Number(e.target.value))} /></label><label className="space-y-1"><span className="text-xs font-bold">الضريبة %</span><input type="number" min="0" max="100" step="0.01" className={input} value={config.taxRate ?? 0} onChange={(e) => set("taxRate", Number(e.target.value))} /></label></div>
    </section>

    <section className={card}><h4 className="flex items-center gap-2 text-sm font-black"><CreditCard className="h-4 w-4 text-indigo-600" /> وسائل الدفع المدعومة</h4>
      <Toggle checked={config.enableCashOnDelivery === true} label="الدفع عند الاستلام" onChange={(value) => set("enableCashOnDelivery", value)} />
      {config.enableCashOnDelivery && <label className="block space-y-1"><span className="text-xs font-bold">رسوم الدفع عند الاستلام</span><input type="number" min="0" step="0.01" className={input} value={config.cashOnDeliveryFee ?? 0} onChange={(e) => set("cashOnDeliveryFee", Number(e.target.value))} /></label>}
      <Toggle checked={config.enableBankTransfer === true} label="التحويل البنكي" onChange={(value) => set("enableBankTransfer", value)} />
      {config.enableBankTransfer && <>
        <div className="grid gap-3 sm:grid-cols-2"><input className={input} aria-label="اسم البنك" placeholder="اسم البنك" value={config.bankName ?? ""} onChange={(e) => set("bankName", e.target.value)} /><input className={input} aria-label="اسم صاحب الحساب البنكي" placeholder="اسم صاحب الحساب" value={config.bankAccountName ?? ""} onChange={(e) => set("bankAccountName", e.target.value)} /><input dir="ltr" className={input} aria-label="رقم IBAN البنكي" placeholder="IBAN" value={config.bankIban ?? ""} onChange={(e) => set("bankIban", e.target.value)} /><input dir="ltr" className={input} aria-label="رقم الحساب البنكي" placeholder="رقم الحساب" value={config.bankAccountNumber ?? ""} onChange={(e) => set("bankAccountNumber", e.target.value)} /></div>
        <p className="rounded-xl bg-amber-50 p-3 text-[11px] leading-5 text-amber-800">لا تدخل كلمات مرور أو رموز API. سيُطلب من العميل رقم مرجع التحويل، وتبقى العملية غير موثقة حتى يراجعها المتجر.</p>
      </>}
      <Toggle checked={config.enableEWallets === true} label="المحافظ والتحويلات المحلية" onChange={(value) => set("enableEWallets", value)} />
      {config.enableEWallets && <>
        <div className="space-y-2">{wallets.map((item, index) => <div key={item.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-center gap-2"><input aria-label={`اسم المحفظة ${index + 1}`} className={input} value={item.name} onChange={(e) => updateWallet(index, { name: e.target.value })} /><button type="button" aria-label={`حذف ${item.name || "المحفظة"}`} onClick={() => set("customWallets", wallets.filter((_, i) => i !== index))} className="rounded-lg p-2 text-rose-600 transition hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button></div><div className="mt-2 grid gap-2 sm:grid-cols-2"><input aria-label={`رقم حساب ${item.name || `المحفظة ${index + 1}`}`} dir="ltr" className={input} value={item.accountNumber} onChange={(e) => updateWallet(index, { accountNumber: e.target.value })} placeholder="رقم الحساب/المحفظة" /><input aria-label={`اسم صاحب حساب ${item.name || `المحفظة ${index + 1}`}`} className={input} value={item.accountName ?? ""} onChange={(e) => updateWallet(index, { accountName: e.target.value })} placeholder="اسم صاحب الحساب" /></div><div className="mt-2"><Toggle checked={item.active === true} label={`تفعيل ${item.name || "المحفظة"}`} onChange={(value) => updateWallet(index, { active: value })} /></div></div>)}</div>
        <div className="grid gap-2 sm:grid-cols-3"><input className={input} aria-label="اسم المحفظة الجديدة" placeholder="اسم المحفظة" value={wallet.name} onChange={(e) => setWallet({ ...wallet, name: e.target.value })} /><input dir="ltr" className={input} aria-label="رقم حساب المحفظة الجديدة" placeholder="رقم الحساب" value={wallet.accountNumber} onChange={(e) => setWallet({ ...wallet, accountNumber: e.target.value })} /><input className={input} aria-label="اسم مستفيد المحفظة الجديدة" placeholder="اسم المستفيد" value={wallet.accountName} onChange={(e) => setWallet({ ...wallet, accountName: e.target.value })} /></div>
        <button type="button" onClick={addWallet} className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white transition hover:bg-slate-800"><Plus className="h-4 w-4" /> إضافة محفظة</button>
      </>}
      <p className="text-[11px] text-slate-500">الدفع بالبطاقات وApple Pay وSTC Pay غير متاح حتى يتم ربط بوابة دفع حقيقية.</p>
    </section>

    <section className={card}><h4 className="flex items-center gap-2 text-sm font-black"><BadgePercent className="h-4 w-4 text-amber-600" /> كوبونات الخصم</h4><Toggle checked={config.enableCoupons === true} label="تفعيل الكوبونات" onChange={(value) => set("enableCoupons", value)} />
      {config.enableCoupons && <>
        {coupons.map((item, index) => <div key={item.code} className="flex items-center gap-2 rounded-xl border border-slate-200 p-2"><span className="flex-1 font-mono text-xs font-black">{item.code}</span><input aria-label={`خصم ${item.code}`} type="number" min="0.01" max="100" step="0.01" className="w-20 rounded-lg border px-2 py-1 text-xs" value={item.discountPercent} onChange={(e) => updateCoupon(index, { discountPercent: Number(e.target.value) })} /><button type="button" onClick={() => updateCoupon(index, { active: !item.active })} className={`rounded-lg px-2 py-1 text-[10px] font-black ${item.active ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-500"}`}>{item.active ? "فعال" : "متوقف"}</button><button type="button" aria-label={`حذف ${item.code}`} onClick={() => set("customCoupons", coupons.filter((_, i) => i !== index))} className="p-1 text-rose-600"><Trash2 className="h-4 w-4" /></button></div>)}
        <div className="flex gap-2"><input aria-label="رمز الكوبون الجديد" className={input} placeholder="CODE10" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} /><input aria-label="نسبة الخصم الجديدة" type="number" min="0.01" max="100" step="0.01" className="w-24 rounded-xl border px-3" value={couponDiscount} onChange={(e) => setCouponDiscount(Number(e.target.value))} /><button type="button" aria-label="إضافة كوبون" onClick={addCoupon} className="rounded-xl bg-slate-950 px-3 text-white transition hover:bg-slate-800"><Plus className="h-4 w-4" /></button></div>
      </>}
    </section>

    <section className={card}><h4 className="text-sm font-black">رسالة الإيصال</h4><input className={input} value={config.thankYouTitle ?? ""} maxLength={500} onChange={(e) => set("thankYouTitle", e.target.value)} placeholder="عنوان التأكيد" /><textarea className={input} rows={3} value={config.thankYouMessage ?? ""} onChange={(e) => set("thankYouMessage", e.target.value)} placeholder="رسالة المتابعة" /><Toggle checked={config.enableWhatsAppNotification === true} label="إظهار زر مشاركة الإيصال عبر WhatsApp" onChange={(value) => set("enableWhatsAppNotification", value)} /><p className="text-[11px] text-slate-500">الزر يفتحه العميل بنفسه ولا يعني أن المنصة أرسلت إشعارًا.</p></section>
  </div>;
}
