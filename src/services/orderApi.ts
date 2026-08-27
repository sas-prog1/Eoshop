import type { StoreConfig } from "../types";
import { apiClient, ApiError } from "./apiClient";
import { arrayField, enumField, nullableStringField, numberField, record, stringField } from "./apiContract";
import { mapStoreConfig } from "./workspaceApi";
import { canonicalContactTarget, neutralCheckoutPresentation } from "../contracts/checkoutPolicy";

export interface StorefrontBootstrap {
  workspaceRevision: number;
  catalogRevision: number;
  config: StoreConfig;
}

export interface OrderReceipt {
  id: string;
  number: string;
  status: "submitted" | "accepted" | "processing" | "completed" | "cancelled" | "expired";
  paymentState: "due_on_delivery" | "transfer_submitted_unverified";
  currencyCode: string;
  totals: {
    itemsSubtotalMinor: number;
    discountMinor: number;
    shippingMinor: number;
    taxMinor: number;
    paymentFeeMinor: number;
    grandTotalMinor: number;
  };
  createdAt: string;
  customerName?: string;
  paymentMethod?: "cod" | "bank_transfer" | "wallet";
  couponCode?: string | null;
  checkoutPresentation: {
    title: string;
    message: string;
    whatsappTarget: string | null;
  };
  allowedTransitions?: Array<"accepted" | "processing" | "completed" | "cancelled">;
  items?: Array<{
    productId: string;
    name: string;
    sku: string;
    unitPriceMinor: number;
    quantity: number;
    lineTotalMinor: number;
    tracked: boolean;
  }>;
}

export type MerchantOrderStatus = OrderReceipt["status"];

export interface MerchantOrderQuery {
  page?: number;
  perPage?: number;
  status?: MerchantOrderStatus;
  query?: string;
}

export interface MerchantOrderList {
  items: OrderReceipt[];
  total: number;
  page: number;
  perPage: number;
  lastPage: number;
  filters: { status: MerchantOrderStatus | null; query: string | null };
}

export interface OrderDetail extends OrderReceipt {
  customer: { name: string; phone: string; email: string | null; notes: string | null };
  address: { city: string; area: string; street: string | null; details: string | null } | null;
  payment: {
    method: "cod" | "bank_transfer" | "wallet";
    state: "due_on_delivery" | "transfer_submitted_unverified";
    channelId: string | null;
    channelLabel: string | null;
    reference: string | null;
  } | null;
  history: Array<{
    from: MerchantOrderStatus | null;
    to: MerchantOrderStatus;
    reasonCode: string;
    createdAt: string;
  }>;
  items: NonNullable<OrderReceipt["items"]>;
}

export interface CreateOrderInput {
  workspaceRevision: number;
  catalogRevision: number;
  lines: Array<{ productId: string; quantity: number }>;
  couponCode?: string;
  payment: { method: "cod" | "bank_transfer" | "wallet"; channelId?: string; reference?: string };
  customer: { name: string; phone: string; email?: string; notes?: string };
  address: { city: string; area: string; street?: string; details?: string };
}

export interface OrderMutationResult {
  replayed: boolean;
  order: OrderReceipt;
}

function invalid(contract: string): never {
  throw new ApiError(`استجابة الخادم لا تطابق عقد ${contract}.`, "unexpected", 200);
}

function nonNegativeIntegerField(source: Record<string, unknown>, key: string, contract: string): number {
  const value = numberField(source, key, contract);
  if (!Number.isSafeInteger(value) || value < 0) return invalid(contract);
  return value;
}

