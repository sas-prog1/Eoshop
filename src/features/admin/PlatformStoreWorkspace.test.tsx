// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createFakeUiAdapters } from "../../adapters/testing/fakeUiAdapters";
import type { PlatformStoreDetail, UserProfile } from "../../adapters/uiAdapters";
import PlatformStoreWorkspace from "./PlatformStoreWorkspace";

const reviewer: UserProfile = {
  id: "reviewer-1", fullName: "مراجع المنصة", email: "reviewer@example.test", phone: "", profileRevision: 1,
  createdAt: null, updatedAt: null, role: "admin", platformRoles: ["platform_reviewer"],
  platformPermissions: ["platform.stores.view", "platform.stores.review"],
};

const store: PlatformStoreDetail = {
  id: "01m0tq3hamfxa30em00wjqvt96", storeName: "تمور مالك", ownerName: "مالك المتجر", ownerEmail: "owner@example.test",
  ownerPhone: "+967700000000", businessType: "retail", verificationStatus: "pending", provisioningStatus: "not_started",
  publicationStatus: "requested", rejectionReason: null, themeStyle: "elegant", domains: [], requestedDomain: "tamoor.lvh.me",
  publicDomain: null, publicationBlockers: ["review_not_approved", "provisioning_not_ready"],
  subscription: { id: "sub-1", status: "active", endsAt: null, plan: { key: "starter", name: "الباقة المبتدئة", activationMode: "automatic" } },
  createdAt: "2026-08-27T08:00:00Z", activeAt: null, latestProvisioningRun: null,
  applicationWorkspace: {
    snapshot: {
      draftId: "draft-1", revision: 4, submittedAt: "2026-08-27T08:00:00Z", storeName: "تمور مالك", businessType: "retail",
      themeStyle: "elegant", handle: "tamoor", planKey: "starter", planName: "الباقة المبتدئة",
      config: { storeName: "تمور مالك", slogan: "من المزرعة إلى بيتك", primaryColor: "#047857", secondaryColor: "#0f172a" },
    },
    dossier: {
      draftId: "draft-1", tenantId: "01m0tq3hamfxa30em00wjqvt96", draftRevision: 4, ready: true, reviewReady: false,
      blockers: [], reviewBlockers: ["owner_identity"],
      requirements: [{
        key: "owner_identity", label: "إثبات هوية المالك", description: "وثيقة خاصة للمراجعة.", uploadRequired: true,
        allowExemption: false, resolved: true,
        evidence: {
          id: "00000000-0000-4000-8000-000000000001", resolution: "uploaded", reviewStatus: "pending", originalName: "identity.pdf",
          mimeType: "application/pdf", byteSize: 2048, exemptionReason: null, uploadedAt: "2026-08-27T08:00:00Z",
          downloadUrl: "/api/admin/stores/01m0tq3hamfxa30em00wjqvt96/application/evidence/00000000-0000-4000-8000-000000000001",
        },
      }],
      correctionRequest: null,
      timeline: [{ id: "submitted", type: "submitted", actorType: "merchant", message: "تم إرسال الطلب.", occurredAt: "2026-08-27T08:00:00Z" }],
    },
    checklist: [{ key: "owner_identity", label: "إثبات هوية المالك", status: "pending", resolved: true }],
    decisionReady: false,
  },
  operations: {
    tenant: { id: "01m0tq3hamfxa30em00wjqvt96", schemaName: "tenant01m0tq3hamfxa30em00wjqvt96" },
    health: { review: false, provisioning: false, domain: true, subscription: true, publication: false },
    blockers: ["review_not_approved", "provisioning_not_ready"], provisioning: null,
    publication: { status: "requested", requestedAt: "2026-08-27T08:00:00Z", publishedAt: null, requestedDomain: "tamoor.lvh.me", publicDomain: null },
  },
};

describe("PlatformStoreWorkspace", () => {
  it("shows the frozen dossier and requires evidence review before approval", async () => {
    const reviewStoreEvidence = vi.fn().mockResolvedValue(store);
    const administration = createFakeUiAdapters({ administration: {
      getStore: vi.fn().mockResolvedValue(store), reviewStoreEvidence,
    } }).administration;

    render(<PlatformStoreWorkspace administration={administration} storeId={store.id} user={reviewer} onBack={vi.fn()} onSessionExpired={vi.fn()} onToast={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: "تمور مالك" })).toBeTruthy();
    expect(screen.getByText("من المزرعة إلى بيتك")).toBeTruthy();
    expect(screen.getByText(/قرار المراجعة لم يعتمد بعد/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /اعتماد وبدء التجهيز/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("link", { name: /فتح المستند الخاص/ }).getAttribute("href")).toContain("/api/admin/stores/");

    await userEvent.click(screen.getByRole("button", { name: "قبول" }));
    await waitFor(() => expect(reviewStoreEvidence).toHaveBeenCalledWith(store.id, "00000000-0000-4000-8000-000000000001", "accepted"));
  });
});
