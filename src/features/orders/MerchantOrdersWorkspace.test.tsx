// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UiAdaptersProvider } from "../../adapters/UiAdaptersContext";
import { createFakeUiAdapters } from "../../adapters/testing/fakeUiAdapters";
import type { MerchantOrderList, OrderDetail, OrderReceipt } from "../../adapters/uiAdapters";
import MerchantOrdersWorkspace from "../../components/MerchantOrdersWorkspace";

const receipt: OrderReceipt = {
  id: "order-1",
  number: "EO-1",
  status: "submitted",
  allowedTransitions: ["accepted", "cancelled"],
  paymentState: "due_on_delivery",
  paymentMethod: "cod",
  customerName: "أحمد العميل",
  currencyCode: "YER",
  totals: { itemsSubtotalMinor: 100, discountMinor: 0, shippingMinor: 0, taxMinor: 0, paymentFeeMinor: 0, grandTotalMinor: 100 },
  createdAt: "2026-08-19T10:00:00Z",
  checkoutPresentation: { title: "تم استلام طلبك", message: "احتفظ برقم الطلب للمتابعة مع المتجر.", whatsappTarget: null },
};

const detail: OrderDetail = {
  ...receipt,
  items: [{ productId: "product-1", name: "عطر صنعاء", sku: "SKU-1", unitPriceMinor: 100, quantity: 1, lineTotalMinor: 100, tracked: true }],
  customer: { name: "أحمد العميل", phone: "+967700000001", email: "customer@example.test", notes: "اتصل قبل الوصول" },
  address: { city: "صنعاء", area: "المدينة القديمة", street: null, details: "البوابة الأولى" },
  payment: { method: "cod", state: "due_on_delivery", channelId: null, channelLabel: null, reference: null },
  history: [{ from: null, to: "submitted", reasonCode: "checkout_submitted", createdAt: "2026-08-19T10:00:00Z" }],
};

const listResult = (items: OrderReceipt[] = [receipt], overrides: Partial<MerchantOrderList> = {}): MerchantOrderList => ({
  items,
  total: items.length,
  page: 1,
  perPage: 25,
  lastPage: 1,
  filters: { status: null, query: null },
  ...overrides,
});

afterEach(cleanup);

