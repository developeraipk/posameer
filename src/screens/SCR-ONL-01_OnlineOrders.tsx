import React, { useState, useEffect, useMemo } from "react";
import { SystemUser } from "@/types/system";
import {
  OnlineOrder,
  OnlineOrderItem,
  CreateOnlineOrderPayload,
  CollectOnlinePaymentPayload,
  MarkOnlineReturnPayload,
  FinishedProduct,
  AttarProduct,
} from "@/types/database";
import {
  getOnlineOrders,
  createOnlineOrder,
  collectOnlineOrderPayment,
  markOnlineOrderReturn,
  updateOnlineOrderStatus,
  getProducts,
  getAttars,
} from "@/lib/tauri-bridge";
import { loadAllOffers } from "@/lib/offer-service";
import { PromotionalOffer } from "@/types/offers";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getPKTDate, parseDateToPKT } from "@/lib/date-utils";
import {
  calcOnlineOrderRealizedPaisa,
  calcOnlineOrderPendingCodPaisa,
  computeItemDiscountAllocation,
  calcOnlineOrderReturnValuePaisa,
} from "@/lib/online-order-metrics";
import {
  Globe,
  MessageSquare,
  Search,
  Plus,
  RefreshCw,
  Printer,
  Truck,
  DollarSign,
  RotateCcw,
  Clock,
  CheckCircle2,
  FileSpreadsheet,
  Phone,
  MapPin,
  X,
  FlaskConical,
  Sparkles,
} from "lucide-react";

interface OnlineOrdersProps {
  currentUser?: SystemUser | null;
}

type ChannelFilter = "ALL" | "WHATSAPP" | "WEBSITE" | "PENDING_COD" | "IN_TRANSIT" | "SETTLED" | "RETURNED";

const COURIER_PARTNERS = [
  "TCS Express",
  "Leopard Courier",
  "Trax Logistics",
  "PostEx",
  "M&P Express",
  "Call Courier",
  "In-House Rider (Local)",
];

