import { describe, expect, it } from "vitest";
import type { StoreConfig } from "../types";
import { ELEGANT_PRESET } from "../types";
import { UiAdapterError } from "../contracts/uiError";
import {
  LatestWorkspaceLoad,
  classifyMerchantRestore,
  hasRecoverableWorkspaceChanges,
  isAsyncWorkspaceResultCurrent,
  isRevisionConflict,
  mayDiscardDirtyWorkspace,
  mergeWorkspaceChanges,
  openWorkspaceConflict,
  reloadWorkspaceConflict,
  resolveWorkspaceConflict,
  shouldApplyWorkspaceResponse,
  shouldClaimAiSave,
  tenantSafeConfig,
} from "../workflows/merchantWorkspaceState";

describe("merchant workspace account and request isolation", () => {
  it("aborts an older store load and accepts only the latest response", () => {
    const coordinator = new LatestWorkspaceLoad();
    const first = coordinator.begin();
    const second = coordinator.begin();

    expect(first.signal.aborted).toBe(true);
    expect(coordinator.isCurrent(first.sequence)).toBe(false);
    expect(coordinator.isCurrent(second.sequence)).toBe(true);

    coordinator.invalidate();
    expect(second.signal.aborted).toBe(true);
    expect(coordinator.isCurrent(second.sequence)).toBe(false);
  });

  it("invalidates a delayed account-A draft before account B starts restoring", async () => {
    const coordinator = new LatestWorkspaceLoad();
    const accountA = coordinator.begin();
    let releaseAccountA: (() => void) | undefined;
    const delayedAccountA = new Promise<void>((resolve) => { releaseAccountA = resolve; });

    coordinator.invalidate();
    const accountB = coordinator.begin();
    releaseAccountA?.();
    await delayedAccountA;

    expect(accountA.signal.aborted).toBe(true);
    expect(coordinator.isCurrent(accountA.sequence)).toBe(false);
    expect(coordinator.isCurrent(accountB.sequence)).toBe(true);
  });

  it("restores only a local draft or a clean preset after an account reset", () => {
    const previousTenantConfig = { ...ELEGANT_PRESET, storeName: "Previous tenant secret" };
    const localDraft = { ...ELEGANT_PRESET, storeName: "Unpublished local draft" } as StoreConfig;

    expect(tenantSafeConfig(localDraft).storeName).toBe("Unpublished local draft");
    expect(tenantSafeConfig(null).storeName).toBe(ELEGANT_PRESET.storeName);
    expect(tenantSafeConfig(null)).not.toEqual(previousTenantConfig);
  });

  it("scrubs legacy browser-only visual URLs before a draft can re-enter the editor", () => {
    const unsafe = {
      ...ELEGANT_PRESET,
      logoUrl: "data:image/png;base64,private-logo",
      heroBannerImage: "blob:http://localhost/private-hero",
      aboutImage: "data:image/png;base64,private-about",
    } as StoreConfig;

    const safe = tenantSafeConfig(unsafe);
    expect(safe.logoUrl).toBe("");
    expect(safe.heroBannerImage).toBe("");
    expect(safe.aboutImage).toBe("");
    expect(unsafe.logoUrl).toContain("private-logo");
  });

  it("classifies restore, dirty switching, logout, and AI save outcomes fail closed", () => {
    expect(classifyMerchantRestore(1)).toBe("loaded");
    expect(classifyMerchantRestore(0)).toBe("none");
    expect(classifyMerchantRestore(0, true)).toBe("error");
    expect(mayDiscardDirtyWorkspace(true, false)).toBe(false);
    expect(mayDiscardDirtyWorkspace(true, true)).toBe(true);
    expect(mayDiscardDirtyWorkspace(false, false)).toBe(true);
    expect(shouldClaimAiSave(false)).toBe(false);
    expect(shouldClaimAiSave(true)).toBe(true);
    expect(hasRecoverableWorkspaceChanges(false, true, false)).toBe(true);
    expect(hasRecoverableWorkspaceChanges(false, false, true)).toBe(true);
    expect(hasRecoverableWorkspaceChanges(false, false, false)).toBe(false);
  });

  it("opens conflict recovery only for the revision machine code", () => {
    const revision = new UiAdapterError("stale", "conflict", "workspace_revision_conflict");
    const catalogRevision = new UiAdapterError("stale catalog", "conflict", "catalog_revision_conflict");
    const quota = new UiAdapterError("quota", "conflict", "workspace_quota_exceeded");

    expect(isRevisionConflict(revision)).toBe(true);
    expect(isRevisionConflict(catalogRevision)).toBe(true);
    expect(isRevisionConflict(quota)).toBe(false);
    expect(isRevisionConflict(new Error("network"))).toBe(false);
  });

  it("rejects a workspace response when an edit occurred during its request", () => {
    expect(shouldApplyWorkspaceResponse(7, 7, true)).toBe(true);
    expect(shouldApplyWorkspaceResponse(7, 8, true)).toBe(false);
    expect(shouldApplyWorkspaceResponse(7, 7, false)).toBe(false);
  });

  it("rejects a stale AI result after a load, edit, logout, or conflict blocks the flow", () => {
    expect(isAsyncWorkspaceResultCurrent(4, 4, 9, 9, false)).toBe(true);
    expect(isAsyncWorkspaceResultCurrent(4, 5, 9, 9, false)).toBe(false);
    expect(isAsyncWorkspaceResultCurrent(4, 4, 9, 10, false)).toBe(false);
    expect(isAsyncWorkspaceResultCurrent(4, 4, 9, 9, true)).toBe(false);
  });

  it("three-way merges only safe draft fields and preserves concurrent server fields", () => {
    const base = { ...ELEGANT_PRESET, storeName: "Base", slogan: "Base slogan" } as StoreConfig;
    const draft = { ...base, storeName: "Draft name", slogan: "Draft slogan" };
    const server = { ...base, storeName: "Server name", phone: "+967700000000" };

    const result = mergeWorkspaceChanges(base, draft, server);

    expect(result.merged.storeName).toBe("Server name");
    expect(result.merged.slogan).toBe("Draft slogan");
    expect(result.merged.phone).toBe("+967700000000");
    expect(result.conflicts).toEqual(["storeName"]);
  });

  it("keeps the server product array when both writers changed products", () => {
    const base = structuredClone(ELEGANT_PRESET) as StoreConfig;
    const draft = structuredClone(base);
    const server = structuredClone(base);
    draft.products = [{ ...draft.products[0], name: "Draft product" }];
    server.products = [{ ...server.products[0], name: "Server product" }];

    const result = mergeWorkspaceChanges(base, draft, server);

    expect(result.merged.products[0].name).toBe("Server product");
    expect(result.conflicts).toContain("products");
    expect(draft.products[0].name).toBe("Draft product");
  });

  it("orchestrates 409 recovery through reload without losing the conflict draft", () => {
    const base = structuredClone(ELEGANT_PRESET) as StoreConfig;
    const draft = { ...base, storeName: "Merchant draft" };
    const server = { ...base, storeName: "Other writer" };

    const opened = openWorkspaceConflict("tenant-a", base, draft, ["68d9959d-5101-4d4f-9cd7-196c7a778230"]);
    expect(hasRecoverableWorkspaceChanges(false, true, false)).toBe(true);

    const reloaded = reloadWorkspaceConflict(opened, server);
    const resolution = resolveWorkspaceConflict(reloaded, server);

    expect(resolution?.config.storeName).toBe("Other writer");
    expect(resolution?.review?.draft.storeName).toBe("Merchant draft");
    expect(resolution?.review?.server.storeName).toBe("Other writer");
    expect(resolution?.review?.conflictingFields).toEqual(["storeName"]);
    expect(reloaded.archiveProductIds).toEqual(["68d9959d-5101-4d4f-9cd7-196c7a778230"]);
    expect(resolution?.review?.archiveProductIds).toEqual(["68d9959d-5101-4d4f-9cd7-196c7a778230"]);
    expect(hasRecoverableWorkspaceChanges(false, false, resolution?.review !== null)).toBe(true);
    expect(mayDiscardDirtyWorkspace(true, false)).toBe(false);
  });
});
