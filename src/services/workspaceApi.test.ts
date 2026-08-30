import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./apiClient";
import { workspaceApi } from "./workspaceApi";
import type { StoreConfig } from "../types";
import { defaultStorefrontSections } from "../contracts/storefrontSections";
import type { StorefrontMarketingBlock } from "../contracts/storefrontMarketingBlocks";

const marketingBlock: StorefrontMarketingBlock = {
  id: "77777777-7777-4777-8777-777777777777",
  placement: "hero_bento",
  position: 1,
  enabled: true,
  contentType: "category",
  title: "اكتشف التقنية",
  ctaLabel: "استكشف الآن",
  imageUrl: "/api/store-assets/tenant-1/88888888-8888-4888-8888-888888888888",
  altText: "كاميرا ضمن مساحة التقنية",
  targetType: "category",
  targetValue: "إلكترونيات",
  disclosure: "none",
};

const config: StoreConfig = {
  storeName: "Server Store",
  slogan: "Server-owned",
  logoIcon: "S",
  primaryColor: "#112233",
  secondaryColor: "#334455",
  themeStyle: "elegant",
  bannerText: "Banner",
  fontFamily: "Cairo",
  phone: "+967700000000",
  currency: "YER",
  products: [{
    id: "draft-product",
    name: "Product",
    price: 12.5,
    description: "Description",
    category: "General",
    imageKeyword: "product",
  }, {
    id: "draft:55555555-5555-4555-8555-555555555555",
    name: "Second product",
    price: 8,
    description: "Second description",
    category: "General",
    imageKeyword: "product",
  }],
};

afterEach(() => {
  apiClient.clearCsrfToken();
  vi.unstubAllGlobals();
});

