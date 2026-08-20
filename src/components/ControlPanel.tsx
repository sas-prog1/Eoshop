import React, { useState } from "react";
import { 
  Plus, Trash2, Sparkles, Check, RefreshCw, Smartphone, Info, HelpCircle, Upload,
  Download, FileCode, ArrowDownToLine, Copy, FileText, Code, Settings, Share2,
  Edit3, ChevronDown, ChevronUp, Package, Search, Tag, CreditCard, Truck, Percent, ShoppingBag,
  ShieldCheck, DollarSign, Gift, Layers, CheckSquare, AlertTriangle, ArrowRight, Save, ToggleLeft, ToggleRight
} from "lucide-react";
import { StoreConfig, Coupon, EWallet } from "../types";
import { useUiAdapters } from "../adapters/UiAdaptersContext";
import MerchantProductEditor from "../features/catalog/MerchantProductEditor";
import AiCopywriterPanel from "../features/store-builder/AiCopywriterPanel";
import { CustomizationCompletionBar, PreviewDeviceSelector } from "../features/store-builder/ControlPanelChrome";
import type { ControlPanelProps, CopywriterOutput } from "../features/store-builder/controlPanelTypes";
import StoreSubmissionPanel from "../features/tenancy/StoreSubmissionPanel";
import MerchantStoreProfileEditor from "../features/store-profile/MerchantStoreProfileEditor";

