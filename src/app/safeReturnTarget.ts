import type { UserProfile, StoreSubmission } from "../adapters/uiAdapters";
import { adminPath, adminStorePath, merchantStorePath, parseCentralRoute } from "./centralNavigation";
import { safeAdminSection } from "../features/admin/adminAccess";

const ulid = "[0-9a-hjkmnp-tv-z]{26}";
const allowedStorePath = new RegExp(`^/app/stores/${ulid}(?:/(?:overview|products|orders|inventory|design|checkout|pages|correction))?$`);
const allowedAdminStorePath = new RegExp(`^/admin/stores/${ulid}$`);
const literalPaths = new Set([
  "/app", "/app/account", "/app/new", "/app/new/design", "/app/new/review",
  "/admin", "/admin/stores", "/admin/users", "/admin/settings", "/admin/audit",
]);

export function readSafeReturnTarget(search: string): string | null {
  const parameters = new URLSearchParams(search);
  const values = parameters.getAll("returnTo");
  if (values.length !== 1) return null;
  const target = values[0];
  if (!target || target.length > 256 || target.includes("?") || target.includes("#") || target.includes("\\")
    || target.includes("%") || target.startsWith("//") || !target.startsWith("/")) return null;
  if (!literalPaths.has(target) && !allowedStorePath.test(target) && !allowedAdminStorePath.test(target)) return null;
  return parseCentralRoute(target).name === "unknown" ? null : target;
}

export function authorizeReturnTarget(target: string | null, user: UserProfile, stores: StoreSubmission[]): string {
  if (!target) return "/app";
  const route = parseCentralRoute(target);
  if (route.name === "admin") {
    const allowed = safeAdminSection(route.section, user);
    if (allowed === route.section) return route.storeId ? adminStorePath(route.storeId) : adminPath(route.section);
    const fallback = safeAdminSection("overview", user);
    return fallback ? adminPath(fallback) : "/app";
  }
  if (route.name === "merchant-store" || route.name === "merchant-correction") {
    const store = stores.find((candidate) => candidate.id === route.tenantId);
    if (!store) return "/app";
    return route.name === "merchant-correction"
      ? `/app/stores/${encodeURIComponent(store.id)}/correction`
      : merchantStorePath(store.id, route.section);
  }
  if (["merchant", "merchant-new", "account"].includes(route.name)) return target;
  return "/app";
}
