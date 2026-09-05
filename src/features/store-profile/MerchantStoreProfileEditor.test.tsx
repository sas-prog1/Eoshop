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

  it("edits the complete hero contract and uploads a dedicated mobile image", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const uploadAsset = vi.fn(async () => ({
      id: "22222222-2222-4222-8222-222222222222",
      url: "/api/store-assets/tenant-a/22222222-2222-4222-8222-222222222222",
      mimeType: "image/webp" as const,
      byteSize: 80,
    }));
    const product = { ...ELEGANT_PRESET.products[0], id: "33333333-3333-4333-8333-333333333333", name: "سماعة منشورة", category: "إلكترونيات", status: "published" as const };
    const view = renderEditor({
      config: { ...ELEGANT_PRESET, products: [product], heroBannerTargetType: "products" },
      initialSection: "hero",
      onChange,
      uploadAsset,
    });

    await user.selectOptions(screen.getByLabelText("وجهة زر واجهة الترحيب"), "category");
    expect(onChange).toHaveBeenCalledWith("heroBannerTargetType", "category");
    expect(onChange).toHaveBeenCalledWith("heroBannerTargetValue", undefined);
    view.rerender(<MerchantStoreProfileEditor {...view.props} config={{ ...view.props.config, heroBannerTargetType: "category" }} />);
    await user.selectOptions(screen.getByLabelText("التصنيف المستهدف لواجهة الترحيب"), "إلكترونيات");
    expect(onChange).toHaveBeenCalledWith("heroBannerTargetValue", "إلكترونيات");

    fireEvent.change(screen.getByLabelText("موضع صورة واجهة الترحيب أفقيًا"), { target: { value: "72" } });
    fireEvent.change(screen.getByLabelText("موضع صورة واجهة الترحيب عموديًا"), { target: { value: "38" } });
    expect(onChange).toHaveBeenCalledWith("heroBannerFocalPointX", 72);
    expect(onChange).toHaveBeenCalledWith("heroBannerFocalPointY", 38);

    const uploadInputs = view.container.querySelectorAll('input[type="file"]');
    expect(uploadInputs).toHaveLength(2);
    fireEvent.change(uploadInputs[1], { target: { files: [new File(["mobile"], "hero-mobile.webp", { type: "image/webp" })] } });
    await waitFor(() => expect(uploadAsset).toHaveBeenCalledWith("tenant-a", expect.any(File), expect.any(AbortSignal)));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("heroBannerMobileImage", expect.stringContaining("/api/store-assets/tenant-a/")));
    expect(onChange).toHaveBeenCalledWith("showHeroBanner", true);
  });

  it("reorders and hides semantic storefront sections while keeping one visible", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const config = {
      ...ELEGANT_PRESET,
      homeSections: [
        { id: "hero" as const, visible: true },
        { id: "trust" as const, visible: true },
        { id: "categories" as const, visible: true },
        { id: "featured_products" as const, visible: true },
        { id: "about" as const, visible: true },
      ],
    };
    const view = renderEditor({ config, initialSection: "layout", onChange });

    await user.click(screen.getByRole("button", { name: "نقل معلومات الخدمة للأعلى" }));
    expect(onChange).toHaveBeenCalledWith("homeSections", [
      { id: "trust", visible: true },
      { id: "hero", visible: true },
      { id: "categories", visible: true },
      { id: "featured_products", visible: true },
      { id: "about", visible: true },
    ]);
    await user.click(screen.getByRole("button", { name: "إخفاء واجهة الترحيب" }));
    expect(onChange).toHaveBeenCalledWith("homeSections", expect.arrayContaining([{ id: "hero", visible: false }]));

    view.rerender(<MerchantStoreProfileEditor {...view.props} initialSection="layout" config={{
      ...config,
      homeSections: config.homeSections.map((section) => ({ ...section, visible: section.id === "hero" })),
    }} />);
    expect(screen.getByRole("button", { name: "إخفاء واجهة الترحيب" })).toHaveProperty("disabled", true);
  });

  it("dispatches the campaign editor that belongs to the selected storefront theme", () => {
    const view = renderEditor({
      config: { ...ELEGANT_PRESET, themeStyle: "tech" },
      initialSection: "campaigns",
    });
    expect(screen.getByRole("heading", { name: "مساحات Tech Bento" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "القصص والمختارات" })).toBeNull();

    view.rerender(<MerchantStoreProfileEditor {...view.props} config={{ ...ELEGANT_PRESET, themeStyle: "elegant" }} />);
    expect(screen.getByRole("heading", { name: "القصص والمختارات" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "مساحات Tech Bento" })).toBeNull();
  });
});
