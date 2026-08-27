import type { AppView } from "./appTypes";
import type { AdminSection } from "../features/admin/adminAccess";

export type MerchantStoreSection = "overview" | "products" | "orders" | "inventory" | "design" | "checkout" | "pages";

export type CentralRoute =
  | { name: "landing" }
  | { name: "auth"; mode: "login" | "register" | "forgot" | "reset" }
  | { name: "account" }
  | { name: "merchant" }
  | { name: "merchant-new"; step: "business" | "design" | "review" }
  | { name: "merchant-store"; tenantId: string; section: MerchantStoreSection }
  | { name: "merchant-correction"; tenantId: string }
  | { name: "admin"; section: AdminSection; storeId?: string }
  | { name: "unknown" };

export function parseCentralRoute(pathname: string): CentralRoute {
  if (pathname === "/" || pathname === "") return { name: "landing" };
  if (pathname === "/login" || pathname === "/login/") return { name: "auth", mode: "login" };
  if (pathname === "/register" || pathname === "/register/") return { name: "auth", mode: "register" };
  if (pathname === "/forgot-password" || pathname === "/forgot-password/") return { name: "auth", mode: "forgot" };
  if (pathname === "/reset-password" || pathname === "/reset-password/") return { name: "auth", mode: "reset" };
  if (pathname === "/app/account" || pathname === "/app/account/") return { name: "account" };
  if (pathname === "/app" || pathname === "/app/") return { name: "merchant" };
  if (pathname === "/app/new" || pathname === "/app/new/") return { name: "merchant-new", step: "business" };
  if (pathname === "/app/new/design" || pathname === "/app/new/design/") return { name: "merchant-new", step: "design" };
  if (pathname === "/app/new/review" || pathname === "/app/new/review/") return { name: "merchant-new", step: "review" };
  if (pathname === "/admin" || pathname === "/admin/") return { name: "admin", section: "overview" };
  if (pathname === "/admin/stores" || pathname === "/admin/stores/") return { name: "admin", section: "stores" };
  if (pathname === "/admin/users" || pathname === "/admin/users/") return { name: "admin", section: "users" };
  if (pathname === "/admin/settings" || pathname === "/admin/settings/") return { name: "admin", section: "settings" };
  if (pathname === "/admin/audit" || pathname === "/admin/audit/") return { name: "admin", section: "audit" };

  const adminStore = pathname.match(/^\/admin\/stores\/([^/]+)\/?$/);
  if (adminStore) {
    try {
      return { name: "admin", section: "stores", storeId: decodeURIComponent(adminStore[1]) };
    } catch {
      return { name: "unknown" };
    }
  }

  const store = pathname.match(/^\/app\/stores\/([^/]+)(?:\/(overview|products|orders|inventory|design|checkout|pages))?\/?$/);
  if (store) {
    try {
      return {
        name: "merchant-store",
        tenantId: decodeURIComponent(store[1]),
        section: (store[2] || "overview") as MerchantStoreSection,
      };
    } catch {
      return { name: "unknown" };
    }
  }

  const correction = pathname.match(/^\/app\/stores\/([^/]+)\/correction\/?$/);
  if (correction) {
    try {
      return { name: "merchant-correction", tenantId: decodeURIComponent(correction[1]) };
    } catch {
      return { name: "unknown" };
    }
  }

  return { name: "unknown" };
}

export function merchantStorePath(tenantId: string, section: MerchantStoreSection = "overview"): string {
  const root = `/app/stores/${encodeURIComponent(tenantId)}`;
  return section === "overview" ? root : `${root}/${section}`;
}

export function adminPath(section: AdminSection = "overview"): string {
  return section === "overview" ? "/admin" : `/admin/${section}`;
}

export function adminStorePath(storeId: string): string {
  return `/admin/stores/${encodeURIComponent(storeId)}`;
}

export function centralPathForView(view: AppView, tenantId?: string): string {
  if (view === "merchant_dashboard") return "/app";
  if (view === "merchant_store" && tenantId) return merchantStorePath(tenantId);
  if (view === "builder" && tenantId) return `/app/stores/${encodeURIComponent(tenantId)}/design`;
  if (view === "landing") return "/";
  return window.location.pathname;
}

export function replaceCentralPath(path: string): void {
  if (window.location.pathname !== path) window.history.replaceState({}, "", path);
}

export function pushCentralPath(path: string): void {
  if (window.location.pathname !== path) window.history.pushState({}, "", path);
}
