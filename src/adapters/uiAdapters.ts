import { adminApi } from "../services/adminApi";
import { assistantApi } from "../services/assistantApi";
import { authApi, toUserProfile } from "../services/authApi";
import { plansApi } from "../services/plansApi";
import { provisioningApi } from "../services/provisioningApi";
import { workspaceApi } from "../services/workspaceApi";
import { catalogApi } from "../services/catalogApi";
import { inventoryApi } from "../services/inventoryApi";
import { orderApi } from "../services/orderApi";
import { storeAssetApi } from "../services/storeAssetApi";

export type {
  PlatformStore,
  ProvisioningStatus,
  PublicationStatus,
  VerificationStatus,
} from "../services/adminApi";
export type { GeneratedStoreIdeas, GeneratedStoreProduct } from "../services/assistantApi";
export type { StorePlan } from "../services/plansApi";
export type { StoreDraft, StoreDraftInput, StoreSubmission, StoreSubmissionInput } from "../services/provisioningApi";
export type { StoreWorkspace } from "../services/workspaceApi";
export type { CatalogSnapshot } from "../services/catalogApi";
export type { StoreAssetUpload } from "../services/storeAssetApi";
export type { CreateOrderInput, OrderReceipt, StorefrontBootstrap } from "../services/orderApi";
export {
  UiAdapterError,
  isUiError,
  isUiErrorCode,
  uiErrorMessage,
} from "../contracts/uiError";
export type { UiErrorCategory, UiErrorShape } from "../contracts/uiError";

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: "merchant" | "admin";
  platformRoles: string[];
  platformPermissions: string[];
  createdStoreId?: string;
  createdStoreName?: string;
  storeStatus?: "pending" | "approved" | "rejected" | "none";
}

export interface AuthActions {
  session(): Promise<UserProfile | null>;
  register(input: Parameters<typeof authApi.register>[0]): Promise<UserProfile>;
  login(email: string, password: string): Promise<UserProfile>;
  logout(): Promise<void>;
  forgotPassword(email: string): Promise<string>;
  resetPassword(input: Parameters<typeof authApi.resetPassword>[0]): Promise<string>;
}

export interface UiAdapters {
  auth: AuthActions;
  administration: typeof adminApi;
  assistant: typeof assistantApi;
  plans: typeof plansApi;
  provisioning: typeof provisioningApi;
  workspace: typeof workspaceApi;
  catalog: typeof catalogApi;
  inventory: typeof inventoryApi;
  orders: typeof orderApi;
  storeAssets: typeof storeAssetApi;
}

export const productionUiAdapters: UiAdapters = {
  auth: {
    async session() {
      const user = await authApi.session();
      return user ? toUserProfile(user) : null;
    },
    async register(input) {
      return toUserProfile(await authApi.register(input));
    },
    async login(email, password) {
      return toUserProfile(await authApi.login(email, password));
    },
    logout: () => authApi.logout(),
    forgotPassword: (email) => authApi.forgotPassword(email),
    resetPassword: (input) => authApi.resetPassword(input),
  },
  administration: adminApi,
  assistant: assistantApi,
  plans: plansApi,
  provisioning: provisioningApi,
  workspace: workspaceApi,
  catalog: catalogApi,
  inventory: inventoryApi,
  orders: orderApi,
  storeAssets: storeAssetApi,
};