describe("workspaceApi", () => {
  it("maps the server workspace, decimal price and discards unknown fields", async () => {
    const response = {
      data: {
        tenantId: "tenant-1",
        revision: 7,
        catalogRevision: 3,
        capabilities: { inventoryView: true, inventoryManage: false },
        updatedAt: "2026-08-15T12:00:00Z",
        databasePassword: "must-not-escape",
        config: {
          ...config,
          logoUrl: "data:image/png;base64,legacy",
          heroBannerImage: "blob:http://localhost/legacy",
          aboutImage: "data:image/png;base64,legacy-about",
          products: [{ ...config.products[0], id: "11111111-1111-4111-8111-111111111111", price: "12.50", internalCost: "secret" }],
          databasePassword: "must-not-escape",
        },
      },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 })));

    const workspace = await workspaceApi.load("tenant-1");

    expect(workspace.config.products[0].price).toBe(12.5);
    expect(workspace.capabilities).toEqual({ inventoryView: true, inventoryManage: false });
    expect(workspace).not.toHaveProperty("databasePassword");
    expect(workspace.config).not.toHaveProperty("databasePassword");
    expect(workspace.config.products[0]).not.toHaveProperty("internalCost");
    expect(workspace.config.logoUrl).toBe("");
    expect(workspace.config.heroBannerImage).toBe("");
    expect(workspace.config.aboutImage).toBe("");
    expect(workspace.config.homeSections).toEqual(defaultStorefrontSections());
  });

  it("rejects a present malformed storefront layout instead of replacing it silently", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: {
        tenantId: "tenant-1",
        revision: 7,
        catalogRevision: 3,
        capabilities: { inventoryView: false, inventoryManage: false },
        updatedAt: null,
        config: { ...config, homeSections: [{ id: "hero", visible: true }] },
      },
    }), { status: 200 })));

    await expect(workspaceApi.load("tenant-1")).rejects.toMatchObject({ category: "unexpected" });
  });

  it("preserves the server-owned marketing contract and hero target fields", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: {
        tenantId: "tenant-1",
        revision: 7,
        catalogRevision: 3,
        capabilities: { inventoryView: true, inventoryManage: true },
        updatedAt: null,
        config: {
          ...config,
          marketingBlocks: [marketingBlock],
          heroBannerMobileImage: "/api/store-assets/tenant-1/99999999-9999-4999-8999-999999999999",
          heroBannerTargetType: "category",
          heroBannerTargetValue: "إلكترونيات",
          heroBannerFocalPointX: 70,
          heroBannerFocalPointY: 40,
        },
      },
    }), { status: 200 })));

    const workspace = await workspaceApi.load("tenant-1");

    expect(workspace.config.marketingBlocks).toEqual([marketingBlock]);
    expect(workspace.config.marketingBlocks?.[0]).not.toBe(marketingBlock);
    expect(workspace.config.heroBannerTargetType).toBe("category");
    expect(workspace.config.heroBannerFocalPointX).toBe(70);
  });

  it("normalizes the nullable onboarding contact before opening a newly provisioned workspace", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: {
        tenantId: "tenant-new",
        revision: 1,
        catalogRevision: 1,
        capabilities: { inventoryView: true, inventoryManage: true },
        updatedAt: "2026-08-24T15:00:00Z",
        config: {
          ...config,
          phone: null,
          heroBannerTitle: null,
          heroBannerSubtitle: null,
          heroBannerBadge: null,
          heroBannerButtonText: null,
          products: [],
          homeSections: defaultStorefrontSections(),
        },
      },
    }), { status: 200 })));

    const workspace = await workspaceApi.load("tenant-new");

    expect(workspace.config.phone).toBe("");
    expect(workspace.config.products).toEqual([]);
    expect(workspace.config.homeSections).toEqual(defaultStorefrontSections());
  });

  it.each([123, true, {}, []])("rejects malformed present workspace phone value %#", async (phone) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: {
        tenantId: "tenant-new",
        revision: 1,
        catalogRevision: 1,
        capabilities: { inventoryView: true, inventoryManage: true },
        updatedAt: "2026-08-24T15:00:00Z",
        config: { ...config, phone, products: [], homeSections: defaultStorefrontSections() },
      },
    }), { status: 200 })));

    await expect(workspaceApi.load("tenant-new")).rejects.toMatchObject({ category: "unexpected" });
  });

  it("omits draft identifiers and sends the current revision through the CSRF client", async () => {
    const saved = {
      data: {
        tenantId: "tenant-1",
        revision: 8,
        catalogRevision: 4,
        capabilities: { inventoryView: true, inventoryManage: true },
        updatedAt: "2026-08-15T12:01:00Z",
        config: {
          ...config,
          marketingBlocks: [marketingBlock],
          products: [
            { ...config.products[0], id: "22222222-2222-4222-8222-222222222222", price: "12.50" },
            { ...config.products[1], id: "66666666-6666-4666-8666-666666666666", price: "8.00" },
          ],
        },
      },
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: "workspace-csrf" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(saved), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { randomUUID: () => "33333333-3333-4333-8333-333333333333" });

    const result = await workspaceApi.save("tenant-1", 7, 3, { ...config, marketingBlocks: [marketingBlock] }, ["44444444-4444-4444-8444-444444444444"]);

    const request = fetchMock.mock.calls[1][1] as RequestInit;
    const body = JSON.parse(request.body as string);
    expect(body.revision).toBe(7);
    expect(body.catalogRevision).toBe(3);
    expect(body.archiveProductIds).toEqual(["44444444-4444-4444-8444-444444444444"]);
    expect(body.config.products[0].id).toBeUndefined();
    expect(body.config.products[1].id).toBeUndefined();
    expect(body.config.products[0].basePrice).toBe("12.50");
    expect(body.config.products[0].status).toBe("draft");
    expect(body.config.marketingBlocks).toEqual([marketingBlock]);
    expect(result.config.products.map((product) => product.id)).toEqual([
      "22222222-2222-4222-8222-222222222222",
      "66666666-6666-4666-8666-666666666666",
    ]);
    expect(request.headers).toMatchObject({ "X-CSRF-TOKEN": "workspace-csrf" });
  });

  it("forwards cancellation to workspace reads so stale store loads cannot win", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError"));
    vi.stubGlobal("fetch", fetchMock);

    const request = workspaceApi.load("tenant-1", controller.signal);
    controller.abort();

    await expect(request).rejects.toMatchObject({ category: "aborted" });
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal).toBe(controller.signal);
  });
});
