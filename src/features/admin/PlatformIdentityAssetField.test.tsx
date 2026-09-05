// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeUiAdapters } from "../../adapters/testing/fakeUiAdapters";
import PlatformIdentityAssetField, { validPlatformImageFile } from "./PlatformIdentityAssetField";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PlatformIdentityAssetField", () => {
  it("enforces the same bounded client contract", () => {
    const valid = new File(["image"], "hero.webp", { type: "image/webp" });
    expect(validPlatformImageFile(valid, { width: 1200, height: 675 })).toBeNull();
    expect(validPlatformImageFile(new File(["x"], "hero.gif", { type: "image/gif" }), { width: 1200, height: 675 })).toMatch(/JPEG/);
    expect(validPlatformImageFile(valid, { width: 319, height: 180 })).toMatch(/320/);
    expect(validPlatformImageFile(valid, { width: 6000, height: 6000 })).toMatch(/25/);
  });

  it("previews locally, uploads, and only then exposes the managed URL for revisioned save", async () => {
    const NativeURL = URL;
    class MockURL extends NativeURL {
      static createObjectURL = vi.fn(() => "blob:platform-preview");
      static revokeObjectURL = vi.fn();
    }
    class MockImage {
      naturalWidth = 1200;
      naturalHeight = 675;
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      set src(_value: string) { queueMicrotask(() => this.onload?.()); }
    }
    vi.stubGlobal("URL", MockURL);
    vi.stubGlobal("Image", MockImage);
    const url = "/api/platform-assets/11111111-1111-4111-8111-111111111111";
    const uploadPlatformAsset = vi.fn().mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111", url, purpose: "landing_hero",
      mimeType: "image/png", byteSize: 5, width: 1200, height: 675,
    });
    const onChange = vi.fn();
    const administration = createFakeUiAdapters({ administration: { uploadPlatformAsset } }).administration;
    const user = userEvent.setup();

    const onPreviewChange = vi.fn();
    render(<PlatformIdentityAssetField administration={administration} purpose="landing_hero" label="صورة الصفحة الرئيسية" value={null} committedValue={null} placeholder="https://..." disabled={false} invalid={false} onChange={onChange} onPreviewChange={onPreviewChange} />);
    await user.upload(screen.getByLabelText("رفع صورة الصفحة الرئيسية من الجهاز"), new File(["image"], "hero.png", { type: "image/png" }));
    expect((await screen.findByAltText("معاينة صورة الصفحة الرئيسية قبل الحفظ")).getAttribute("src")).toBe("blob:platform-preview");
    expect(onPreviewChange).toHaveBeenLastCalledWith("blob:platform-preview");
    expect(onChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "رفع واستخدام الأصل" }));
    await waitFor(() => expect(uploadPlatformAsset).toHaveBeenCalledWith("landing_hero", expect.any(File), expect.objectContaining({ idempotencyKey: expect.any(String) })));
    expect(onChange).toHaveBeenCalledWith(url);
    expect(screen.getByAltText("معاينة صورة الصفحة الرئيسية قبل الحفظ").getAttribute("src")).toBe("blob:platform-preview");
  });

  it("keeps the chosen file available for a retry after an upload failure", async () => {
    const NativeURL = URL;
    class MockURL extends NativeURL { static createObjectURL = () => "blob:retry"; static revokeObjectURL = vi.fn(); }
    class MockImage { naturalWidth = 640; naturalHeight = 360; onload: null | (() => void) = null; set src(_value: string) { queueMicrotask(() => this.onload?.()); } }
    vi.stubGlobal("URL", MockURL);
    vi.stubGlobal("Image", MockImage);
    vi.stubGlobal("crypto", { randomUUID: () => "22222222-2222-4222-8222-222222222222" });
    const uploadPlatformAsset = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ url: "/api/platform-assets/11111111-1111-4111-8111-111111111111" });
    const user = userEvent.setup();
    render(<PlatformIdentityAssetField administration={createFakeUiAdapters({ administration: { uploadPlatformAsset } }).administration} purpose="landing_hero" label="صورة الصفحة الرئيسية" value={null} committedValue={null} placeholder="" disabled={false} invalid={false} onChange={vi.fn()} onPreviewChange={vi.fn()} />);
    await user.upload(screen.getByLabelText("رفع صورة الصفحة الرئيسية من الجهاز"), new File(["image"], "hero.png", { type: "image/png" }));
    await user.click(await screen.findByRole("button", { name: "رفع واستخدام الأصل" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/إعادة المحاولة/);
    await user.click(screen.getByRole("button", { name: "إعادة محاولة الرفع" }));
    await waitFor(() => expect(uploadPlatformAsset).toHaveBeenCalledTimes(2));
    expect(uploadPlatformAsset.mock.calls[0][2]).toEqual({ idempotencyKey: "22222222-2222-4222-8222-222222222222" });
    expect(uploadPlatformAsset.mock.calls[1][2]).toEqual({ idempotencyKey: "22222222-2222-4222-8222-222222222222" });
  });
});
