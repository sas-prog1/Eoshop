import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./apiClient";
import { DEFAULT_PLATFORM_SETTINGS, mapPlatformSettings, platformSettingsApi } from "./platformSettingsApi";

afterEach(() => {
  apiClient.clearCsrfToken();
  vi.unstubAllGlobals();
});

describe("platformSettingsApi", () => {
  it("rejects malformed navigation instead of inventing client defaults", () => {
    expect(() => mapPlatformSettings({
      ...DEFAULT_PLATFORM_SETTINGS,
      navigationItems: DEFAULT_PLATFORM_SETTINGS.navigationItems.slice(0, 2),
    })).toThrow(/عقد تنقل المنصة/);
  });

  it("rejects unsafe or malformed server-owned logos instead of rendering them", () => {
    for (const logoUrl of [
      "data:image/svg+xml,<svg></svg>",
      "https://cdn.example.test/logo%zz.png",
      "https://cdn.example.test/logo%FF.png",
      "https://cdn.example.test/logo%25zz.png",
      "https://cdn.example.test/logo%2525zz.png",
      "https://cdn.example.test/logo%25FF.png",
    ]) {
      expect(() => mapPlatformSettings({
        ...DEFAULT_PLATFORM_SETTINGS,
        logoUrl,
      })).toThrow(/رابط شعار غير آمن/);
    }
  });

  it("rejects unsupported brand fonts and unsafe identity images", () => {
    expect(() => mapPlatformSettings({
      ...DEFAULT_PLATFORM_SETTINGS,
      brandFontFamily: "Remote Font",
    })).toThrow();
    expect(() => mapPlatformSettings({
      ...DEFAULT_PLATFORM_SETTINGS,
      authImageUrl: "data:image/png;base64,unsafe",
    })).toThrow(/رابط صورة هوية غير آمن/);
  });

  it("accepts the exact server-owned platform asset route", () => {
    const managed = "/api/platform-assets/11111111-1111-4111-8111-111111111111";
    expect(mapPlatformSettings({
      ...DEFAULT_PLATFORM_SETTINGS,
      landingHeroImageUrl: managed,
      authImageUrl: managed,
    })).toMatchObject({ landingHeroImageUrl: managed, authImageUrl: managed });
  });

  it("loads the public safe projection with an abort signal", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { ...DEFAULT_PLATFORM_SETTINGS, platformName: "هوية الخادم" },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await expect(platformSettingsApi.load(controller.signal)).resolves.toMatchObject({ platformName: "هوية الخادم" });
    expect(fetchMock).toHaveBeenCalledWith("/api/platform-settings", expect.objectContaining({
      method: "GET",
      signal: controller.signal,
      redirect: "error",
    }));
  });
});
