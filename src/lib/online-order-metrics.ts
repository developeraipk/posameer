import { OnlineOrder } from "@/types/database";

/**
 * Computes actual realized cash/digital collections already received for an online order.
 * Uncollected pending COD receivables are strictly excluded until payment is received.
 */
export function calcOnlineOrderRealizedPaisa(o: OnlineOrder): number {
  if (o.delivery_status === "CANCELLED") {
    return 0;
  }
  if (o.payment_status === "RETURNED" || o.delivery_status === "RETURNED_RTO") {
    return Math.max(0, o.deduction_amount_paisa || 0);
  }
  const netAdvance = Math.max(0, (o.advance_paid_paisa || 0) - (o.refund_amount_paisa || 0));
  if (o.payment_status === "PAID" && (o.cod_balance_paisa || 0) <= 0) {
    if ((o.refund_amount_paisa || 0) > 0 && (o.advance_paid_paisa || 0) > 0) {
      return Math.max(0, Math.min(o.total_amount_paisa || 0, netAdvance));
    }
    return Math.max(0, o.total_amount_paisa || 0);
  }
  const codReceived = Math.max(
    0,
    (o.total_amount_paisa || 0) - (o.cod_balance_paisa || 0) - netAdvance
  );
  return Math.max(0, netAdvance + codReceived);
}

/**
 * Computes uncollected pending COD receivable balance for an active (non-returned, non-cancelled) order.
 */
export function calcOnlineOrderPendingCodPaisa(o: OnlineOrder): number {
  if (
    o.delivery_status === "CANCELLED" ||
    o.payment_status === "RETURNED" ||
    o.delivery_status === "RETURNED_RTO"
  ) {
    return 0;
  }
  return Math.max(0, o.cod_balance_paisa || 0);
}

export interface OnlineItemDiscountAllocation {
  effectiveUnitPricePaisa: number;
  allocatedDiscountPaisa: number;
  origUnitPricePaisa: number;
}

/**
 * Allocates any order-level discount strictly from the highest-priced item downward,
 * while preserving explicit per-item discounts already stored in items_json.
 */
export function computeItemDiscountAllocation(
  items: any[],
  totalDiscountPaisa: number
): Map<number, OnlineItemDiscountAllocation> {
  const result = new Map<number, OnlineItemDiscountAllocation>();
  if (!items || items.length === 0) return result;

  const prepared = items.map((it, idx) => {
    const qty = Math.max(1, Number(it.quantity) || 1);
    const unitPrice =
      Number(it.unit_price_paisa) ||
      (Number(it.line_total_paisa) ? Math.round(Number(it.line_total_paisa) / qty) : 0);
    const lineTotal = unitPrice * qty;
    const storedDisc = Math.max(0, Math.min(lineTotal, Number(it.discount_paisa) || 0));
    const activeUnits = Math.max(0, qty - (Number(it.returned_quantity) || 0));
    return { idx, qty, unitPrice, lineTotal, storedDisc, activeUnits };
  });

  const storedSum = prepared.reduce((s, p) => s + p.storedDisc, 0);
  const discountsByIdx = new Map<number, number>();
  for (const p of prepared) {
    discountsByIdx.set(p.idx, p.storedDisc);
  }

  let remainingExtra =
    storedSum > 0
      ? Math.max(0, totalDiscountPaisa - storedSum)
      : Math.max(0, totalDiscountPaisa);

  if (remainingExtra > 0) {
    const sorted = [...prepared].sort((a, b) => {
      if (b.lineTotal !== a.lineTotal) return b.lineTotal - a.lineTotal;
      return b.activeUnits - a.activeUnits;
    });
    for (const p of sorted) {
      if (remainingExtra <= 0) break;
      const already = discountsByIdx.get(p.idx) || 0;
      const headroom = Math.max(0, p.lineTotal - already);
      const add = Math.min(remainingExtra, headroom);
      discountsByIdx.set(p.idx, already + add);
      remainingExtra -= add;
    }
  }

  for (const p of prepared) {
    const disc = discountsByIdx.get(p.idx) || 0;
    const effLineTotal = Math.max(0, p.lineTotal - disc);
    const effUnitPrice = Math.round(effLineTotal / p.qty);
    result.set(p.idx, {
      effectiveUnitPricePaisa: effUnitPrice,
      allocatedDiscountPaisa: disc,
      origUnitPricePaisa: p.unitPrice,
    });
  }

  return result;
}

/**
 * Computes exact net returned/RTO value for an online order (including COD returns where cash refund is 0
 * and partial returns of discounted highest-price items).
 */
export function calcOnlineOrderReturnValuePaisa(o: OnlineOrder): number {
  const isFullReturn =
    (o.payment_status === "RETURNED" ||
      o.delivery_status === "RETURNED_RTO" ||
      (o.delivery_status as string) === "RETURNED") &&
    (o.delivery_status as string) !== "PARTIAL_RETURN";
  const deduct = Math.max(0, o.deduction_amount_paisa || 0);
  const recordedRefund = Math.max(0, o.refund_amount_paisa || 0);

  let returnedItemsNetPaisa = 0;
  try {
    const items = typeof o.items_json === "string" ? JSON.parse(o.items_json) : o.items_json;
    if (Array.isArray(items) && items.length > 0) {
      const allocs = computeItemDiscountAllocation(items, o.discount_paisa || 0);
      items.forEach((it: any, idx: number) => {
        const qty = Math.max(1, Number(it.quantity) || 1);
        const retQtyRaw = Number(it.returned_quantity) || 0;
        const retStatus = it.return_status || "ACTIVE";
        const isItRet =
          retQtyRaw > 0 || retStatus === "RETURNED" || retStatus === "PARTIAL_RETURN" || isFullReturn;
        if (!isItRet) return;
        const retUnits = retQtyRaw > 0 ? Math.min(retQtyRaw, qty) : qty;
        const alloc = allocs.get(idx);
        const netLine = alloc
          ? Math.max(0, alloc.origUnitPricePaisa * qty - alloc.allocatedDiscountPaisa)
          : Math.max(0, Number(it.line_total_paisa) || 0);
        returnedItemsNetPaisa += Math.round((netLine * retUnits) / qty);
      });
    }
  } catch {
    // fallback below
  }

  if (recordedRefund > 0) {
    if (deduct > 0) return recordedRefund;
    if (returnedItemsNetPaisa > 0) return Math.max(recordedRefund, returnedItemsNetPaisa);
    return recordedRefund;
  }

  if (returnedItemsNetPaisa > 0) {
    return Math.max(0, returnedItemsNetPaisa - deduct);
  }

  return Math.max(0, (o.total_amount_paisa || 0) - deduct);
}
