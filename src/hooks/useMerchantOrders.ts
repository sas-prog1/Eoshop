import { useCallback, useEffect, useRef, useState } from "react";
import { useUiAdapters } from "../adapters/UiAdaptersContext";
import type { MerchantOrderQuery, MerchantOrderStatus, OrderDetail, OrderReceipt } from "../adapters/uiAdapters";
import { isUiError, uiErrorMessage } from "../contracts/uiError";
import { randomUuid } from "../utils/randomUuid";

export function useMerchantOrders(tenantId: string, enabled: boolean, onSessionExpired?: () => void) {
  const { orders } = useUiAdapters();
  const [items, setItems] = useState<OrderReceipt[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [filters, setFilters] = useState<{ status: MerchantOrderStatus | null; query: string }>({ status: null, query: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [pendingOrderIds, setPendingOrderIds] = useState<Set<string>>(() => new Set());
  const pageRef = useRef(1);
  const filtersRef = useRef<{ status: MerchantOrderStatus | null; query: string }>({ status: null, query: "" });
  const loadSequence = useRef(0);
  const transitionSequence = useRef(0);
  const pendingRef = useRef(new Set<string>());
  const transitionKeys = useRef(new Map<string, string>());
  const loadController = useRef<AbortController | null>(null);
  const detailController = useRef<AbortController | null>(null);
  const transitionControllers = useRef(new Map<string, AbortController>());
  const sessionExpired = useRef(onSessionExpired);
  sessionExpired.current = onSessionExpired;

  const load = useCallback(async (
    requestedPage = pageRef.current,
    requestedFilters = filtersRef.current,
  ) => {
    if (!enabled || pendingRef.current.size > 0) return;
    const sequence = ++loadSequence.current;
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    setLoading(true);
    setError(null);
    try {
      const query: MerchantOrderQuery = {
        page: requestedPage,
        perPage: 25,
        status: requestedFilters.status ?? undefined,
        query: requestedFilters.query || undefined,
      };
      const result = await orders.list(tenantId, query, controller.signal);
      if (sequence !== loadSequence.current) return;
      setItems(result.items);
      setTotal(result.total);
      pageRef.current = result.page;
      setPage(result.page);
      setLastPage(result.lastPage);
    } catch (caught) {
      if (sequence !== loadSequence.current || isUiError(caught, "aborted")) return;
      if (isUiError(caught, "unauthenticated")) {
        sessionExpired.current?.();
        return;
      }
      setItems([]);
      setTotal(null);
      setError(uiErrorMessage(caught, "تعذر تحميل طلبات المتجر."));
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [enabled, orders, tenantId]);

  useEffect(() => {
    loadSequence.current += 1;
    transitionSequence.current += 1;
    loadController.current?.abort();
    detailController.current?.abort();
    transitionControllers.current.forEach((controller) => controller.abort());
    transitionControllers.current.clear();
    pendingRef.current.clear();
    setPendingOrderIds(new Set());
    setItems([]);
    setTotal(null);
    pageRef.current = 1;
    setPage(1);
    setLastPage(1);
    filtersRef.current = { status: null, query: "" };
    setFilters({ status: null, query: "" });
    setSelected(null);
    setDetailLoading(false);
    setDetailError(null);
    setError(null);
    if (enabled) void load();
    return () => {
      loadSequence.current += 1;
      transitionSequence.current += 1;
      loadController.current?.abort();
      detailController.current?.abort();
      transitionControllers.current.forEach((controller) => controller.abort());
      transitionControllers.current.clear();
    };
  }, [enabled, load, tenantId]);

  const applyFilters = useCallback((status: MerchantOrderStatus | null, query: string) => {
    const next = { status, query: query.trim() };
    filtersRef.current = next;
    pageRef.current = 1;
    setPage(1);
    setFilters(next);
    void load(1, next);
  }, [load]);

  const goToPage = useCallback((nextPage: number) => {
    if (nextPage < 1 || nextPage > lastPage || nextPage === pageRef.current) return;
    pageRef.current = nextPage;
    setPage(nextPage);
    void load(nextPage, filtersRef.current);
  }, [lastPage, load]);

  const openDetail = useCallback(async (order: OrderReceipt) => {
    if (!enabled) return;
    detailController.current?.abort();
    const controller = new AbortController();
    detailController.current = controller;
    setSelected(null);
    setDetailLoading(true);
    setDetailError(null);
    try {
      setSelected(await orders.detail(tenantId, order.id, controller.signal));
    } catch (caught) {
      if (isUiError(caught, "aborted")) return;
      if (isUiError(caught, "unauthenticated")) {
        sessionExpired.current?.();
        return;
      }
      setDetailError(uiErrorMessage(caught, "تعذر تحميل تفاصيل الطلب."));
    } finally {
      if (detailController.current === controller) setDetailLoading(false);
    }
  }, [enabled, orders, tenantId]);

  const closeDetail = useCallback(() => {
    detailController.current?.abort();
    detailController.current = null;
    setSelected(null);
    setDetailLoading(false);
    setDetailError(null);
  }, []);

  const advance = useCallback(async (order: OrderReceipt, target: OrderReceipt["status"]) => {
    if (!enabled || pendingRef.current.size > 0 || !order.allowedTransitions?.some((allowed) => allowed === target)) return;
    loadSequence.current += 1;
    loadController.current?.abort();
    setLoading(false);
    const operation = `${tenantId}:${order.id}:${target}:merchant_${target}`;
    const key = transitionKeys.current.get(operation) ?? randomUuid();
    transitionKeys.current.set(operation, key);
    const sequence = transitionSequence.current;
    const controller = new AbortController();
    transitionControllers.current.set(operation, controller);
    pendingRef.current.add(order.id);
    setPendingOrderIds(new Set(pendingRef.current));
    setError(null);
    setDetailError(null);
    try {
      const result = await orders.updateStatus(tenantId, order.id, target, `merchant_${target}`, key, controller.signal);
      if (sequence !== transitionSequence.current) return;
      transitionKeys.current.delete(operation);
      if (result.replayed) {
        const authoritative = await orders.list(tenantId, {
          page: pageRef.current,
          perPage: 25,
          status: filtersRef.current.status ?? undefined,
          query: filtersRef.current.query || undefined,
        }, controller.signal);
        if (sequence !== transitionSequence.current) return;
        setItems(authoritative.items);
        setTotal(authoritative.total);
        pageRef.current = authoritative.page;
        setPage(authoritative.page);
        setLastPage(authoritative.lastPage);
      } else {
        setItems((current) => current.map((candidate) => candidate.id === result.order.id ? result.order : candidate));
      }
      if (selected?.id === order.id) {
        setSelected(await orders.detail(tenantId, order.id, controller.signal));
      }
    } catch (caught) {
      if (sequence !== transitionSequence.current || isUiError(caught, "aborted")) return;
      if (isUiError(caught, "unauthenticated")) {
        sessionExpired.current?.();
        return;
      }
      const message = uiErrorMessage(caught, "تعذر تحديث حالة الطلب. يمكنك إعادة المحاولة دون تكرار العملية.");
      if (selected?.id === order.id) setDetailError(message);
      else setError(message);
    } finally {
      transitionControllers.current.delete(operation);
      if (sequence === transitionSequence.current) {
        pendingRef.current.delete(order.id);
        setPendingOrderIds(new Set(pendingRef.current));
      }
    }
  }, [enabled, orders, selected?.id, tenantId]);

  return {
    items,
    total,
    page,
    lastPage,
    filters,
    loading,
    error,
    selected,
    detailLoading,
    detailError,
    pendingOrderIds,
    load,
    applyFilters,
    goToPage,
    openDetail,
    closeDetail,
    advance,
  };
}