export default function ControlPanel({
  config,
  activeTenantId,
  mediaOwnerKey = null,
  canViewInventory = false,
  handleConfigChange,
  handleProductChange,
  handleProductMediaChange,
  addEmptyProduct,
  deleteProduct,
  activeTab,
  setActiveTab,
  previewDevice,
  setPreviewDevice,
  onOpenCheckoutPreview,
  onOpenInventory,
  onOpenDomainModal
}: ControlPanelProps) {
  const { assistant, catalog, storeAssets } = useUiAdapters();

  // AI assistant states inside control panel
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false);
  const [copyOutput, setCopyOutput] = useState<CopywriterOutput | null>(null);

  // Checkout coupon state
  const [newCouponCode, setNewCouponCode] = useState("");
  const [newCouponDiscount, setNewCouponDiscount] = useState<number>(15);

  // Custom E-Wallet states
  const [newWalletName, setNewWalletName] = useState("");
  const [newWalletNumber, setNewWalletNumber] = useState("");
  const [newWalletHolder, setNewWalletHolder] = useState("");
  const [newWalletIcon, setNewWalletIcon] = useState("📱");
  const [newWalletBadge, setNewWalletBadge] = useState("إيداع مباشر ⚡");

  // Wallet Inline Edit state
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);
  const [editWalletName, setEditWalletName] = useState("");
  const [editWalletNumber, setEditWalletNumber] = useState("");
  const [editWalletHolder, setEditWalletHolder] = useState("");
  const [editWalletBadge, setEditWalletBadge] = useState("");
  const [editWalletIcon, setEditWalletIcon] = useState("📱");

  const triggerCopyWrite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assistantPrompt.trim()) return;

    setIsGeneratingCopy(true);
    try {
      const data = await assistant.generateStoreIdeas(
        `اكتب شعارات وعروض دعائية ومحتوى تسويقي بناءً على هذه الفكرة: "${assistantPrompt}"`,
      );
      
      setCopyOutput({
        slogan: data.slogan,
        banner: data.bannerText,
        productDesc: data.products?.[0]?.description || "وصف تسويقي فاخر يناسب عملائك"
      });
    } catch (err) {
      console.error(err);
      setCopyOutput({
        slogan: "التميز يبدأ من الاختيار الصحيح لهويتك",
        banner: "عروض مذهلة بانتظارك بمناسبة الافتتاح الحصري لعملائنا",
        productDesc: "منتج مصنع بحب وعناية فائقة لتلبية كافة التطلعات والاحتياجات"
      });
    } finally {
      setIsGeneratingCopy(false);
    }
  };

  const [copiedConfig, setCopiedConfig] = useState(false);

  // Download Config JSON File
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `store_config_${config.storeName || "my_store"}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import Config JSON File
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed && typeof parsed === "object") {
            Object.keys(parsed).forEach((key) => {
              handleConfigChange(key as keyof StoreConfig, parsed[key]);
            });
            alert("تم استيراد كافة إعدادات وهوية المتجر بنجاح! 🎉");
          }
        } catch (err) {
          alert("الملف المحمل غير صالح. يرجى التأكد من اختيار ملف store_config.json بصيغة JSON صحيح.");
        }
      };
      reader.readAsText(file);
    }
  };

  // Download Standalone Offline HTML File
  const handleDownloadOfflineHTML = () => {
    const htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.storeName || 'متجري الإلكتروني'}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Cairo', sans-serif; background-color: #f8fafc; }
  </style>
</head>
<body class="bg-slate-50 text-slate-800 min-h-screen">
  <!-- Header Navbar -->
  <header class="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-xs">
    <div class="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-xl text-white font-bold">
          ${config.logoIcon || "🛍️"}
        </div>
        <div>
          <h1 class="font-black text-lg text-slate-900">${config.storeName || "اسم المتجر"}</h1>
          <p class="text-xs text-slate-500 font-medium">${config.slogan || ""}</p>
        </div>
      </div>
      <a href="https://wa.me/${((config as any).whatsappNumber || '966500000000').replace(/\+/g, '')}" target="_blank" class="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition shadow">
        💬 تواصل واتساب
      </a>
    </div>
  </header>

  <!-- Hero Section -->
  <section class="bg-slate-900 text-white py-12 px-6 text-center border-b border-slate-800">
    <div class="max-w-3xl mx-auto space-y-3">
      <span class="inline-block px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold border border-emerald-500/30">
        نسخة معاينة معتمدة أوفلاين ⚡
      </span>
      <h2 class="text-2xl sm:text-4xl font-black">${config.storeName || "أهلاً بك في متجرنا"}</h2>
      <p class="text-slate-300 text-sm sm:text-base leading-relaxed font-medium">${config.slogan || ""}</p>
    </div>
  </section>

  <!-- Products Catalog -->
  <main class="max-w-6xl mx-auto px-6 py-10">
    <h3 class="text-xl font-extrabold text-slate-900 mb-6 flex items-center gap-2">
      <span>🛍️ كتالوج المنتجات المعروضة (${config.products?.length || 0})</span>
    </h3>
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
      ${config.products?.map(p => `
        <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3">
          <div class="space-y-2">
            <div class="w-full h-48 bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center">
              ${p.imageUrl ? `<img src="${p.imageUrl}" alt="${p.name}" class="w-full h-full object-cover">` : `<span class="text-4xl">📦</span>`}
            </div>
            <h4 class="font-extrabold text-slate-900 text-base">${p.name}</h4>
            <p class="text-xs text-slate-500 line-clamp-2">${p.description || ''}</p>
          </div>
          <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span class="text-lg font-black text-slate-900">${p.price} <span class="text-xs font-bold text-slate-500">${config.currency || "ر.س"}</span></span>
            <span class="px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-bold">متوفر</span>
          </div>
        </div>
      `).join('')}
    </div>
  </main>

  <!-- Footer -->
  <footer class="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
    <p>جميع الحقوق محفوظة © ${config.storeName || 'المتجر'} - تم الإنشاء بواسطة منصة مبتكر للمتاجر الرقمية</p>
  </footer>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", url);
    downloadAnchor.setAttribute("download", `${config.storeName || "store"}_offline_preview.html`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleCopyJSONToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(config, null, 2));
    setCopiedConfig(true);
    setTimeout(() => setCopiedConfig(false), 3000);
  };

  return (
    <div className="flex flex-col h-full bg-white min-h-0 overflow-hidden">
      <PreviewDeviceSelector device={previewDevice} onChange={setPreviewDevice} />

      {/* 2. TABBED CONTENTS */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Store identity and appearance are one focused, server-bound profile editor. */}
        {(activeTab === "branding" || activeTab === "design") && (
          <MerchantStoreProfileEditor
            config={config}
            activeTenantId={activeTenantId}
            mediaOwnerKey={mediaOwnerKey}
            initialSection={activeTab === "branding" ? "identity" : "appearance"}
            onChange={handleConfigChange}
            uploadAsset={storeAssets.upload}
          />
        )}

        {activeTab === "products" && (
          <MerchantProductEditor
            products={config.products}
            currency={config.currency}
            activeTenantId={activeTenantId}
            mediaOwnerKey={mediaOwnerKey}
            canViewInventory={canViewInventory}
            onProductChange={handleProductChange}
            onProductMediaChange={handleProductMediaChange}
            uploadMedia={catalog.uploadMedia}
            onAddProduct={addEmptyProduct}
            onArchiveProduct={deleteProduct}
            onOpenInventory={onOpenInventory}
          />
        )}

        {/* --- CHECKOUT & PAYMENT CUSTOMIZATION TAB (تعديل إتمام الطلب والدفع) --- */}

        {activeTab === "checkout" && (() => {
          const coupons: Coupon[] = config.customCoupons || [
            { code: "WELCOME10", discountPercent: 10, active: true },
            { code: "SUMMER20", discountPercent: 20, active: true }
          ];

          const handleAddCoupon = (e: React.FormEvent) => {
            e.preventDefault();
            if (!newCouponCode.trim()) return;
            const codeClean = newCouponCode.trim().toUpperCase();
            const updated = [...coupons, { code: codeClean, discountPercent: Number(newCouponDiscount), active: true }];
            handleConfigChange("customCoupons", updated);
            setNewCouponCode("");
            setNewCouponDiscount(15);
          };

          const handleToggleCoupon = (index: number) => {
            const updated = [...coupons];
            updated[index].active = !updated[index].active;
            handleConfigChange("customCoupons", updated);
          };

          const handleDeleteCoupon = (index: number) => {
            const updated = coupons.filter((_, idx) => idx !== index);
            handleConfigChange("customCoupons", updated);
          };

          return (
            <div className="space-y-6 animate-fadeIn text-right">
              {/* Info Header */}
              <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-900 p-4.5 rounded-2xl text-white shadow-md space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-emerald-300 flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-emerald-400" />
                      <span>تعديل وتخصيص صفحة إتمام الطلب ووسائل الدفع 💳</span>
                    </h4>
                    <p className="text-[11px] text-emerald-100/80 leading-relaxed max-w-xl">
                      خصص نصوص وملاحظات صفحة إتمام الطلب، حدد وسائل الدفع المتاحة، ورسوم الشحن والضرائب، بالإضافة لإدارة كوبونات الخصم ورسالة الشكر المخصصة.
                    </p>
                  </div>

                  {onOpenCheckoutPreview && (
                    <button
                      type="button"
                      onClick={onOpenCheckoutPreview}
                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl transition shadow-md flex items-center gap-2 cursor-pointer shrink-0"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>معاينة وتجربة نافذة الدفع مباشرة 🛒</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 1. Page Title & Notice Banner */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <h5 className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5 border-b border-slate-200 pb-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>عناوين وتنبيهات صفحة الدفع</span>
                </h5>

                <div className="space-y-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">عنوان صفحة الشراء والدفع الرئيسي</label>
                    <input
                      type="text"
                      value={config.checkoutTitle || "إتمام الطلب الشراء والدفع"}
                      onChange={(e) => handleConfigChange("checkoutTitle", e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">الوصف الفرعي</label>
                    <input
                      type="text"
                      value={config.checkoutSubtitle || "أدخل بيانات التوصيل واختر طريقة الدفع المناسبة لك"}
                      onChange={(e) => handleConfigChange("checkoutSubtitle", e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">شريط التنبيه والمميزات أعلى صفحة الدفع</label>
                    <input
                      type="text"
                      value={config.checkoutNotice || "توصيل سريع وآمن لجميع مناطق المملكة والخليج العربي 🚚⚡"}
                      onChange={(e) => handleConfigChange("checkoutNotice", e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Shipping, Taxes & Minimum Order */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <h5 className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5 border-b border-slate-200 pb-2">
                  <Truck className="w-4 h-4 text-emerald-600" />
                  <span>رسوم الشحن، الضرائب، والحد الأدنى للطلب</span>
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">رسوم الشحن القياسية ({config.currency})</label>
                    <input
                      type="number"
                      min={0}
                      value={config.shippingFee ?? 0}
                      onChange={(e) => handleConfigChange("shippingFee", Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                      placeholder="0 (شحن مجاني)"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">الحد الأدنى للشحن المجاني ({config.currency})</label>
                    <input
                      type="number"
                      min={0}
                      value={config.freeShippingThreshold ?? 250}
                      onChange={(e) => handleConfigChange("freeShippingThreshold", Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">نسبة ضريبة القيمة المضافة (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={config.taxRate ?? 15}
                      onChange={(e) => handleConfigChange("taxRate", Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">الحد الأدنى لقيمة الطلب ({config.currency})</label>
                    <input
                      type="number"
                      min={0}
                      value={config.minOrderAmount ?? 0}
                      onChange={(e) => handleConfigChange("minOrderAmount", Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Payment Methods Control */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3.5">
                <h5 className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5 border-b border-slate-200 pb-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  <span>تفعيل وتخصيص وسائل الدفع المتاحة</span>
                </h5>

                <div className="space-y-3 text-xs">
                  {/* Cash on Delivery */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">💵</span>
                        <div>
                          <span className="font-bold text-slate-900 block">الدفع عند الاستلام (Cash on Delivery)</span>
                          <span className="text-[10px] text-slate-500">يدفع الزبون نقداً لمندوب الشحن فور التوصيل</span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={config.enableCashOnDelivery === true}
                        onChange={(e) => handleConfigChange("enableCashOnDelivery", e.target.checked)}
                        className="w-5 h-5 accent-emerald-600 rounded cursor-pointer"
                      />
                    </div>

                    {config.enableCashOnDelivery === true && (
                      <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                        <label className="text-[10px] font-bold text-slate-600">رسوم إضافية للدفع عند الاستلام:</label>
                        <input
                          type="number"
                          min={0}
                          value={config.cashOnDeliveryFee ?? 10}
                          onChange={(e) => handleConfigChange("cashOnDeliveryFee", Number(e.target.value))}
                          className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold"
                        />
                        <span className="text-[10px] text-slate-400">{config.currency}</span>
                      </div>
                    )}
                  </div>

                  {/* Bank Transfer & Wallets */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🏦</span>
                        <div>
                          <span className="font-bold text-slate-900 block">التحويل البنكي / المحافظ المباشرة</span>
                          <span className="text-[10px] text-slate-500">عرض الحسابات البنكية والآيبان لإيداع الزبون مباشرة</span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={config.enableBankTransfer === true}
                        onChange={(e) => handleConfigChange("enableBankTransfer", e.target.checked)}
                        className="w-5 h-5 accent-emerald-600 rounded cursor-pointer"
                      />
                    </div>

                    {config.enableBankTransfer === true && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">اسم البنك / المحفظة</label>
                          <input
                            type="text"
                            value={config.bankName || "بنك الراجحي"}
                            onChange={(e) => handleConfigChange("bankName", e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">اسم صاحب الحساب الرسمي</label>
                          <input
                            type="text"
                            value={config.bankAccountName || config.storeName}
                            onChange={(e) => handleConfigChange("bankAccountName", e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">رقم الحساب البنكي / رقم المحفظة</label>
                          <input
                            type="text"
                            value={config.bankAccountNumber || ""}
                            onChange={(e) => handleConfigChange("bankAccountNumber", e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">رقم الآيبان (IBAN)</label>
                          <input
                            type="text"
                            value={config.bankIban || ""}
                            onChange={(e) => handleConfigChange("bankIban", e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Cards, Apple Pay & STC Pay */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-[11px]">مدى وفيزا 💳</span>
                      <input
                        type="checkbox"
                        checked={config.enableOnlineCard !== false}
                        onChange={(e) => handleConfigChange("enableOnlineCard", e.target.checked)}
                        className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                      />
                    </div>

                    <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-[11px]">أبل باي Apple Pay 🍏</span>
                      <input
                        type="checkbox"
                        checked={config.enableApplePay !== false}
                        onChange={(e) => handleConfigChange("enableApplePay", e.target.checked)}
                        className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                      />
                    </div>

                    <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-[11px]">STC Pay 📲</span>
                      <input
                        type="checkbox"
                        checked={config.enableStcPay !== false}
                        onChange={(e) => handleConfigChange("enableStcPay", e.target.checked)}
                        className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 3.5. Custom Electronic Wallets Management (إدارة المحافظ الإلكترونية) */}
              {(() => {
                const walletsList: EWallet[] = config.customWallets || [
                  {
                    id: "w-stc",
                    name: "محفظة STC Pay / urpay",
                    accountNumber: "0501234567",
                    accountName: config.storeName || "المتجر الرسمي",
                    icon: "📱",
                    badge: "دفع فوري ⚡",
                    active: true,
                    bgColor: "bg-purple-50/80 border-purple-200/90 text-purple-900"
                  },
                  {
                    id: "w-kuraimi",
                    name: "محفظة الكريمي إكسبرس (Kuraimi)",
                    accountNumber: "30678912",
                    accountName: config.storeName || "المتجر الرسمي",
                    icon: "🏦",
                    badge: "الأكثر شيوعاً واستخداماً 🔥",
                    active: true,
                    bgColor: "bg-blue-50/80 border-blue-200/90 text-blue-900"
                  },
                  {
                    id: "w-jawali",
                    name: "محفظة جوالي (Jawali Wallet)",
                    accountNumber: "770123456",
                    accountName: config.storeName || "المتجر الرسمي",
                    icon: "📱",
                    badge: "إيداع فوري ⚡",
                    active: true,
                    bgColor: "bg-emerald-50/80 border-emerald-200/90 text-emerald-900"
                  },
                  {
                    id: "w-onecash",
                    name: "محفظة ون كاش (OneCash)",
                    accountNumber: "779876543",
                    accountName: config.storeName || "المتجر الرسمي",
                    icon: "💸",
                    badge: "تحويل مباشر وآمن 🔒",
                    active: true,
                    bgColor: "bg-purple-50/80 border-purple-200/90 text-purple-900"
                  },
                  {
                    id: "w-floos",
                    name: "محفظة فلوس / جيب (Floos / Pocket)",
                    accountNumber: "771122334",
                    accountName: config.storeName || "المتجر الرسمي",
                    icon: "👛",
                    badge: "سريع ومباشر 🚀",
                    active: true,
                    bgColor: "bg-amber-50/80 border-amber-200/90 text-amber-900"
                  }
                ];

                const handleAddWallet = (e: React.FormEvent) => {
                  e.preventDefault();
                  if (!newWalletName.trim() || !newWalletNumber.trim()) return;

                  const newWalletObj: EWallet = {
                    id: `w-${Date.now()}`,
                    name: newWalletName.trim(),
                    accountNumber: newWalletNumber.trim(),
                    accountName: newWalletHolder.trim() || config.storeName || "المتجر الرسمي",
                    icon: newWalletIcon || "📱",
                    badge: newWalletBadge.trim() || "إيداع مباشر ⚡",
                    active: true,
                    bgColor: "bg-slate-50 border-slate-200 text-slate-800"
                  };

                  const updated = [...walletsList, newWalletObj];
                  handleConfigChange("customWallets", updated);
                  setNewWalletName("");
                  setNewWalletNumber("");
                  setNewWalletHolder("");
                };

                const handleToggleWallet = (id: string) => {
                  const updated = walletsList.map(w => w.id === id ? { ...w, active: !w.active } : w);
                  handleConfigChange("customWallets", updated);
                };

                const handleDeleteWallet = (id: string) => {
                  const updated = walletsList.filter(w => w.id !== id);
                  handleConfigChange("customWallets", updated);
                };

                const handleStartEditWallet = (wallet: EWallet) => {
                  setEditingWalletId(wallet.id);
                  setEditWalletName(wallet.name);
                  setEditWalletNumber(wallet.accountNumber);
                  setEditWalletHolder(wallet.accountName || "");
                  setEditWalletBadge(wallet.badge || "");
                  setEditWalletIcon(wallet.icon || "📱");
                };

                const handleSaveEditWallet = (id: string) => {
                  if (!editWalletName.trim() || !editWalletNumber.trim()) return;
                  const updated = walletsList.map(w => w.id === id ? {
                    ...w,
                    name: editWalletName.trim(),
                    accountNumber: editWalletNumber.trim(),
                    accountName: editWalletHolder.trim() || config.storeName || "المتجر الرسمي",
                    badge: editWalletBadge.trim(),
                    icon: editWalletIcon || "📱"
                  } : w);
                  handleConfigChange("customWallets", updated);
                  setEditingWalletId(null);
                };

                return (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                      <h5 className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                        <Smartphone className="w-4 h-4 text-emerald-600" />
                        <span>إدارة المحافظ الإلكترونية والتطبيقات المالية 📲💸</span>
                      </h5>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <span className="text-[10px] font-bold text-slate-600">تفعيل خيار المحافظ</span>
                        <input
                          type="checkbox"
                          checked={config.enableEWallets === true}
                          onChange={(e) => handleConfigChange("enableEWallets", e.target.checked)}
                          className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                        />
                      </label>
                    </div>

                    {config.enableEWallets === true && (
                      <div className="space-y-4 text-xs">
                        {/* Form to add a new custom wallet */}
                        <form onSubmit={handleAddWallet} className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3">
                          <h6 className="font-extrabold text-[11px] text-slate-800 flex items-center gap-1">
                            <Plus className="w-3.5 h-3.5 text-emerald-600" />
                            <span>إضافة محفظة إلكترونية جديدة</span>
                          </h6>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">اسم المحفظة / التطبيق *</label>
                              <input
                                type="text"
                                placeholder="مثال: محفظة STC Pay / الكريمي / Instapay"
                                value={newWalletName}
                                onChange={(e) => setNewWalletName(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                                required
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">رقم الحساب / الجوال للإيداع *</label>
                              <input
                                type="text"
                                placeholder="مثال: 0501234567 أو 30678912"
                                value={newWalletNumber}
                                onChange={(e) => setNewWalletNumber(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800"
                                required
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">اسم صاحب المحفظة / المتجر</label>
                              <input
                                type="text"
                                placeholder={config.storeName || "اسم المستفيد"}
                                value={newWalletHolder}
                                onChange={(e) => setNewWalletHolder(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">الشعار / العبارة الترويجية</label>
                              <input
                                type="text"
                                placeholder="مثال: تحويل فوري ⚡"
                                value={newWalletBadge}
                                onChange={(e) => setNewWalletBadge(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                              />
                            </div>
                          </div>

                          {/* Icon Selector */}
                          <div className="flex items-center gap-2 pt-1">
                            <span className="text-[10px] font-bold text-slate-600 shrink-0">أيقونة المحفظة:</span>
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                              {["📱", "🏦", "💸", "👛", "💳", "⚡", "📲", "💎", "🏛️"].map((ic) => (
                                <button
                                  type="button"
                                  key={ic}
                                  onClick={() => setNewWalletIcon(ic)}
                                  className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition cursor-pointer border ${
                                    newWalletIcon === ic ? "bg-emerald-100 border-emerald-500 scale-110 shadow-2xs" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                                  }`}
                                >
                                  {ic}
                                </button>
                              ))}
                            </div>
                          </div>

                          <button
                            type="submit"
                            disabled={!newWalletName.trim() || !newWalletNumber.trim()}
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-xs rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <Plus className="w-4 h-4" />
                            <span>حفظ وإضافة المحفظة إلى وسائل الدفع ➕</span>
                          </button>
                        </form>

                        {/* List of custom wallets */}
                        <div className="space-y-2">
                          <h6 className="font-bold text-[11px] text-slate-700">المحافظ المتاحة حالياً ({walletsList.length}):</h6>
                          <div className="space-y-2 max-h-80 overflow-y-auto pl-1">
                            {walletsList.map((wallet) => {
                              const isEditingThis = editingWalletId === wallet.id;

                              if (isEditingThis) {
                                return (
                                  <div key={wallet.id} className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 space-y-2.5 text-[11px] animate-fadeIn">
                                    <div className="flex items-center justify-between font-bold text-amber-900 border-b border-amber-200/80 pb-1.5">
                                      <span>تعديل بيانات المحفظة ✏️</span>
                                      <button
                                        type="button"
                                        onClick={() => setEditingWalletId(null)}
                                        className="text-[10px] text-slate-500 hover:text-slate-800"
                                      >
                                        إلغاء ✖️
                                      </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      <div>
                                        <label className="block text-[10px] font-bold text-slate-700 mb-0.5">اسم المحفظة / التطبيق *</label>
                                        <input
                                          type="text"
                                          value={editWalletName}
                                          onChange={(e) => setEditWalletName(e.target.value)}
                                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                                          required
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-[10px] font-bold text-slate-700 mb-0.5">رقم الحساب / الجوال للإيداع *</label>
                                        <input
                                          type="text"
                                          value={editWalletNumber}
                                          onChange={(e) => setEditWalletNumber(e.target.value)}
                                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800"
                                          required
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-[10px] font-bold text-slate-700 mb-0.5">اسم صاحب المحفظة / المستفيد</label>
                                        <input
                                          type="text"
                                          value={editWalletHolder}
                                          onChange={(e) => setEditWalletHolder(e.target.value)}
                                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-[10px] font-bold text-slate-700 mb-0.5">العبارة الترويجية / الشعار</label>
                                        <input
                                          type="text"
                                          value={editWalletBadge}
                                          onChange={(e) => setEditWalletBadge(e.target.value)}
                                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                                        />
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 pt-1">
                                      <span className="text-[10px] font-bold text-slate-600 shrink-0">الأيقونة:</span>
                                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                                        {["📱", "🏦", "💸", "👛", "💳", "⚡", "📲", "💎", "🏛️"].map((ic) => (
                                          <button
                                            type="button"
                                            key={ic}
                                            onClick={() => setEditWalletIcon(ic)}
                                            className={`w-6 h-6 rounded text-xs flex items-center justify-center transition border ${
                                              editWalletIcon === ic ? "bg-amber-200 border-amber-500 scale-105" : "bg-white border-slate-200"
                                            }`}
                                          >
                                            {ic}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-amber-200/80">
                                      <button
                                        type="button"
                                        onClick={() => setEditingWalletId(null)}
                                        className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] rounded-lg transition"
                                      >
                                        إلغاء
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSaveEditWallet(wallet.id)}
                                        className="px-4 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] rounded-lg transition flex items-center gap-1 shadow-xs cursor-pointer"
                                      >
                                        <Save className="w-3.5 h-3.5" />
                                        <span>حفظ التعديلات ✅</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div
                                  key={wallet.id}
                                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition ${
                                    wallet.active !== false ? "bg-white border-slate-200 shadow-2xs" : "bg-slate-100/70 border-slate-200 opacity-60"
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="text-xl shrink-0">{wallet.icon || "📱"}</span>
                                    <div className="min-w-0 text-right">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-black text-xs text-slate-900 truncate">{wallet.name}</span>
                                        {wallet.badge && (
                                          <span className="bg-amber-100 text-amber-900 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border border-amber-200">
                                            {wallet.badge}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                                        <span>رقم الإيداع: <strong className="font-mono text-slate-800 bg-slate-100 px-1 py-0.5 rounded border border-slate-200">{wallet.accountNumber}</strong></span>
                                        {wallet.accountName && <span>• المستفيد: <span className="text-slate-700">{wallet.accountName}</span></span>}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditWallet(wallet)}
                                      className="p-1.5 text-blue-600 hover:bg-blue-50 border border-blue-200/60 rounded-lg transition cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                                      title="تعديل رقم الحساب أو المحفظة"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                      <span className="hidden sm:inline">تعديل</span>
                                    </button>

                                    <label className="flex items-center gap-1 cursor-pointer text-[10px] font-bold text-slate-600 px-1">
                                      <input
                                        type="checkbox"
                                        checked={wallet.active !== false}
                                        onChange={() => handleToggleWallet(wallet.id)}
                                        className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                                      />
                                      <span>{wallet.active !== false ? "مفعلة" : "معطلة"}</span>
                                    </label>

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteWallet(wallet.id)}
                                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                      title="حذف المحفظة"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 4. Custom Coupons Management */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h5 className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                    <Percent className="w-4 h-4 text-emerald-600" />
                    <span>إدارة كوبونات الخصم والتخفيضات 🎟️</span>
                  </h5>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <span className="text-[10px] font-bold text-slate-600">تفعيل الكوبونات</span>
                    <input
                      type="checkbox"
                      checked={config.enableCoupons !== false}
                      onChange={(e) => handleConfigChange("enableCoupons", e.target.checked)}
                      className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                    />
                  </label>
                </div>

                {config.enableCoupons !== false && (
                  <div className="space-y-3 text-xs">
                    {/* Add Coupon Form */}
                    <form onSubmit={handleAddCoupon} className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200">
                      <input
                        type="text"
                        placeholder="رمز الكود (مثال: PROMO20)"
                        value={newCouponCode}
                        onChange={(e) => setNewCouponCode(e.target.value)}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono uppercase font-bold text-xs"
                      />
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={newCouponDiscount}
                          onChange={(e) => setNewCouponDiscount(Number(e.target.value))}
                          className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-center font-bold font-mono text-xs"
                        />
                        <span className="font-bold text-slate-500">%</span>
                      </div>
                      <button
                        type="submit"
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg transition shadow-xs text-xs flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>إضافة كود</span>
                      </button>
                    </form>

                    {/* Active Coupons List */}
                    <div className="space-y-1.5">
                      {coupons.map((coupon, idx) => (
                        <div key={coupon.code + idx} className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-xs">
                              {coupon.code}
                            </span>
                            <span className="font-bold text-slate-700">خصم {coupon.discountPercent}%</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleCoupon(idx)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                                coupon.active ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-slate-100 text-slate-500 border-slate-200"
                              }`}
                            >
                              {coupon.active ? "مفعل ✅" : "معطل ⏸️"}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteCoupon(idx)}
                              className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Post-Purchase Customization */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <h5 className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5 border-b border-slate-200 pb-2">
                  <Gift className="w-4 h-4 text-emerald-600" />
                  <span>رسالة الشكر المخصصة بعد النجاح وإشعار الواتساب</span>
                </h5>

                <div className="space-y-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">عنوان شاشة الشكر والتأكيد</label>
                    <input
                      type="text"
                      value={config.thankYouTitle || "شكراً لطلبك! تم استلام طلبك بنجاح 🎉"}
                      onChange={(e) => handleConfigChange("thankYouTitle", e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">رسالة التفاصيل للشاشة الأخيرة</label>
                    <textarea
                      rows={2}
                      value={config.thankYouMessage || "سنقوم بتجهيز طلبك وشحنه فوراً، ويمكنك متابعة الطلب أو إرسال الفاتورة عبر الواتساب."}
                      onChange={(e) => handleConfigChange("thankYouMessage", e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                    />
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-800 text-[11px]">إتاحة زر إرسال فاتورة الطلب المباشرة عبر الواتساب 💬</span>
                    <input
                      type="checkbox"
                      checked={config.enableWhatsAppNotification !== false}
                      onChange={(e) => handleConfigChange("enableWhatsAppNotification", e.target.checked)}
                      className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* --- PAGES CUSTOMIZATION TAB --- */}
        {activeTab === "pages" && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 space-y-1">
              <h4 className="font-bold text-indigo-900 text-xs flex items-center gap-1.5">
                <Info className="w-4 h-4 text-indigo-600" />
                <span>تعديل نصوص وصفحات المتجر (من نحن & تواصل معنا)</span>
              </h4>
              <p className="text-[11px] text-indigo-700 leading-relaxed">
                يمكنك تخصيص كل كلمة وصفحة في قالبك! عدّل قصة متجرك ورؤيتك، وكذلك جميع وسائل الاتصال والعناوين وساعات العمل لترسخ ثقة عملائك.
              </p>
            </div>

            {/* SECTION 1: ABOUT US CUSTOMIZATION */}
            <div className="space-y-4 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80">
              <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
                <span className="text-base">📖</span>
                <h5 className="text-xs font-black text-slate-800">تخصيص صفحة (من نحن / عن المتجر)</h5>
              </div>

              {/* About Title */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">عنوان الصفحة أو الفقرة الرئيسية</label>
                <input
                  type="text"
                  value={config.aboutTitle || ""}
                  onChange={(e) => handleConfigChange("aboutTitle", e.target.value)}
                  placeholder="مثال: قصة لورين للعطور - فخامة العبق الشرقي"
                  className="w-full bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none"
                />
              </div>

              {/* About Text */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">قصة وشغف المتجر (الوصف التفصيلي)</label>
                <textarea
                  rows={3}
                  value={config.aboutText || ""}
                  onChange={(e) => handleConfigChange("aboutText", e.target.value)}
                  placeholder="اكتب هنا قصة تأسيس متجرك، ماذا يميزكم وما القيمة التي تقدمونها للعملاء..."
                  className="w-full bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none leading-relaxed"
                />
              </div>

              {/* About Vision */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">الرؤية والرسالة والهدف</label>
                <textarea
                  rows={2}
                  value={config.aboutVision || ""}
                  onChange={(e) => handleConfigChange("aboutVision", e.target.value)}
                  placeholder="مثال: نسعى لنكون الخيار الأول لعشاق الأناقة والابتكار في الخليج..."
                  className="w-full bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none leading-relaxed"
                />
              </div>

              {/* About Image Uploader / URL */}
              <div className="space-y-2 pt-2 border-t border-slate-200/60">
                <label className="block text-xs font-bold text-slate-700">صورة صفحة (من نحن) الرسمية 🖼️</label>
                
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-bold leading-5 text-amber-800">
                  رفع صورة «من نحن» سينتقل إلى محرر الصفحات. في هذه المرحلة استخدم رابط HTTPS فقط.
                </p>

                {/* Direct Image URL input */}
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold block">أو أدخل رابط صورة مباشر (URL):</span>
                  <input
                    type="text"
                    value={/^(?:data|blob):/i.test(config.aboutImage || "") ? "" : (config.aboutImage || "")}
                    onChange={(e) => handleConfigChange("aboutImage", e.target.value)}
                    placeholder="https://images.unsplash.com/photo-..."
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
                  />
                </div>

                {/* Image Presets */}
                <div className="space-y-1">
                  <span className="text-[9px] text-slate-400 font-bold block">أو اختر صورة جاهزة تناسب متجرك:</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { name: "عطور وفاخر", url: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=800&q=80" },
                      { name: "تقنية وعملي", url: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80" },
                      { name: "متجر وأثاث", url: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80" }
                    ].map((preset) => (
                      <button
                        key={preset.url}
                        type="button"
                        onClick={() => handleConfigChange("aboutImage", preset.url)}
                        className={`p-1.5 rounded-lg border text-[10px] font-bold text-center transition ${
                          config.aboutImage === preset.url
                            ? "bg-indigo-50 border-indigo-500 text-indigo-700"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: CONTACT US CUSTOMIZATION */}
            <div className="space-y-4 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80">
              <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
                <span className="text-base">📞</span>
                <h5 className="text-xs font-black text-slate-800">تخصيص بيانات صفحة (تواصل معنا)</h5>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">البريد الإلكتروني المباشر</label>
                <input
                  type="email"
                  value={config.email || ""}
                  onChange={(e) => handleConfigChange("email", e.target.value)}
                  placeholder="support@yourdomain.com"
                  className="w-full bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none"
                />
              </div>

              {/* WhatsApp number */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">رقم الواتساب المباشر (مع الرمز الدولي)</label>
                <input
                  type="text"
                  value={config.whatsapp || ""}
                  onChange={(e) => handleConfigChange("whatsapp", e.target.value)}
                  placeholder="+966500000000"
                  className="w-full bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none"
                />
              </div>

              {/* Address */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">العنوان والموقع الجغرافي للمقر أو المستودع</label>
                <input
                  type="text"
                  value={config.address || ""}
                  onChange={(e) => handleConfigChange("address", e.target.value)}
                  placeholder="الرياض، طريق الملك فهد - المملكة العربية السعودية"
                  className="w-full bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none"
                />
              </div>

              {/* Working Hours */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">أوقات وساعات العمل والرد على الاستفسارات</label>
                <input
                  type="text"
                  value={config.workingHours || ""}
                  onChange={(e) => handleConfigChange("workingHours", e.target.value)}
                  placeholder="السبت - الخميس: 9:00 صباحاً - 11:00 مساءً"
                  className="w-full bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none"
                />
              </div>
            </div>

            {/* SECTION 3: SOCIAL MEDIA HANDLES */}
            <div className="space-y-3 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80">
              <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
                <span className="text-base">🌐</span>
                <h5 className="text-xs font-black text-slate-800">حسابات التواصل الاجتماعي (تظهر في التذييل)</h5>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500">انستغرام (Instagram)</label>
                  <input
                    type="text"
                    value={config.instagram || ""}
                    onChange={(e) => handleConfigChange("instagram", e.target.value)}
                    placeholder="اسم الحساب"
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500">تويتر / X</label>
                  <input
                    type="text"
                    value={config.twitter || ""}
                    onChange={(e) => handleConfigChange("twitter", e.target.value)}
                    placeholder="اسم الحساب"
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500">تيك توك (TikTok)</label>
                  <input
                    type="text"
                    value={config.tiktok || ""}
                    onChange={(e) => handleConfigChange("tiktok", e.target.value)}
                    placeholder="اسم الحساب"
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500">سناب شات (Snapchat)</label>
                  <input
                    type="text"
                    value={config.snapchat || ""}
                    onChange={(e) => handleConfigChange("snapchat", e.target.value)}
                    placeholder="اسم الحساب"
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- AI ASSISTANT / COPYWRITER TAB --- */}
        {activeTab === "ai" && (
          <AiCopywriterPanel
            prompt={assistantPrompt}
            loading={isGeneratingCopy}
            output={copyOutput}
            onPromptChange={setAssistantPrompt}
            onSubmit={triggerCopyWrite}
          />
        )}

        {/* --- STORE ACTIVATION & SUBDOMAIN REQUEST TAB --- */}
        {activeTab === "export" && (
          <StoreSubmissionPanel
            storeName={config.storeName}
            slogan={config.slogan}
            productCount={config.products.length}
            onOpen={onOpenDomainModal}
          />
        )}
      </div>

      {/* Sticky Bottom Action Bar for Finishing Customization */}
      {activeTab !== "export" && (
        <CustomizationCompletionBar
          onComplete={() => {
            if (onOpenDomainModal) onOpenDomainModal();
            else setActiveTab("export");
          }}
        />
      )}
    </div>
  );
}