export const OnlineOrders: React.FC<OnlineOrdersProps> = ({ currentUser }) => {
  const [orders, setOrders] = useState<OnlineOrder[]>([]);
  const [products, setProducts] = useState<FinishedProduct[]>([]);
  const [attars, setAttars] = useState<AttarProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Filters & Search
  const [filterTab, setFilterTab] = useState<ChannelFilter>("ALL");
  const [periodFilter, setPeriodFilter] = useState<"ALL" | "TODAY" | "WEEK" | "MONTH">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination State (Show latest 10 by default)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterTab, periodFilter, searchQuery]);

  // Modals state
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OnlineOrder | null>(null);

  // Attar Portion & Custom Rate Customizer State
  const [selectedAttarForOnline, setSelectedAttarForOnline] = useState<AttarProduct | null>(null);
  const [attarPortionUnit, setAttarPortionUnit] = useState<"TOLA" | "HALF_TOLA" | "QUARTER_TOLA" | "12ML" | "6ML" | "3ML" | "CUSTOM_TOLA" | "CUSTOM_ML">("TOLA");
  const [attarPortionQty, setAttarPortionQty] = useState<number>(1);
  const [attarCustomRateRupees, setAttarCustomRateRupees] = useState<string>("");
  const [attarCustomTola, setAttarCustomTola] = useState<number>(1);
  const [attarCustomMl, setAttarCustomMl] = useState<number>(10);

  // New Order Form State
  const [newChannel, setNewChannel] = useState<"WHATSAPP" | "WEBSITE">("WHATSAPP");
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custCity, setCustCity] = useState("");
  const [custAddress, setCustAddress] = useState("");
  const [orderItems, setOrderItems] = useState<OnlineOrderItem[]>([]);
  const [deliveryCharges, setDeliveryCharges] = useState("0");
  const [discountRupees, setDiscountRupees] = useState("0");
  const [advancePaidRupees, setAdvancePaidRupees] = useState("0");
  const [courierPartner, setCourierPartner] = useState(COURIER_PARTNERS[0]);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [custodian, setCustodian] = useState<"COURIER" | "STAFF_HANDLER">("COURIER");
  const [orderNotes, setOrderNotes] = useState("");

  // Item Picker in Modal
  const [itemSearch, setItemSearch] = useState("");
  const [selectedItemType, setSelectedItemType] = useState<"PERFUME" | "ATTAR" | "TESTER" | "OFFERS">("PERFUME");
  const [offers, setOffers] = useState<PromotionalOffer[]>([]);

  // Tester Customizer State
  const [selectedPerfumeForTester, setSelectedPerfumeForTester] = useState<FinishedProduct | null>(null);
  const [testerPresetMl, setTesterPresetMl] = useState<1 | 2 | 3 | 5 | "CUSTOM">(1);
  const [customTesterMl, setCustomTesterMl] = useState<number>(1);
  const [testerPriceRupees, setTesterPriceRupees] = useState<string>("0");
  const [testerQty, setTesterQty] = useState<number>(1);

  // Return Items Selection State (For Partial/Full Returns)
  const [returnItemSelections, setReturnItemSelections] = useState<{
    originalIndex: number;
    name: string;
    totalOrderedQty?: number;
    alreadyReturnedQty?: number;
    maxQty: number;
    returnQty: number;
    selected: boolean;
    unitPricePaisa: number;
    origUnitPricePaisa?: number;
    allocatedDiscountPaisa?: number;
    rawItem: any;
  }[]>([]);

  // Payment Collection Form State
  const [collectAmountRupees, setCollectAmountRupees] = useState("");
  const [collectMethod, setCollectMethod] = useState("CASH");
  const [collectReference, setCollectReference] = useState("");
  const [collectNotes, setCollectNotes] = useState("");

  // Return & Cancellation Refund Form State
  const [returnReason, setReturnReason] = useState("Customer refused delivery / unreachable");
  const [refundMode, setRefundMode] = useState<"FULL" | "PARTIAL" | "NONE">("FULL");
  const [refundDeductionRupees, setRefundDeductionRupees] = useState("0");
  const [refundPaymentMethod, setRefundPaymentMethod] = useState("CASH");
  const [includeDeliveryInReturn, setIncludeDeliveryInReturn] = useState(false);

  // Status Update State
  const [updateDeliveryStatus, setUpdateDeliveryStatus] = useState("DISPATCHED");
  const [updateTracking, setUpdateTracking] = useState("");
  const [updateCourier, setUpdateCourier] = useState(COURIER_PARTNERS[0]);

  const loadData = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const [orderList, prods, atts, offersList] = await Promise.all([
        getOnlineOrders(),
        getProducts(),
        getAttars(),
        loadAllOffers().catch(() => []),
      ]);
      setOrders(orderList || []);
      setProducts(prods || []);
      setAttars(atts || []);
      setOffers(offersList || []);
    } catch (err: any) {
      console.error("Failed to load online orders:", err);
      setFeedback({
        type: "error",
        text: typeof err === "string" ? err : err.message || "Failed to load orders",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleGlobalRefresh = () => loadData();
    window.addEventListener("app:refresh-data", handleGlobalRefresh);
    return () => window.removeEventListener("app:refresh-data", handleGlobalRefresh);
  }, []);

  const formatRs = (paisa: number) => {
    return (paisa / 100).toLocaleString("en-PK", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  // Filter Helper based on selected period (Strict Pakistan Local Time UTC+5, 12:00 AM midnight day-end)
  const filterByPeriod = useMemo(() => {
    const todayPKT = getPKTDate(new Date());
    const currentMonthPKT = todayPKT.slice(0, 7);
    const d7 = new Date();
    d7.setDate(d7.getDate() - 7);
    const weekAgoPKT = getPKTDate(d7);

    return (dateStr?: string) => {
      if (!dateStr || periodFilter === "ALL") return true;
      const recordPKT = parseDateToPKT(dateStr);
      if (!recordPKT) return true;
      if (periodFilter === "TODAY") return recordPKT === todayPKT;
      if (periodFilter === "WEEK") return recordPKT >= weekAgoPKT && recordPKT <= todayPKT;
      if (periodFilter === "MONTH") return recordPKT.startsWith(currentMonthPKT);
      return true;
    };
  }, [periodFilter]);

  // Orders filtered by period for accurate KPIs and reporting
  const periodFilteredOrders = useMemo(() => {
    return orders.filter((o) => filterByPeriod(o.created_at));
  }, [orders, filterByPeriod]);

  // KPI Calculations (Scoped to the active periodFilter)
  const waOrders = periodFilteredOrders.filter((o) => o.channel === "WHATSAPP");
  const webOrders = periodFilteredOrders.filter((o) => o.channel === "WEBSITE");

  // Gross Order Value before returns/refunds (True sales volume)
  const calcOrderGrossPaisa = (o: OnlineOrder): number => {
    if (o.items_json) {
      try {
        const items = typeof o.items_json === "string" ? JSON.parse(o.items_json) : o.items_json;
        if (Array.isArray(items) && items.length > 0) {
          const itemsGross = items.reduce((sum: number, it: any) => {
            const qty = Number(it.quantity) || 1;
            const unitPrice = Number(it.unit_price_paisa) || (Number(it.line_total_paisa) ? Math.round(Number(it.line_total_paisa) / qty) : 0);
            return sum + qty * unitPrice;
          }, 0);
          if (itemsGross > 0) {
            return itemsGross + (o.delivery_charges_paisa || 0);
          }
        }
      } catch {
        // fallback
      }
    }
    return (o.total_amount_paisa || 0) + (o.refund_amount_paisa || 0) + (o.deduction_amount_paisa || 0);
  };

  // True Goods Value of Returned Items / Full Parcel
  const calcOrderReturnedGoodsValuePaisa = (o: OnlineOrder): number => {
    return calcOnlineOrderReturnValuePaisa(o);
  };

  // Total Gross Order Value (Intact gross sales volume for non-cancelled orders)
  const activeWaOrders = waOrders.filter((o) => o.delivery_status !== "CANCELLED");
  const activeWebOrders = webOrders.filter((o) => o.delivery_status !== "CANCELLED");
  const totalGrossOrderValuePaisa = [...activeWaOrders, ...activeWebOrders].reduce(
    (sum, o) => sum + calcOrderGrossPaisa(o),
    0
  );
  const waGrossOrderValuePaisa = activeWaOrders.reduce((sum, o) => sum + calcOrderGrossPaisa(o), 0);
  const webGrossOrderValuePaisa = activeWebOrders.reduce((sum, o) => sum + calcOrderGrossPaisa(o), 0);

  // Pending Receivables (COD)
  const waPendingPaisa = activeWaOrders.reduce(
    (sum, o) => sum + calcOnlineOrderPendingCodPaisa(o),
    0
  );
  const webPendingPaisa = activeWebOrders.reduce(
    (sum, o) => sum + calcOnlineOrderPendingCodPaisa(o),
    0
  );
  const totalPendingPaisa = waPendingPaisa + webPendingPaisa;

  // Realized Net Cash Collected (Total actual cash/payments collected minus all refunds)
  const waCollectedPaisa = activeWaOrders.reduce((sum, o) => sum + calcOnlineOrderRealizedPaisa(o), 0);
  const webCollectedPaisa = activeWebOrders.reduce((sum, o) => sum + calcOnlineOrderRealizedPaisa(o), 0);
  const totalCollectedPaisa = waCollectedPaisa + webCollectedPaisa;

  // Custodian split of pending money
  const courierCodPaisa = periodFilteredOrders
    .filter((o) => o.payment_custodian === "COURIER" && o.payment_status !== "RETURNED")
    .reduce((sum, o) => sum + o.cod_balance_paisa, 0);

  const staffPendingPaisa = periodFilteredOrders
    .filter((o) => o.payment_custodian === "STAFF_HANDLER" && o.payment_status !== "RETURNED")
    .reduce((sum, o) => sum + o.cod_balance_paisa, 0);

  const waStaffPendingPaisa = periodFilteredOrders
    .filter(
      (o) =>
        o.channel === "WHATSAPP" &&
        o.payment_custodian === "STAFF_HANDLER" &&
        o.payment_status !== "RETURNED"
    )
    .reduce((sum, o) => sum + o.cod_balance_paisa, 0);

  const webStaffPendingPaisa = periodFilteredOrders
    .filter(
      (o) =>
        o.channel === "WEBSITE" &&
        o.payment_custodian === "STAFF_HANDLER" &&
        o.payment_status !== "RETURNED"
    )
    .reduce((sum, o) => sum + o.cod_balance_paisa, 0);

  const returnedOrders = periodFilteredOrders.filter(
    (o) =>
      o.delivery_status === "RETURNED_RTO" ||
      o.delivery_status === "PARTIAL_RETURN" ||
      o.payment_status === "RETURNED" ||
      (o.refund_amount_paisa || 0) > 0
  );
  const totalReturnedValuePaisa = returnedOrders.reduce((sum, o) => {
    return sum + calcOrderReturnedGoodsValuePaisa(o);
  }, 0);
  const totalRefundedPaisa = returnedOrders.reduce((sum, o) => sum + (o.refund_amount_paisa || 0), 0);

  // Filtering for table display
  const filteredOrders = useMemo(() => {
    return periodFilteredOrders.filter((o) => {
      // Channel / Status filter
      if (filterTab === "WHATSAPP" && o.channel !== "WHATSAPP") return false;
      if (filterTab === "WEBSITE" && o.channel !== "WEBSITE") return false;
      if (filterTab === "PENDING_COD" && (o.cod_balance_paisa <= 0 || o.payment_status === "RETURNED")) return false;
      if (filterTab === "IN_TRANSIT" && o.delivery_status !== "DISPATCHED") return false;
      if (filterTab === "SETTLED" && (o.payment_status !== "PAID" || o.cod_balance_paisa > 0)) return false;
      if (filterTab === "RETURNED" && o.delivery_status !== "RETURNED_RTO" && o.payment_status !== "RETURNED") return false;

      // Search Query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        o.order_number.toLowerCase().includes(q) ||
        o.customer_phone.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.city.toLowerCase().includes(q) ||
        (o.courier_partner && o.courier_partner.toLowerCase().includes(q)) ||
        (o.tracking_number && o.tracking_number.toLowerCase().includes(q))
      );
    });
  }, [periodFilteredOrders, filterTab, searchQuery]);

  // Pagination Slice (10 items per page)
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  // Handle Item Addition in New Order Modal
  const handleAddItem = (prod: FinishedProduct | AttarProduct, type: "PERFUME" | "ATTAR") => {
    if (type === "PERFUME") {
      const p = prod as FinishedProduct;
      const stock = p.current_stock_units ?? 0;
      if (stock <= 0) {
        alert(`"${p.name}" is currently Out of Stock (0 units remaining). Cannot be added to order!`);
        return;
      }
      const existing = orderItems.find((it) => it.product_id === p.product_id);
      if (existing) {
        if (existing.quantity >= stock) {
          alert(`Cannot add more than available stock (${stock} units) for "${p.name}".`);
          return;
        }
        setOrderItems(
          orderItems.map((it) =>
            it.product_id === p.product_id
              ? {
                  ...it,
                  quantity: it.quantity + 1,
                  line_total_paisa: (it.quantity + 1) * it.unit_price_paisa,
                }
              : it
          )
        );
      } else {
        setOrderItems([
          ...orderItems,
          {
            product_id: p.product_id,
            name: `${p.name} (${p.size_ml}ml)`,
            item_type: "PERFUME",
            quantity: 1,
            size_ml: p.size_ml,
            unit_price_paisa: p.retail_price_paisa,
            line_total_paisa: p.retail_price_paisa,
          },
        ]);
      }
    } else {
      const a = prod as AttarProduct;
      // Open Attar Portion & Custom Rate Dialog
      setSelectedAttarForOnline(a);
      setAttarPortionUnit("TOLA");
      setAttarPortionQty(1);
      setAttarCustomRateRupees(Math.round(a.selling_price_per_tola_paisa / 100).toString());
      setAttarCustomTola(1);
      setAttarCustomMl(10);
    }
  };

  const handleConfirmAddAttar = () => {
    if (!selectedAttarForOnline) return;
    const a = selectedAttarForOnline;

    let unitPricePaisa = 0;
    let unitLabel = "";
    let grams = 12.0;

    if (attarPortionUnit === "TOLA") {
      unitPricePaisa = a.selling_price_per_tola_paisa;
      unitLabel = "1 Tola (11.66g)";
      grams = 11.66;
    } else if (attarPortionUnit === "HALF_TOLA") {
      unitPricePaisa = a.selling_price_half_tola_paisa;
      unitLabel = "1/2 Tola (5.83g)";
      grams = 5.83;
    } else if (attarPortionUnit === "QUARTER_TOLA") {
      unitPricePaisa = a.selling_price_quarter_tola_paisa;
      unitLabel = "1/4 Tola (2.92g)";
      grams = 2.92;
    } else if (attarPortionUnit === "12ML") {
      unitPricePaisa = Math.round(a.selling_price_per_ml_paisa * 12);
      unitLabel = "12 ml";
      grams = 12.0;
    } else if (attarPortionUnit === "6ML") {
      unitPricePaisa = Math.round(a.selling_price_per_ml_paisa * 6);
      unitLabel = "6 ml";
      grams = 6.0;
    } else if (attarPortionUnit === "3ML") {
      unitPricePaisa = Math.round(a.selling_price_per_ml_paisa * 3);
      unitLabel = "3 ml";
      grams = 3.0;
    } else if (attarPortionUnit === "CUSTOM_TOLA") {
      const tola = attarCustomTola || 1;
      unitPricePaisa = Math.round(a.selling_price_per_tola_paisa * tola);
      unitLabel = `${tola} Tola`;
      grams = tola * 11.66;
    } else if (attarPortionUnit === "CUSTOM_ML") {
      const ml = attarCustomMl || 1;
      unitPricePaisa = Math.round(a.selling_price_per_ml_paisa * ml);
      unitLabel = `${ml} ml`;
      grams = ml;
    }

    const effectiveUnitPricePaisa =
      attarCustomRateRupees.trim() !== "" &&
      !isNaN(Number(attarCustomRateRupees)) &&
      Number(attarCustomRateRupees) > 0
        ? Math.round(Number(attarCustomRateRupees) * 100)
        : unitPricePaisa;

    const qty = Math.max(1, attarPortionQty);
    const lineTotalPaisa = effectiveUnitPricePaisa * qty;

    const newItem: OnlineOrderItem = {
      attar_id: a.attar_id,
      name: `${a.name} (${unitLabel})`,
      item_type: "ATTAR",
      quantity: qty,
      unit_price_paisa: effectiveUnitPricePaisa,
      line_total_paisa: lineTotalPaisa,
      grams: grams,
    };

    setOrderItems([...orderItems, newItem]);
    setSelectedAttarForOnline(null);
  };

  const handleRemoveItem = (index: number) => {
    setOrderItems(orderItems.filter((_, idx) => idx !== index));
  };

  const handleUpdateItemQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }
    const it = orderItems[index];
    if (it.item_type === "PERFUME" && it.product_id) {
      const prod = products.find((p) => p.product_id === it.product_id);
      if (prod && newQty > (prod.current_stock_units ?? 0)) {
        alert(`Cannot add more than available stock (${prod.current_stock_units} units) for "${prod.name}".`);
        return;
      }
    }
    setOrderItems(
      orderItems.map((item, idx) =>
        idx === index
          ? {
              ...item,
              quantity: newQty,
              line_total_paisa: newQty * item.unit_price_paisa,
              discount_paisa: item.discount_paisa ? Math.round((item.discount_paisa / (item.quantity || 1)) * newQty) : 0,
            }
          : item
      )
    );
  };

  // Allocate total order discount to highest-priced items first while preserving existing bundle discounts
  const allocateDiscountToHighestItem = (
    items: OnlineOrderItem[],
    totalDiscountPaisa: number
  ): OnlineOrderItem[] => {
    if (items.length === 0 || totalDiscountPaisa <= 0) {
      return items.map((it) => ({ ...it, discount_paisa: 0 }));
    }
    const existingSum = items.reduce((s, it) => s + (it.discount_paisa || 0), 0);
    if (existingSum === totalDiscountPaisa) {
      return items;
    }

    const prepared = items.map((it, idx) => {
      const lineTotal = it.line_total_paisa || (it.unit_price_paisa * (it.quantity || 1));
      const existing = existingSum > 0 && totalDiscountPaisa >= existingSum
        ? Math.min(lineTotal, Math.max(0, it.discount_paisa || 0))
        : 0;
      return { idx, lineTotal, existing };
    });

    const discMap = new Map<number, number>();
    let preservedSum = 0;
    for (const p of prepared) {
      discMap.set(p.idx, p.existing);
      preservedSum += p.existing;
    }

    let remaining = Math.max(0, totalDiscountPaisa - preservedSum);
    prepared.sort((a, b) => b.lineTotal - a.lineTotal);

    for (const p of prepared) {
      if (remaining <= 0) break;
      const curr = discMap.get(p.idx) || 0;
      const headroom = Math.max(0, p.lineTotal - curr);
      const add = Math.min(remaining, headroom);
      discMap.set(p.idx, curr + add);
      remaining -= add;
    }

    return items.map((it, idx) => ({
      ...it,
      discount_paisa: discMap.get(idx) || 0,
    }));
  };

  // Computations for New Order (Gross items subtotal, offer bundle discounts, special discount)
  const newOrderSubtotalPaisa = orderItems.reduce((sum, it) => sum + it.line_total_paisa, 0);
  const bundleDiscountPaisa = orderItems.reduce((sum, it) => sum + (it.discount_paisa || 0), 0);
  const deliveryPaisa = Math.max(0, Math.round((parseFloat(deliveryCharges) || 0) * 100));
  const specialDiscountPaisa = Math.max(0, Math.round((parseFloat(discountRupees) || 0) * 100));
  const totalOrderDiscountPaisa = bundleDiscountPaisa + specialDiscountPaisa;
  const newOrderTotalPaisa = Math.max(0, newOrderSubtotalPaisa + deliveryPaisa - totalOrderDiscountPaisa);
  const advancePaisa = Math.min(newOrderTotalPaisa, Math.max(0, Math.round((parseFloat(advancePaidRupees) || 0) * 100)));
  const codBalancePaisa = Math.max(0, newOrderTotalPaisa - advancePaisa);

  const displayedOrderItems = useMemo(
    () => allocateDiscountToHighestItem(orderItems, totalOrderDiscountPaisa),
    [orderItems, totalOrderDiscountPaisa]
  );

  // Submit New Order
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custPhone.trim()) {
      alert("Customer mobile phone is required for online shipping!");
      return;
    }
    if (orderItems.length === 0) {
      alert("Please add at least one product to the order!");
      return;
    }

    try {
      setLoading(true);
      const finalizedItems = allocateDiscountToHighestItem(orderItems, totalOrderDiscountPaisa);

      const payload: CreateOnlineOrderPayload = {
        channel: newChannel,
        customer_name: custName.trim() || "Valued Online Customer",
        customer_phone: custPhone.trim(),
        shipping_address: custAddress.trim() || "Address pending dispatch",
        city: custCity.trim() || "Pakistan",
        items_json: JSON.stringify(finalizedItems),
        subtotal_paisa: newOrderSubtotalPaisa,
        delivery_charges_paisa: deliveryPaisa,
        discount_paisa: totalOrderDiscountPaisa,
        total_amount_paisa: newOrderTotalPaisa,
        advance_paid_paisa: advancePaisa,
        cod_balance_paisa: codBalancePaisa,
        payment_custodian: codBalancePaisa > 0 ? custodian : "COURIER",
        courier_partner: courierPartner,
        tracking_number: trackingNumber.trim() || undefined,
        notes: orderNotes.trim() || undefined,
        created_by_user_id: currentUser?.user_id || "usr_online_mgr",
      };

      const created = await createOnlineOrder(payload);
      setFeedback({
        type: "success",
        text: `✓ Order ${created.order_number} booked successfully! COD Amount: Rs. ${formatRs(created.cod_balance_paisa)}`,
      });
      setIsNewOrderModalOpen(false);
      resetNewOrderForm();
      await loadData();
      window.dispatchEvent(new CustomEvent("app:refresh-data"));
    } catch (err: any) {
      console.error("Failed to create online order:", err);
      setFeedback({
        type: "error",
        text: typeof err === "string" ? err : err.message || "Failed to create order",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetNewOrderForm = () => {
    setCustName("");
    setCustPhone("");
    setCustCity("");
    setCustAddress("");
    setOrderItems([]);
    setDeliveryCharges("0");
    setDiscountRupees("0");
    setAdvancePaidRupees("0");
    setTrackingNumber("");
    setOrderNotes("");
  };

  // Open Collect Modal
  const openCollectPaymentModal = (order: OnlineOrder) => {
    setSelectedOrder(order);
    setCollectAmountRupees((order.cod_balance_paisa / 100).toString());
    setCollectMethod("CASH");
    setCollectReference("");
    setCollectNotes("");
    setIsCollectModalOpen(true);
  };

  // Execute Collect Payment
  const handleExecuteCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    const amountPaisa = Math.round((parseFloat(collectAmountRupees) || 0) * 100);
    if (amountPaisa <= 0) {
      alert("Please enter a valid payment collection amount!");
      return;
    }

    try {
      setLoading(true);
      const payload: CollectOnlinePaymentPayload = {
        order_id: selectedOrder.order_id,
        amount_paid_paisa: amountPaisa,
        payment_method: collectMethod,
        reference_number: collectReference.trim() || undefined,
        collected_by: currentUser?.full_name || currentUser?.username || "Online Cashier",
        notes: collectNotes.trim() || undefined,
      };

      await collectOnlineOrderPayment(payload);
      setFeedback({
        type: "success",
        text: `✓ Payment of Rs. ${(amountPaisa / 100).toLocaleString()} collected for Order ${selectedOrder.order_number}! Settled into treasury.`,
      });
      setIsCollectModalOpen(false);
      setSelectedOrder(null);
      await loadData();
      window.dispatchEvent(new CustomEvent("app:refresh-data"));
    } catch (err: any) {
      console.error("Failed to collect online payment:", err);
      setFeedback({
        type: "error",
        text: typeof err === "string" ? err : err.message || "Failed to collect payment",
      });
    } finally {
      setLoading(false);
    }
  };

  // Open Return / RTO & Cancellation Refund Modal
  const openReturnModal = (order: OnlineOrder) => {
    setSelectedOrder(order);
    setReturnReason("Customer cancelled order / refused parcel / Address unreachable");

    // Parse order items for itemized partial/full return selection
    let parsed: any[] = [];
    try {
      parsed = JSON.parse(order.items_json);
    } catch {
      parsed = [];
    }

    // Allocate order discount to the highest-priced items first so return refund calculation is simple and clean
    const discountAllocations = computeItemDiscountAllocation(parsed, order.discount_paisa || 0);

    const selections = parsed.map((it, idx) => {
      const alreadyReturned = it.returned_quantity || 0;
      const totalOrdered = it.quantity || 1;
      const availableQty = Math.max(0, totalOrdered - alreadyReturned);
      const alloc = discountAllocations.get(idx) || {
        effectiveUnitPricePaisa: it.unit_price_paisa || Math.round((it.line_total_paisa || 0) / totalOrdered),
        allocatedDiscountPaisa: 0,
        origUnitPricePaisa: it.unit_price_paisa || Math.round((it.line_total_paisa || 0) / totalOrdered),
      };

      return {
        originalIndex: idx,
        name: it.name || it.product_name || "Fragrance Item",
        totalOrderedQty: totalOrdered,
        alreadyReturnedQty: alreadyReturned,
        maxQty: availableQty,
        returnQty: availableQty > 0 ? availableQty : 0,
        selected: availableQty > 0,
        unitPricePaisa: alloc.effectiveUnitPricePaisa,
        origUnitPricePaisa: alloc.origUnitPricePaisa,
        allocatedDiscountPaisa: alloc.allocatedDiscountPaisa,
        rawItem: it,
      };
    });
    setReturnItemSelections(selections);

    const netPaidSoFar = Math.max(0, (order.advance_paid_paisa || 0) - (order.refund_amount_paisa || 0));
    setIncludeDeliveryInReturn(false);
    if (netPaidSoFar > 0) {
      setRefundMode("FULL");
      setRefundDeductionRupees("0");
      setRefundPaymentMethod(order.refund_settlement_method || "CASH");
    } else {
      setRefundMode("NONE");
      setRefundDeductionRupees("0");
      setRefundPaymentMethod("CASH");
    }
    setIsReturnModalOpen(true);
  };

  // Execute Return / RTO & Refund Settlement
  const handleExecuteReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    // Check which items are selected
    const selectedReturns = returnItemSelections.filter((it) => it.selected && it.returnQty > 0);
    if (selectedReturns.length === 0) {
      alert("Please select at least one item to return!");
      return;
    }

    // Determine if all remaining unreturned units are being returned
    const isAllReturned = returnItemSelections.every((it) => {
      if (it.maxQty === 0) return true; // already returned previously
      return it.selected && it.returnQty === it.maxQty;
    });

    const netPaidSoFar = Math.max(0, (selectedOrder.advance_paid_paisa || 0) - (selectedOrder.refund_amount_paisa || 0));
    const returnedItemsValuePaisa = selectedReturns.reduce((sum, s) => sum + s.returnQty * s.unitPricePaisa, 0);
    const deliveryChargesPaisa = Math.max(0, selectedOrder.delivery_charges_paisa || 0);
    const deliveryReturnPaisa = includeDeliveryInReturn ? deliveryChargesPaisa : 0;
    const totalReturnableValuePaisa = returnedItemsValuePaisa + deliveryReturnPaisa;
    const maxRefundPossible = Math.min(netPaidSoFar, totalReturnableValuePaisa);

    let refundPaisa = 0;
    let deductionPaisa = 0;

    if (netPaidSoFar > 0) {
      if (refundMode === "FULL") {
        refundPaisa = maxRefundPossible;
        deductionPaisa = isAllReturned ? Math.max(0, netPaidSoFar - refundPaisa) : 0;
      } else if (refundMode === "PARTIAL") {
        const deductionInputPaisa = Math.max(0, Math.round((parseFloat(refundDeductionRupees) || 0) * 100));
        const customCut = Math.min(maxRefundPossible, deductionInputPaisa);
        refundPaisa = Math.max(0, maxRefundPossible - customCut);
        deductionPaisa = isAllReturned ? Math.max(0, netPaidSoFar - refundPaisa) : customCut;
      } else {
        // NONE (100% paid amount retained)
        refundPaisa = 0;
        deductionPaisa = isAllReturned ? netPaidSoFar : maxRefundPossible;
      }
    }

    try {
      setLoading(true);

      // Exclude optional refunded delivery charges when allocating per-item refund amounts
      const itemRefundPoolPaisa = Math.min(refundPaisa, returnedItemsValuePaisa);

      // Create updated items array preserving ALL items, tracking returned quantities and exact refund per item
      const updatedAllItems = returnItemSelections.map((s) => {
        const newlyReturned = s.selected ? s.returnQty : 0;
        const totalReturned = (s.rawItem.returned_quantity || 0) + newlyReturned;
        const totalOrdered = s.rawItem.quantity || 1;
        const exactItemValue = s.returnQty * s.unitPricePaisa;
        const itemShareOfRefund = (s.selected && returnedItemsValuePaisa > 0 && itemRefundPoolPaisa > 0)
          ? (itemRefundPoolPaisa >= returnedItemsValuePaisa
              ? exactItemValue
              : Math.round(itemRefundPoolPaisa * (exactItemValue / returnedItemsValuePaisa)))
          : 0;
        const prevItemRefund = s.rawItem.refund_paisa || 0;

        return {
          ...s.rawItem,
          returned_quantity: totalReturned,
          refund_paisa: prevItemRefund + itemShareOfRefund,
          return_status:
            totalReturned >= totalOrdered
              ? "RETURNED"
              : totalReturned > 0
              ? "PARTIAL_RETURN"
              : "ACTIVE",
        };
      });

      const returnedItems = selectedReturns.map((s) => {
        const exactItemValue = s.returnQty * s.unitPricePaisa;
        const itemRefund = returnedItemsValuePaisa > 0 && itemRefundPoolPaisa > 0
          ? (itemRefundPoolPaisa >= returnedItemsValuePaisa
              ? exactItemValue
              : Math.round(itemRefundPoolPaisa * (exactItemValue / returnedItemsValuePaisa)))
          : 0;
        return {
          ...s.rawItem,
          quantity: s.returnQty,
          unit_price_paisa: s.unitPricePaisa,
          line_total_paisa: s.returnQty * s.unitPricePaisa,
          refund_paisa: itemRefund,
        };
      });

      // Calculate new active items subtotal (only for unreturned units)
      const activeItemsSubtotalPaisa = updatedAllItems.reduce((sum, it) => {
        const activeUnits = Math.max(0, (it.quantity || 1) - (it.returned_quantity || 0));
        const unitPrice = it.unit_price_paisa || Math.round((it.line_total_paisa || 0) / (it.quantity || 1));
        return sum + activeUnits * unitPrice;
      }, 0);

      // Active remaining discount belongs ONLY to unreturned units
      const activeItemsDiscountPaisa = isAllReturned
        ? 0
        : updatedAllItems.reduce((sum, it) => {
            const activeUnits = Math.max(0, (it.quantity || 1) - (it.returned_quantity || 0));
            const totalOrdered = it.quantity || 1;
            const itemDisc = it.discount_paisa || 0;
            const activeItemDisc = totalOrdered > 0 ? Math.round((itemDisc * activeUnits) / totalOrdered) : 0;
            return sum + activeItemDisc;
          }, 0);

      const remainingDeliveryPaisa = isAllReturned
        ? 0
        : includeDeliveryInReturn
        ? 0
        : deliveryChargesPaisa;

      const newTotalPaisa = isAllReturned
        ? 0
        : Math.max(
            0,
            activeItemsSubtotalPaisa + remainingDeliveryPaisa - activeItemsDiscountPaisa
          );

      const payload: MarkOnlineReturnPayload = {
        order_id: selectedOrder.order_id,
        return_reason: returnReason.trim(),
        user_id: currentUser?.user_id || "usr_online_mgr",
        refund_amount_paisa: refundPaisa,
        deduction_amount_paisa: deductionPaisa,
        refund_settlement_method: refundPaisa > 0 ? refundPaymentMethod : undefined,
        returned_items_json: JSON.stringify(returnedItems),
        remaining_items_json: JSON.stringify(updatedAllItems),
        new_total_paisa: newTotalPaisa,
        new_subtotal_paisa: activeItemsSubtotalPaisa,
        new_discount_paisa: activeItemsDiscountPaisa,
        new_delivery_charges_paisa: remainingDeliveryPaisa,
        is_partial: !isAllReturned,
      };

      await markOnlineOrderReturn(payload);
      setFeedback({
        type: "success",
        text: isAllReturned
          ? `✓ Order ${selectedOrder.order_number} marked as Full Return (RTO). Restocked into inventory! ${
              refundPaisa > 0 ? `Rs. ${formatRs(refundPaisa)} refunded to customer (${refundPaymentMethod}).` : ""
            } ${deductionPaisa > 0 ? `Rs. ${formatRs(deductionPaisa)} retained as handling cut.` : ""}`
          : `✓ Partial return recorded for ${selectedOrder.order_number}! Selected items restocked; order retains active items. ${
              refundPaisa > 0 ? `Rs. ${formatRs(refundPaisa)} refunded to customer (${refundPaymentMethod}).` : ""
            }`,
      });
      setIsReturnModalOpen(false);
      setSelectedOrder(null);
      await loadData();
      window.dispatchEvent(new CustomEvent("app:refresh-data"));
    } catch (err: any) {
      console.error("Failed to mark order return:", err);
      setFeedback({
        type: "error",
        text: typeof err === "string" ? err : err.message || "Failed to mark return",
      });
    } finally {
      setLoading(false);
    }
  };

  // Open Status Update Modal
  const openStatusModal = (order: OnlineOrder) => {
    setSelectedOrder(order);
    setUpdateDeliveryStatus(order.delivery_status || "DISPATCHED");
    setUpdateTracking(order.tracking_number || "");
    setUpdateCourier(order.courier_partner || COURIER_PARTNERS[0]);
    setIsStatusModalOpen(true);
  };

  const handleExecuteStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    try {
      setLoading(true);
      await updateOnlineOrderStatus(
        selectedOrder.order_id,
        updateDeliveryStatus,
        updateTracking.trim() || undefined,
        updateCourier
      );
      setFeedback({
        type: "success",
        text: `✓ Order ${selectedOrder.order_number} status updated to ${updateDeliveryStatus}!`,
      });
      setIsStatusModalOpen(false);
      setSelectedOrder(null);
      await loadData();
      window.dispatchEvent(new CustomEvent("app:refresh-data"));
    } catch (err: any) {
      console.error("Failed to update status:", err);
      setFeedback({
        type: "error",
        text: typeof err === "string" ? err : err.message || "Failed to update status",
      });
    } finally {
      setLoading(false);
    }
  };

  // Generate HTML for Thermal 80mm & A4 Consignment Dispatch Slip
  const generateShippingSlipHtml = (order: OnlineOrder, format: "THERMAL_80MM" | "A4"): string => {
    let items: OnlineOrderItem[] = [];
    try {
      items = JSON.parse(order.items_json);
    } catch {
      items = [];
    }

    const isPrepaidOrStaff =
      order.cod_balance_paisa <= 0 ||
      order.advance_paid_paisa >= order.total_amount_paisa ||
      (order.total_amount_paisa - order.advance_paid_paisa) <= 0 ||
      order.payment_status === "PAID" ||
      order.payment_custodian === "STAFF_HANDLER" ||
      order.payment_custodian === "SETTLED";

    if (format === "THERMAL_80MM") {
      return `
        <div style="width: 72mm; margin: 0 auto; padding: 4px 2px; font-family: 'Segoe UI', -apple-system, Roboto, Arial, sans-serif; font-size: 11px; color: #000000; background: #ffffff; line-height: 1.35; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
          <!-- High-Contrast Brand Header with Official Receipt Logo -->
          <div style="text-align: center; padding-bottom: 3px;">
            <img src="/logo-receipt.png" style="width: 44mm; height: auto; margin: 0 auto 3px auto; display: block; image-rendering: pixelated;" alt="Ameer Perfumes" />
            <div style="font-size: 8.5px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; color: #000000;">HAUTE PARFUMERIE & LUXURY ATTARS</div>
            <div style="font-size: 9px; font-weight: 700; color: #000000; margin-top: 1px;">Sports Complex, Bannu • Cell: 0329 9969277</div>
            <!-- Clean Badge without Solid Inversion to Prevent Printer Ink Bleed -->
            <div style="margin: 5px auto 2px auto; display: inline-block; border: 1.5px solid #000000; border-radius: 4px; padding: 2px 10px; font-size: 10px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; background: #ffffff; color: #000000;">
              ${order.channel === "WHATSAPP" ? "💬 WHATSAPP PARCEL DISPATCH" : "🌐 WEBSITE PARCEL DISPATCH"}
            </div>
          </div>

          <div style="border-top: 1.5px dashed #000000; margin: 6px 0;"></div>

          <!-- Consignment & Order Metadata -->
          <div style="font-size: 10px; font-weight: 700; color: #000000;">
            <div style="display: flex; justify-content: space-between; margin: 2px 0;">
              <span style="font-weight: 800;">ORDER NO:</span>
              <span style="font-weight: 900; font-family: monospace; font-size: 12px; letter-spacing: 0.5px;">${order.order_number}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 2px 0;">
              <span style="font-weight: 800;">BOOKING DATE:</span>
              <span>${order.created_at}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 2px 0;">
              <span style="font-weight: 800;">COURIER SERVICE:</span>
              <span style="font-weight: 900; text-transform: uppercase;">${order.courier_partner}</span>
            </div>
            ${order.tracking_number ? `
            <div style="display: flex; justify-content: space-between; margin: 2px 0;">
              <span style="font-weight: 800;">TRACKING NUMBER:</span>
              <span style="font-weight: 900; font-family: monospace;">${order.tracking_number}</span>
            </div>` : ""}
          </div>

          <!-- PROMINENT CONSIGNEE / RECIPIENT BOX (OPTIMIZED FOR COURIER RIDERS) -->
          <div style="border: 2px solid #000000; padding: 7px 8px; margin: 6px 0; background: #ffffff;">
            <div style="font-size: 8.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #000000; padding-bottom: 2px; margin-bottom: 4px;">
              DELIVER TO (CONSIGNEE):
            </div>
            <div style="font-size: 13.5px; font-weight: 900; text-transform: uppercase; color: #000000;">
              ${order.customer_name}
            </div>
            <div style="font-size: 15px; font-weight: 900; margin: 4px 0; color: #000000; font-family: monospace; letter-spacing: 0.5px;">
              📞 PHONE: ${order.customer_phone}
            </div>
            <div style="font-size: 11px; margin-top: 3px;">
              <strong>DESTINATION CITY:</strong> <span style="font-weight: 900; text-transform: uppercase;">${order.city}</span>
            </div>
            <div style="font-size: 10.5px; margin-top: 2px; line-height: 1.35;">
              <strong>SHIPPING ADDRESS:</strong> ${order.shipping_address}
            </div>
          </div>

          <!-- PACKAGE CONTENTS (ITEMIZED) -->
          <div style="border-top: 1.5px dashed #000000; margin: 6px 0 4px 0;"></div>
          <div style="font-size: 9.5px; font-weight: 900; text-transform: uppercase; margin-bottom: 3px; display: flex; justify-content: space-between;">
            <span>Item Description</span>
            <span>Amount</span>
          </div>
          <div style="border-top: 1px solid #000000; margin-bottom: 4px;"></div>
          ${items
            .map(
              (it: any) => {
                const isRet = (it.returned_quantity || 0) >= (it.quantity || 1);
                const isPart = (it.returned_quantity || 0) > 0 && !isRet;
                return `
            <div style="display: flex; justify-content: space-between; font-size: 10.5px; margin-bottom: 2px; font-family: monospace; ${isRet ? "text-decoration: line-through; opacity: 0.6;" : ""}">
              <span style="font-weight: 700;">${it.quantity}x ${it.name} ${isRet ? "(RETURNED)" : isPart ? `(${it.returned_quantity} ret)` : ""}</span>
              <span style="font-weight: 900;">Rs. ${(it.line_total_paisa / 100).toLocaleString()}</span>
            </div>
          `;
              }
            )
            .join("")}

          <!-- FINANCIAL BREAKDOWN -->
          <div style="border-top: 1.5px dashed #000000; margin: 6px 0 4px 0;"></div>
          <div style="font-size: 10px; font-weight: 700;">
            <div style="display: flex; justify-content: space-between; margin: 1px 0;">
              <span>Subtotal:</span>
              <span style="font-family: monospace; font-weight: 800;">Rs. ${(order.subtotal_paisa / 100).toLocaleString()}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 1px 0;">
              <span>Delivery Charges:</span>
              <span style="font-family: monospace; font-weight: 800;">Rs. ${(order.delivery_charges_paisa / 100).toLocaleString()}</span>
            </div>
            ${
              order.discount_paisa > 0
                ? `
            <div style="display: flex; justify-content: space-between; margin: 1px 0;">
              <span>Discount:</span>
              <span style="font-family: monospace; font-weight: 800;">-Rs. ${(order.discount_paisa / 100).toLocaleString()}</span>
            </div>`
                : ""
            }
            <div style="display: flex; justify-content: space-between; margin: 1px 0; font-weight: 800;">
              <span>Total Order Value:</span>
              <span style="font-family: monospace; font-weight: 900;">Rs. ${(order.total_amount_paisa / 100).toLocaleString()}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 1px 0;">
              <span>Advance Paid:</span>
              <span style="font-family: monospace; font-weight: 800;">Rs. ${(order.advance_paid_paisa / 100).toLocaleString()}</span>
            </div>
          </div>

          <!-- PAYMENT OR CASH ON DELIVERY (COD) CONTAINER -->
          ${isPrepaidOrStaff ? `
          <div style="margin: 7px 0; border: 2px solid #000000; padding: 7px 4px; text-align: center; background: #ffffff;">
            <div style="font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.8px;">
              ✓ PAID IN ADVANCE — PREPAID ORDER
            </div>
            <div style="font-size: 9px; font-weight: 800; text-transform: uppercase; margin-top: 2px;">
              (DO NOT COLLECT CASH FROM CUSTOMER)
            </div>
          </div>
          ` : `
          <div style="margin: 7px 0; border: 2.5px solid #000000; padding: 7px 4px; text-align: center; background: #ffffff;">
            <div style="font-size: 10.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.8px;">
              CASH ON DELIVERY (COD):
            </div>
            <div style="font-size: 22px; font-weight: 900; font-family: monospace; letter-spacing: 1px; margin: 2px 0;">
              Rs. ${(order.cod_balance_paisa / 100).toLocaleString()}
            </div>
            <div style="font-size: 9px; font-weight: 800; text-transform: uppercase;">
              (Rider: Collect exact cash from customer)
            </div>
          </div>
          `}

          <div style="border-top: 1.5px dashed #000000; margin: 6px 0 4px 0;"></div>
          <div style="text-align: center; font-size: 9.5px; font-weight: 600; line-height: 1.35;">
            Thank you for choosing Ameer Perfumes!<br/>
            Complaints & Support: <strong>0329 9969277</strong><br/>
            <span style="font-size: 8.5px; font-weight: 700; color: #000000; margin-top: 2px; display: inline-block;">
              Software Developed by Global Tech • Contact: 0329 9969277
            </span>
          </div>
        </div>
      `;
    } else {
      // A4 Comprehensive Packing Invoice
      return `
        <div style="width: 100%; max-width: 800px; margin: 0 auto; padding: 24px; font-family: sans-serif; color: #1e293b;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 14px;">
              <img src="/logo-rect.png" style="height: 54px; width: auto; object-fit: contain;" alt="Ameer Perfumes" />
              <div>
                <h1 style="font-size: 22px; font-weight: 800; color: #d97706; margin: 0; letter-spacing: 0.5px;">AMEER PERFUMES</h1>
                <p style="font-size: 11px; color: #64748b; margin: 2px 0 0 0; text-transform: uppercase; font-weight: 600;">Haute Parfumerie & Concentrated Perfume Oils</p>
                <p style="font-size: 11px; color: #64748b; margin: 2px 0 0 0;">Main Sports Complex, Bannu • Cell: 0329 9969277</p>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 18px; font-weight: 800; color: #0f172a;">ONLINE SHIPPING DISPATCH SLIP</div>
              <div style="font-size: 13px; font-weight: bold; color: #d97706; margin-top: 2px;">${order.order_number}</div>
              <div style="font-size: 11px; color: #64748b;">Channel: <strong>${order.channel}</strong></div>
              <div style="font-size: 11px; color: #64748b;">Date: ${order.created_at}</div>
            </div>
          </div>
            <div style="text-align: right;">
              <div style="font-size: 18px; font-weight: 800; color: #0f172a;">ONLINE SHIPPING DISPATCH SLIP</div>
              <div style="font-size: 13px; font-weight: bold; color: #d97706; margin-top: 2px;">${order.order_number}</div>
              <div style="font-size: 11px; color: #64748b;">Channel: <strong>${order.channel}</strong></div>
              <div style="font-size: 11px; color: #64748b;">Date: ${order.created_at}</div>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
            <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; background: #f8fafc;">
              <h3 style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; margin: 0 0 8px 0;">Customer (Consignee) Details</h3>
              <div style="font-size: 16px; font-weight: 700; color: #0f172a;">${order.customer_name}</div>
              <div style="font-size: 15px; font-weight: 800; color: #b45309; margin: 4px 0;">📞 ${order.customer_phone}</div>
              <div style="font-size: 12px; color: #334155;"><strong>Destination City:</strong> ${order.city}</div>
              <div style="font-size: 12px; color: #334155; margin-top: 2px;"><strong>Shipping Address:</strong> ${order.shipping_address}</div>
            </div>

            <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; background: #f8fafc;">
              <h3 style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; margin: 0 0 8px 0;">Logistics & Dispatch Information</h3>
              <div style="font-size: 14px; font-weight: 700; color: #0f172a;">Courier: ${order.courier_partner}</div>
              <div style="font-size: 12px; color: #334155; margin: 4px 0;">Tracking Number: <strong>${order.tracking_number || "To be issued"}</strong></div>
              <div style="font-size: 12px; color: #334155;">Payment Custodian: <strong>${order.payment_custodian}</strong></div>
              <div style="font-size: 12px; color: #334155;">Delivery Status: <strong>${order.delivery_status}</strong></div>
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left;">
                <th style="padding: 10px;">Item Description</th>
                <th style="padding: 10px; text-align: center;">Type</th>
                <th style="padding: 10px; text-align: center;">Qty</th>
                <th style="padding: 10px; text-align: right;">Unit Rate</th>
                <th style="padding: 10px; text-align: right;">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              ${items
                .map(
                  (it: any) => {
                    const isRet = (it.returned_quantity || 0) >= (it.quantity || 1);
                    const isPart = (it.returned_quantity || 0) > 0 && !isRet;
                    return `
                <tr style="border-bottom: 1px solid #e2e8f0; ${isRet ? "text-decoration: line-through; opacity: 0.6; background: #fff1f2;" : ""}">
                  <td style="padding: 10px; font-weight: 600;">${it.name} ${isRet ? '<span style="color: #e11d48; font-size: 10px; font-weight: bold; margin-left: 6px;">[RETURNED]</span>' : isPart ? `<span style="color: #d97706; font-size: 10px; font-weight: bold; margin-left: 6px;">[${it.returned_quantity} RETURNED]</span>` : ""}</td>
                  <td style="padding: 10px; text-align: center;">${it.item_type}</td>
                  <td style="padding: 10px; text-align: center; font-weight: 700;">${it.quantity}</td>
                  <td style="padding: 10px; text-align: right;">Rs. ${(it.unit_price_paisa / 100).toLocaleString()}</td>
                  <td style="padding: 10px; text-align: right; font-weight: 700;">Rs. ${(it.line_total_paisa / 100).toLocaleString()}</td>
                </tr>
              `;
                  }
                )
                .join("")}
            </tbody>
          </table>

          <div style="display: flex; justify-content: flex-end; margin-bottom: 24px;">
            <div style="width: 320px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; background: #fff;">
              <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
                <span>Subtotal:</span>
                <span>Rs. ${(order.subtotal_paisa / 100).toLocaleString()}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
                <span>Delivery Charges:</span>
                <span>Rs. ${(order.delivery_charges_paisa / 100).toLocaleString()}</span>
              </div>
              ${
                order.discount_paisa > 0
                  ? `
              <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; color: #e11d48;">
                <span>Discount:</span>
                <span>-Rs. ${(order.discount_paisa / 100).toLocaleString()}</span>
              </div>`
                  : ""
              }
              <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; border-top: 1px solid #e2e8f0; padding-top: 6px; margin-top: 4px;">
                <span>Total Order Value:</span>
                <span>Rs. ${(order.total_amount_paisa / 100).toLocaleString()}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 12px; color: #059669; margin: 4px 0;">
                <span>Advance Paid:</span>
                <span>Rs. ${(order.advance_paid_paisa / 100).toLocaleString()}</span>
              </div>
              ${isPrepaidOrStaff ? `
              <div style="display: flex; justify-content: space-between; font-size: 13.5px; font-weight: 800; color: #059669; border-top: 2px solid #059669; padding-top: 8px; margin-top: 6px;">
                <span>PAYMENT STATUS:</span>
                <span>PAID IN ADVANCE (DO NOT COLLECT CASH)</span>
              </div>
              ` : `
              <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; color: #b45309; border-top: 2px solid #b45309; padding-top: 8px; margin-top: 6px;">
                <span>CASH ON DELIVERY (COD):</span>
                <span>Rs. ${(order.cod_balance_paisa / 100).toLocaleString()}</span>
              </div>
              `}
            </div>
          </div>

          <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; display: flex; justify-content: space-between; font-size: 10px; color: #64748b;">
            <div>Ameer Perfumes ERP • Official E-Commerce Shipping Dispatch Document</div>
            <div>Software Developed by Global Tech • Contact: 0329 9969277</div>
          </div>
        </div>
      `;
    }
  };

  // Execute native print targeting correct container
  const executePrintSlip = (order: OnlineOrder, format: "THERMAL_80MM" | "A4") => {
    const html = generateShippingSlipHtml(order, format);

    if (format === "THERMAL_80MM") {
      const printArea = document.getElementById("thermal-print-area");
      if (!printArea) return;
      printArea.innerHTML = html;
      document.body.classList.remove("printing-wholesale-a4");
      document.body.classList.remove("printing-reports-a4");
      setTimeout(() => {
        window.print();
        const cleanUp = () => {
          if (printArea) printArea.innerHTML = "";
          window.removeEventListener("afterprint", cleanUp);
        };
        window.addEventListener("afterprint", cleanUp);
      }, 80);
    } else {
      const printArea = document.getElementById("wholesale-print-area");
      if (!printArea) return;
      printArea.innerHTML = html;
      document.body.classList.add("printing-wholesale-a4");
      document.body.classList.remove("printing-reports-a4");
      setTimeout(() => {
        window.print();
        const cleanUp = () => {
          document.body.classList.remove("printing-wholesale-a4");
          if (printArea) printArea.innerHTML = "";
          window.removeEventListener("afterprint", cleanUp);
        };
        window.addEventListener("afterprint", cleanUp);
      }, 80);
    }
  };

  // Export Orders to CSV
  const handleExportCSV = () => {
    const header = "Order No,Channel,Customer Name,Customer Phone,City,Address,Total (PKR),Advance Paid (PKR),COD Balance (PKR),Payment Status,Custodian,Courier,Tracking No,Delivery Status,Date\n";
    const rows = filteredOrders
      .map(
        (o) =>
          `"${o.order_number}","${o.channel}","${o.customer_name}","${o.customer_phone}","${o.city}","${o.shipping_address.replace(/"/g, '""')}",${o.total_amount_paisa / 100},${o.advance_paid_paisa / 100},${o.cod_balance_paisa / 100},"${o.payment_status}","${o.payment_custodian}","${o.courier_partner}","${o.tracking_number}","${o.delivery_status}","${o.created_at}"`
      )
      .join("\n");

    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Ameer_Online_Orders_${filterTab}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setFeedback({
      type: "success",
      text: `✓ Online orders (${filteredOrders.length} records) exported to Excel successfully! Check your Downloads folder.`,
    });
  };

  return (
    <div className="flex-1 p-6 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col gap-6 select-none overflow-y-auto">
      {/* Screen Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold font-serif text-slate-900 dark:text-slate-100 tracking-wide flex items-center gap-2">
              <Globe className="w-5 h-5 text-emerald-500" />
              Online & Social Commerce Hub (WhatsApp & Website)
            </h1>
            <Badge variant="gold" className="text-[11px] font-bold">
              Dispatch & COD Center
            </Badge>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Dedicated order management, courier COD reconciliation, staff custodian tracking, instant payment collection, and RTO return logistics.
          </p>
        </div>

        {/* Global Primary Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 shadow-xs whitespace-nowrap px-3 py-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Orders (Excel)</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              resetNewOrderForm();
              setIsNewOrderModalOpen(true);
            }}
            className="flex items-center gap-1.5 text-xs font-bold cursor-pointer bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-sm whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Book New Online Order</span>
          </Button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="font-bold underline ml-3 cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* EXECUTIVE KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Card 1: TOTAL GROSS */}
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 uppercase font-mono font-bold tracking-wider">
            <span>TOTAL GROSS</span>
            <Globe className="w-4 h-4 text-blue-500" />
          </div>
          <span className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1 block">
            Rs. {formatRs(totalGrossOrderValuePaisa)}
          </span>
          <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400 block -mt-0.5">
            {orders.length} Total Online Orders
          </span>
          <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-col gap-1 text-[11px] font-mono">
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>💬 WA: {waOrders.length} Orders</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">Rs. {formatRs(waGrossOrderValuePaisa)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>🌐 Web: {webOrders.length} Orders</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">Rs. {formatRs(webGrossOrderValuePaisa)}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Pending Receivables (Pending COD & Balances) */}
        <div className="bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/30 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-400 uppercase font-mono font-bold">
            <span>Pending Receivables</span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <span className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1 block">
            Rs. {formatRs(totalPendingPaisa)}
          </span>
          <div className="mt-1 pt-1 border-t border-amber-500/20 flex flex-col gap-0.5 text-[11px] font-mono text-amber-800 dark:text-amber-300">
            <div className="flex justify-between">
              <span>💬 WhatsApp:</span>
              <span className="font-bold">Rs. {formatRs(waPendingPaisa)}</span>
            </div>
            <div className="flex justify-between">
              <span>🌐 Website:</span>
              <span className="font-bold">Rs. {formatRs(webPendingPaisa)}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Custodian Breakdown (Where is the Pending Money?) */}
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 uppercase font-mono">
            <span>Pending Custodian Split</span>
            <Truck className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-1 flex flex-col gap-1 font-mono text-xs">
            <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
              <span className="flex items-center gap-1">🚚 Courier COD:</span>
              <span className="text-indigo-600 dark:text-indigo-400">Rs. {formatRs(courierCodPaisa)}</span>
            </div>
            <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
              <span className="flex items-center gap-1">👤 Staff Handler:</span>
              <span className="text-amber-600 dark:text-amber-400">Rs. {formatRs(staffPendingPaisa)}</span>
            </div>
            <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-1 text-[11px] font-mono">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-1">💬 WA Staff:</span>
                <strong className="text-slate-800 dark:text-slate-200 font-bold">Rs. {formatRs(waStaffPendingPaisa)}</strong>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-1">🌐 Web Staff:</span>
                <strong className="text-slate-800 dark:text-slate-200 font-bold">Rs. {formatRs(webStaffPendingPaisa)}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Realized Cash Received (Net Collections) */}
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 uppercase font-mono">
            <span>Realized Collections</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 block">
            Rs. {formatRs(totalCollectedPaisa)}
          </span>
          <div className="mt-1 pt-1 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-0.5 text-[11px] font-mono">
            <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
              <span>💬 WhatsApp:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">Rs. {formatRs(waCollectedPaisa)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
              <span>🌐 Website:</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">Rs. {formatRs(webCollectedPaisa)}</span>
            </div>
          </div>
        </div>

        {/* Card 5: Returns / RTOs */}
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 uppercase font-mono">
            <span>Returns / RTOs</span>
            <RotateCcw className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
              {returnedOrders.length} {returnedOrders.some(o => o.delivery_status === "PARTIAL_RETURN") ? (returnedOrders.length === 1 ? "Return (Partial)" : "Returns") : "Parcels"}
            </span>
            <span className="text-xs font-mono font-bold text-rose-700 dark:text-rose-300">
              Rs. {formatRs(totalReturnedValuePaisa)}
            </span>
          </div>
          <div className="mt-1 pt-1 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-0.5 text-[10.5px] font-mono text-slate-500">
            <div className="flex justify-between">
              <span>Goods Value:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">Rs. {formatRs(totalReturnedValuePaisa)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Refunded:</span>
              <span className="font-semibold text-rose-600 dark:text-rose-400">Rs. {formatRs(totalRefundedPaisa)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* FILTER TABS & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: "ALL", label: `All Orders (${orders.length})` },
            { id: "WHATSAPP", label: `💬 WhatsApp (${waOrders.length})` },
            { id: "WEBSITE", label: `🌐 Website (${webOrders.length})` },
            { id: "PENDING_COD", label: `⏳ Pending COD (${orders.filter((o) => o.cod_balance_paisa > 0 && o.payment_status !== "RETURNED").length})` },
            { id: "IN_TRANSIT", label: `🚚 In Transit (${orders.filter((o) => o.delivery_status === "DISPATCHED").length})` },
            { id: "SETTLED", label: `✅ Fully Settled (${orders.filter((o) => o.payment_status === "PAID").length})` },
            { id: "RETURNED", label: `↩️ Returns / RTO (${returnedOrders.length})` },
          ].map((tab) => {
            return (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id as ChannelFilter)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap ${
                  filterTab === tab.id
                    ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900"
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Period Filter Dropdown */}
          <div className="flex items-center bg-white dark:bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-300 dark:border-slate-700 shadow-2xs hover:border-amber-500/50 transition-colors h-9 shrink-0">
            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0 mr-1.5" />
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-1.5 font-mono">
              Period:
            </span>
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as any)}
              className="bg-transparent text-slate-900 dark:text-slate-100 font-bold text-xs outline-none cursor-pointer pr-1"
            >
              <option value="ALL" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium">All Records (Lifetime)</option>
              <option value="TODAY" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium">Daily (Today)</option>
              <option value="WEEK" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium">Last 7 Days (Week)</option>
              <option value="MONTH" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium">This Month (MTD)</option>
            </select>
          </div>

          <div className="w-full sm:w-72">
            <Input
              placeholder="Search order #, customer phone, name, city, courier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<Search className="w-4 h-4 text-emerald-500" />}
              className="h-9 text-xs"
            />
          </div>
        </div>
      </div>

      {/* ORDERS MASTER AUDIT TABLE */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900/40 shadow-xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 font-mono uppercase text-[10px]">
              <th className="py-2.5 px-3">Order # & Date</th>
              <th className="py-2.5 px-3">Channel</th>
              <th className="py-2.5 px-3">Customer & Mobile #</th>
              <th className="py-2.5 px-3">Courier & Tracking</th>
              <th className="py-2.5 px-3">Pending Custodian</th>
              <th className="py-2.5 px-3 text-right">Order Total</th>
              <th className="py-2.5 px-3 text-right">Advance Paid</th>
              <th className="py-2.5 px-3 text-right">Pending COD</th>
              <th className="py-2.5 px-3 text-center">Status</th>
              <th className="py-2.5 px-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
            {paginatedOrders.map((o) => (
              <tr key={o.order_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                {/* 1. Order Number & Date */}
                <td className="py-2.5 px-3">
                  <div className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    {o.order_number}
                  </div>
                  <div className="text-[10px] text-slate-400 font-sans">{o.created_at}</div>
                </td>

                {/* 2. Channel Badge */}
                <td className="py-2.5 px-3">
                  {o.channel === "WHATSAPP" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      💬 WhatsApp
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                      🌐 Website
                    </span>
                  )}
                </td>

                {/* 3. Customer & Mobile Number */}
                <td className="py-2.5 px-3 font-sans">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                    {o.customer_name}
                  </div>
                  <div className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    <span>{o.customer_phone}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate max-w-[180px]" title={o.shipping_address}>
                    {o.city} • {o.shipping_address}
                  </div>
                  {/* Order Items Badges (Preserving and displaying all products & returned units) */}
                  {(() => {
                    let items: any[] = [];
                    try {
                      items = JSON.parse(o.items_json);
                    } catch {
                      items = [];
                    }
                    if (!items.length) return null;
                    return (
                      <div className="flex flex-wrap gap-1 mt-1.5 max-w-[240px]">
                        {items.map((it: any, i: number) => {
                          const isReturned = (it.returned_quantity || 0) >= (it.quantity || 1);
                          const isPartial = (it.returned_quantity || 0) > 0 && !isReturned;
                          return (
                            <span
                              key={i}
                              className={`text-[9.5px] px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1 ${
                                isReturned
                                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 line-through border border-rose-500/20"
                                  : isPartial
                                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                              }`}
                              title={`${it.name || "Item"} (${it.quantity}x) ${
                                isReturned ? "[Returned]" : isPartial ? `[${it.returned_quantity} returned]` : ""
                              }`}
                            >
                              📦 {it.name || "Item"} ({it.quantity}x)
                              {isReturned && <span className="font-bold text-rose-600 dark:text-rose-400 text-[8.5px]">↩️ RET</span>}
                              {isPartial && <span className="font-bold text-amber-600 dark:text-amber-400 text-[8.5px]">({it.returned_quantity} ret)</span>}
                            </span>
                          );
                        })}
                      </div>
                    );
                  })()}
                </td>

                {/* 4. Courier & Tracking */}
                <td className="py-2.5 px-3 font-sans">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-slate-400" />
                    <span>{o.courier_partner}</span>
                  </div>
                  {o.tracking_number ? (
                    <span className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded-md font-bold">
                      {o.tracking_number}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">No Tracking</span>
                  )}
                </td>

                {/* 5. Pending Custodian */}
                <td className="py-2.5 px-3">
                  {o.payment_status === "RETURNED" ? (
                    <span className="text-rose-500 text-[10px] font-bold">↩️ RTO Cancelled</span>
                  ) : o.cod_balance_paisa <= 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Treasury Settled
                    </span>
                  ) : o.payment_custodian === "COURIER" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                      🚚 With Courier (COD)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                      👤 Online Staff Handler
                    </span>
                  )}
                </td>

                {/* 6. Order Total */}
                <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">
                  Rs. {formatRs(o.total_amount_paisa)}
                </td>

                {/* 7. Advance Paid */}
                <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                  Rs. {formatRs(o.advance_paid_paisa)}
                </td>

                {/* 8. Pending COD */}
                <td className="py-2.5 px-3 text-right font-bold">
                  {o.cod_balance_paisa > 0 && o.payment_status !== "RETURNED" ? (
                    <span className="text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md font-mono font-bold">
                      Rs. {formatRs(o.cod_balance_paisa)}
                    </span>
                  ) : (
                    <span className="text-slate-400">Rs. 0</span>
                  )}
                </td>

                {/* 9. Status Badges & Refund Details */}
                <td className="py-2.5 px-3 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        o.payment_status === "PAID"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                          : o.payment_status === "PARTIAL"
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                          : o.payment_status === "RETURNED"
                          ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                          : "bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30"
                      }`}
                    >
                      {o.payment_status}
                    </span>
                    <span className="text-[9px] font-sans text-slate-500 font-semibold uppercase">
                      {o.delivery_status}
                    </span>
                    {o.payment_status === "RETURNED" && (
                      <div className="flex flex-col gap-0.5 mt-0.5 max-w-[130px]">
                        {o.refund_amount_paisa && o.refund_amount_paisa > 0 ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 whitespace-nowrap">
                            ↩ Ref: Rs. {formatRs(o.refund_amount_paisa)} ({o.refund_settlement_method || "CASH"})
                          </span>
                        ) : null}
                        {o.deduction_amount_paisa && o.deduction_amount_paisa > 0 ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20 whitespace-nowrap">
                            Cut Kept: Rs. {formatRs(o.deduction_amount_paisa)}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>
                </td>

                {/* 10. Actions */}
                <td className="py-2.5 px-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    {/* Collect Payment Button */}
                    {o.cod_balance_paisa > 0 && o.payment_status !== "RETURNED" && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => openCollectPaymentModal(o)}
                        className="h-7 px-2 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
                        title="Collect pending COD balance into treasury"
                      >
                        <DollarSign className="w-3 h-3" />
                        <span>Collect</span>
                      </Button>
                    )}

                    {/* Unified Direct Print Slip Button (Direct Native Print Dialog) */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => executePrintSlip(o, "THERMAL_80MM")}
                      className="h-7 px-2.5 text-[11px] font-bold border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 flex items-center gap-1 cursor-pointer"
                      title="Direct Print 80mm Shipping Dispatch Slip"
                    >
                      <Printer className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      <span>Print Slip</span>
                    </Button>

                    {/* Status Update Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openStatusModal(o)}
                      className="h-7 px-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                      title="Update Delivery & Tracking Status"
                    >
                      <Truck className="w-3.5 h-3.5" />
                    </Button>

                    {/* Return / RTO Button */}
                    {o.delivery_status !== "RETURNED_RTO" && o.payment_status !== "RETURNED" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openReturnModal(o)}
                        className="h-7 px-1.5 text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                        title="Mark Parcel Return / RTO & Cancellation Refund"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-500 font-sans">
                  No online orders found matching current filters. Click "+ Book New Online Order" to add one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
        <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
          Showing{" "}
          <span className="font-bold text-slate-900 dark:text-slate-100">
            {filteredOrders.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
          </span>{" "}
          to{" "}
          <span className="font-bold text-slate-900 dark:text-slate-100">
            {Math.min(currentPage * pageSize, filteredOrders.length)}
          </span>{" "}
          of{" "}
          <span className="font-bold text-slate-900 dark:text-slate-100">
            {filteredOrders.length}
          </span>{" "}
          orders (Page {currentPage} of {totalPages})
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="text-xs px-3 py-1 cursor-pointer disabled:opacity-40"
          >
            ◀ Previous
          </Button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => {
            if (
              pg === 1 ||
              pg === totalPages ||
              (pg >= currentPage - 1 && pg <= currentPage + 1)
            ) {
              return (
                <button
                  key={pg}
                  type="button"
                  onClick={() => setCurrentPage(pg)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    currentPage === pg
                      ? "bg-amber-500 text-slate-950 shadow-xs font-black"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {pg}
                </button>
              );
            }
            if (pg === currentPage - 2 || pg === currentPage + 2) {
              return (
                <span key={pg} className="px-1 text-slate-400 text-xs">
                  ...
                </span>
              );
            }
            return null;
          })}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="text-xs px-3 py-1 cursor-pointer disabled:opacity-40"
          >
            Next ▶
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: BOOK NEW ONLINE ORDER */}
      {/* ========================================================================= */}
      {isNewOrderModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2.5">
                <Globe className="w-5 h-5 text-emerald-500" />
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Book New Online / Social Commerce Order
                </h2>
              </div>
              <button
                onClick={() => setIsNewOrderModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateOrder} className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* Channel Selector */}
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Select Channel / Source:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewChannel("WHATSAPP")}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold cursor-pointer transition-all ${
                      newChannel === "WHATSAPP"
                        ? "bg-emerald-600 text-white border-emerald-500 shadow-sm"
                        : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>💬 WhatsApp Order</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewChannel("WEBSITE")}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold cursor-pointer transition-all ${
                      newChannel === "WEBSITE"
                        ? "bg-blue-600 text-white border-blue-500 shadow-sm"
                        : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <Globe className="w-4 h-4" />
                    <span>🌐 Website Order</span>
                  </button>
                </div>
              </div>

              {/* Customer Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Customer Mobile Number *
                  </label>
                  <Input
                    placeholder="e.g. 0300 1234567"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    required
                    icon={<Phone className="w-4 h-4 text-emerald-500" />}
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Customer Name
                  </label>
                  <Input
                    placeholder="e.g. Muhammad Adnan"
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Destination City
                  </label>
                  <Input
                    placeholder="e.g. Peshawar, Lahore, Islamabad, Bannu"
                    value={custCity}
                    onChange={(e) => setCustCity(e.target.value)}
                    icon={<MapPin className="w-4 h-4 text-amber-500" />}
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Complete Shipping Address
                  </label>
                  <Input
                    placeholder="House/Shop #, Street, Area"
                    value={custAddress}
                    onChange={(e) => setCustAddress(e.target.value)}
                  />
                </div>
              </div>

              {/* Products Picker */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <span>Package Items:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                      ({orderItems.length} items added)
                    </span>
                  </label>

                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[11px]">
                    <button
                      type="button"
                      onClick={() => setSelectedItemType("PERFUME")}
                      className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                        selectedItemType === "PERFUME"
                          ? "bg-amber-500 text-slate-950 font-bold"
                          : "text-slate-500"
                      }`}
                    >
                      Perfumes
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedItemType("ATTAR")}
                      className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                        selectedItemType === "ATTAR"
                          ? "bg-amber-500 text-slate-950 font-bold"
                          : "text-slate-500"
                      }`}
                    >
                      Attars
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedItemType("TESTER")}
                      className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer flex items-center gap-1 ${
                        selectedItemType === "TESTER"
                          ? "bg-purple-600 text-white font-bold"
                          : "text-slate-500"
                      }`}
                    >
                      <FlaskConical className="w-3 h-3" />
                      <span>Testers</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedItemType("OFFERS")}
                      className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer flex items-center gap-1 ${
                        selectedItemType === "OFFERS"
                          ? "bg-emerald-600 text-white font-bold"
                          : "text-slate-500"
                      }`}
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Offers</span>
                    </button>
                  </div>
                </div>

                {/* Quick Item Search & Select */}
                <div className="flex gap-2">
                  <Input
                    placeholder={`Search ${selectedItemType.toLowerCase()} to add...`}
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    icon={<Search className="w-3.5 h-3.5 text-slate-400" />}
                    className="h-8 text-xs flex-1"
                  />
                </div>

                {/* Products Grid to click & add */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto p-1.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950/40">
                  {selectedItemType === "PERFUME" &&
                    products
                      .filter((p) => !itemSearch.trim() || p.name.toLowerCase().includes(itemSearch.toLowerCase()))
                      .slice(0, 16)
                      .map((p) => {
                        const stock = p.current_stock_units ?? 0;
                        const isOutOfStock = stock <= 0;
                        return (
                          <button
                            key={p.product_id}
                            type="button"
                            onClick={() => {
                              if (isOutOfStock) return;
                              handleAddItem(p, "PERFUME");
                            }}
                            disabled={isOutOfStock}
                            className={`p-2 rounded-lg border text-left transition-all flex flex-col justify-between ${
                              isOutOfStock
                                ? "opacity-40 cursor-not-allowed bg-rose-500/5 border-rose-500/30"
                                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-500 cursor-pointer shadow-2xs"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {p.name}
                              </span>
                              {isOutOfStock ? (
                                <span className="text-[9px] font-bold text-rose-600 bg-rose-100 dark:bg-rose-950/60 px-1 py-0.2 rounded shrink-0">
                                  0 Stock
                                </span>
                              ) : (
                                <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 shrink-0">
                                  {stock} left
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between text-[10px] font-mono mt-1 text-slate-500">
                              <span>{p.size_ml}ml</span>
                              <span className={`font-bold ${isOutOfStock ? "text-slate-400 line-through" : "text-amber-600 dark:text-amber-400"}`}>
                                Rs. {formatRs(p.retail_price_paisa)}
                              </span>
                            </div>
                          </button>
                        );
                      })}

                  {selectedItemType === "ATTAR" &&
                    attars
                      .filter((a) => !itemSearch.trim() || a.name.toLowerCase().includes(itemSearch.toLowerCase()))
                      .slice(0, 16)
                      .map((a) => (
                        <button
                          key={a.attar_id}
                          type="button"
                          onClick={() => handleAddItem(a, "ATTAR")}
                          className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-left hover:border-emerald-500 transition-all cursor-pointer flex flex-col justify-between shadow-2xs"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {a.name}
                            </span>
                            <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded shrink-0">
                              Decant / Portion
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] font-mono mt-1 text-slate-500">
                            <span>1 Tola / Custom Rate</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              Rs. {formatRs(a.selling_price_per_tola_paisa)}
                            </span>
                          </div>
                        </button>
                      ))}

                  {selectedItemType === "TESTER" &&
                    products
                      .filter((p) => !itemSearch.trim() || p.name.toLowerCase().includes(itemSearch.toLowerCase()))
                      .slice(0, 16)
                      .map((p) => (
                        <button
                          key={`tester_${p.product_id}`}
                          type="button"
                          onClick={() => {
                            setSelectedPerfumeForTester(p);
                            setTesterPresetMl(1);
                            setCustomTesterMl(1);
                            setTesterPriceRupees("0");
                            setTesterQty(1);
                          }}
                          className="p-2 rounded-lg border border-purple-200 dark:border-purple-900/50 bg-white dark:bg-slate-900 text-left hover:border-purple-500 transition-all cursor-pointer flex flex-col justify-between shadow-2xs group"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-purple-600">
                              {p.name}
                            </span>
                            <span className="text-[9px] font-bold text-purple-700 dark:text-purple-300 bg-purple-500/15 px-1 py-0.2 rounded shrink-0 flex items-center gap-0.5">
                              <FlaskConical className="w-2.5 h-2.5" />
                              <span>Tester</span>
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] font-mono mt-1 text-slate-500">
                            <span>1ml, 2ml, 3ml, 5ml</span>
                            <span className="font-bold text-purple-600 dark:text-purple-400">Sample Dispense</span>
                          </div>
                        </button>
                      ))}

                  {selectedItemType === "OFFERS" &&
                    (offers.length === 0 ? (
                      <div className="col-span-2 sm:col-span-3 p-4 text-center text-xs text-slate-500">
                        No promotional offers active.
                      </div>
                    ) : (
                      offers
                        .filter((off) => off.is_active && (!itemSearch.trim() || off.title.toLowerCase().includes(itemSearch.toLowerCase())))
                        .map((off) => (
                          <div
                            key={off.offer_id}
                            className="p-2 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-500/5 dark:bg-amber-950/20 flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-amber-900 dark:text-amber-200 truncate">
                                  🎁 {off.title}
                                </span>
                                <span className="text-[10px] font-mono line-through text-slate-400">
                                  Rs. {formatRs(Math.round(off.regular_total * 100))}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1 line-clamp-1">
                                {off.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                              </p>
                            </div>
                            <div className="flex items-center justify-between mt-2 pt-1 border-t border-amber-200 dark:border-amber-900/50">
                              <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-300">
                                Rs. {formatRs(Math.round(off.bundle_price * 100))}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const regularTotalPaisa = Math.round(off.regular_total * 100);
                                  const bundlePricePaisa = Math.round(off.bundle_price * 100);
                                  const totalSavingsPaisa = Math.max(0, regularTotalPaisa - bundlePricePaisa);

                                  if (off.items && off.items.length > 0) {
                                    // Distribute savings to highest regular price item so prices remain clean integers
                                    const preparedItems = off.items.map((it, idx) => {
                                      const q = Math.max(1, it.quantity || 1);
                                      const regUnitPricePaisa = Math.round(it.unit_regular_price * 100);
                                      const regLineTotalPaisa = regUnitPricePaisa * q;
                                      return { idx, item: it, q, regUnitPricePaisa, regLineTotalPaisa };
                                    });

                                    const sorted = [...preparedItems].sort((a, b) => b.regLineTotalPaisa - a.regLineTotalPaisa);
                                    let remainingDisc = totalSavingsPaisa;
                                    const discMap = new Map<number, number>();

                                    for (const p of sorted) {
                                      if (remainingDisc <= 0) {
                                        discMap.set(p.idx, 0);
                                      } else {
                                        const itemDisc = Math.min(remainingDisc, p.regLineTotalPaisa);
                                        discMap.set(p.idx, itemDisc);
                                        remainingDisc -= itemDisc;
                                      }
                                    }

                                    const unpackedItems: OnlineOrderItem[] = preparedItems.map((p) => {
                                      const itemDisc = discMap.get(p.idx) || 0;

                                      const isTester = p.item.item_type === "TESTER" || 
                                        p.item.name.toLowerCase().includes("tester") || 
                                        p.item.name.toLowerCase().includes("sample");

                                      const sizeMlMatch = p.item.size_label ? p.item.size_label.match(/(\d+)\s*ml/i) : null;
                                      const parsedMl = sizeMlMatch ? parseInt(sizeMlMatch[1], 10) : undefined;

                                      return {
                                        name: `${p.item.name} (${off.title})`,
                                        item_type: p.item.item_type,
                                        product_id: p.item.product_id,
                                        attar_id: p.item.attar_id,
                                        quantity: p.q,
                                        size_ml: parsedMl,
                                        unit_price_paisa: p.regUnitPricePaisa,
                                        line_total_paisa: p.regLineTotalPaisa,
                                        discount_paisa: itemDisc,
                                        is_tester: isTester,
                                      };
                                    });

                                    setOrderItems([...orderItems, ...unpackedItems]);
                                  } else {
                                    const regularTotalPaisa = Math.round((off.regular_total || off.bundle_price) * 100);
                                    const bundlePricePaisa = Math.round(off.bundle_price * 100);
                                    const savingsPaisa = Math.max(0, regularTotalPaisa - bundlePricePaisa);
                                    const newItem: OnlineOrderItem = {
                                      name: `🎁 Offer: ${off.title}`,
                                      item_type: "OFFER",
                                      quantity: 1,
                                      unit_price_paisa: regularTotalPaisa,
                                      line_total_paisa: regularTotalPaisa,
                                      discount_paisa: savingsPaisa,
                                    };
                                    setOrderItems([...orderItems, newItem]);
                                  }
                                }}
                                className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10px] cursor-pointer"
                              >
                                + Add Bundle
                              </button>
                            </div>
                          </div>
                        ))
                    ))}
                </div>

                {/* Tester Dispensing Modal Dialog */}
                {selectedPerfumeForTester && (
                  <div className="p-3.5 bg-purple-500/10 border border-purple-500/30 rounded-xl space-y-3">
                    <div className="flex items-center justify-between border-b border-purple-200 dark:border-purple-800/60 pb-2">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-purple-900 dark:text-purple-200">
                        <FlaskConical className="w-4 h-4 text-purple-600" />
                        <span>Dispense Tester: {selectedPerfumeForTester.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedPerfumeForTester(null)}
                        className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                      >
                        ✕ Cancel
                      </button>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold mb-1 text-slate-700 dark:text-slate-300">
                        Select Volume (ml):
                      </label>
                      <div className="flex items-center gap-1.5">
                        {[1, 2, 3, 5, "CUSTOM"].map((preset) => (
                          <button
                            key={String(preset)}
                            type="button"
                            onClick={() => setTesterPresetMl(preset as any)}
                            className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                              testerPresetMl === preset
                                ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                                : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-purple-400"
                            }`}
                          >
                            {preset === "CUSTOM" ? "Custom" : `${preset}ml`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {testerPresetMl === "CUSTOM" && (
                      <div className="w-36">
                        <label className="block text-[11px] font-semibold mb-1 text-slate-700 dark:text-slate-300">
                          Custom ml:
                        </label>
                        <Input
                          type="number"
                          min="1"
                          value={customTesterMl}
                          onChange={(e) => setCustomTesterMl(parseInt(e.target.value) || 1)}
                          className="h-7 text-xs font-mono font-bold"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold mb-1 text-slate-700 dark:text-slate-300">
                          Quantity:
                        </label>
                        <Input
                          type="number"
                          min="1"
                          value={testerQty}
                          onChange={(e) => setTesterQty(parseInt(e.target.value) || 1)}
                          className="h-7 text-xs font-mono font-bold text-center"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold mb-1 text-slate-700 dark:text-slate-300">
                          Price (PKR, 0 = Free Complimentary):
                        </label>
                        <Input
                          type="number"
                          min="0"
                          value={testerPriceRupees}
                          onChange={(e) => setTesterPriceRupees(e.target.value)}
                          placeholder="0"
                          className="h-7 text-xs font-mono font-bold text-purple-600"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        type="button"
                        variant="primary"
                        onClick={() => {
                          const ml = testerPresetMl === "CUSTOM" ? customTesterMl : testerPresetMl;
                          const ratePaisa = Math.round(Math.max(0, parseFloat(testerPriceRupees) || 0) * 100);
                          const qty = Math.max(1, testerQty);
                          const newItem: OnlineOrderItem = {
                            product_id: selectedPerfumeForTester.product_id,
                            name: `${selectedPerfumeForTester.name} (Tester ${ml}ml)`,
                            item_type: "TESTER",
                            quantity: qty,
                            unit_price_paisa: ratePaisa,
                            line_total_paisa: ratePaisa * qty,
                            is_tester: true,
                          };
                          setOrderItems([...orderItems, newItem]);
                          setSelectedPerfumeForTester(null);
                        }}
                        className="text-xs bg-purple-600 hover:bg-purple-700 text-white font-bold cursor-pointer"
                      >
                        ✓ Add Tester to Order
                      </Button>
                    </div>
                  </div>
                )}

                {/* Selected Items Table */}
                {orderItems.length > 0 && (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-100 dark:bg-slate-900 text-slate-500 text-[10px]">
                        <tr>
                          <th className="p-2">Item</th>
                          <th className="p-2 text-center">Qty</th>
                          <th className="p-2 text-right">Unit Price</th>
                          <th className="p-2 text-right">Total</th>
                          <th className="p-2 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {displayedOrderItems.map((it, idx) => (
                          <tr key={idx}>
                            <td className="p-2 font-sans font-semibold">
                              <div>{it.name}</div>
                              {it.discount_paisa && it.discount_paisa > 0 ? (
                                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono font-normal block">
                                  Discount Allocated: -Rs. {formatRs(it.discount_paisa)}
                                </span>
                              ) : null}
                            </td>
                            <td className="p-2 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemQty(idx, it.quantity - 1)}
                                  className="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-800 font-bold cursor-pointer"
                                >
                                  -
                                </button>
                                <span>{it.quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemQty(idx, it.quantity + 1)}
                                  className="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-800 font-bold cursor-pointer"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="p-2 text-right">Rs. {formatRs(it.unit_price_paisa)}</td>
                            <td className="p-2 text-right font-bold text-emerald-600 dark:text-emerald-400">
                              <div>Rs. {formatRs(it.line_total_paisa)}</div>
                              {it.discount_paisa && it.discount_paisa > 0 ? (
                                <div className="text-[10px] text-slate-500 font-normal">
                                  Net: Rs. {formatRs(it.line_total_paisa - it.discount_paisa)}
                                </div>
                              ) : null}
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="text-rose-500 hover:text-rose-700 font-bold cursor-pointer"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Courier, Custodian & Financial Splits */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="space-y-3">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Courier Partner
                    </label>
                    <select
                      value={courierPartner}
                      onChange={(e) => setCourierPartner(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs font-semibold"
                    >
                      {COURIER_PARTNERS.map((cp) => (
                        <option key={cp} value={cp}>
                          {cp}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Tracking / Consignment ID (Optional)
                    </label>
                    <Input
                      placeholder="e.g. 1029384756"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Pending Cash Custodian
                    </label>
                    <select
                      value={custodian}
                      onChange={(e) => setCustodian(e.target.value as any)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs font-semibold"
                    >
                      <option value="COURIER">🚚 Courier COD (Pending with Rider/Courier)</option>
                      <option value="STAFF_HANDLER">👤 Online Staff Handler (Advance / Online Wallet)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Order Notes / Instructions
                    </label>
                    <Input
                      placeholder="e.g. Call before delivery, gift wrap"
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                    />
                  </div>
                </div>

                {/* Financial Summary Card */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between font-mono space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-sans">Gross Items Subtotal:</span>
                    <span className="font-bold">Rs. {formatRs(newOrderSubtotalPaisa)}</span>
                  </div>

                  {bundleDiscountPaisa > 0 && (
                    <div className="flex justify-between items-center text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-1 rounded-md">
                      <span className="font-sans font-semibold flex items-center gap-1">
                        🎁 Offer Deal Discount:
                      </span>
                      <span className="font-bold font-mono">-Rs. {formatRs(bundleDiscountPaisa)}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-sans">Delivery Charges:</span>
                    <div className="w-24">
                      <Input
                        type="number"
                        value={deliveryCharges}
                        onChange={(e) => setDeliveryCharges(e.target.value)}
                        className="h-7 text-xs text-right font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-sans">Special Discount:</span>
                    <div className="w-24">
                      <Input
                        type="number"
                        value={discountRupees}
                        onChange={(e) => setDiscountRupees(e.target.value)}
                        className="h-7 text-xs text-right font-mono text-rose-500"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {totalOrderDiscountPaisa > 0 && (
                    <div className="flex justify-between items-center text-xs text-rose-600 dark:text-rose-400 font-semibold">
                      <span className="font-sans">Total Discount Granted:</span>
                      <span className="font-mono font-bold">-Rs. {formatRs(totalOrderDiscountPaisa)}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-sm font-bold border-t border-slate-200 dark:border-slate-800 pt-2">
                    <span className="font-sans">Total Order Value:</span>
                    <span className="text-emerald-600 dark:text-emerald-400">Rs. {formatRs(newOrderTotalPaisa)}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs pt-1">
                    <span className="text-slate-500 font-sans">Advance Received:</span>
                    <div className="w-28">
                      <Input
                        type="number"
                        value={advancePaidRupees}
                        onChange={(e) => setAdvancePaidRupees(e.target.value)}
                        className="h-7 text-xs text-right font-mono font-bold text-emerald-600 dark:text-emerald-400"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Cash on Delivery Highlight */}
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 font-sans">
                        Pending Cash on Delivery (COD)
                      </div>
                      <div className="text-xs text-slate-500 font-sans">Payable by customer to rider</div>
                    </div>
                    <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
                      Rs. {formatRs(codBalancePaisa)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsNewOrderModalOpen(false)}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={loading || orderItems.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                >
                  Confirm & Dispatch Order
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: COLLECT PAYMENT */}
      {/* ========================================================================= */}
      {isCollectModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 shrink-0">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-500" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Collect Payment for {selectedOrder.order_number}
                </h2>
              </div>
              <button
                onClick={() => setIsCollectModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteCollectPayment} className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Total Order Value:</span>
                  <span className="font-bold">Rs. {formatRs(selectedOrder.total_amount_paisa)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Advance Already Paid:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    Rs. {formatRs(selectedOrder.advance_paid_paisa)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t border-amber-500/20 pt-1 text-amber-700 dark:text-amber-400">
                  <span className="font-sans">Pending Balance to Collect:</span>
                  <span>Rs. {formatRs(selectedOrder.cod_balance_paisa)}</span>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Collection Amount (PKR) *
                </label>
                <Input
                  type="number"
                  value={collectAmountRupees}
                  onChange={(e) => setCollectAmountRupees(e.target.value)}
                  required
                  className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Payment Method *
                </label>
                <select
                  value={collectMethod}
                  onChange={(e) => setCollectMethod(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs font-semibold"
                >
                  <option value="CASH">💵 Cash (Disbursed by Courier / Received in Hand)</option>
                  <option value="EASYPAISA">📱 EasyPaisa</option>
                  <option value="JAZZCASH">📱 JazzCash</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Courier Cheque / Slip / TID Reference (Optional)
                </label>
                <Input
                  placeholder="e.g. TCS-DISB-9981 or TID: 98127391"
                  value={collectReference}
                  onChange={(e) => setCollectReference(e.target.value)}
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Notes
                </label>
                <Input
                  placeholder="e.g. Received weekly courier COD settlement"
                  value={collectNotes}
                  onChange={(e) => setCollectNotes(e.target.value)}
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCollectModalOpen(false)}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                >
                  Confirm Collection
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: MARK RETURN / RTO & CANCELLATION REFUND */}
      {/* ========================================================================= */}
      {isReturnModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-rose-500/10 shrink-0">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <RotateCcw className="w-5 h-5" />
                <h2 className="text-sm font-bold">
                  Mark Order Return / RTO ({selectedOrder.order_number})
                </h2>
              </div>
              <button
                onClick={() => setIsReturnModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteReturn} className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-700 dark:text-rose-300">
                <p className="font-semibold mb-1">⚠️ Return & Restock Action:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                  <li>Selected returned items will be restocked back into inventory.</li>
                  <li>Order status will be updated (Full Return or Partial Return).</li>
                </ul>
              </div>

              {/* Itemized Selection for Partial or Full Return */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-950/40">
                <div className="bg-slate-100 dark:bg-slate-800/80 px-3 py-2 flex items-center justify-between font-bold text-[11px] text-slate-700 dark:text-slate-300">
                  <span>Select Items to Return & Restock:</span>
                  <span className="font-mono text-rose-600 dark:text-rose-400">
                    {returnItemSelections.filter((i) => i.selected).length} of {returnItemSelections.length} items selected
                  </span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-48 overflow-y-auto p-1.5 space-y-1">
                  {returnItemSelections.map((item, idx) => {
                    const isAlreadyFullyReturned = item.maxQty === 0;
                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
                          isAlreadyFullyReturned
                            ? "bg-slate-100/50 dark:bg-slate-900/30 border-slate-200/50 dark:border-slate-800/50 opacity-60"
                            : item.selected
                            ? "bg-white dark:bg-slate-900 border-rose-300/60 dark:border-rose-900/40 shadow-2xs"
                            : "bg-slate-50 dark:bg-slate-900/30 border-transparent opacity-60"
                        }`}
                      >
                        <label className="flex items-center gap-2 cursor-pointer select-none flex-1">
                          <input
                            type="checkbox"
                            checked={item.selected && !isAlreadyFullyReturned}
                            disabled={isAlreadyFullyReturned}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setReturnItemSelections((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, selected: checked } : it))
                              );
                            }}
                            className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                          />
                          <div>
                            <div className={`font-bold text-slate-800 dark:text-slate-200 ${isAlreadyFullyReturned ? "line-through text-slate-400" : ""}`}>
                              {item.name}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              Ordered: {item.totalOrderedQty || item.maxQty} units
                              {(item.alreadyReturnedQty || 0) > 0 ? ` • Already Returned: ${item.alreadyReturnedQty} units` : ""}
                              • Unit: Rs. {formatRs(item.unitPricePaisa)}
                              {item.allocatedDiscountPaisa && item.allocatedDiscountPaisa > 0 ? (
                                <span className="ml-1.5 px-1.5 py-0.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold rounded border border-rose-500/20">
                                  -Rs. {formatRs(item.allocatedDiscountPaisa)} disc applied
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </label>

                        {!isAlreadyFullyReturned && item.selected ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-slate-500">Return Qty:</span>
                            <input
                              type="number"
                              min="1"
                              max={item.maxQty}
                              value={item.returnQty}
                              onChange={(e) => {
                                const val = Math.max(1, Math.min(item.maxQty, parseInt(e.target.value) || 1));
                                setReturnItemSelections((prev) =>
                                  prev.map((it, i) => (i === idx ? { ...it, returnQty: val } : it))
                                );
                              }}
                              className="w-14 h-7 text-center font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
                            />
                            <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 w-20 text-right">
                              Rs. {formatRs(item.returnQty * item.unitPricePaisa)}
                            </span>
                          </div>
                        ) : isAlreadyFullyReturned ? (
                          <span className="text-[10px] font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded">
                            ↩ Already Returned
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Optional Delivery Charges Return Toggle & Advance Refund Settlement Options */}
              {(() => {
                const selectedItems = returnItemSelections.filter((it) => it.selected && it.returnQty > 0);
                const returnedValPaisa = selectedItems.reduce((sum, s) => sum + s.returnQty * s.unitPricePaisa, 0);
                const deliveryChargesPaisa = Math.max(0, selectedOrder.delivery_charges_paisa || 0);
                const deliveryReturnPaisa = includeDeliveryInReturn ? deliveryChargesPaisa : 0;
                const totalReturnValPaisa = returnedValPaisa + deliveryReturnPaisa;
                const netPaidSoFar = Math.max(0, (selectedOrder.advance_paid_paisa || 0) - (selectedOrder.refund_amount_paisa || 0));
                const maxRefundEligible = Math.min(netPaidSoFar, totalReturnValPaisa);
                const deductionInputPaisa = Math.max(0, Math.round((parseFloat(refundDeductionRupees) || 0) * 100));
                const deductionCut = Math.min(maxRefundEligible, deductionInputPaisa);
                const calculatedRefundPaisa =
                  refundMode === "FULL"
                    ? maxRefundEligible
                    : refundMode === "PARTIAL"
                    ? Math.max(0, maxRefundEligible - deductionCut)
                    : 0;

                return (
                  <>
                    {deliveryChargesPaisa > 0 && (
                      <label className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 cursor-pointer select-none transition-colors">
                        <input
                          type="checkbox"
                          checked={includeDeliveryInReturn}
                          onChange={(e) => setIncludeDeliveryInReturn(e.target.checked)}
                          className="mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer shrink-0"
                        />
                        <div className="flex-1 text-xs">
                          <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between gap-2">
                            <span>Also Return / Refund Delivery Charges</span>
                            <span className="font-mono text-amber-700 dark:text-amber-400">
                              +Rs. {formatRs(deliveryChargesPaisa)}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                            {includeDeliveryInReturn
                              ? `Delivery fee (Rs. ${formatRs(deliveryChargesPaisa)}) IS included in return/refund (Total return: Rs. ${formatRs(totalReturnValPaisa)}).`
                              : `Only products (Rs. ${formatRs(returnedValPaisa)}) are returned; Rs. ${formatRs(deliveryChargesPaisa)} courier delivery fee is NOT returned.`}
                          </p>
                        </div>
                      </label>
                    )}

                    {netPaidSoFar <= 0 ? (
                      <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400">
                        ℹ️ No customer advance paid / payment recorded. Return value (Rs. {formatRs(totalReturnValPaisa)}
                        {includeDeliveryInReturn && deliveryChargesPaisa > 0 ? ` incl. Rs. ${formatRs(deliveryChargesPaisa)} delivery` : ""}) will reduce pending COD receivable. No cash refund required.
                      </div>
                    ) : (
                      <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 font-sans">
                        <div className="grid grid-cols-2 gap-2 text-xs border-b border-slate-200 dark:border-slate-800/80 pb-2">
                          <div>
                            <span className="text-slate-500 block text-[10px]">Net Collected from Customer:</span>
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              Rs. {formatRs(netPaidSoFar)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">
                              Selected Return Value {includeDeliveryInReturn && deliveryChargesPaisa > 0 ? "(+ Delivery)" : "(Products Only)"}:
                            </span>
                            <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                              Rs. {formatRs(totalReturnValPaisa)}
                            </span>
                          </div>
                        </div>

                        <div>
                          <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                            Select Refund Settlement Option:
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setRefundMode("FULL");
                                setRefundDeductionRupees("0");
                              }}
                              className={`p-2 rounded-lg border text-center text-xs font-bold transition-all cursor-pointer ${
                                refundMode === "FULL"
                                  ? "bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500"
                                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 hover:border-slate-400"
                              }`}
                            >
                              Full Refund
                              <div className="text-[10px] font-normal text-slate-500">Rs. {formatRs(maxRefundEligible)}</div>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setRefundMode("PARTIAL");
                                setRefundDeductionRupees("200");
                              }}
                              className={`p-2 rounded-lg border text-center text-xs font-bold transition-all cursor-pointer ${
                                refundMode === "PARTIAL"
                                  ? "bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500"
                                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 hover:border-slate-400"
                              }`}
                            >
                              Partial Refund
                              <div className="text-[10px] font-normal text-slate-500">Deduct courier/cut</div>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setRefundMode("NONE");
                                setRefundDeductionRupees((maxRefundEligible / 100).toString());
                              }}
                              className={`p-2 rounded-lg border text-center text-xs font-bold transition-all cursor-pointer ${
                                refundMode === "NONE"
                                  ? "bg-rose-500/15 border-rose-500 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500"
                                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 hover:border-slate-400"
                              }`}
                            >
                              No Refund
                              <div className="text-[10px] font-normal text-slate-500">Retain advance</div>
                            </button>
                          </div>
                        </div>

                        {refundMode === "PARTIAL" && (
                          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-amber-800 dark:text-amber-300">
                                Deduction Cut (Courier/Handling PKR):
                              </span>
                              <div className="w-28">
                                <Input
                                  type="number"
                                  min={0}
                                  max={maxRefundEligible / 100}
                                  value={refundDeductionRupees}
                                  onChange={(e) => setRefundDeductionRupees(e.target.value)}
                                  className="h-7 text-xs text-right font-mono font-bold text-rose-600"
                                />
                              </div>
                            </div>
                            <div className="flex justify-between items-center text-xs font-mono font-bold pt-1 border-t border-amber-500/20">
                              <span>Net Refund Amount to Customer:</span>
                              <span className="text-emerald-600 dark:text-emerald-400">
                                Rs. {formatRs(calculatedRefundPaisa)}
                              </span>
                            </div>
                          </div>
                        )}

                        {refundMode !== "NONE" && calculatedRefundPaisa > 0 && (
                          <div>
                            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                              Refund Settlement Channel:
                            </label>
                            <select
                              value={refundPaymentMethod}
                              onChange={(e) => setRefundPaymentMethod(e.target.value)}
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs font-semibold"
                            >
                              <option value="CASH">💵 Cash</option>
                              <option value="EASYPAISA">📱 EasyPaisa</option>
                              <option value="JAZZCASH">📱 JazzCash</option>
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Reason for Return / RTO *
                </label>
                <Input
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsReturnModalOpen(false)}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  disabled={loading}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
                >
                  Confirm Return & Restock
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: UPDATE DELIVERY STATUS */}
      {/* ========================================================================= */}
      {isStatusModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 shrink-0">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-500" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Update Logistics Status ({selectedOrder.order_number})
                </h2>
              </div>
              <button
                onClick={() => setIsStatusModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteStatusUpdate} className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Delivery Status
                </label>
                <select
                  value={updateDeliveryStatus}
                  onChange={(e) => setUpdateDeliveryStatus(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs font-semibold"
                >
                  <option value="BOOKED">BOOKED (Label Created, Awaiting Pickup)</option>
                  <option value="DISPATCHED">DISPATCHED (Handed to Courier / In Transit)</option>
                  <option value="DELIVERED">DELIVERED (Successfully Handed to Customer)</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Courier Partner
                </label>
                <select
                  value={updateCourier}
                  onChange={(e) => setUpdateCourier(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs font-semibold"
                >
                  {COURIER_PARTNERS.map((cp) => (
                    <option key={cp} value={cp}>
                      {cp}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Tracking Number
                </label>
                <Input
                  value={updateTracking}
                  onChange={(e) => setUpdateTracking(e.target.value)}
                  placeholder="e.g. 1029384756"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsStatusModalOpen(false)}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
                >
                  Save Status
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODAL: ATTAR PORTION & CUSTOM RATE FOR ONLINE ORDER */}
      {/* ========================================================================= */}
      {selectedAttarForOnline && (() => {
        const a = selectedAttarForOnline;
        let unitPricePaisa = 0;
        let unitLabel = "";
        let unitVol = "";

        if (attarPortionUnit === "TOLA") {
          unitPricePaisa = a.selling_price_per_tola_paisa;
          unitLabel = "1 Tola";
          unitVol = "11.66 grams (~11.1 ml)";
        } else if (attarPortionUnit === "HALF_TOLA") {
          unitPricePaisa = a.selling_price_half_tola_paisa;
          unitLabel = "1/2 Tola";
          unitVol = "5.83 grams (~5.5 ml)";
        } else if (attarPortionUnit === "QUARTER_TOLA") {
          unitPricePaisa = a.selling_price_quarter_tola_paisa;
          unitLabel = "1/4 Tola";
          unitVol = "2.92 grams (~2.8 ml)";
        } else if (attarPortionUnit === "12ML") {
          unitPricePaisa = Math.round(a.selling_price_per_ml_paisa * 12);
          unitLabel = "12 ml";
          unitVol = "12.0 ml";
        } else if (attarPortionUnit === "6ML") {
          unitPricePaisa = Math.round(a.selling_price_per_ml_paisa * 6);
          unitLabel = "6 ml";
          unitVol = "6.0 ml";
        } else if (attarPortionUnit === "3ML") {
          unitPricePaisa = Math.round(a.selling_price_per_ml_paisa * 3);
          unitLabel = "3 ml";
          unitVol = "3.0 ml";
        } else if (attarPortionUnit === "CUSTOM_TOLA") {
          const tola = attarCustomTola || 1;
          unitPricePaisa = Math.round(a.selling_price_per_tola_paisa * tola);
          unitLabel = `${tola} Tola`;
          unitVol = `${(tola * 11.66).toFixed(2)} grams`;
        } else if (attarPortionUnit === "CUSTOM_ML") {
          const ml = attarCustomMl || 1;
          unitPricePaisa = Math.round(a.selling_price_per_ml_paisa * ml);
          unitLabel = `${ml} ml`;
          unitVol = `${ml}.0 ml`;
        }

        const effectiveUnitPricePaisa =
          attarCustomRateRupees.trim() !== "" &&
          !isNaN(Number(attarCustomRateRupees)) &&
          Number(attarCustomRateRupees) > 0
            ? Math.round(Number(attarCustomRateRupees) * 100)
            : unitPricePaisa;

        return (
          <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    💧 Attar Portion & Custom Rate: {a.name}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    SKU: {a.sku} • Select portion / bottle size & adjust custom price
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAttarForOnline(null)}
                  className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Portion Selector Grid */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Select Dispensing Portion / Size:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "TOLA" as const, label: "1 Tola (11.66g)", price: Math.round(a.selling_price_per_tola_paisa / 100) },
                    { id: "HALF_TOLA" as const, label: "1/2 Tola (5.83g)", price: Math.round(a.selling_price_half_tola_paisa / 100) },
                    { id: "QUARTER_TOLA" as const, label: "1/4 Tola (2.92g)", price: Math.round(a.selling_price_quarter_tola_paisa / 100) },
                    { id: "12ML" as const, label: "12 ml", price: Math.round((a.selling_price_per_ml_paisa * 12) / 100) },
                    { id: "6ML" as const, label: "6 ml", price: Math.round((a.selling_price_per_ml_paisa * 6) / 100) },
                    { id: "3ML" as const, label: "3 ml", price: Math.round((a.selling_price_per_ml_paisa * 3) / 100) },
                    { id: "CUSTOM_TOLA" as const, label: "Custom Tola", price: Math.round((a.selling_price_per_tola_paisa * (attarCustomTola || 1)) / 100) },
                    { id: "CUSTOM_ML" as const, label: "Custom ML", price: Math.round((a.selling_price_per_ml_paisa * (attarCustomMl || 1)) / 100) },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setAttarPortionUnit(opt.id);
                        setAttarCustomRateRupees("");
                      }}
                      className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                        attarPortionUnit === opt.id
                          ? "border-emerald-500 bg-emerald-500/15 ring-1 ring-emerald-500/50 shadow-xs"
                          : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 hover:border-emerald-500/40"
                      }`}
                    >
                      <div className="text-[11px] font-bold text-slate-900 dark:text-slate-100">{opt.label}</div>
                      <div className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        Rs. {opt.price.toLocaleString()}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Tola Input */}
              {attarPortionUnit === "CUSTOM_TOLA" && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Enter Custom Tolas (e.g. 0.75, 1.5, 2):
                    </label>
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono">
                      Weight: {((attarCustomTola || 1) * 11.66).toFixed(2)}g
                    </span>
                  </div>
                  <Input
                    type="number"
                    min={0.05}
                    step="0.05"
                    value={attarCustomTola || ""}
                    onChange={(e) => {
                      setAttarCustomTola(parseFloat(e.target.value) || 0);
                      setAttarCustomRateRupees("");
                    }}
                    placeholder="1.0"
                    className="h-8 font-mono font-bold"
                  />
                </div>
              )}

              {/* Custom ML Input */}
              {attarPortionUnit === "CUSTOM_ML" && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Enter Custom Milliliters (ml):
                    </label>
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono">
                      Portion: {attarCustomMl || 1} ml
                    </span>
                  </div>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={attarCustomMl || ""}
                    onChange={(e) => {
                      setAttarCustomMl(parseInt(e.target.value) || 0);
                      setAttarCustomRateRupees("");
                    }}
                    placeholder="10"
                    className="h-8 font-mono font-bold"
                  />
                </div>
              )}

              {/* Custom Selling Rate */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>Custom Selling Rate per Portion (PKR):</span>
                  <span className="text-[11px] text-emerald-600 font-mono">
                    Standard: Rs. {Math.round(unitPricePaisa / 100).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rs.</span>
                    <Input
                      type="number"
                      min={1}
                      value={attarCustomRateRupees}
                      onChange={(e) => setAttarCustomRateRupees(e.target.value)}
                      placeholder={String(Math.round(unitPricePaisa / 100))}
                      className="pl-9 h-9 font-mono font-bold text-sm"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAttarCustomRateRupees(Math.round(unitPricePaisa / 100).toString())}
                    className="text-xs whitespace-nowrap active:scale-95"
                  >
                    Reset Standard
                  </Button>
                </div>
              </div>

              {/* Quantity & Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Bottles:</span>
                  <button
                    type="button"
                    onClick={() => setAttarPortionQty(Math.max(1, attarPortionQty - 1))}
                    className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-800 font-bold flex items-center justify-center cursor-pointer"
                  >
                    -
                  </button>
                  <span className="font-mono font-bold text-sm w-6 text-center">{attarPortionQty}</span>
                  <button
                    type="button"
                    onClick={() => setAttarPortionQty(attarPortionQty + 1)}
                    className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-800 font-bold flex items-center justify-center cursor-pointer"
                  >
                    +
                  </button>
                  <span className="text-[11px] text-slate-400 font-mono ml-1">
                    ({unitLabel} • {unitVol})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedAttarForOnline(null)}
                    className="cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleConfirmAddAttar}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                  >
                    Add to Order • Rs. {((effectiveUnitPricePaisa * attarPortionQty) / 100).toLocaleString()}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}


    </div>
  );
};
