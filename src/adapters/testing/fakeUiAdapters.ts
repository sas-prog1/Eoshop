import type { UiAdapters } from "../uiAdapters";

type AdapterOverrides = {
  [Key in keyof UiAdapters]?: Partial<UiAdapters[Key]>;
};

function unexpected(operation: string): never {
  throw new Error(`Unexpected fake UI adapter call: ${operation}`);
}

export function createFakeUiAdapters(overrides: AdapterOverrides = {}): UiAdapters {
  const adapters: UiAdapters = {
    auth: {
      session: async () => unexpected("auth.session"),
      register: async () => unexpected("auth.register"),
      login: async () => unexpected("auth.login"),
      logout: async () => unexpected("auth.logout"),
      updateProfile: async () => unexpected("auth.updateProfile"),
      changePassword: async () => unexpected("auth.changePassword"),
      forgotPassword: async () => unexpected("auth.forgotPassword"),
      resetPassword: async () => unexpected("auth.resetPassword"),
    },
    administration: {
      getPlatformSettings: async () => unexpected("administration.getPlatformSettings"),
      updatePlatformSettings: async () => unexpected("administration.updatePlatformSettings"),
      overview: async () => unexpected("administration.overview"),
      listStores: async () => unexpected("administration.listStores"),
      getStore: async () => unexpected("administration.getStore"),
      listAuditLogs: async () => unexpected("administration.listAuditLogs"),
      listPlatformRoles: async () => unexpected("administration.listPlatformRoles"),
      listUsers: async () => unexpected("administration.listUsers"),
      inviteUser: async () => unexpected("administration.inviteUser"),
      replaceUserRoles: async () => unexpected("administration.replaceUserRoles"),
      updateUserStatus: async () => unexpected("administration.updateUserStatus"),
      resendUserInvitation: async () => unexpected("administration.resendUserInvitation"),
      updateStoreStatus: async () => unexpected("administration.updateStoreStatus"),
      reviewStoreEvidence: async () => unexpected("administration.reviewStoreEvidence"),
      retryProvisioning: async () => unexpected("administration.retryProvisioning"),
      activateSubscription: async () => unexpected("administration.activateSubscription"),
      publish: async () => unexpected("administration.publish"),
      unpublish: async () => unexpected("administration.unpublish"),
    },
    platformSettings: {
      load: async () => unexpected("platformSettings.load"),
    },
    assistant: {
      generateStoreIdeas: async () => unexpected("assistant.generateStoreIdeas"),
    },
    plans: {
      list: async () => unexpected("plans.list"),
      domainAvailability: async () => unexpected("plans.domainAvailability"),
    },
    provisioning: {
      clearPendingForOwner: () => unexpected("provisioning.clearPendingForOwner"),
      recoverCommittedSubmission: async () => unexpected("provisioning.recoverCommittedSubmission"),
      currentDraft: async () => unexpected("provisioning.currentDraft"),
      application: async () => unexpected("provisioning.application"),
      uploadApplicationEvidence: async () => unexpected("provisioning.uploadApplicationEvidence"),
      exemptApplicationRequirement: async () => unexpected("provisioning.exemptApplicationRequirement"),
      correctionDraft: async () => unexpected("provisioning.correctionDraft"),
      saveDraft: async () => unexpected("provisioning.saveDraft"),
      saveBusiness: async () => unexpected("provisioning.saveBusiness"),
      saveDesign: async () => unexpected("provisioning.saveDesign"),
      saveReview: async () => unexpected("provisioning.saveReview"),
      saveCorrection: async () => unexpected("provisioning.saveCorrection"),
      listStores: async () => unexpected("provisioning.listStores"),
      submit: async () => unexpected("provisioning.submit"),
      resubmit: async () => unexpected("provisioning.resubmit"),
      publish: async () => unexpected("provisioning.publish"),
      unpublish: async () => unexpected("provisioning.unpublish"),
    },
    workspace: {
      load: async () => unexpected("workspace.load"),
      save: async () => unexpected("workspace.save"),
    },
    catalog: {
      load: async () => unexpected("catalog.load"),
      uploadMedia: async () => unexpected("catalog.uploadMedia"),
    },
    inventory: {
      load: async () => unexpected("inventory.load"),
      adjust: async () => unexpected("inventory.adjust"),
      updatePolicy: async () => unexpected("inventory.updatePolicy"),
    },
    orders: {
      loadStorefront: async () => unexpected("orders.loadStorefront"),
      create: async () => unexpected("orders.create"),
      list: async () => unexpected("orders.list"),
      detail: async () => unexpected("orders.detail"),
      updateStatus: async () => unexpected("orders.updateStatus"),
    },
    merchantDashboard: {
      load: async () => unexpected("merchantDashboard.load"),
    },
    storeAssets: {
      upload: async () => unexpected("storeAssets.upload"),
    },
  };

  return {
    auth: { ...adapters.auth, ...overrides.auth },
    administration: { ...adapters.administration, ...overrides.administration },
    platformSettings: { ...adapters.platformSettings, ...overrides.platformSettings },
    assistant: { ...adapters.assistant, ...overrides.assistant },
    plans: { ...adapters.plans, ...overrides.plans },
    provisioning: { ...adapters.provisioning, ...overrides.provisioning },
    workspace: { ...adapters.workspace, ...overrides.workspace },
    catalog: { ...adapters.catalog, ...overrides.catalog },
    inventory: { ...adapters.inventory, ...overrides.inventory },
    orders: { ...adapters.orders, ...overrides.orders },
    merchantDashboard: { ...adapters.merchantDashboard, ...overrides.merchantDashboard },
    storeAssets: { ...adapters.storeAssets, ...overrides.storeAssets },
  };
}
