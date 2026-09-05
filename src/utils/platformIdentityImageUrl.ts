import { isSafePlatformLogoUrl } from "./platformLogoUrl";

const managedPlatformAsset = /^\/api\/platform-assets\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isManagedPlatformAssetUrl(value: string | null): boolean {
  return value !== null && managedPlatformAsset.test(value);
}

export function isSafePlatformIdentityImageUrl(value: string | null): boolean {
  return value === null || isManagedPlatformAssetUrl(value) || isSafePlatformLogoUrl(value);
}
