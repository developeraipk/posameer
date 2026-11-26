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
