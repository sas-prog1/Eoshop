import { apiClient, ApiError } from "./apiClient";
import { numberField, record, stringField } from "./apiContract";

export interface StoreAssetUpload {
  id: string;
  url: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  byteSize: number;
}

function mapUpload(value: unknown): StoreAssetUpload {
  const envelope = record(value, "رفع أصل هوية المتجر");
  const dto = record(envelope.data, "أصل هوية المتجر");
  const mimeType = stringField(dto, "mimeType", "أصل هوية المتجر");
  if (!(["image/jpeg", "image/png", "image/webp"] as const).includes(mimeType as StoreAssetUpload["mimeType"])) {
    throw new ApiError("استجابة الخادم لا تطابق عقد أصل هوية المتجر.", "unexpected", 200);
  }

  const url = stringField(dto, "url", "أصل هوية المتجر");
  if (!url.startsWith("/api/store-assets/")) {
    throw new ApiError("استجابة الخادم لا تطابق مسار أصل هوية المتجر.", "unexpected", 200);
  }

  return {
    id: stringField(dto, "id", "أصل هوية المتجر"),
    url,
    mimeType: mimeType as StoreAssetUpload["mimeType"],
    byteSize: numberField(dto, "byteSize", "أصل هوية المتجر"),
  };
}

export const storeAssetApi = {
  async upload(tenantId: string, file: File, signal?: AbortSignal): Promise<StoreAssetUpload> {
    const idempotencyKey = crypto.randomUUID();
    const body = new FormData();
    body.append("image", file);
    body.append("idempotencyKey", idempotencyKey);

    return mapUpload(await apiClient.request(
      `/api/merchant/stores/${encodeURIComponent(tenantId)}/assets`,
      {
        method: "POST",
        body,
        headers: { "Idempotency-Key": idempotencyKey },
        retrySafety: "idempotent",
        signal,
      },
    ));
  },
};