describe("MerchantOrdersWorkspace", () => {
  it("opens protected customer, delivery, item and timeline details before a transition", async () => {
    const accepted = { ...receipt, status: "accepted" as const, allowedTransitions: ["processing" as const, "completed" as const] };
    const acceptedDetail = { ...detail, ...accepted, history: [...detail.history, { from: "submitted" as const, to: "accepted" as const, reasonCode: "merchant_accepted", createdAt: "2026-08-19T10:05:00Z" }] };
    const list = vi.fn(async () => listResult());
    const getDetail = vi.fn().mockResolvedValueOnce(detail).mockResolvedValueOnce(acceptedDetail);
    const updateStatus = vi.fn(async () => ({ replayed: false, order: accepted }));
    const adapters = createFakeUiAdapters({ orders: { list, detail: getDetail, updateStatus } });
    render(<UiAdaptersProvider adapters={adapters}><MerchantOrdersWorkspace tenantId="tenant-a" canView /></UiAdaptersProvider>);
    const operator = userEvent.setup();

    await operator.click(await screen.findByRole("button", { name: /فتح تفاصيل الطلب/ }));
    expect(await screen.findByText("+967700000001")).toBeTruthy();
    expect(screen.getByText("البوابة الأولى")).toBeTruthy();
    expect(screen.getByText("عطر صنعاء")).toBeTruthy();
    expect(screen.getByText(/أرسل العميل الطلب/)).toBeTruthy();

    await operator.click(screen.getByRole("button", { name: "قبول الطلب" }));
    await waitFor(() => expect(updateStatus).toHaveBeenCalledWith("tenant-a", "order-1", "accepted", "merchant_accepted", expect.any(String), expect.any(AbortSignal)));
    expect(await screen.findByRole("button", { name: "بدء التجهيز" })).toBeTruthy();
    expect(getDetail).toHaveBeenCalledTimes(2);
  });

  it("reuses the same transition key after an ambiguous failure", async () => {
    const authoritative = { ...receipt, status: "processing" as const, allowedTransitions: ["completed" as const] };
    const processingDetail = { ...detail, ...authoritative };
    const updateStatus = vi.fn()
      .mockRejectedValueOnce(new Error("network result unknown"))
      .mockResolvedValueOnce({ replayed: true, order: { ...receipt, status: "accepted", allowedTransitions: ["processing"] } });
    const list = vi.fn()
      .mockResolvedValueOnce(listResult())
      .mockResolvedValueOnce(listResult([authoritative]));
    const getDetail = vi.fn().mockResolvedValueOnce(detail).mockResolvedValueOnce(processingDetail);
    const adapters = createFakeUiAdapters({ orders: { list, detail: getDetail, updateStatus } });
    render(<UiAdaptersProvider adapters={adapters}><MerchantOrdersWorkspace tenantId="tenant-a" canView /></UiAdaptersProvider>);
    const operator = userEvent.setup();

    await operator.click(await screen.findByRole("button", { name: /فتح تفاصيل الطلب/ }));
    await operator.click(await screen.findByRole("button", { name: "قبول الطلب" }));
    await waitFor(() => expect(within(screen.getByRole("dialog")).getByRole("alert")).toBeTruthy());
    await operator.click(screen.getByRole("button", { name: "قبول الطلب" }));
    await waitFor(() => expect(updateStatus).toHaveBeenCalledTimes(2));
    expect(updateStatus.mock.calls[0][4]).toBe(updateStatus.mock.calls[1][4]);
    expect(await screen.findByRole("button", { name: "إكمال الطلب" })).toBeTruthy();
  });

  it("sends bounded status and order-number filters to the server", async () => {
    const list = vi.fn(async (_tenant: string, query: { status?: string; query?: string }) => listResult([], { filters: { status: query.status === "submitted" ? "submitted" : null, query: query.query ?? null } }));
    const adapters = createFakeUiAdapters({ orders: { list } });
    render(<UiAdaptersProvider adapters={adapters}><MerchantOrdersWorkspace tenantId="tenant-a" canView /></UiAdaptersProvider>);
    const operator = userEvent.setup();
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));

    await operator.type(screen.getByPlaceholderText("EO-..."), "EO-ABC");
    await operator.selectOptions(screen.getByRole("combobox", { name: "حالة الطلب" }), "submitted");
    await operator.click(screen.getByRole("button", { name: "تطبيق" }));

    await waitFor(() => expect(list).toHaveBeenLastCalledWith("tenant-a", expect.objectContaining({ page: 1, status: "submitted", query: "EO-ABC" }), expect.any(AbortSignal)));
  });

  it("keeps a read-only order detail free of management actions", async () => {
    const adapters = createFakeUiAdapters({ orders: { list: vi.fn(async () => listResult([{ ...receipt, allowedTransitions: [] }])), detail: vi.fn(async () => ({ ...detail, allowedTransitions: [] })) } });
    render(<UiAdaptersProvider adapters={adapters}><MerchantOrdersWorkspace tenantId="tenant-a" canView /></UiAdaptersProvider>);
    const operator = userEvent.setup();

    await operator.click(await screen.findByRole("button", { name: /فتح تفاصيل الطلب/ }));
    expect(await screen.findByText("+967700000001")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "قبول الطلب" })).toBeNull();
    expect(screen.queryByRole("button", { name: "إلغاء الطلب" })).toBeNull();
  });

  it("requires explicit confirmation before the terminal cancellation action", async () => {
    const updateStatus = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const adapters = createFakeUiAdapters({ orders: { list: vi.fn(async () => listResult()), detail: vi.fn(async () => detail), updateStatus } });
    render(<UiAdaptersProvider adapters={adapters}><MerchantOrdersWorkspace tenantId="tenant-a" canView /></UiAdaptersProvider>);
    const operator = userEvent.setup();

    await operator.click(await screen.findByRole("button", { name: /فتح تفاصيل الطلب/ }));
    await operator.click(await screen.findByRole("button", { name: "إلغاء الطلب" }));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(updateStatus).not.toHaveBeenCalled();
    confirm.mockRestore();
  });
});
