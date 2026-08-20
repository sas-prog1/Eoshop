// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ELEGANT_PRESET } from "../../types";
import MerchantStoreProfileEditor from "./MerchantStoreProfileEditor";

afterEach(cleanup);

function renderEditor(overrides: Partial<React.ComponentProps<typeof MerchantStoreProfileEditor>> = {}) {
  const props: React.ComponentProps<typeof MerchantStoreProfileEditor> = {
    config: { ...ELEGANT_PRESET, logoType: "image", logoUrl: "" },
    activeTenantId: "tenant-a",
    mediaOwnerKey: "account-a",
    initialSection: "identity",
    onChange: vi.fn(),
    uploadAsset: vi.fn(async () => ({
      id: "11111111-1111-4111-8111-111111111111",
      url: "/api/store-assets/tenant-a/11111111-1111-4111-8111-111111111111",
      mimeType: "image/png" as const,
      byteSize: 64,
    })),
    ...overrides,
  };
  return { ...render(<MerchantStoreProfileEditor {...props} />), props };
}

describe("MerchantStoreProfileEditor", () => {
  it("edits the store profile, locks existing-store currency and binds a managed logo upload", async () => {
    const onChange = vi.fn();
    const uploadAsset = vi.fn(async () => ({
      id: "11111111-1111-4111-8111-111111111111",
      url: "/api/store-assets/tenant-a/11111111-1111-4111-8111-111111111111",
      mimeType: "image/png" as const,
      byteSize: 64,
    }));
    const view = renderEditor({ onChange, uploadAsset });

    fireEvent.change(screen.getByLabelText("اسم المتجر"), { target: { value: "متجر محدث" } });
    expect(onChange).toHaveBeenCalledWith("storeName", "متجر محدث");
    expect(screen.getByDisplayValue("YER")).toHaveProperty("readOnly", true);

    fireEvent.change(view.container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(["image"], "logo.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(uploadAsset).toHaveBeenCalledWith("tenant-a", expect.any(File), expect.any(AbortSignal)));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(
      "logoUrl",
      "/api/store-assets/tenant-a/11111111-1111-4111-8111-111111111111",
    ));
    expect(onChange).toHaveBeenCalledWith("logoType", "image");
  });

  it("keeps draft creation truthful by disabling device upload while allowing an HTTPS URL", () => {
    const onChange = vi.fn();
    const view = renderEditor({ activeTenantId: null, mediaOwnerKey: "account-a", onChange });
    expect(view.container.querySelector('input[type="file"]')).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByPlaceholderText("https://example.com/image.png"), {
      target: { value: "https://cdn.example.test/logo.png" },
    });
    expect(onChange).toHaveBeenCalledWith("logoUrl", "https://cdn.example.test/logo.png");
    expect(screen.getByText(/الرفع يصبح متاحًا بعد إنشاء المتجر/)).toBeTruthy();
  });

  it("aborts and ignores a deferred upload after the account changes", async () => {
    let resolveUpload!: (value: Awaited<ReturnType<React.ComponentProps<typeof MerchantStoreProfileEditor>["uploadAsset"]>>) => void;
    let capturedSignal: AbortSignal | undefined;
    const uploadAsset = vi.fn((_tenantId: string, _file: File, signal?: AbortSignal) => {
      capturedSignal = signal;
      return new Promise<Awaited<ReturnType<React.ComponentProps<typeof MerchantStoreProfileEditor>["uploadAsset"]>>>((resolve) => { resolveUpload = resolve; });
    });
    const onChange = vi.fn();
    const view = renderEditor({ uploadAsset, onChange });
    fireEvent.change(view.container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(["image"], "logo.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(uploadAsset).toHaveBeenCalledTimes(1));

    view.rerender(<MerchantStoreProfileEditor {...view.props} mediaOwnerKey="account-b" />);
    expect(capturedSignal?.aborted).toBe(true);
    resolveUpload({
      id: "11111111-1111-4111-8111-111111111111",
      url: "/api/store-assets/tenant-a/11111111-1111-4111-8111-111111111111",
      mimeType: "image/png",
      byteSize: 64,
    });
    await Promise.resolve();
    expect(onChange).not.toHaveBeenCalledWith("logoUrl", expect.any(String));
  });

  it("invalidates a deferred upload when the merchant replaces the same slot with a URL", async () => {
    let resolveUpload!: (value: { id: string; url: string; mimeType: "image/png"; byteSize: number }) => void;
    let capturedSignal: AbortSignal | undefined;
    const uploadAsset = vi.fn((_tenantId: string, _file: File, signal?: AbortSignal) => {
      capturedSignal = signal;
      return new Promise<{ id: string; url: string; mimeType: "image/png"; byteSize: number }>((resolve) => { resolveUpload = resolve; });
    });
    const onChange = vi.fn();
    const view = renderEditor({ uploadAsset, onChange });
    fireEvent.change(view.container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(["image"], "logo.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(uploadAsset).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByPlaceholderText("https://example.com/image.png"), {
      target: { value: "https://cdn.example.test/new-logo.png" },
    });
    expect(capturedSignal?.aborted).toBe(true);
    resolveUpload({
      id: "11111111-1111-4111-8111-111111111111",
      url: "/api/store-assets/tenant-a/11111111-1111-4111-8111-111111111111",
      mimeType: "image/png",
      byteSize: 64,
    });
    await Promise.resolve();
    expect(onChange).toHaveBeenCalledWith("logoUrl", "https://cdn.example.test/new-logo.png");
    expect(onChange).not.toHaveBeenCalledWith("logoUrl", expect.stringContaining("/api/store-assets/"));
  });

  it("moves between appearance and hero without exposing local data URLs", async () => {
    const user = userEvent.setup();
    renderEditor({ config: { ...ELEGANT_PRESET, logoType: "image", logoUrl: "data:image/png;base64,secret" } });
    expect(screen.getByPlaceholderText("https://example.com/image.png")).toHaveProperty("value", "");
    await user.click(screen.getByRole("button", { name: /الألوان والخط/ }));
    expect(screen.getByText("نظام المظهر")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /واجهة الترحيب/ }));
    expect(screen.getByRole("heading", { name: "واجهة الترحيب" })).toBeTruthy();
  });
});
