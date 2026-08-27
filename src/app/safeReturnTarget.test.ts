// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import type { StoreSubmission, UserProfile } from "../adapters/uiAdapters";
import { authorizeReturnTarget, readSafeReturnTarget } from "./safeReturnTarget";

const merchant: UserProfile = {
  id: "owner-1",
  fullName: "Merchant",
  email: "merchant@example.test",
  phone: "",
  profileRevision: 1,
  createdAt: null,
  updatedAt: null,
  role: "merchant",
  platformRoles: [],
  platformPermissions: [],
};

const tenantId = "01j00000000000000000000000";
const store: StoreSubmission = {
  id: tenantId,
  storeName: "Owned Store",
  businessType: "retail",
  verificationStatus: "approved",
  provisioningStatus: "active",
  publicationStatus: "published",
  reviewFeedback: null,
  capabilities: { workspaceManage: true, catalogManage: true, inventoryView: true, inventoryManage: true, ordersView: true, ordersManage: true, draftEdit: false, resubmit: false, publish: false, unpublish: true },
  internalDomain: null,
  requestedDomain: null,
  publicDomain: "owned.example.test",
  plan: { key: "starter", name: "Starter", activationMode: "automatic" },
  subscriptionStatus: "active",
  publicationBlockers: [],
  createdAt: null,
  activeAt: null,
  publishedAt: null,
};

afterEach(() => window.history.replaceState({}, "", "/"));

describe("safe return target", () => {
  it("accepts one normally encoded internal target and rejects double-encoded, duplicate and external forms", () => {
    expect(readSafeReturnTarget(`?returnTo=/app/stores/${tenantId}/orders`)).toBe(`/app/stores/${tenantId}/orders`);
    expect(readSafeReturnTarget("?returnTo=%2Fapp%2Fnew")).toBe("/app/new");
    expect(readSafeReturnTarget("?returnTo=//evil.example/path")).toBeNull();
    expect(readSafeReturnTarget("?returnTo=%252Fapp%252Fnew")).toBeNull();
    expect(readSafeReturnTarget("?returnTo=/app&returnTo=/admin")).toBeNull();
    expect(readSafeReturnTarget("?returnTo=/app?tab=secret")).toBeNull();
  });

  it("reauthorizes store ownership and platform sections after login", () => {
    expect(authorizeReturnTarget(`/app/stores/${tenantId}/orders`, merchant, [store]))
      .toBe(`/app/stores/${tenantId}/orders`);
    expect(authorizeReturnTarget("/app/stores/01j11111111111111111111111/orders", merchant, [store]))
      .toBe("/app");
    expect(authorizeReturnTarget("/admin/users", merchant, [store])).toBe("/app");

    const operator = { ...merchant, role: "admin" as const, platformPermissions: ["platform.users.manage"] };
    expect(authorizeReturnTarget("/admin/users", operator, [])).toBe("/admin/users");
    expect(authorizeReturnTarget("/admin/audit", operator, [])).toBe("/admin/users");
    const storeReviewer = { ...merchant, role: "admin" as const, platformPermissions: ["platform.stores.view"] };
    expect(readSafeReturnTarget(`?returnTo=/admin/stores/${tenantId}`)).toBe(`/admin/stores/${tenantId}`);
    expect(authorizeReturnTarget(`/admin/stores/${tenantId}`, storeReviewer, [])).toBe(`/admin/stores/${tenantId}`);
  });
});
