import type { Product } from "../types";
import type { OrderReceipt } from "../adapters/uiAdapters";

export type CartLine = { product: Product; quantity: number };

export interface CartReconciliation {
  items: CartLine[];
  removed: number;
  changed: number;
}

export interface MerchantOrderAction {
  status: OrderReceipt["status"];
  label: string;
  tone: "danger" | "primary";
}

export function merchantOrderStatusLabel(status: OrderReceipt["status"]): string {
  return {
    submitted: "جديد",
    accepted: "مقبول",
    processing: "قيد التجهيز",
    completed: "مكتمل",
    cancelled: "ملغي",
    expired: "منتهي",
  }[status];
}

export function merchantPaymentMethodLabel(method: OrderReceipt["paymentMethod"]): string {
  if (method === "cod") return "الدفع عند الاستلام";
  if (method === "bank_transfer") return "تحويل بنكي";
  if (method === "wallet") return "محفظة إلكترونية";
  return "وسيلة الدفع غير متاحة";
}

export function merchantOrderReasonLabel(reasonCode: string): string {
  return {
    checkout_submitted: "أرسل العميل الطلب",
    merchant_accepted: "قبل التاجر الطلب",
    merchant_processing: "بدأ التاجر التجهيز",
    merchant_completed: "أكمل التاجر الطلب",
    merchant_cancelled: "ألغى التاجر الطلب",
    checkout_reservation_expired: "انتهت مهلة حجز المخزون",
  }[reasonCode] ?? "تحديث مسجل من الخادم";
}

export function merchantOrderActions(order: OrderReceipt): MerchantOrderAction[] {
  const labels: Record<NonNullable<OrderReceipt["allowedTransitions"]>[number], string> = {
    accepted: "قبول الطلب",
    processing: "بدء التجهيز",
    completed: "إكمال الطلب",
    cancelled: "إلغاء الطلب",
  };
  return (order.allowedTransitions ?? []).map((status) => ({
    status,
    label: labels[status],
    tone: status === "cancelled" ? "danger" : "primary",
  }));
}

export function reconcileCartWithStorefront(cart: CartLine[], products: Product[]): CartReconciliation {
  const currentProducts = new Map(products.map((product) => [product.id, product]));
  let removed = 0;
  let changed = 0;
  const items: CartLine[] = [];

  for (const line of cart) {
    const product = currentProducts.get(line.product.id);
    if (!product || product.status === "archived" || product.status === "draft") {
      removed += 1;
      continue;
    }
    const available = product.manageStock === false
      ? null
      : product.availableQuantity ?? product.stockQuantity ?? null;
    if (available !== null && available <= 0) {
      removed += 1;
      continue;
    }
    const quantity = available === null ? line.quantity : Math.min(line.quantity, available);
    if (quantity !== line.quantity || JSON.stringify(product) !== JSON.stringify(line.product)) changed += 1;
    items.push({ product, quantity });
  }

  return { items, removed, changed };
}
