// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ELEGANT_PRESET } from "../types";
import type { StoreWorkspace } from "../adapters/uiAdapters";
import type { WorkspaceConflictState } from "../workflows/merchantWorkspaceState";
import AppToast from "./AppToast";
import { isCentralFrontendHost, parseCentralFrontendDomains } from "./hostRouting";
import PublicStorefrontScreen from "../features/storefront/PublicStorefrontScreen";
import WorkspaceRecoveryOverlays from "../features/store-builder/WorkspaceRecoveryOverlays";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const activeWorkspace: StoreWorkspace = {
  tenantId: "tenant-a",
  revision: 2,
  catalogRevision: 3,
  capabilities: { inventoryView: true, inventoryManage: true },
  config: ELEGANT_PRESET,
  updatedAt: null,
};

const conflict: WorkspaceConflictState = {
  tenantId: activeWorkspace.tenantId,
  base: ELEGANT_PRESET,
  draft: { ...ELEGANT_PRESET, storeName: "مسودتي" },
  archiveProductIds: [],
  serverReloaded: false,
  merged: null,
  conflictingFields: [],
};

function recoveryProps() {
  return {
    activeWorkspace,
    conflict: null,
    conflictReview: null,
    localDraft: null,
    loading: false,
    saving: false,
    reloadWorkspace: vi.fn(),
    applyNonConflictingChanges: vi.fn(),
    archiveConflictDraft: vi.fn(),
    discardConflictReview: vi.fn(),
    importLocalDraft: vi.fn(),
    discardLocalDraft: vi.fn(),
  };
}

describe("application shell boundaries", () => {
  it("normalizes configured central hosts without accepting suffix lookalikes", () => {
    expect(parseCentralFrontendDomains(" LOCALHOST, Eoshop.Local ,, ")).toEqual(["localhost", "eoshop.local"]);
    expect(isCentralFrontendHost("EOSHOP.LOCAL", "localhost,eoshop.local")).toBe(true);
    expect(isCentralFrontendHost("shop.eoshop.local", "localhost,eoshop.local")).toBe(false);
    expect(isCentralFrontendHost("eoshop.local.attacker.test", "localhost,eoshop.local")).toBe(false);
  });

  it("renders the shared toast with its semantic visual state", () => {
    render(<AppToast toast={{ message: "تم الحفظ", type: "success" }} />);

    const message = screen.getByText("تم الحفظ");
    expect(message.parentElement?.className).toContain("bg-emerald-50");
  });

  it("preserves storefront load failure and explicit retry behavior", async () => {
    const retry = vi.fn();
    const user = userEvent.setup();

    render(
      <PublicStorefrontScreen
        storefront={null}
        error="تعذر الاتصال بالخادم"
        loading={false}
        cart={[]}
        addToCart={vi.fn()}
        updateQuantity={vi.fn()}
        isCartDrawerOpen={false}
        setIsCartDrawerOpen={vi.fn()}
        hasOrdered={false}
        handleCheckout={vi.fn()}
        selectedCategory="الكل"
        setSelectedCategory={vi.fn()}
        submitOrder={vi.fn()}
        retry={retry}
      />,
    );

    expect(screen.getByRole("heading", { name: "تعذر تحميل المتجر" })).toBeTruthy();
    expect(screen.getByText("تعذر الاتصال بالخادم")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("keeps conflict recovery guarded until the server copy is loaded", async () => {
    const props = recoveryProps();
    const user = userEvent.setup();

    render(<WorkspaceRecoveryOverlays {...props} conflict={conflict} />);

    expect((screen.getByRole("button", { name: "تطبيق التغييرات الآمنة" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "تحميل نسخة الخادم" }));
    await user.click(screen.getByRole("button", { name: "تجاهل تعديلاتي" }));
    expect(props.reloadWorkspace).toHaveBeenNthCalledWith(1, false);
    expect(props.reloadWorkspace).toHaveBeenNthCalledWith(2, true);
  });

  it("enables safe reapply only for a reloaded server copy", async () => {
    const props = recoveryProps();
    const user = userEvent.setup();

    render(<WorkspaceRecoveryOverlays {...props} conflict={{ ...conflict, serverReloaded: true }} />);

    await user.click(screen.getByRole("button", { name: "تطبيق التغييرات الآمنة" }));
    expect(props.applyNonConflictingChanges).toHaveBeenCalledTimes(1);
  });

  it("exposes both explicit actions for fields requiring manual review", async () => {
    const props = recoveryProps();
    const user = userEvent.setup();

    render(
      <WorkspaceRecoveryOverlays
        {...props}
        conflictReview={{
          tenantId: activeWorkspace.tenantId,
          draft: { ...ELEGANT_PRESET, storeName: "مسودتي" },
          server: { ...ELEGANT_PRESET, storeName: "نسخة الخادم" },
          archiveProductIds: [],
          conflictingFields: ["storeName"],
        }}
      />,
    );

    expect(screen.getByText('"مسودتي"')).toBeTruthy();
    expect(screen.getByText('"نسخة الخادم"')).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "حفظ لقطتي كمسودة محلية" }));
    await user.click(screen.getByRole("button", { name: "الاحتفاظ بنسخة الخادم" }));
    expect(props.archiveConflictDraft).toHaveBeenCalledTimes(1);
    expect(props.discardConflictReview).toHaveBeenCalledTimes(1);
  });

  it("requires explicit import or discard for a local draft", async () => {
    const props = recoveryProps();
    const localDraft = { ...ELEGANT_PRESET, storeName: "مسودة محلية" };
    const user = userEvent.setup();

    render(<WorkspaceRecoveryOverlays {...props} localDraft={localDraft} />);

    await user.click(screen.getByRole("button", { name: "تطبيق المسودة في المحرر" }));
    await user.click(screen.getByRole("button", { name: "تجاهل المسودة" }));
    expect(props.importLocalDraft).toHaveBeenCalledWith(localDraft);
    expect(props.discardLocalDraft).toHaveBeenCalledTimes(1);
  });

  it.each([
    { state: "conflict", conflict, loading: false, saving: false },
    { state: "loading", conflict: null, loading: true, saving: false },
    { state: "saving", conflict: null, loading: false, saving: true },
  ])("blocks local-draft import while workspace is $state", ({ conflict: currentConflict, loading, saving }) => {
    const props = recoveryProps();

    render(
      <WorkspaceRecoveryOverlays
        {...props}
        conflict={currentConflict}
        loading={loading}
        saving={saving}
        localDraft={{ ...ELEGANT_PRESET, storeName: "مسودة محلية" }}
      />,
    );

    expect((screen.getByRole("button", { name: "تطبيق المسودة في المحرر" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
