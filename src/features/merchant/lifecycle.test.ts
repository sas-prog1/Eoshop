import { describe, expect, it } from "vitest";
import type { StoreSubmission } from "../../adapters/uiAdapters";
import { deriveMerchantLifecycle, publicationBlockerLabel } from "./lifecycle";

function store(overrides: Partial<StoreSubmission> = {}): StoreSubmission {
  return {
    id: "tenant-1",
    storeName: "متجر صنعاء",
    businessType: "retail",
    verificationStatus: "pending",
    provisioningStatus: "not_started",
    publicationStatus: "requested",
    reviewFeedback: null,
    capabilities: { workspaceManage: true, catalogManage: true, inventoryView: true, inventoryManage: true, ordersView: true, ordersManage: true, draftEdit: false, resubmit: false, publish: false, unpublish: false },
    internalDomain: "store-tenant-1.eoshop.local",
    requestedDomain: "sanaa.eoshop.local",
    publicDomain: null,
    plan: { key: "starter", name: "البداية", activationMode: "automatic" },
    subscriptionStatus: "active",
    publicationBlockers: ["review_not_approved", "provisioning_not_ready"],
    createdAt: null,
    activeAt: null,
    publishedAt: null,
    ...overrides,
  };
}

describe("deriveMerchantLifecycle", () => {
  it("separates correctable requests from final rejection and suspension", () => {
    expect(deriveMerchantLifecycle(store())).toMatchObject({ stage: "review", actionOwner: "platform", canOpenBuilder: false });
    expect(deriveMerchantLifecycle(store({ verificationStatus: "rejected", reviewFeedback: "أكمل بيانات النشاط" }))).toMatchObject({
      stage: "blocked",
      explanation: "أكمل بيانات النشاط",
      actionOwner: "platform",
      canOpenBuilder: false,
    });
    expect(deriveMerchantLifecycle(store({ verificationStatus: "changes_requested", reviewFeedback: "أكمل بيانات النشاط" }))).toMatchObject({
      stage: "blocked",
      explanation: "أكمل بيانات النشاط",
      actionOwner: "merchant",
      canOpenBuilder: false,
    });
    expect(deriveMerchantLifecycle(store({ verificationStatus: "suspended" }))).toMatchObject({ tone: "danger", actionOwner: "platform" });
  });

  it("distinguishes provisioning progress and failure", () => {
    expect(deriveMerchantLifecycle(store({ verificationStatus: "approved", provisioningStatus: "provisioning" }))).toMatchObject({
      stage: "provisioning",
      actionOwner: "system",
      completedSteps: 2,
    });
    expect(deriveMerchantLifecycle(store({ verificationStatus: "approved", provisioningStatus: "failed" }))).toMatchObject({
      stage: "blocked",
      tone: "danger",
      actionOwner: "platform",
    });
  });

  it("keeps the builder available while a ready store waits for entitlement or publication", () => {
    expect(deriveMerchantLifecycle(store({
      verificationStatus: "approved",
      provisioningStatus: "active",
      subscriptionStatus: "pending_activation",
      publicationBlockers: ["subscription_not_active"],
    }))).toMatchObject({ canOpenBuilder: true, actionOwner: "platform", isPublished: false });

    expect(deriveMerchantLifecycle(store({
      verificationStatus: "approved",
      provisioningStatus: "active",
      publicationBlockers: [],
    }))).toMatchObject({ stage: "publication", canOpenBuilder: true, isPublished: false });
  });

  it("keeps the full builder closed when the active membership lacks workspace management", () => {
    expect(deriveMerchantLifecycle(store({
      verificationStatus: "approved",
      provisioningStatus: "active",
      publicationBlockers: [],
      capabilities: { workspaceManage: false, catalogManage: true, inventoryView: true, inventoryManage: true, ordersView: true, ordersManage: true, draftEdit: false, resubmit: false, publish: false, unpublish: false },
    }))).toMatchObject({ canOpenBuilder: false });
  });

  it("exposes a published state only with an exact public domain and no blockers", () => {
    expect(deriveMerchantLifecycle(store({
      verificationStatus: "approved",
      provisioningStatus: "active",
      publicationStatus: "published",
      publicDomain: "sanaa.eoshop.local",
      publicationBlockers: [],
    }))).toMatchObject({ stage: "published", tone: "success", isPublished: true, completedSteps: 4 });

    expect(deriveMerchantLifecycle(store({
      verificationStatus: "approved",
      provisioningStatus: "active",
      publicationStatus: "published",
      publicDomain: null,
      publicationBlockers: [],
    }))).toMatchObject({ stage: "blocked", tone: "danger", isPublished: false });
  });

  it("renders unknown blocker codes as safe support messages", () => {
    expect(publicationBlockerLabel("internal_future_code")).toContain("فريق المنصة");
  });
});
