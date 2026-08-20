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
      forgotPassword: async () => unexpected("auth.forgotPassword"),
      resetPassword: async () => unexpected("auth.resetPassword"),
    },
    administration: {
      listStores: async () => unexpected("administration.listStores"),
      updateStoreStatus: async () => unexpected("administration.updateStoreStatus"),
      retryProvisioning: async () => unexpected("administration.retryProvisioning"),
      activateSubscription: async () => unexpected("administration.activateSubscription"),
      publish: async () => unexpected("administration.publish"),
      unpublish: async () => unexpected("administration.unpublish"),
    },
    assistant: {
      generateStoreIdeas: async () => unexpected("assistant.generateStoreIdeas"),
    },
    plans: {
      list: async () => unexpected("plans.list"),
      domainAvailability: async () => unexpected("plans.domainAvailability"),
    },
    provisioning: {
      currentDraft: async () => unexpected("provisioning.currentDraft"),
      correctionDraft: async () => unexpected("provisioning.correctionDraft"),
      saveDraft: async () => unexpected("provisioning.saveDraft"),
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
      updateStatus: async () => unexpected("orders.updateStatus"),
    },
    storeAssets: {
      upload: async () => unexpected("storeAssets.upload"),
    },
  };

  return {
    auth: { ...adapters.auth, ...overrides.auth },
    administration: { ...adapters.administration, ...overrides.administration },
    assistant: { ...adapters.assistant, ...overrides.assistant },
    plans: { ...adapters.plans, ...overrides.plans },
    provisioning: { ...adapters.provisioning, ...overrides.provisioning },
    workspace: { ...adapters.workspace, ...overrides.workspace },
    catalog: { ...adapters.catalog, ...overrides.catalog },
    inventory: { ...adapters.inventory, ...overrides.inventory },
    orders: { ...adapters.orders, ...overrides.orders },
    storeAssets: { ...adapters.storeAssets, ...overrides.storeAssets },
  };
}
