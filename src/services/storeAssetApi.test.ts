import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./apiClient";
import { storeAssetApi } from "./storeAssetApi";

afterEach(() => {
  apiClient.clearCsrfToken();
  vi.unstubAllGlobals();
});

describe("storeAssetApi", () => {
  it("uploads through the CSRF client with one idempotency key and maps only the public contract", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const key = "22222222-2222-4222-8222-222222222222";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: "asset-csrf" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {
        id,
        url: `/api/store-assets/tenant-a/${id}`,
        mimeType: "image/png",
        byteSize: 64,
        disk: "private",
      } }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { randomUUID: () => key });

    const upload = await storeAssetApi.upload("tenant-a", new File(["image"], "logo.png", { type: "image/png" }));
    const request = fetchMock.mock.calls[1][1] as RequestInit;
    const body = request.body as FormData;

    expect(fetchMock.mock.calls[1][0]).toBe("/api/merchant/stores/tenant-a/assets");
    expect(request.headers).toMatchObject({ "Idempotency-Key": key, "X-CSRF-TOKEN": "asset-csrf" });
    expect(body.get("idempotencyKey")).toBe(key);
    expect(upload).toEqual({ id, url: `/api/store-assets/tenant-a/${id}`, mimeType: "image/png", byteSize: 64 });
    expect(upload).not.toHaveProperty("disk");
  });

  it("rejects a malformed success response", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: "asset-csrf" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {
        id: "11111111-1111-4111-8111-111111111111",
        url: "https://evil.example.test/logo.png",
        mimeType: "image/png",
        byteSize: 64,
      } }), { status: 200 })));

    await expect(storeAssetApi.upload("tenant-a", new File(["image"], "logo.png", { type: "image/png" })))
      .rejects.toMatchObject({ category: "unexpected" });
  });
});