function mapReceipt(value: unknown): OrderReceipt {
  const dto = record(value, "إيصال الطلب");
  const totals = record(dto.totals, "إجماليات الطلب");
  const presentation = dto.checkoutPresentation === undefined
    ? { ...neutralCheckoutPresentation }
    : (() => {
      const item = record(dto.checkoutPresentation, "عرض إيصال الطلب");
      const target = item.whatsappTarget;
      if (target !== null && typeof target !== "string") return invalid("عرض إيصال الطلب");
      if (typeof target === "string" && canonicalContactTarget(target) !== target) return invalid("عرض إيصال الطلب");
      return {
        title: stringField(item, "title", "عرض إيصال الطلب"),
        message: stringField(item, "message", "عرض إيصال الطلب"),
        whatsappTarget: target as string | null,
      };
    })();
  const receipt: OrderReceipt = {
    id: stringField(dto, "id", "إيصال الطلب"),
    number: stringField(dto, "number", "إيصال الطلب"),
    status: enumField(dto, "status", ["submitted", "accepted", "processing", "completed", "cancelled", "expired"] as const, "إيصال الطلب"),
    paymentState: enumField(dto, "paymentState", ["due_on_delivery", "transfer_submitted_unverified"] as const, "إيصال الطلب"),
    currencyCode: stringField(dto, "currencyCode", "إيصال الطلب"),
    totals: {
      itemsSubtotalMinor: nonNegativeIntegerField(totals, "itemsSubtotalMinor", "إجماليات الطلب"),
      discountMinor: nonNegativeIntegerField(totals, "discountMinor", "إجماليات الطلب"),
      shippingMinor: nonNegativeIntegerField(totals, "shippingMinor", "إجماليات الطلب"),
      taxMinor: nonNegativeIntegerField(totals, "taxMinor", "إجماليات الطلب"),
      paymentFeeMinor: nonNegativeIntegerField(totals, "paymentFeeMinor", "إجماليات الطلب"),
      grandTotalMinor: nonNegativeIntegerField(totals, "grandTotalMinor", "إجماليات الطلب"),
    },
    createdAt: stringField(dto, "createdAt", "إيصال الطلب"),
    checkoutPresentation: presentation,
  };
  if (dto.customerName !== undefined) receipt.customerName = stringField(dto, "customerName", "إيصال الطلب");
  if (dto.paymentMethod !== undefined) receipt.paymentMethod = enumField(dto, "paymentMethod", ["cod", "bank_transfer", "wallet"] as const, "إيصال الطلب");
  if (dto.couponCode !== undefined) receipt.couponCode = nullableStringField(dto, "couponCode", "إيصال الطلب");
  if (dto.allowedTransitions !== undefined) {
    const transitions = arrayField(dto, "allowedTransitions", "انتقالات الطلب");
    receipt.allowedTransitions = transitions.map((value) => (
      enumField(
        { value },
        "value",
        ["accepted", "processing", "completed", "cancelled"] as const,
        "انتقالات الطلب",
      )
    ));
  }
  if (dto.items !== undefined) {
    receipt.items = arrayField(dto, "items", "بنود الطلب").map((value) => {
      const item = record(value, "بند الطلب");
      if (typeof item.tracked !== "boolean") return invalid("بند الطلب");
      return {
        productId: stringField(item, "productId", "بند الطلب"),
        name: stringField(item, "name", "بند الطلب"),
        sku: stringField(item, "sku", "بند الطلب"),
        unitPriceMinor: nonNegativeIntegerField(item, "unitPriceMinor", "بند الطلب"),
        quantity: nonNegativeIntegerField(item, "quantity", "بند الطلب"),
        lineTotalMinor: nonNegativeIntegerField(item, "lineTotalMinor", "بند الطلب"),
        tracked: item.tracked,
      };
    });
  }

  return receipt;
}

function optionalNullableString(source: Record<string, unknown>, key: string, contract: string): string | null {
  return source[key] === undefined ? null : nullableStringField(source, key, contract);
}

function mapDetail(value: unknown): OrderDetail {
  const receipt = mapReceipt(value);
  const dto = record(value, "تفاصيل الطلب");
  const customer = record(dto.customer, "عميل الطلب");
  const address = dto.address === null ? null : record(dto.address, "عنوان الطلب");
  const payment = dto.payment === null ? null : record(dto.payment, "دفع الطلب");
  const items = receipt.items;
  if (!items) return invalid("تفاصيل الطلب");

  return {
    ...receipt,
    items,
    customer: {
      name: stringField(customer, "name", "عميل الطلب"),
      phone: stringField(customer, "phone", "عميل الطلب"),
      email: optionalNullableString(customer, "email", "عميل الطلب"),
      notes: optionalNullableString(customer, "notes", "عميل الطلب"),
    },
    address: address === null ? null : {
      city: stringField(address, "city", "عنوان الطلب"),
      area: stringField(address, "area", "عنوان الطلب"),
      street: optionalNullableString(address, "street", "عنوان الطلب"),
      details: optionalNullableString(address, "details", "عنوان الطلب"),
    },
    payment: payment === null ? null : {
      method: enumField(payment, "method", ["cod", "bank_transfer", "wallet"] as const, "دفع الطلب"),
      state: enumField(payment, "state", ["due_on_delivery", "transfer_submitted_unverified"] as const, "دفع الطلب"),
      channelId: nullableStringField(payment, "channelId", "دفع الطلب"),
      channelLabel: nullableStringField(payment, "channelLabel", "دفع الطلب"),
      reference: nullableStringField(payment, "reference", "دفع الطلب"),
    },
    history: arrayField(dto, "history", "سجل الطلب").map((value) => {
      const event = record(value, "حدث الطلب");
      return {
        from: event.from === null ? null : enumField(event, "from", ["submitted", "accepted", "processing", "completed", "cancelled", "expired"] as const, "حدث الطلب"),
        to: enumField(event, "to", ["submitted", "accepted", "processing", "completed", "cancelled", "expired"] as const, "حدث الطلب"),
        reasonCode: stringField(event, "reasonCode", "حدث الطلب"),
        createdAt: stringField(event, "createdAt", "حدث الطلب"),
      };
    }),
  };
}

