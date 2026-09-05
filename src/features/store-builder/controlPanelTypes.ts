import type { Product, StoreConfig } from "../../types";

export type ControlTab =
  | "branding"
  | "design"
  | "products"
  | "checkout"
  | "pages"
  | "ai"
  | "export";

export type PreviewDevice = "desktop" | "mobile";

export interface ControlPanelProps {
  config: StoreConfig;
  activeTenantId: string | null;
  mediaOwnerKey?: string | null;
  canViewInventory?: boolean;
  handleConfigChange: (key: keyof StoreConfig, value: any) => void;
  handleProductChange: (productId: string, patch: Partial<Product>) => void;
  handleProductMediaChange: (productId: string, urls: string[]) => void;
  addEmptyProduct: () => void;
  deleteProduct: (id: string) => void;
  activeTab: ControlTab;
  setActiveTab: (tab: ControlTab) => void;
  previewDevice: PreviewDevice;
  setPreviewDevice: (device: PreviewDevice) => void;
  onOpenCheckoutPreview?: () => void;
  onOpenInventory?: () => void;
  onOpenDomainModal?: () => void;
  onCompleteCustomization?: () => void | Promise<void>;
  completionDisabled?: boolean;
  completionLoading?: boolean;
}

export interface CopywriterOutput {
  slogan?: string;
  banner?: string;
  productDesc?: string;
}
