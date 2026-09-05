import { adminApi } from "../services/adminApi";
import { assistantApi } from "../services/assistantApi";
import { authApi, toUserProfile } from "../services/authApi";
import { plansApi } from "../services/plansApi";
import { provisioningApi } from "../services/provisioningApi";
import { workspaceApi } from "../services/workspaceApi";
import { catalogApi } from "../services/catalogApi";
import { inventoryApi } from "../services/inventoryApi";
import { orderApi } from "../services/orderApi";
import { merchantDashboardApi } from "../services/merchantDashboardApi";
import { storeAssetApi } from "../services/storeAssetApi";
import { platformSettingsApi } from "../services/platformSettingsApi";

export type {
  AdminAuditEvent,
  AdminAuditQuery,
  InvitationDispatchStatus,
  InvitePlatformUserInput,
  InvitePlatformUserResult,
  PaginatedResult,
  PaginationMeta,
  PlatformAttentionQueue,
  PlatformOverview,
  PlatformAssetPurpose,
  PlatformAssetUpload,
  PlatformAssetUploadOptions,
  PlatformRole,
  PlatformStore,
  PlatformStoreDetail,
  PlatformStoreQuery,
  PlatformUser,
  PlatformUserQuery,
  PlatformUserStatus,
  ProvisioningStatus,
  PublicationStatus,
  VerificationStatus,
} from "../services/adminApi";
export type { GeneratedStoreIdeas, GeneratedStoreProduct } from "../services/assistantApi";
export type { StorePlan } from "../services/plansApi";
export type { StoreApplicationDossier, StoreApplicationEvidence, StoreApplicationRequirement, StoreDraft, StoreDraftInput, StoreSubmission, StoreSubmissionInput } from "../services/provisioningApi";
export type { StoreWorkspace } from "../services/workspaceApi";
export type { CatalogSnapshot } from "../services/catalogApi";
export type { StoreAssetUpload } from "../services/storeAssetApi";
export type { CreateOrderInput, MerchantOrderList, MerchantOrderQuery, MerchantOrderStatus, OrderDetail, OrderReceipt, StorefrontBootstrap } from "../services/orderApi";
export type { MerchantDashboardSnapshot, MerchantDashboardTaskCode } from "../services/merchantDashboardApi";
export type { AdminPlatformSettings, PlatformBrandFont, PlatformNavigationItem, PlatformNavigationKey, PlatformSettings, UpdatePlatformSettingsInput } from "../services/platformSettingsApi";
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
  profileRevision: number;
  createdAt: string | null;
  updatedAt: string | null;
  role: "merchant" | "admin";
  platformRoles: string[];
  platformPermissions: string[];
  createdStoreId?: string;
  createdStoreName?: string;
  storeStatus?: "pending" | "approved" | "rejected" | "none";
}

export interface AuthActions {
  session(signal?: AbortSignal): Promise<UserProfile | null>;
  register(input: Parameters<typeof authApi.register>[0]): Promise<UserProfile>;
  login(email: string, password: string): Promise<UserProfile>;
  logout(): Promise<void>;
  updateProfile(input: Parameters<typeof authApi.updateProfile>[0], signal?: AbortSignal): Promise<UserProfile>;
  changePassword(input: Parameters<typeof authApi.changePassword>[0], signal?: AbortSignal): Promise<string>;
  forgotPassword(email: string): Promise<string>;
  resetPassword(input: Parameters<typeof authApi.resetPassword>[0]): Promise<string>;
}

export interface UiAdapters {
  auth: AuthActions;
  administration: typeof adminApi;
  platformSettings: typeof platformSettingsApi;
  assistant: typeof assistantApi;
  plans: typeof plansApi;
  provisioning: typeof provisioningApi;
  workspace: typeof workspaceApi;
  catalog: typeof catalogApi;
  inventory: typeof inventoryApi;
  orders: typeof orderApi;
  merchantDashboard: typeof merchantDashboardApi;
  storeAssets: typeof storeAssetApi;
}

export const productionUiAdapters: UiAdapters = {
  auth: {
    async session(signal) {
      const user = await authApi.session(signal);
      return user ? toUserProfile(user) : null;
    },
    async register(input) {
      return toUserProfile(await authApi.register(input));
    },
    async login(email, password) {
      return toUserProfile(await authApi.login(email, password));
    },
    logout: () => authApi.logout(),
    async updateProfile(input, signal) {
      return toUserProfile(await authApi.updateProfile(input, signal));
    },
    changePassword: (input, signal) => authApi.changePassword(input, signal),
    forgotPassword: (email) => authApi.forgotPassword(email),
    resetPassword: (input) => authApi.resetPassword(input),
  },
  administration: adminApi,
  platformSettings: platformSettingsApi,
  assistant: assistantApi,
  plans: plansApi,
  provisioning: provisioningApi,
  workspace: workspaceApi,
  catalog: catalogApi,
  inventory: inventoryApi,
  orders: orderApi,
  merchantDashboard: merchantDashboardApi,
  storeAssets: storeAssetApi,
};