function mapBootstrap(value: unknown): StorefrontBootstrap {
  const envelope = record(value, "واجهة المتجر");
  const dto = record(envelope.data, "واجهة المتجر");
  return {
    workspaceRevision: nonNegativeIntegerField(dto, "workspaceRevision", "واجهة المتجر"),
    catalogRevision: nonNegativeIntegerField(dto, "catalogRevision", "واجهة المتجر"),
    config: mapStoreConfig(dto.config),
  };
}

function mapCreate(value: unknown): { replayed: boolean; order: OrderReceipt } {
  const envelope = record(value, "إنشاء الطلب");
  const dto = record(envelope.data, "إنشاء الطلب");
  if (typeof dto.replayed !== "boolean") return invalid("إنشاء الطلب");
  return { replayed: dto.replayed, order: mapReceipt(dto.order) };
}

function mapList(value: unknown): MerchantOrderList {
  const envelope = record(value, "قائمة الطلبات");
  const dto = record(envelope.data, "قائمة الطلبات");
  const pagination = record(dto.pagination, "ترقيم الطلبات");
  const filters = record(dto.filters, "مرشحات الطلبات");
  const status = filters.status;
  const query = filters.query;
  if (status !== null && typeof status !== "string") return invalid("مرشحات الطلبات");
  if (query !== null && typeof query !== "string") return invalid("مرشحات الطلبات");
  return {
    items: arrayField(dto, "items", "قائمة الطلبات").map(mapReceipt),
    total: nonNegativeIntegerField(pagination, "total", "ترقيم الطلبات"),
    page: nonNegativeIntegerField(pagination, "page", "ترقيم الطلبات"),
    perPage: nonNegativeIntegerField(pagination, "perPage", "ترقيم الطلبات"),
    lastPage: nonNegativeIntegerField(pagination, "lastPage", "ترقيم الطلبات"),
    filters: {
      status: status === null ? null : enumField(filters, "status", ["submitted", "accepted", "processing", "completed", "cancelled", "expired"] as const, "مرشحات الطلبات"),
      query: query as string | null,
    },
  };
}

export const orderApi = {
  async loadStorefront(signal?: AbortSignal): Promise<StorefrontBootstrap> {
    return mapBootstrap(await apiClient.request("/api/store/config", { signal }));
  },

  async create(input: CreateOrderInput, idempotencyKey: string): Promise<{ replayed: boolean; order: OrderReceipt }> {
    return mapCreate(await apiClient.request("/api/store/orders", {
      method: "POST",
      body: input,
      headers: { "Idempotency-Key": idempotencyKey },
      retrySafety: "idempotent",
    }));
  },

  async list(tenantId: string, query: MerchantOrderQuery = {}, signal?: AbortSignal): Promise<MerchantOrderList> {
    const params = new URLSearchParams();
    if (query.page !== undefined) params.set("page", String(query.page));
    if (query.perPage !== undefined) params.set("perPage", String(query.perPage));
    if (query.status) params.set("status", query.status);
    if (query.query?.trim()) params.set("query", query.query.trim());
    const suffix = params.size === 0 ? "" : `?${params.toString()}`;
    return mapList(await apiClient.request(`/api/merchant/stores/${encodeURIComponent(tenantId)}/orders${suffix}`, { signal }));
  },

  async detail(tenantId: string, orderId: string, signal?: AbortSignal): Promise<OrderDetail> {
    const envelope = record(await apiClient.request(`/api/merchant/stores/${encodeURIComponent(tenantId)}/orders/${encodeURIComponent(orderId)}`, { signal }), "تفاصيل الطلب");
    return mapDetail(record(envelope.data, "تفاصيل الطلب"));
  },

  async updateStatus(tenantId: string, orderId: string, status: OrderReceipt["status"], reasonCode: string, idempotencyKey: string, signal?: AbortSignal): Promise<OrderMutationResult> {
    const envelope = record(await apiClient.request(`/api/merchant/stores/${encodeURIComponent(tenantId)}/orders/${encodeURIComponent(orderId)}/status`, {
      method: "PATCH",
      body: { status, reasonCode },
      headers: { "Idempotency-Key": idempotencyKey },
      retrySafety: "idempotent",
      signal,
    }), "تحديث الطلب");
    const data = record(envelope.data, "تحديث الطلب");
    if (typeof data.replayed !== "boolean") return invalid("تحديث الطلب");
    return { replayed: data.replayed, order: mapReceipt(data.order) };
  },
};
