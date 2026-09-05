import React, { useState } from "react";
import { useUiAdapters } from "../adapters/UiAdaptersContext";
import MerchantProductEditor from "../features/catalog/MerchantProductEditor";
import MerchantCheckoutSettingsEditor from "../features/checkout/MerchantCheckoutSettingsEditor";
import MerchantStoreContentEditor from "../features/store-content/MerchantStoreContentEditor";
import AiCopywriterPanel from "../features/store-builder/AiCopywriterPanel";
import { CustomizationCompletionBar, PreviewDeviceSelector } from "../features/store-builder/ControlPanelChrome";
import type { ControlPanelProps, CopywriterOutput } from "../features/store-builder/controlPanelTypes";
import MerchantStoreProfileEditor from "../features/store-profile/MerchantStoreProfileEditor";
import StoreSubmissionPanel from "../features/tenancy/StoreSubmissionPanel";

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
  onOpenDomainModal,
  onCompleteCustomization,
  completionDisabled = false,
  completionLoading = false,
}: ControlPanelProps) {
  const { assistant, catalog, storeAssets } = useUiAdapters();
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false);
  const [copyOutput, setCopyOutput] = useState<CopywriterOutput | null>(null);

  const triggerCopyWrite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!assistantPrompt.trim()) return;
    setIsGeneratingCopy(true);
    try {
      const data = await assistant.generateStoreIdeas(`اكتب محتوى تسويقيًا واقعيًا بناءً على هذه الفكرة: "${assistantPrompt}"`);
      setCopyOutput({
        slogan: data.slogan,
        banner: data.bannerText,
        productDesc: data.products?.[0]?.description ?? "",
      });
    } catch {
      setCopyOutput({
        slogan: "التميز يبدأ من الاختيار الصحيح لهويتك",
        banner: "اكتب عرضك الحقيقي هنا بعد مراجعة تفاصيله",
        productDesc: "أضف وصفًا دقيقًا يوضح خصائص المنتج وفائدته للعميل",
      });
    } finally {
      setIsGeneratingCopy(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
      <PreviewDeviceSelector device={previewDevice} onChange={setPreviewDevice} />
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
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
        {activeTab === "checkout" && <MerchantCheckoutSettingsEditor config={config} onChange={handleConfigChange} onOpenPreview={onOpenCheckoutPreview} />}
        {activeTab === "pages" && <MerchantStoreContentEditor config={config} activeTenantId={activeTenantId} mediaOwnerKey={mediaOwnerKey} onChange={handleConfigChange} uploadAsset={storeAssets.upload} />}
        {activeTab === "ai" && <AiCopywriterPanel prompt={assistantPrompt} loading={isGeneratingCopy} output={copyOutput} onPromptChange={setAssistantPrompt} onSubmit={triggerCopyWrite} />}
        {activeTab === "export" && (
          <StoreSubmissionPanel
            storeName={config.storeName}
            slogan={config.slogan}
            productCount={config.products.length}
            onOpen={onOpenDomainModal}
            existingWorkspace={activeTenantId !== null}
            onReturnToPortal={onCompleteCustomization}
          />
        )}
      </div>
      {activeTab !== "export" && (
        <CustomizationCompletionBar
          existingWorkspace={activeTenantId !== null}
          disabled={completionDisabled}
          loading={completionLoading}
          onComplete={() => {
            if (onCompleteCustomization) {
              void onCompleteCustomization();
              return;
            }
            if (onOpenDomainModal) {
              onOpenDomainModal();
              return;
            }
            setActiveTab("export");
          }}
        />
      )}
    </div>
  );
}
