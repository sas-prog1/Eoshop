import { describe, expect, it } from "vitest";
import { isManagedPlatformAssetUrl, isSafePlatformIdentityImageUrl } from "./platformIdentityImageUrl";

describe("platformIdentityImageUrl", () => {
  const managed = "/api/platform-assets/11111111-1111-4111-8111-111111111111";

  it("accepts only the exact managed platform route or safe external HTTPS", () => {
    expect(isManagedPlatformAssetUrl(managed)).toBe(true);
    expect(isSafePlatformIdentityImageUrl(managed)).toBe(true);
    expect(isSafePlatformIdentityImageUrl("https://cdn.example.test/platform/hero.webp")).toBe(true);
    expect(isSafePlatformIdentityImageUrl(null)).toBe(true);

    for (const unsafe of [
      `${managed}/`, `${managed}?download=1`, `${managed}#fragment`,
      "/api/store-assets/tenant/11111111-1111-4111-8111-111111111111",
      "data:image/png;base64,unsafe", "http://cdn.example.test/hero.png",
    ]) {
      expect(isSafePlatformIdentityImageUrl(unsafe)).toBe(false);
    }
  });
});
