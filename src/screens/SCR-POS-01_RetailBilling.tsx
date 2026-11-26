import React, { useState, useEffect, useRef, useCallback } from "react";
import { FinishedProduct, SalesPaymentTender, RecentSaleSummary, AttarProduct } from "@/types/database";
import { SystemUser, WorkstationStatus } from "@/types/system";
import { usePOSStore } from "@/store/pos-store";
import {
  getProducts,
  getSalespersons,
  searchProductByBarcode,
  createSalesInvoice,
  getRecentSales,
  getAttars,
  getAllUsers,
} from "@/lib/tauri-bridge";
import { formatPaisaToRupees } from "@/lib/formatters";
import { formatLocalDateTime, isDateInPKTPeriod } from "@/lib/date-utils";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dialog } from "@/components/ui/Dialog";
import { PromotionalOffer, OfferItemSpec } from "@/types/offers";
import {
  loadAllOffers,
  persistOffer,
  removeOffer,
  formatTimeRemaining,
} from "@/lib/offer-service";
import {
  Search,
  Barcode,
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Banknote,
  ShieldCheck,
  CheckCircle2,
  Printer,
  UserCheck,
  Phone,
  RotateCcw,
  History,
  Gift,
  FlaskConical,
  Droplets,
  Smartphone,
  Zap,
  Calendar,
  Clock,
  Edit2,
  Tag,
  Download,
  FileText,
  Receipt,
} from "lucide-react";
import { exportSalesHistoryToCSV } from "@/lib/export-utils";

interface RetailBillingProps {
  currentUser: SystemUser | null;
  status: WorkstationStatus;
  onSwitchUser?: (user: SystemUser) => void;
}

export const RetailBilling: React.FC<RetailBillingProps> = ({ currentUser, status, onSwitchUser: _onSwitchUser }) => {
  const {
    cart,
    customerPhone,
    salespersonId,
    specialDiscountPaisa,
    selectedCategory,
    searchQuery,
    isPaymentModalOpen,
    addToCart,
    toggleTester: _toggleTester,
    setTesterItem,
    addPromotionalOfferToCart,
    addAttarToCart,
    updateQuantity,
    updateUnitPrice,
    removeFromCart,
    clearCart,
    setCustomerPhone,
    setSalespersonId,
    setSpecialDiscount,
    setSelectedCategory,
    setSearchQuery,
    setCompletedInvoice,
    setIsPaymentModalOpen,
    getTotals,
  } = usePOSStore();

  const [products, setProducts] = useState<FinishedProduct[]>([]);
  const [attars, setAttars] = useState<AttarProduct[]>([]);
  const [salespersons, setSalespersons] = useState<{ salesperson_id: string; full_name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"CASH" | "EASYPAISA" | "JAZZCASH">("CASH");
  const [digitalWalletTid, setDigitalWalletTid] = useState<string>("");
  const [autoPrintReceipt, setAutoPrintReceipt] = useState<boolean>(true);
  const [tenderedCashRupees, setTenderedCashRupees] = useState<string>("");
  const [isQuickCashModalOpen, setIsQuickCashModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [barcodeBuffer, setBarcodeBuffer] = useState("");
  const [lastBarcodeScanTime, setLastBarcodeScanTime] = useState(0);

  // Attar Decanting Modal State
  const [selectedAttarForDecant, setSelectedAttarForDecant] = useState<AttarProduct | null>(null);
  const [decantUnit, setDecantUnit] = useState<"TOLA" | "HALF_TOLA" | "QUARTER_TOLA" | "12ML" | "6ML" | "3ML" | "CUSTOM_TOLA" | "CUSTOM_ML">("TOLA");
  const [decantQty, setDecantQty] = useState<number>(1);
  const [customDecantMl, setCustomDecantMl] = useState<number>(10);
  const [customDecantTola, setCustomDecantTola] = useState<number>(1);
  const [decantCustomRateRupees, setDecantCustomRateRupees] = useState<string>("");

  // Tester Dispensing Modal State
  const [selectedCartItemForTester, setSelectedCartItemForTester] = useState<import("@/types/database").CartItem | null>(null);
  const [testerPresetMl, setTesterPresetMl] = useState<1 | 2 | 3 | 5 | "CUSTOM">(1);
  const [customTesterMl, setCustomTesterMl] = useState<number>(1);
  const [testerPriceRupees, setTesterPriceRupees] = useState<string>("0");

  // Sales History Drawer & Inspection State
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [recentSales, setRecentSales] = useState<RecentSaleSummary[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isOffersModalOpen, setIsOffersModalOpen] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [historyPage, setHistoryPage] = useState<number>(1);
  const [historyPeriod, setHistoryPeriod] = useState<"ALL" | "TODAY" | "WEEK" | "MONTH" | "YEAR">("ALL");
  const [historyExportFeedback, setHistoryExportFeedback] = useState<string | null>(null);
  const [lastCompletedInvoice, setLastCompletedInvoice] = useState<import("@/types/database").SalesInvoiceResult | null>(() => {
    try {
      const cached = localStorage.getItem("pos_last_completed_invoice");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const handleReprintLastReceipt = () => {
    if (lastCompletedInvoice) {
      printReceipt(lastCompletedInvoice);
    } else {
      alert("⚠️ No previous receipt cached in memory. You can print any previous customer receipt from Sales History [F2].");
    }
  };

  // Promotional Offers Management State
  const [offersList, setOffersList] = useState<PromotionalOffer[]>([]);
  const [isOffersLoading, setIsOffersLoading] = useState(false);
  const [isOfferEditorOpen, setIsOfferEditorOpen] = useState(false);
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);

  // Form state for creating / editing offer
  const [offerFormTitle, setOfferFormTitle] = useState("");
  const [offerFormTag, setOfferFormTag] = useState("3-DAY FLASH SALE");
  const [offerFormDesc, setOfferFormDesc] = useState("");
  const [offerFormEndDate, setOfferFormEndDate] = useState<string>(() => {
    return new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  });
  const [offerFormBundlePrice, setOfferFormBundlePrice] = useState<string>("2300");
  const [offerFormItems, setOfferFormItems] = useState<OfferItemSpec[]>([]);

  // Item selector inside offer form
  const [pickerType, setPickerType] = useState<"ATTAR" | "PERFUME" | "TESTER">("ATTAR");
  const [pickerSelectedAttarId, setPickerSelectedAttarId] = useState<string>("");
  const [pickerAttarBottleSize, setPickerAttarBottleSize] = useState<string>("6ml");
  const [pickerSelectedPerfumeId, setPickerSelectedPerfumeId] = useState<string>("");
  const [pickerTesterMl, setPickerTesterMl] = useState<number>(1);
  const [pickerQuantity, setPickerQuantity] = useState<number>(1);
  const [pickerPriceOverride, setPickerPriceOverride] = useState<string>("");

  const isSuperAdminOrManager =
    currentUser?.role === "SUPER_ADMIN" ||
    (currentUser?.role as string) === "ADMIN" ||
    currentUser?.role === "SHOP_MANAGER";

  const refreshOffers = useCallback(async () => {
    setIsOffersLoading(true);
    try {
      const list = await loadAllOffers();
      setOffersList(list);
    } catch (e) {
      console.error("Failed to load offers:", e);
    } finally {
      setIsOffersLoading(false);
    }
  }, []);

  const handleOpenCreateOffer = () => {
    setEditingOfferId(null);
    setOfferFormTitle("");
    setOfferFormTag("3-DAY FLASH SALE");
    setOfferFormDesc("");
    setOfferFormEndDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16));
    setOfferFormBundlePrice("");
    setOfferFormItems([]);
    if (attars.length > 0) setPickerSelectedAttarId(attars[0].attar_id);
    if (products.length > 0) setPickerSelectedPerfumeId(products[0].product_id);
    setPickerPriceOverride("");
    setPickerQuantity(1);
    setIsOfferEditorOpen(true);
  };

  const handleOpenEditOffer = (offer: PromotionalOffer) => {
    setEditingOfferId(offer.offer_id);
    setOfferFormTitle(offer.title);
    setOfferFormTag(offer.tag);
    setOfferFormDesc(offer.description || "");
    const dateStr = offer.end_date
      ? new Date(offer.end_date).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16);
    setOfferFormEndDate(dateStr);
    setOfferFormBundlePrice(offer.bundle_price.toString());
    setOfferFormItems([...offer.items]);
    if (attars.length > 0) setPickerSelectedAttarId(attars[0].attar_id);
    if (products.length > 0) setPickerSelectedPerfumeId(products[0].product_id);
    setPickerPriceOverride("");
    setPickerQuantity(1);
    setIsOfferEditorOpen(true);
  };

  const handleSetExpiryDays = (days: number) => {
    const futureDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    setOfferFormEndDate(futureDate.toISOString().slice(0, 16));
  };

  const handleAddItemToBundle = () => {
    if (pickerType === "ATTAR") {
      const selectedAttar = attars.find((a) => a.attar_id === pickerSelectedAttarId) || attars[0];
      if (!selectedAttar) {
        alert("Please register at least one attar oil first in the Attar catalog.");
        return;
      }
      let defaultPrice = 1000;
      let defaultCost = 450;
      if (pickerAttarBottleSize === "3ml") {
        defaultPrice = Math.round(
          (selectedAttar.selling_price_quarter_tola_paisa || selectedAttar.selling_price_per_tola_paisa * 0.25) / 100
        );
        defaultCost = Math.round(
          (selectedAttar.cost_per_quarter_tola_paisa || selectedAttar.cost_per_tola_paisa * 0.25) / 100
        );
      } else if (pickerAttarBottleSize === "6ml") {
        defaultPrice = Math.round(
          (selectedAttar.selling_price_half_tola_paisa || selectedAttar.selling_price_per_tola_paisa * 0.5) / 100
        );
        defaultCost = Math.round(
          (selectedAttar.cost_per_half_tola_paisa || selectedAttar.cost_per_tola_paisa * 0.5) / 100
        );
      } else {
        defaultPrice = Math.round(selectedAttar.selling_price_per_tola_paisa / 100);
        defaultCost = Math.round(selectedAttar.cost_per_tola_paisa / 100);
      }

      const unitPrice = pickerPriceOverride.trim() ? parseFloat(pickerPriceOverride) || defaultPrice : defaultPrice;

      const newItem: OfferItemSpec = {
        item_type: "ATTAR",
        attar_id: selectedAttar.attar_id,
        product_id: selectedAttar.attar_id,
        name: selectedAttar.name,
        size_label: pickerAttarBottleSize,
        quantity: Math.max(1, pickerQuantity),
        unit_regular_price: unitPrice,
        unit_cost_price: defaultCost,
      };

      setOfferFormItems((prev) => [...prev, newItem]);
      setPickerPriceOverride("");
      setPickerQuantity(1);
    } else if (pickerType === "TESTER") {
      const selectedProd = products.find((p) => p.product_id === pickerSelectedPerfumeId) || products[0];
      if (!selectedProd) {
        alert("Please register at least one finished perfume first in the Perfume catalog to create a tester offer.");
        return;
      }
      const testerMl = pickerTesterMl || 1;
      const unitPrice = pickerPriceOverride.trim() ? Math.max(0, parseFloat(pickerPriceOverride) || 0) : 0;

      const newItem: OfferItemSpec = {
        item_type: "TESTER",
        product_id: selectedProd.product_id,
        name: `${selectedProd.name} — Tester`,
        size_label: `${testerMl}ml Sample`,
        quantity: Math.max(1, pickerQuantity),
        unit_regular_price: unitPrice,
        unit_cost_price: 0,
      };

      setOfferFormItems((prev) => [...prev, newItem]);
      setPickerPriceOverride("");
      setPickerQuantity(1);
    } else {
      const selectedProd = products.find((p) => p.product_id === pickerSelectedPerfumeId) || products[0];
      if (!selectedProd) {
        alert("Please register at least one finished perfume first in the Perfume catalog.");
        return;
      }
      if (selectedProd.current_stock_units <= 0) {
        alert(`Cannot add '${selectedProd.name}' to offer bundle: stock is 0 (Out of stock). Only in-stock perfumes can be added to promotional bundles.`);
        return;
      }
      if (pickerQuantity > selectedProd.current_stock_units) {
        alert(`Cannot add ${pickerQuantity} units of '${selectedProd.name}': only ${selectedProd.current_stock_units} units available in inventory stock.`);
        return;
      }
      const defaultPrice = Math.round(selectedProd.retail_price_paisa / 100);
      const defaultCost = Math.round((selectedProd.latest_batch_cost_paisa || (selectedProd as any).unit_cost_paisa || 0) / 100);
      const unitPrice = pickerPriceOverride.trim() ? parseFloat(pickerPriceOverride) || defaultPrice : defaultPrice;

      const newItem: OfferItemSpec = {
        item_type: "PERFUME",
        product_id: selectedProd.product_id,
        name: selectedProd.name,
        size_label: `${selectedProd.size_ml}ml`,
        quantity: Math.max(1, pickerQuantity),
        unit_regular_price: unitPrice,
        unit_cost_price: defaultCost,
      };

      setOfferFormItems((prev) => [...prev, newItem]);
      setPickerPriceOverride("");
      setPickerQuantity(1);
    }
  };

  const handleRemoveItemFromBundle = (index: number) => {
    setOfferFormItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveOffer = async () => {
    if (!offerFormTitle.trim()) {
      alert("Please enter a title for the offer bundle.");
      return;
    }
    if (offerFormItems.length === 0) {
      alert("Please add at least one product (attar or perfume) to this bundle.");
      return;
    }
    const dealPrice = parseFloat(offerFormBundlePrice);
    if (isNaN(dealPrice) || dealPrice <= 0) {
      alert("Please enter a valid deal / bundle price in Rupees.");
      return;
    }

    const regularTotal = offerFormItems.reduce((acc, it) => acc + it.unit_regular_price * it.quantity, 0);
    const totalCost = offerFormItems.reduce((acc, it) => acc + (it.unit_cost_price || 0) * it.quantity, 0);
    const savings = Math.max(0, regularTotal - dealPrice);
    const discountPercent = regularTotal > 0 ? Math.round((savings / regularTotal) * 100) : 0;

    const offerId = editingOfferId || `OFFER-${Date.now()}`;
    const newOffer: PromotionalOffer = {
      offer_id: offerId,
      title: offerFormTitle.trim(),
      tag: offerFormTag.trim() || "SPECIAL OFFER",
      description:
        offerFormDesc.trim() || `${offerFormItems.length} assorted fragrance components festive package.`,
      items: offerFormItems,
      regular_total: regularTotal,
      bundle_price: dealPrice,
      savings: savings,
      discount_percent: discountPercent,
      total_cost: totalCost,
      start_date: new Date().toISOString(),
      end_date: new Date(offerFormEndDate).toISOString(),
      is_active: true,
      created_at: new Date().toISOString(),
    };

    await persistOffer(newOffer);
    await refreshOffers();
    setIsOfferEditorOpen(false);
  };

  const handleDeleteOffer = async (offerId: string) => {
    if (confirm("Are you sure you want to permanently delete this promotional offer?")) {
      await removeOffer(offerId);
      await refreshOffers();
    }
  };

  // Active Cashier / Counter Operator State
  const [cashierUsers, setCashierUsers] = useState<SystemUser[]>([]);
  const [activeCashierId, setActiveCashierId] = useState<string>(() => {
    return localStorage.getItem("pos_active_cashier_id") || "usr_cashier1";
  });

  const handleSwitchCashier = (userId: string) => {
    setActiveCashierId(userId);
    localStorage.setItem("pos_active_cashier_id", userId);
  };

  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleOpenHistory = useCallback(async () => {
    setIsHistoryModalOpen(true);
    setHistoryPage(1);
    setIsHistoryLoading(true);
    try {
      const list = await getRecentSales(1000);
      setRecentSales(list);
    } catch (err) {
      console.error("Failed to load recent sales:", err);
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  // Load products, salespersons & attars
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [prods, sps, atts, allUsers] = await Promise.all([
        getProducts(),
        getSalespersons(),
        getAttars(),
        getAllUsers(),
      ]);
      setProducts(prods);
      setSalespersons(sps);
      setAttars(atts);

      const operators = allUsers.filter(
        (u) => u.is_active && u.role !== "OWNER"
      );
      setCashierUsers(operators);

      const savedCashierId = localStorage.getItem("pos_active_cashier_id");
      if (operators.length > 0) {
        const found = operators.find((u) => u.user_id === savedCashierId);
        if (found) {
          setActiveCashierId(found.user_id);
        } else if (currentUser && currentUser.role !== "OWNER") {
          setActiveCashierId(currentUser.user_id);
          localStorage.setItem("pos_active_cashier_id", currentUser.user_id);
        } else {
          setActiveCashierId(operators[0].user_id);
          localStorage.setItem("pos_active_cashier_id", operators[0].user_id);
        }
      }

      if (sps.length > 0) {
        const isSpValid = sps.some((sp) => sp.salesperson_id === salespersonId);
        if (!isSpValid) {
          setSalespersonId(sps[0].salesperson_id);
        }
      }

      await refreshOffers();
    } catch (err) {
      console.error("Failed to load POS catalog:", err);
    } finally {
      setIsLoading(false);
    }
  }, [salespersonId, setSalespersonId, currentUser, refreshOffers]);

  useEffect(() => {
    loadData();
    const handleGlobalRefresh = () => loadData();
    window.addEventListener("app:refresh-data", handleGlobalRefresh);
    return () => window.removeEventListener("app:refresh-data", handleGlobalRefresh);
  }, [loadData]);

  useEffect(() => {
    if (isOffersModalOpen) {
      refreshOffers();
    }
  }, [isOffersModalOpen, refreshOffers]);

  // Background Auto-Refresh Poller (Every 8 seconds, refreshes product stock across LAN stations silently without interrupting cashier)
  useEffect(() => {
    let isMounted = true;
    const interval = setInterval(async () => {
      if (!isPaymentModalOpen && !isQuickCashModalOpen && !isLoading && document.visibilityState === "visible") {
        try {
          const [prods, atts] = await Promise.all([getProducts(), getAttars()]);
          if (isMounted) {
            setProducts(prods);
            setAttars(atts);
          }
        } catch {}
      }
    }, 8000);

    const onFocus = async () => {
      try {
        const [prods, atts] = await Promise.all([getProducts(), getAttars()]);
        if (isMounted) {
          setProducts(prods);
          setAttars(atts);
        }
      } catch {}
    };
    window.addEventListener("focus", onFocus);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [isPaymentModalOpen, isQuickCashModalOpen, isLoading]);

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Barcode Hardware Listener (USB HID Scanner Wedge support)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Hotkeys
      if (e.key === "F1") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "F2") {
        e.preventDefault();
        handleOpenHistory();
      } else if (e.key === "F4") {
        e.preventDefault();
        if (cart.length > 0) clearCart();
      } else if (e.key === "F7") {
        e.preventDefault();
        setIsOffersModalOpen((prev) => !prev);
      } else if (e.key === "F9") {
        e.preventDefault();
        openQuickCashModal();
      } else if (e.key === "F12") {
        e.preventDefault();
        openPaymentModal();
      }

      // Barcode Scanner detection
      const currentTime = Date.now();
      if (currentTime - lastBarcodeScanTime > 100) {
        setBarcodeBuffer("");
      }
      setLastBarcodeScanTime(currentTime);

      if (e.key === "Enter" && barcodeBuffer.length >= 6) {
        e.preventDefault();
        searchProductByBarcode(barcodeBuffer).then((product) => {
          if (product) {
            addToCart(product);
            setBarcodeBuffer("");
          }
        });
      } else if (e.key.length === 1) {
        setBarcodeBuffer((prev) => prev + e.key);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [barcodeBuffer, lastBarcodeScanTime, cart.length, getTotals, addToCart, clearCart, setIsPaymentModalOpen]);

  // Filter products by category and search
  const filteredProducts = products.filter((p) => {
    const matchesCategory =
      selectedCategory === "ALL" ||
      selectedCategory === "PERFUMES" ||
      p.category === selectedCategory;
    const cleanQuery = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !cleanQuery ||
      p.name.toLowerCase().includes(cleanQuery) ||
      p.sku.toLowerCase().includes(cleanQuery) ||
      (p.barcode && p.barcode.toLowerCase().includes(cleanQuery));
    return matchesCategory && matchesSearch;
  });

  // Filter attars by search
  const filteredAttars = attars.filter((a) => {
    const cleanQuery = searchQuery.trim().toLowerCase();
    return (
      !cleanQuery ||
      a.name.toLowerCase().includes(cleanQuery) ||
      a.sku.toLowerCase().includes(cleanQuery) ||
      (a.origin_country && a.origin_country.toLowerCase().includes(cleanQuery))
    );
  });

  const totals = getTotals();
  const tenderedPaisa = Math.round((parseFloat(tenderedCashRupees) || 0) * 100);
  const changeDuePaisa = Math.max(0, tenderedPaisa - totals.netPayablePaisa);

  // Cashier Selling Price Bump: Sets cart item price(s) so net payable equals tendered cash and change = Rs. 0
  const handleApplyTenderAsFinalPrice = () => {
    if (cart.length === 0) return;
    const tendered = Math.round((parseFloat(tenderedCashRupees) || 0) * 100);
    if (tendered <= 0) return;

    if (cart.length === 1) {
      const item = cart[0];
      const newUnitPricePaisa = Math.round(tendered / (item.quantity || 1));
      updateUnitPrice(item.product_id, newUnitPricePaisa);
    } else {
      const currentGross = totals.grossTotalPaisa;
      if (currentGross <= 0) return;
      cart.forEach((it) => {
        const ratio = it.line_total_paisa / currentGross;
        const targetLineTotal = Math.round(tendered * ratio);
        const newUnit = Math.round(targetLineTotal / (it.quantity || 1));
        updateUnitPrice(it.product_id, newUnit);
      });
    }
  };

  const printReceipt = (invoice: import("@/types/database").SalesInvoiceResult) => {
    const savedReceiptSettings = JSON.parse(localStorage.getItem("ameer_receipt_settings") || "{}");
    const receiptAddress =
      savedReceiptSettings.address && !savedReceiptSettings.address.includes("Lahore")
        ? savedReceiptSettings.address
        : "Main Branch Sports Complex Bannu";
    const receiptPhone =
      savedReceiptSettings.phone && !savedReceiptSettings.phone.includes("0300-1234567")
        ? savedReceiptSettings.phone
        : "WhatsApp: 03100988522";
    const receiptSubtitle = savedReceiptSettings.subtitle || "Haute Parfumerie & Pure Concentrated Oils";
    const receiptPolicy = savedReceiptSettings.policy || "Exchange acceptable within 7 days in original condition.";

    const triggerBrowserPrint = () => {
      const itemsHtml = invoice.items
        .map(
          (it) => `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:5px; font-size:11px; line-height:1.25; color:#000000;">
          <div style="flex:1; padding-right:4px;">
            <div style="font-weight:800; color:#000000;">${it.product_name}</div>
            <div style="font-size:10px; font-weight:700; color:#000000;">${it.quantity} x Rs. ${(
            (it.unit_price_paisa || it.line_total_paisa / it.quantity) /
            100
          ).toLocaleString()}</div>
          </div>
          <div style="font-weight:900; font-family:monospace; font-size:11px; text-align:right; color:#000000;">
            Rs. ${(it.line_total_paisa / 100).toLocaleString()}
          </div>
        </div>
      `
        )
        .join("");

      const receiptHtml = `
        <div style="font-family:'Segoe UI', Roboto, -apple-system, Arial, sans-serif; width:72mm; margin:0 auto; padding:4px 2px; font-size:11px; color:#000000; background:#ffffff; line-height:1.35; -webkit-print-color-adjust:exact; print-color-adjust:exact;">
          <div style="text-align:center; padding-bottom:4px;">
            <!-- High-Contrast 1-Bit Thermal Receipt Logo (Pure Black, Zero Dither) -->
            <img src="/logo-receipt.png" style="width:48mm; height:auto; margin:0 auto 4px auto; display:block; image-rendering:pixelated;" alt="Ameer Perfumes" />
            <div style="font-size:9px; font-weight:800; letter-spacing:0.8px; text-transform:uppercase; margin-top:2px; color:#000000;">${receiptSubtitle}</div>
            <div style="font-size:9.5px; font-weight:700; color:#000000; margin-top:2px;">${receiptAddress}</div>
            <div style="font-size:9.5px; font-weight:700; color:#000000;">${receiptPhone}</div>
          </div>

          <div style="border-top:1.5px dashed #000000; margin:5px 0;"></div>

          <div style="font-size:10px; font-weight:700; color:#000000; margin-bottom:4px;">
            <div style="display:flex; justify-content:space-between; margin:2px 0;">
              <span style="font-weight:800; color:#000000;">Invoice #:</span>
              <span style="font-weight:900; font-family:monospace; color:#000000;">${invoice.invoice_number}</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin:2px 0;">
              <span style="font-weight:800; color:#000000;">Date & Time:</span>
              <span style="font-weight:700; color:#000000;">${new Date(invoice.invoice_date).toLocaleString()}</span>
            </div>
          </div>

          <div style="border-top:1.5px dashed #000000; margin:5px 0;"></div>
          <div style="font-size:10px; font-weight:900; text-transform:uppercase; margin-bottom:4px; display:flex; justify-content:space-between; color:#000000;">
            <span>Item Description</span>
            <span>Amount (PKR)</span>
          </div>
          <div style="border-top:1.5px dashed #000000; margin-bottom:5px;"></div>

          ${itemsHtml}

          <div style="border-top:1.5px dashed #000000; margin:6px 0 4px 0;"></div>

          <div style="font-size:11px; color:#000000;">
            <div style="display:flex; justify-content:space-between; margin:2.5px 0; font-weight:700;">
              <span>Gross Total:</span>
              <span style="font-family:monospace; font-weight:800;">Rs. ${(invoice.gross_total_paisa / 100).toLocaleString()}</span>
            </div>
            ${
              invoice.discount_paisa > 0
                ? `<div style="display:flex; justify-content:space-between; margin:2.5px 0; font-weight:800; color:#000000;">
                     <span>Special Discount:</span>
                     <span style="font-family:monospace; font-weight:900;">-Rs. ${(invoice.discount_paisa / 100).toLocaleString()}</span>
                   </div>`
                : ""
            }
            <div style="border-top:1.5px solid #000000; margin:4px 0;"></div>
            <div style="display:flex; justify-content:space-between; align-items:baseline; font-size:14px; font-weight:900; margin:3px 0; color:#000000;">
              <span>NET AMOUNT:</span>
              <span style="font-family:monospace;">Rs. ${(invoice.net_payable_paisa / 100).toLocaleString()}</span>
            </div>
            ${
              invoice.change_due_paisa > 0
                ? `<div style="display:flex; justify-content:space-between; margin:2.5px 0; font-size:10.5px; font-weight:800; color:#000000;">
                     <span>Change Returned:</span>
                     <span style="font-family:monospace; font-weight:900;">Rs. ${(invoice.change_due_paisa / 100).toLocaleString()}</span>
                   </div>`
                : ""
            }
          </div>

          <div style="border-top:1.5px dashed #000000; margin:6px 0 4px 0;"></div>

          <div style="text-align:center; font-size:9.5px; font-weight:700; color:#000000; margin-top:5px; line-height:1.4;">
            <div style="font-weight:800;">Thank you for your patronage!</div>
            <div>${receiptPolicy}</div>
          </div>

          <div style="border-top:1.5px dashed #000000; margin:6px 0 4px 0;"></div>

          <div style="text-align:center; font-size:9px; font-weight:700; color:#000000; line-height:1.35;">
            <div style="font-weight:900; letter-spacing:0.5px;">Software Developed by Global Tech</div>
            <div>Contact: 0329 9969277</div>
          </div>
        </div>
      `;

      const printArea = document.getElementById("thermal-print-area");
      if (printArea) {
        printArea.innerHTML = receiptHtml;
        document.body.classList.remove("printing-report");
        document.body.classList.remove("printing-reports-master");
        document.body.classList.remove("printing-wholesale-a4");
        setTimeout(() => {
          window.print();
          const cleanUp = () => {
            if (printArea) printArea.innerHTML = "";
            window.removeEventListener("afterprint", cleanUp);
          };
          window.addEventListener("afterprint", cleanUp);
        }, 80);
      } else {
        window.print();
      }
    };

    // Universal Browser Print Preview: Always open clean standard print dialog
    triggerBrowserPrint();
  };

  // Dedicated Print History Handlers for A4 and 80mm Thermal (Fixes blank page issue)
  const handlePrintHistoryA4 = (salesToPrint: RecentSaleSummary[], totalRevenuePaisa: number, totalBottles: number, periodLabel: string) => {
    const printArea = document.getElementById("reports-print-area");
    if (!printArea) {
      window.print();
      return;
    }

    const userLabel = currentUser?.full_name || currentUser?.username || "Authorized Staff";
    const printedAt = new Date().toLocaleString("en-PK", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const rowsHtml = salesToPrint
      .map((s, idx) => {
        let itemsText = "";
        if (s.items_detail && s.items_detail.length > 0) {
          itemsText = s.items_detail
            .map((it) => {
              if (it.returned_quantity > 0) {
                const retTag =
                  it.returned_quantity === it.quantity
                    ? `ALL ${it.quantity} RETURNED`
                    : `${it.returned_quantity} of ${it.quantity} RETURNED`;
                return `<div style="color: #991b1b; font-weight: 700; margin: 2px 0;">• ${it.product_name} <span style="background: #fee2e2; color: #991b1b; padding: 1px 4px; border-radius: 3px; font-size: 8.5px; border: 1px solid #fca5a5;">↩ ${retTag}</span></div>`;
              }
              return `<div style="color: #1e293b; margin: 1px 0;">• ${it.product_name} <span style="color: #64748b; font-family: monospace;">(x${it.quantity})</span></div>`;
            })
            .join("");
        } else {
          itemsText = `<div style="color: #1e293b;">${s.product_names || "Fragrance"}</div>`;
        }

        let statusBadge = "";
        if (s.return_status === "FULL" || (s.is_returned && (!s.return_status || s.return_status === "FULL"))) {
          statusBadge = `<span style="background: #fee2e2; color: #991b1b; border: 1px solid #f87171; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 9px;">FULL RETURN</span>`;
        } else if (s.return_status === "PARTIAL" || (s.returned_units && s.returned_units > 0)) {
          statusBadge = `<span style="background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 9px;">PARTIAL (${s.returned_units}/${s.total_units})</span>`;
        } else {
          statusBadge = `<span style="background: #dcfce7; color: #166534; border: 1px solid #86efac; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 9px;">COMPLETED</span>`;
        }

        const invDate = new Date(s.invoice_date).toLocaleString("en-PK", {
          dateStyle: "short",
          timeStyle: "short",
        });

        return `
          <tr style="border-bottom: 1px solid #e2e8f0; font-size: 10px; background: ${idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">
            <td style="padding: 6px 4px; text-align: center; color: #64748b;">${idx + 1}</td>
            <td style="padding: 6px 6px; font-family: monospace; font-weight: 800; color: #b45309; white-space: nowrap;">${s.invoice_number}</td>
            <td style="padding: 6px 6px; font-family: monospace; color: #475569; white-space: nowrap;">${invDate}</td>
            <td style="padding: 6px 6px; font-family: monospace; color: #334155;">${s.customer_phone || "Walk-in"}</td>
            <td style="padding: 6px 6px; font-size: 9.5px; max-width: 250px;">${itemsText}</td>
            <td style="padding: 6px 6px; font-size: 9px; font-weight: 700; color: #3b82f6;">${s.order_source || "SHOP"}</td>
            <td style="padding: 6px 6px; color: #334155;">${s.cashier_name || s.salesperson_name || "Counter 1"}</td>
            <td style="padding: 6px 6px; text-align: center; font-family: monospace; font-weight: 700;">${s.total_units}</td>
            <td style="padding: 6px 6px; text-align: center; font-size: 9px; font-weight: 700; color: #475569;">${s.payment_method || "CASH"}</td>
            <td style="padding: 6px 6px; text-align: right; font-family: monospace; font-weight: 800; color: #0f172a; white-space: nowrap;">Rs. ${(s.net_payable_paisa / 100).toLocaleString()}</td>
            <td style="padding: 6px 4px; text-align: center;">${statusBadge}</td>
          </tr>
        `;
      })
      .join("");

    const htmlContent = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; width: 100%;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <img src="/logo-rect.png" style="height: 48px; width: auto; object-fit: contain;" alt="Ameer Perfumes" />
            <div>
              <h1 style="margin: 0; font-size: 19px; font-weight: 900; letter-spacing: 1px; color: #0f172a;">AMEER PERFUMES</h1>
              <div style="font-size: 10px; font-weight: 700; color: #b45309; text-transform: uppercase; letter-spacing: 0.5px;">Haute Parfumerie & Pure Concentrated Oils</div>
              <div style="font-size: 9px; color: #475569; margin-top: 2px;">Main Branch Sports Complex Bannu | Contact: 03100988522</div>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 14px; font-weight: 900; color: #0f172a; text-transform: uppercase;">SALES & INVOICES AUDIT REPORT</div>
            <div style="font-size: 9.5px; color: #64748b; margin-top: 2px;">Filter Period: <strong style="color: #0f172a;">${periodLabel}</strong></div>
            <div style="font-size: 9px; color: #64748b; margin-top: 1px;">Generated: ${printedAt}</div>
          </div>
        </div>

        <!-- Summary KPI Ribbon -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px;">
          <div>
            <div style="font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 700;">Total Invoices</div>
            <div style="font-size: 14px; font-weight: 900; color: #0f172a; font-family: monospace;">${salesToPrint.length}</div>
          </div>
          <div>
            <div style="font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 700;">Units Sold</div>
            <div style="font-size: 14px; font-weight: 900; color: #7c3aed; font-family: monospace;">${totalBottles}</div>
          </div>
          <div>
            <div style="font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 700;">Total Net Revenue</div>
            <div style="font-size: 14px; font-weight: 900; color: #059669; font-family: monospace;">Rs. ${(totalRevenuePaisa / 100).toLocaleString()}</div>
          </div>
          <div>
            <div style="font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 700;">Generated By</div>
            <div style="font-size: 11px; font-weight: 700; color: #0f172a;">${userLabel}</div>
          </div>
        </div>

        <!-- Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background: #0f172a; color: #ffffff; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.5px;">
              <th style="padding: 7px 4px; text-align: center; width: 28px;">#</th>
              <th style="padding: 7px 6px; text-align: left; width: 110px;">Invoice #</th>
              <th style="padding: 7px 6px; text-align: left; width: 100px;">Date & Time</th>
              <th style="padding: 7px 6px; text-align: left; width: 95px;">Customer</th>
              <th style="padding: 7px 6px; text-align: left;">Products & Notes</th>
              <th style="padding: 7px 6px; text-align: left; width: 70px;">Channel</th>
              <th style="padding: 7px 6px; text-align: left; width: 90px;">Staff</th>
              <th style="padding: 7px 6px; text-align: center; width: 45px;">Qty</th>
              <th style="padding: 7px 6px; text-align: center; width: 55px;">Pay</th>
              <th style="padding: 7px 6px; text-align: right; width: 85px;">Net (PKR)</th>
              <th style="padding: 7px 4px; text-align: center; width: 75px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <!-- Signatures & Verification -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 35px; border-top: 1px dashed #cbd5e1; padding-top: 18px; font-size: 9.5px; color: #475569;">
          <div>
            <div>Prepared By: __________________________</div>
            <div style="margin-top: 4px; font-size: 8.5px; color: #94a3b8;">Printed from POS History Desk</div>
          </div>
          <div style="text-align: center;">
            <div>Manager Verification: __________________________</div>
            <div style="margin-top: 4px; font-size: 8.5px; color: #94a3b8;">Audit Verified</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 700; color: #0f172a;">Ameer Perfumes Bannu</div>
            <div style="font-size: 8.5px; color: #94a3b8; margin-top: 2px;">Software Developed by Global Tech (0329 9969277)</div>
          </div>
        </div>
      </div>
    `;

    printArea.innerHTML = htmlContent;
    document.body.classList.add("printing-reports-a4");
    document.body.classList.remove("printing-wholesale-a4");
    document.body.classList.remove("printing-report");
    document.body.classList.remove("printing-reports-master");

    setTimeout(() => {
      window.print();
      const cleanUp = () => {
        document.body.classList.remove("printing-reports-a4");
        if (printArea) printArea.innerHTML = "";
        window.removeEventListener("afterprint", cleanUp);
      };
      window.addEventListener("afterprint", cleanUp);
    }, 80);
  };

  const handlePrintHistoryThermal = (salesToPrint: RecentSaleSummary[], totalRevenuePaisa: number, totalBottles: number, periodLabel: string) => {
    const printArea = document.getElementById("thermal-print-area");
    if (!printArea) {
      window.print();
      return;
    }

    const userLabel = currentUser?.full_name || currentUser?.username || "Cashier";
    const printedAt = new Date().toLocaleString("en-PK", {
      dateStyle: "short",
      timeStyle: "short",
    });

    const invoiceLines = salesToPrint
      .map((s) => {
        let itemsStr = s.product_names || "Fragrance Items";
        if (s.items_detail && s.items_detail.length > 0) {
          itemsStr = s.items_detail.map((i) => `${i.product_name} x${i.quantity}`).join(", ");
        }
        const invTime = new Date(s.invoice_date).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" });
        return `
          <div style="margin-bottom: 5px; padding-bottom: 4px; border-bottom: 1px dotted #888;">
            <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 10px;">
              <span>${s.invoice_number}</span>
              <span>Rs. ${(s.net_payable_paisa / 100).toLocaleString()}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 9px; color: #444;">
              <span>${invTime} • ${s.order_source || "Shop"}</span>
              <span>${s.customer_phone || "Walk-in"}</span>
            </div>
            <div style="font-size: 9px; color: #222; margin-top: 1px; line-height: 1.2;">
              ${itemsStr}
            </div>
            ${s.is_returned ? `<div style="font-size: 8.5px; font-weight: 800; color: #000;">[RETURN: ${s.returned_units || 0} units]</div>` : ""}
          </div>
        `;
      })
      .join("");

    const receiptHtml = `
      <div style="width: 72mm; margin: 0 auto; padding: 4px 2px; font-family: 'Courier New', monospace; color: #000000; font-size: 10px; line-height: 1.3;">
        <div style="text-align: center; margin-bottom: 6px;">
          <img src="/logo-rect.png" style="max-height: 44px; max-width: 140px; margin: 0 auto; display: block; filter: contrast(180%) grayscale(100%);" alt="Logo" />
          <div style="font-size: 12px; font-weight: 900; letter-spacing: 0.5px; margin-top: 3px;">AMEER PERFUMES</div>
          <div style="font-size: 8px; font-weight: 700; text-transform: uppercase;">Haute Parfumerie & Pure Oils</div>
          <div style="font-size: 8.5px;">Main Branch Sports Complex Bannu</div>
          <div style="font-size: 8.5px;">WhatsApp: 03100988522</div>
        </div>

        <div style="border-top: 1.5px dashed #000; margin: 4px 0;"></div>
        <div style="text-align: center; font-weight: 900; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">
          SALES HISTORY SUMMARY
        </div>
        <div style="text-align: center; font-size: 8.5px; margin-bottom: 2px;">
          Period: ${periodLabel} | Printed: ${printedAt}
        </div>
        <div style="text-align: center; font-size: 8.5px;">Staff: ${userLabel}</div>
        <div style="border-top: 1.5px dashed #000; margin: 4px 0;"></div>

        <!-- Totals Banner -->
        <div style="padding: 3px 0; font-size: 10px;">
          <div style="display: flex; justify-content: space-between;">
            <span>Total Invoices:</span>
            <span style="font-weight: 900;">${salesToPrint.length}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>Total Units Sold:</span>
            <span style="font-weight: 900;">${totalBottles}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 900; margin-top: 2px; border-top: 1px solid #000; padding-top: 2px;">
            <span>TOTAL REVENUE:</span>
            <span>Rs. ${(totalRevenuePaisa / 100).toLocaleString()}</span>
          </div>
        </div>

        <div style="border-top: 1.5px dashed #000; margin: 4px 0 6px 0;"></div>
        <div style="font-weight: 800; font-size: 9px; text-transform: uppercase; margin-bottom: 4px;">INVOICE DETAILS (${salesToPrint.length}):</div>

        ${invoiceLines}

        <div style="border-top: 1.5px dashed #000; margin: 6px 0 4px 0;"></div>
        <div style="text-align: center; font-size: 8.5px; font-weight: 700; line-height: 1.35;">
          <div style="font-weight: 900;">Software Developed by Global Tech</div>
          <div>Contact: 0329 9969277</div>
        </div>
      </div>
    `;

    printArea.innerHTML = receiptHtml;
    document.body.classList.remove("printing-reports-a4");
    document.body.classList.remove("printing-wholesale-a4");
    document.body.classList.remove("printing-report");
    document.body.classList.remove("printing-reports-master");

    setTimeout(() => {
      window.print();
      const cleanUp = () => {
        if (printArea) printArea.innerHTML = "";
        window.removeEventListener("afterprint", cleanUp);
      };
      window.addEventListener("afterprint", cleanUp);
    }, 80);
  };

  const handleSpecialDiscountChange = (valStr: string) => {
    const num = Math.max(0, parseFloat(valStr) || 0);
    const discountPaisa = Math.round(num * 100);
    setSpecialDiscount(discountPaisa);
    const newNetPaisa = Math.max(0, totals.grossTotalPaisa - totals.itemDiscountPaisa - discountPaisa);
    setTenderedCashRupees((newNetPaisa / 100).toString());
  };

  // Modal opening helpers with default state initialization
  const openQuickCashModal = () => {
    if (cart.length === 0) return;
    setTenderedCashRupees((totals.netPayablePaisa / 100).toString());
    if (salespersons.length > 0 && !salespersons.some((s) => s.salesperson_id === salespersonId)) {
      setSalespersonId(salespersons[0].salesperson_id);
    }
    setIsQuickCashModalOpen(true);
  };

  const openPaymentModal = () => {
    if (cart.length === 0) return;
    setTenderedCashRupees((totals.netPayablePaisa / 100).toString());
    setSelectedPaymentMethod("CASH");
    if (salespersons.length > 0 && !salespersons.some((s) => s.salesperson_id === salespersonId)) {
      setSalespersonId(salespersons[0].salesperson_id);
    }
    setIsPaymentModalOpen(true);
  };

  // Dedicated Fast Quick Cash Checkout Handler [F9]
  const handleQuickCashCheckout = async () => {
    if (cart.length === 0 || isSubmitting) return;

    const quickTenderedPaisa = Math.round((parseFloat(tenderedCashRupees) || (totals.netPayablePaisa / 100)) * 100);
    if (quickTenderedPaisa < totals.netPayablePaisa) {
      alert("Tendered cash is less than the net payable amount!");
      return;
    }

    setIsSubmitting(true);
    try {
      const payments: SalesPaymentTender[] = [
        {
          payment_method: "CASH",
          amount_paisa: totals.netPayablePaisa,
          is_cash_drawer_tender: true,
        },
      ];

      const activeTerminalId = status?.stationId || (status as any)?.station_id || "POS-01";
      const recordedCashierId = (currentUser?.role === "SUPER_ADMIN" || (currentUser?.role as string) === "ADMIN")
        ? (activeCashierId || "usr_cashier1")
        : (currentUser?.user_id || "usr_cashier1");

      const validSalespersonId =
        (salespersons.find((s) => s.salesperson_id === salespersonId)?.salesperson_id) ||
        (salespersons[0]?.salesperson_id) ||
        salespersonId ||
        "sp_01";

      const payload = {
        customer_phone: customerPhone?.trim() || "03000000000",
        salesperson_id: validSalespersonId,
        cashier_user_id: recordedCashierId,
        terminal_id: activeTerminalId,
        order_source: "WALK_IN",
        items: cart.map((item) => ({
          product_id: item.attar_id || item.product_id,
          product_name: item.name,
          quantity: item.quantity,
          size_ml: item.size_ml,
          unit_cost_paisa: item.unit_cost_paisa,
          unit_selling_price_paisa: item.unit_price_paisa,
          discount_amount_paisa: item.discount_paisa,
          line_total_paisa: item.line_total_paisa,
          item_type: item.item_type || "PERFUME",
          attar_id: item.attar_id,
          measurement_unit: item.measurement_unit || "BOTTLE",
          density_grams_per_ml: item.density_grams_per_ml || 1000,
        })),
        payments,
        gross_total_paisa: totals.grossTotalPaisa,
        item_discount_paisa: totals.itemDiscountPaisa,
        special_discount_paisa: totals.specialDiscountPaisa,
        net_payable_paisa: totals.netPayablePaisa,
      };

      const result = await createSalesInvoice(payload);
      setIsQuickCashModalOpen(false);
      clearCart();
      await loadData();

      setLastCompletedInvoice(result);
      try {
        localStorage.setItem("pos_last_completed_invoice", JSON.stringify(result));
      } catch {}

      setCompletedInvoice(null);
      if (autoPrintReceipt) {
        setTimeout(() => {
          printReceipt(result);
        }, 100);
      }
    } catch (err: any) {
      console.error("Quick cash checkout failed:", err);
      const msg = typeof err === "string" ? err : err?.message || JSON.stringify(err);
      alert(`Quick cash checkout failed: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Checkout submission
  const handleCheckout = async () => {
    if (cart.length === 0 || isSubmitting) return;

    const effectiveTenderedPaisa =
      selectedPaymentMethod === "CASH"
        ? Math.round((parseFloat(tenderedCashRupees) || (totals.netPayablePaisa / 100)) * 100)
        : totals.netPayablePaisa;

    if (selectedPaymentMethod === "CASH" && effectiveTenderedPaisa < totals.netPayablePaisa) {
      alert("Tendered cash is less than the net payable amount!");
      return;
    }

    setIsSubmitting(true);
    try {
      const referenceCode =
        selectedPaymentMethod === "EASYPAISA"
          ? (digitalWalletTid.trim() ? `EasyPaisa (TID: ${digitalWalletTid.trim()})` : "EasyPaisa Mobile Payment")
          : selectedPaymentMethod === "JAZZCASH"
          ? (digitalWalletTid.trim() ? `JazzCash (TID: ${digitalWalletTid.trim()})` : "JazzCash Mobile Payment")
          : undefined;

      const payments: SalesPaymentTender[] = [
        {
          payment_method: selectedPaymentMethod,
          amount_paisa: totals.netPayablePaisa,
          reference_code: referenceCode,
          is_cash_drawer_tender: selectedPaymentMethod === "CASH",
        },
      ];

      const activeTerminalId = status?.stationId || (status as any)?.station_id || "POS-01";
      const recordedCashierId = (currentUser?.role === "SUPER_ADMIN" || (currentUser?.role as string) === "ADMIN")
        ? (activeCashierId || "usr_cashier1")
        : (currentUser?.user_id || "usr_cashier1");

      const validSalespersonId =
        (salespersons.find((s) => s.salesperson_id === salespersonId)?.salesperson_id) ||
        (salespersons[0]?.salesperson_id) ||
        salespersonId ||
        "sp_01";

      const payload = {
        customer_phone: customerPhone?.trim() || "03000000000",
        salesperson_id: validSalespersonId,
        cashier_user_id: recordedCashierId,
        terminal_id: activeTerminalId,
        order_source: "WALK_IN",
        items: cart.map((item) => ({
          product_id: item.attar_id || item.product_id,
          product_name: item.name,
          quantity: item.quantity,
          size_ml: item.size_ml,
          unit_cost_paisa: item.unit_cost_paisa,
          unit_selling_price_paisa: item.unit_price_paisa,
          discount_amount_paisa: item.discount_paisa,
          line_total_paisa: item.line_total_paisa,
          item_type: item.item_type || "PERFUME",
          attar_id: item.attar_id,
          measurement_unit: item.measurement_unit || "BOTTLE",
          density_grams_per_ml: item.density_grams_per_ml || 1000,
        })),
        payments,
        gross_total_paisa: totals.grossTotalPaisa,
        item_discount_paisa: totals.itemDiscountPaisa,
        special_discount_paisa: totals.specialDiscountPaisa,
        net_payable_paisa: totals.netPayablePaisa,
      };

      const result = await createSalesInvoice(payload);
      setIsPaymentModalOpen(false);
      clearCart();
      await loadData(); // Reload genuine SQLite inventory counts immediately

      setLastCompletedInvoice(result);
      try {
        localStorage.setItem("pos_last_completed_invoice", JSON.stringify(result));
      } catch {}

      setCompletedInvoice(null);
      if (autoPrintReceipt) {
        setTimeout(() => {
          printReceipt(result);
        }, 100);
      }
    } catch (err: any) {
      console.error("Checkout failed:", err);
      const msg = typeof err === "string" ? err : err?.message || JSON.stringify(err);
      alert(`Checkout transaction failed: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dedicated Enter Key handler for Quick Cash and Payment Modals (Works immediately without clicking)
  const handleQuickCashRef = useRef(handleQuickCashCheckout);
  handleQuickCashRef.current = handleQuickCashCheckout;

  const handleCheckoutRef = useRef(handleCheckout);
  handleCheckoutRef.current = handleCheckout;

  useEffect(() => {
    if (!isQuickCashModalOpen && !isPaymentModalOpen) return;

    const handleModalEnter = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();

        if (isQuickCashModalOpen) {
          handleQuickCashRef.current();
        } else if (isPaymentModalOpen) {
          handleCheckoutRef.current();
        }
      }
    };

    window.addEventListener("keydown", handleModalEnter, true);
    return () => window.removeEventListener("keydown", handleModalEnter, true);
  }, [isQuickCashModalOpen, isPaymentModalOpen]);

  const categories = [
    { id: "ALL", label: "All Products" },
    { id: "PERFUMES", label: "Perfumes" },
    { id: "ATTAR", label: "💧 Attars & Decants" },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top Header & Search Strip */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 lg:px-4 py-2 flex flex-wrap items-center justify-between gap-3 min-w-0 shadow-xs">
        {/* Left: Search Box & Quick Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="relative w-44 sm:w-56 md:w-64 shrink-0">
            <Search className="w-4 h-4 text-amber-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search products, perfumes, attars, SKU, or barcode [F1]..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg pl-9 pr-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-colors shadow-xs"
            />
          </div>

          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap shrink-0">
            <Barcode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Scanner</span>
          </div>

          <button
            type="button"
            onClick={handleOpenHistory}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 rounded-lg text-xs font-semibold cursor-pointer transition-colors shrink-0 whitespace-nowrap"
            title="View past sales invoices and receipts history [F2]"
          >
            <History className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>History [F2]</span>
          </button>

          <button
            type="button"
            onClick={handleReprintLastReceipt}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-500/30 rounded-lg text-xs font-semibold cursor-pointer transition-colors shrink-0 whitespace-nowrap"
            title="Reprint last completed receipt in case thermal paper ran out or jammed"
          >
            <Printer className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>🖨️ Reprint Last Slip</span>
          </button>

          <button
            type="button"
            onClick={() => setIsOffersModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/30 rounded-lg text-xs font-semibold cursor-pointer transition-colors shrink-0 whitespace-nowrap"
            title="Special seasonal offers and discounted bundles [F7]"
          >
            <Gift className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <span>Offers [F7]</span>
          </button>
        </div>

        {/* Right: Cashier, Salesperson & Customer Attribution */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* Active Cashier */}
          <div className="flex items-center gap-1.5 text-xs bg-slate-100 dark:bg-slate-900 border border-emerald-500/50 dark:border-emerald-600/60 px-2 py-1 rounded-lg shadow-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-slate-600 dark:text-slate-300 font-medium">Cashier:</span>
            {currentUser?.role === "SUPER_ADMIN" || (currentUser?.role as string) === "ADMIN" ? (
              <select
                value={activeCashierId}
                onChange={(e) => handleSwitchCashier(e.target.value)}
                className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                title="Super Admin: Active counter cashier"
              >
                {cashierUsers.map((u) => (
                  <option key={u.user_id} value={u.user_id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 py-1">
                    {u.full_name} ({u.username})
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-bold text-slate-900 dark:text-slate-200">
                {currentUser?.full_name || "Counter Cashier"}
              </span>
            )}
          </div>

          {/* Floor Staff Selector */}
          <div className="flex items-center gap-1.5 text-xs bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-2 py-1 rounded-lg shadow-xs">
            <UserCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-slate-600 dark:text-slate-300 font-medium">Staff:</span>
            <select
              value={salespersonId}
              onChange={(e) => setSalespersonId(e.target.value)}
              className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
            >
              {salespersons.map((sp) => (
                <option key={sp.salesperson_id} value={sp.salesperson_id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 py-1">
                  {sp.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Customer Phone */}
          <div className="flex items-center gap-1.5 text-xs">
            <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="text-slate-600 dark:text-slate-400 font-medium">Customer:</span>
            <input
              type="tel"
              placeholder="03000000000"
              maxLength={11}
              value={customerPhone}
              onChange={(e) => {
                const clean = e.target.value.replace(/[^0-9]/g, "");
                setCustomerPhone(clean.slice(0, 11));
              }}
              className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-xs rounded-lg px-2.5 py-1.5 w-28 lg:w-32 focus:outline-none focus:ring-1 focus:ring-amber-500/40 font-mono font-medium"
            />
          </div>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="flex-1 min-h-0 flex overflow-hidden min-w-0 w-full">
        {/* Left Section: Catalog Grid */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
          {/* Category Tabs */}
          <div className="flex items-center gap-2 px-6 py-2.5 bg-white/80 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800/80 overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat.id
                    ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Product Cards Grid */}
          <div className="flex-1 p-6 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                Loading artisanal perfume catalog...
              </div>
            ) : selectedCategory === "ATTAR" ? (
              filteredAttars.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2">
                  <Droplets className="w-12 h-12 text-amber-500/50" />
                  <p>No attar products found.</p>
                  <p className="text-xs text-slate-400">Add attars in the Attar Bar to sell them here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredAttars.map((a) => (
                    <Card
                      key={a.attar_id}
                      variant="elevated"
                      onClick={() => {
                        setSelectedAttarForDecant(a);
                        setDecantUnit("TOLA");
                        setDecantQty(1);
                        setDecantCustomRateRupees(Math.round(a.selling_price_per_tola_paisa / 100).toString());
                      }}
                      className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs transition-all flex flex-col justify-between p-4 cursor-pointer hover:border-emerald-500/50 hover:shadow-md"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold text-[11px] tracking-wide uppercase">
                            <Droplets className="w-3.5 h-3.5 fill-emerald-500/20 text-emerald-600 dark:text-emerald-400" />
                            <span>💧 Attar Oil</span>
                          </div>
                          <span className="text-[10px] font-mono font-medium text-slate-400 dark:text-slate-500">
                            {a.sku}
                          </span>
                        </div>

                        <h4
                          className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-2 break-words leading-tight line-clamp-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors"
                          title={a.name}
                        >
                          {a.name}
                        </h4>
                        <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mt-0.5 truncate whitespace-nowrap h-4">
                          {((a.density_grams_per_ml || 1000) / 1000).toFixed(3)} g/ml • Pure Blend
                        </p>

                        {/* Prominent Attar Oil Badge */}
                        <div className="mt-3 py-2 px-3 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-lg border border-emerald-500/30 text-center">
                          <span className="text-sm font-bold font-serif text-emerald-800 dark:text-emerald-200 tracking-wide">
                            Attar Oil
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          1 Tola: Rs. {Math.round(a.selling_price_per_tola_paisa / 100).toLocaleString()}
                        </span>
                        <Button
                          size="sm"
                          variant="primary"
                          className="w-8 h-8 p-0 rounded-lg flex items-center justify-center shrink-0 shadow-xs hover:scale-105 active:scale-95"
                          title="Dispense Attar"
                        >
                          <Plus className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )
            ) : selectedCategory === "PERFUMES" ? (
              filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2">
                  <ShoppingBag className="w-12 h-12 text-slate-400 dark:text-slate-700" />
                  <p>No perfume products match your criteria.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredProducts.map((p) => {
                    const isOutOfStock = p.current_stock_units <= 0;
                    return (
                      <Card
                        key={p.product_id}
                        variant="elevated"
                        onClick={() => {
                          if (!isOutOfStock) addToCart(p);
                        }}
                        className={`group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs transition-all flex flex-col justify-between p-4 ${
                          isOutOfStock
                            ? "opacity-60 cursor-not-allowed border-rose-500/20"
                            : "cursor-pointer hover:border-amber-500/50 hover:shadow-md"
                        }`}
                      >
                        <div>
                          {/* Top Header: Luxury Badge & Stock Pill */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-blue-600 dark:text-blue-400 font-bold text-xs tracking-wide uppercase whitespace-nowrap">
                              💎 Perfume
                            </span>
                            {isOutOfStock ? (
                              <span className="text-[10px] font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded whitespace-nowrap">
                                Out of Stock
                              </span>
                            ) : (
                              <span
                                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded whitespace-nowrap ${
                                  p.current_stock_units <= p.reorder_threshold_units
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                }`}
                              >
                                {p.current_stock_units} Stock
                              </span>
                            )}
                          </div>

                          {/* Fragrance Title & SKU */}
                          <div className="h-12 flex flex-col justify-start">
                            <h4
                              className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-1.5 break-words leading-tight line-clamp-1 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors"
                              title={p.name}
                            >
                              {p.name}
                            </h4>
                            <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mt-0.5 truncate whitespace-nowrap" title={`${p.sku} • ${p.size_ml}ml Spray Bottle`}>
                              {p.sku} • {p.size_ml}ml Spray Bottle
                            </p>
                          </div>

                          {/* Prominent Bottle Size Badge */}
                          <div className="mt-2 py-2 px-3 bg-amber-500/10 dark:bg-amber-500/15 rounded-lg border border-amber-500/25 text-center">
                            <span className="text-sm font-bold font-serif text-slate-900 dark:text-slate-100 tracking-wide">
                              {p.size_ml}ml Perfume
                            </span>
                          </div>
                        </div>

                        {/* Bottom Action Footer */}
                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-[10px] text-slate-400 block font-medium">Selling Rate</span>
                            <span className="font-bold font-mono text-amber-700 dark:text-amber-400 text-sm whitespace-nowrap">
                              {formatPaisaToRupees(p.retail_price_paisa)}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="primary"
                            disabled={isOutOfStock}
                            className={`w-8 h-8 p-0 rounded-lg flex items-center justify-center shrink-0 shadow-xs hover:scale-105 active:scale-95 ${
                              isOutOfStock ? "opacity-30 cursor-not-allowed" : ""
                            }`}
                            title="Add to Cart"
                          >
                            <Plus className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )
            ) : filteredProducts.length === 0 && filteredAttars.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2">
                <ShoppingBag className="w-12 h-12 text-slate-400 dark:text-slate-700" />
                <p>No perfume or attar products match your search criteria.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* 1. Perfume Cards */}
                {filteredProducts.map((p) => {
                  const isOutOfStock = p.current_stock_units <= 0;
                  return (
                    <Card
                      key={p.product_id}
                      variant="elevated"
                      onClick={() => {
                        if (!isOutOfStock) addToCart(p);
                      }}
                      className={`group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs transition-all flex flex-col justify-between p-4 ${
                        isOutOfStock
                          ? "opacity-60 cursor-not-allowed border-rose-500/20"
                          : "cursor-pointer hover:border-amber-500/50 hover:shadow-md"
                      }`}
                    >
                      <div>
                        {/* Top Header: Luxury Badge & Stock Pill */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-blue-600 dark:text-blue-400 font-bold text-xs tracking-wide uppercase whitespace-nowrap">
                            💎 Perfume
                          </span>
                          {isOutOfStock ? (
                            <span className="text-[10px] font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded whitespace-nowrap">
                              Out of Stock
                            </span>
                          ) : (
                            <span
                              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded whitespace-nowrap ${
                                p.current_stock_units <= p.reorder_threshold_units
                                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              }`}
                            >
                              {p.current_stock_units} Stock
                            </span>
                          )}
                        </div>

                        {/* Fragrance Title & SKU */}
                        <div className="h-12 flex flex-col justify-start">
                          <h4
                            className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-1.5 break-words leading-tight line-clamp-1 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors"
                            title={p.name}
                          >
                            {p.name}
                          </h4>
                          <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mt-0.5 truncate whitespace-nowrap" title={`${p.sku} • ${p.size_ml}ml Spray Bottle`}>
                            {p.sku} • {p.size_ml}ml Spray Bottle
                          </p>
                        </div>

                        {/* Prominent Bottle Size Badge */}
                        <div className="mt-2 py-2 px-3 bg-amber-500/10 dark:bg-amber-500/15 rounded-lg border border-amber-500/25 text-center">
                          <span className="text-sm font-bold font-serif text-slate-900 dark:text-slate-100 tracking-wide">
                            {p.size_ml}ml Perfume
                          </span>
                        </div>
                      </div>

                      {/* Bottom Action Footer */}
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[10px] text-slate-400 block font-medium">Selling Rate</span>
                          <span className="font-bold font-mono text-amber-700 dark:text-amber-400 text-sm whitespace-nowrap">
                            {formatPaisaToRupees(p.retail_price_paisa)}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={isOutOfStock}
                          className={`w-8 h-8 p-0 rounded-lg flex items-center justify-center shrink-0 shadow-xs hover:scale-105 active:scale-95 ${
                            isOutOfStock ? "opacity-30 cursor-not-allowed" : ""
                          }`}
                          title="Add to Cart"
                        >
                          <Plus className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                        </Button>
                      </div>
                    </Card>
                  );
                })}

                {/* 2. Attar Cards */}
                {filteredAttars.map((a) => (
                  <Card
                    key={a.attar_id}
                    variant="elevated"
                    onClick={() => {
                      setSelectedAttarForDecant(a);
                      setDecantUnit("TOLA");
                      setDecantQty(1);
                      setDecantCustomRateRupees(Math.round(a.selling_price_per_tola_paisa / 100).toString());
                    }}
                    className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs transition-all flex flex-col justify-between p-4 cursor-pointer hover:border-emerald-500/50 hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold text-[11px] tracking-wide uppercase">
                          <Droplets className="w-3.5 h-3.5 fill-emerald-500/20 text-emerald-600 dark:text-emerald-400" />
                          <span>💧 Attar Oil</span>
                        </div>
                        <span className="text-[10px] font-mono font-medium text-slate-400 dark:text-slate-500">
                          {a.sku}
                        </span>
                      </div>

                      <h4
                        className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-2 break-words leading-tight line-clamp-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors"
                        title={a.name}
                      >
                        {a.name}
                      </h4>
                      <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mt-0.5 truncate whitespace-nowrap h-4">
                        {((a.density_grams_per_ml || 1000) / 1000).toFixed(3)} g/ml • Pure Blend
                      </p>

                      {/* Prominent Attar Oil Badge */}
                      <div className="mt-3 py-2 px-3 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-lg border border-emerald-500/30 text-center">
                        <span className="text-sm font-bold font-serif text-emerald-800 dark:text-emerald-200 tracking-wide">
                          Attar Oil
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        1 Tola: Rs. {Math.round(a.selling_price_per_tola_paisa / 100).toLocaleString()}
                      </span>
                      <Button
                        size="sm"
                        variant="primary"
                        className="w-8 h-8 p-0 rounded-lg flex items-center justify-center shrink-0 shadow-xs hover:scale-105 active:scale-95"
                        title="Dispense Attar"
                      >
                        <Plus className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Section: Active Cart & Settle Panel */}
        <div className="w-80 md:w-96 lg:w-[420px] shrink-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col h-full min-h-0 overflow-hidden shadow-xl">
          {/* Cart Header */}
          <div className="shrink-0 px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <h3 className="font-bold text-slate-900 dark:text-slate-100">Counter Order Cart</h3>
            </div>
            {cart.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearCart}
                className="text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 text-xs gap-1 h-7 px-2 font-semibold"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear [F4]</span>
              </Button>
            )}
          </div>

          {/* Cart Items List */}
          <div className="flex-1 min-h-0 p-4 overflow-y-auto space-y-3">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 space-y-2">
                <ShoppingBag className="w-10 h-10 text-slate-300 dark:text-slate-800" />
                <p className="text-xs">Cart is empty. Click a perfume or scan barcode.</p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.product_id}
                  className="p-3 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h5 className="font-semibold text-slate-900 dark:text-slate-100 text-xs leading-tight">
                        {item.name}
                      </h5>
                      <span className="text-[10px] font-mono text-slate-500">
                        {item.sku} ({item.size_ml}ml)
                      </span>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.product_id)}
                      className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    {/* Quantity & Tester Controls */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg">
                        <button
                          onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                          className="px-2 py-1 text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-3 text-xs font-mono font-bold text-slate-900 dark:text-slate-100">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                          className="px-2 py-1 text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Tester Bottle & Sample Selection (Default 1 ml & Custom Options) */}
                      {!item.attar_id && item.item_type !== "OFFER_BUNDLE" && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCartItemForTester(item);
                            const currentMl = item.size_ml || 1;
                            if ([1, 2, 3, 5].includes(currentMl)) {
                              setTesterPresetMl(currentMl as 1 | 2 | 3 | 5);
                            } else {
                              setTesterPresetMl("CUSTOM");
                              setCustomTesterMl(currentMl);
                            }
                            setTesterPriceRupees(item.is_tester ? String(Math.round(item.unit_price_paisa / 100)) : "0");
                          }}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-colors ${
                            item.is_tester
                              ? "bg-purple-600 text-white shadow-xs hover:bg-purple-700"
                              : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                          }`}
                          title="Dispense as tester sample decant (Default 1 ml or Custom ml)"
                        >
                          <FlaskConical className="w-3 h-3" />
                          <span>{item.is_tester ? `Tester (${item.size_ml || 1}ml)` : "Tester"}</span>
                        </button>
                      )}
                    </div>

                    {/* Price Calculation & Cashier Custom Rate Adjustment */}
                    <div className="text-right flex flex-col items-end">
                      <div className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400">
                        {formatPaisaToRupees(item.line_total_paisa)}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                        <span className="text-[9px] uppercase text-slate-400">Rate:</span>
                        <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-1 py-0.5 shadow-2xs">
                          <span className="text-[10px] font-mono font-semibold text-slate-500 mr-0.5">Rs</span>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={(item.unit_price_paisa / 100).toString()}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val) && val >= 0) {
                                updateUnitPrice(item.product_id, Math.round(val * 100));
                              }
                            }}
                            className="w-16 text-right font-mono font-bold text-xs bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none"
                            title="Cashier can adjust or increase selling price per unit"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cart Financial Summary & Checkout Action */}
          <div className="shrink-0 p-4 lg:p-5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 space-y-3 z-10 shadow-lg">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Gross Subtotal ({totals.totalQuantity} items):</span>
                <span className="font-mono text-slate-900 dark:text-slate-200 font-semibold">
                  {formatPaisaToRupees(totals.grossTotalPaisa)}
                </span>
              </div>
              {totals.itemDiscountPaisa > 0 && (
                <div className="flex justify-between text-rose-600 dark:text-rose-400">
                  <span>Item Discounts:</span>
                  <span className="font-mono font-semibold">
                    -{formatPaisaToRupees(totals.itemDiscountPaisa)}
                  </span>
                </div>
              )}
              {specialDiscountPaisa > 0 && (
                <div className="flex justify-between text-rose-600 dark:text-rose-400">
                  <span>Special Discount:</span>
                  <span className="font-mono font-semibold">
                    -{formatPaisaToRupees(specialDiscountPaisa)}
                  </span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between items-baseline">
                <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">Net Payable:</span>
                <span className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-400">
                  {formatPaisaToRupees(totals.netPayablePaisa)}
                </span>
              </div>
            </div>

            {/* Quick Settle Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                variant="outline"
                disabled={cart.length === 0}
                onClick={openQuickCashModal}
                className="gap-1.5 text-xs h-11 font-semibold border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
              >
                <Zap className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Quick Cash [F9]</span>
              </Button>
              <Button
                variant="primary"
                disabled={cart.length === 0}
                onClick={openPaymentModal}
                className="gap-1.5 text-xs font-bold h-11 bg-amber-500 hover:bg-amber-400 text-slate-950"
              >
                <CreditCard className="w-4 h-4 shrink-0" />
                <span>Settle & Pay [F12]</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Express Quick Cash Checkout Dialog Modal [F9] */}
      <Dialog
        open={isQuickCashModalOpen}
        onClose={() => setIsQuickCashModalOpen(false)}
        title="⚡ Express Quick Cash Checkout [F9]"
        description="Fast 1-click cash transaction with automatic drawer release and thermal receipt."
        maxWidth="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleQuickCashCheckout();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleQuickCashCheckout();
            }
          }}
          className="space-y-4 pt-1"
        >
          {/* Large Net Payable Display */}
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl flex flex-col items-center justify-center text-center">
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
              Total Net Amount Due
            </span>
            <span className="text-3xl font-extrabold font-mono text-emerald-700 dark:text-emerald-400 mt-1">
              {formatPaisaToRupees(totals.netPayablePaisa)}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
              {cart.reduce((sum, item) => sum + item.quantity, 0)} items in counter cart
            </span>
          </div>

          {/* Salesperson / Attendant Floor Staff Selector */}
          <div className="space-y-1.5 p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Served / Assisted By Employee (Floor Staff):</span>
            </label>
            <select
              value={salespersonId}
              onChange={(e) => setSalespersonId(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
            >
              {salespersons.map((sp) => (
                <option key={sp.salesperson_id} value={sp.salesperson_id}>
                  {sp.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Cash Tendered Input */}
          <div className="space-y-2 p-3.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl">
            <Input
              label="Cash Received from Customer (PKR)"
              type="number"
              value={tenderedCashRupees}
              onChange={(e) => setTenderedCashRupees(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleQuickCashCheckout();
                }
              }}
              className="font-mono text-xl font-bold text-amber-600 dark:text-amber-400"
              autoFocus
            />

            {/* Quick Currency Notes */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                { label: "Exact", val: totals.netPayablePaisa / 100 },
                { label: "Rs. 500", val: 500 },
                { label: "Rs. 1,000", val: 1000 },
                { label: "Rs. 5,000", val: 5000 },
                { label: "Rs. 10,000", val: 10000 },
                { label: "Rs. 20,000", val: 20000 },
              ].map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={() => setTenderedCashRupees(btn.val.toString())}
                  className="px-2.5 py-1 text-xs bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg font-mono font-medium cursor-pointer transition-colors"
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Change to Return Calculation */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-600 dark:text-slate-400 font-medium">Change to Return:</span>
              <span className="text-base font-bold font-mono text-emerald-700 dark:text-emerald-400">
                {formatPaisaToRupees(changeDuePaisa)}
              </span>
            </div>

            {changeDuePaisa > 0 && (
              <button
                type="button"
                onClick={handleApplyTenderAsFinalPrice}
                className="w-full mt-2 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs flex items-center justify-between shadow-md transition-all cursor-pointer select-none"
              >
                <span className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-slate-950" />
                  <span>Sell at Rs. {Math.round(tenderedPaisa / 100).toLocaleString()} (No Change Return)</span>
                </span>
                <span className="bg-slate-950/20 px-2 py-0.5 rounded text-[11px] font-mono">
                  Adjust Selling Rate
                </span>
              </button>
            )}
          </div>

          {/* Direct Thermal Print Toggle */}
          <label className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoPrintReceipt}
              onChange={(e) => setAutoPrintReceipt(e.target.checked)}
              className="w-4 h-4 text-emerald-500 rounded focus:ring-emerald-500"
            />
            <span className="font-medium text-slate-800 dark:text-slate-200">
              🖨️ Auto-print 80mm thermal receipt upon sale completion
            </span>
          </label>

          {/* Quick Cash Action Buttons */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsQuickCashModalOpen(false)}
              className="w-1/3 text-xs"
            >
              Cancel [Esc]
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isSubmitting}
              className="w-2/3 gap-2 font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
            >
              {isSubmitting ? (
                <span>Recording Sale...</span>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span>Confirm Cash Sale</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Payment & Tender Dialog Modal */}
      <Dialog
        open={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Counter Settle & Tender Payment"
        description="Select payment tender method and record tendered currency."
        maxWidth="md"
      >
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            handleCheckout();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleCheckout();
            }
          }}
        >
          {/* Amount Due Banner */}
          <div className="p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/20 rounded-xl flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Total Amount Due:</span>
            <span className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-400">
              {formatPaisaToRupees(totals.netPayablePaisa)}
            </span>
          </div>

          {/* Cashier & Salesperson Attribution for this sale */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Active Cashier</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">
                  {currentUser?.role === "SUPER_ADMIN" ? "Admin Selectable" : "Assigned"}
                </span>
              </label>
              {currentUser?.role === "SUPER_ADMIN" ? (
                <select
                  value={activeCashierId}
                  onChange={(e) => handleSwitchCashier(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-emerald-400/60 dark:border-emerald-600/60 text-slate-900 dark:text-slate-100 text-xs rounded-lg px-3 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                >
                  {cashierUsers.map((u) => (
                    <option key={u.user_id} value={u.user_id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 py-1">
                      {u.full_name} ({u.username})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs rounded-lg px-3 py-2 font-semibold flex items-center justify-between">
                  <span>{currentUser?.full_name || "Counter Cashier"}</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Verified</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Floor Salesperson</span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-normal">Attribution</span>
              </label>
              <select
                value={salespersonId}
                onChange={(e) => setSalespersonId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs rounded-lg px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              >
                {salespersons.map((sp) => (
                  <option key={sp.salesperson_id} value={sp.salesperson_id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 py-1">
                    {sp.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Payment Method Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedPaymentMethod("CASH")}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 cursor-pointer transition-all ${
                  selectedPaymentMethod === "CASH"
                    ? "bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-300 font-bold shadow-xs"
                    : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                <Banknote className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-semibold">Cash Drawer</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPaymentMethod("EASYPAISA")}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 cursor-pointer transition-all ${
                  selectedPaymentMethod === "EASYPAISA"
                    ? "bg-emerald-500/15 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-bold shadow-xs"
                    : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                <Smartphone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-semibold">EasyPaisa</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPaymentMethod("JAZZCASH")}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 cursor-pointer transition-all ${
                  selectedPaymentMethod === "JAZZCASH"
                    ? "bg-rose-500/15 border-rose-500 text-rose-800 dark:text-rose-300 font-bold shadow-xs"
                    : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                <Smartphone className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                <span className="text-xs font-semibold">JazzCash</span>
              </button>
            </div>
          </div>

          {/* EasyPaisa Transfer Details */}
          {selectedPaymentMethod === "EASYPAISA" && (
            <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  <span>EasyPaisa Shop Account:</span>
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  0300-1234567 (Ameer Perfumes)
                </span>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block">
                  Customer Transfer Transaction ID (TID) or Sender Mobile # *
                </label>
                <Input
                  placeholder="e.g. TID 9876543210 or 03XX-XXXXXXX"
                  value={digitalWalletTid}
                  onChange={(e) => setDigitalWalletTid(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>
          )}

          {/* JazzCash Transfer Details */}
          {selectedPaymentMethod === "JAZZCASH" && (
            <div className="p-3.5 bg-rose-500/5 border border-rose-500/20 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-rose-600" />
                  <span>JazzCash Shop Account:</span>
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  0300-7654321 (Ameer Perfumes)
                </span>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block">
                  Customer Transfer Transaction ID (TID) or Sender Mobile # *
                </label>
                <Input
                  placeholder="e.g. TID 1234567890 or 03XX-XXXXXXX"
                  value={digitalWalletTid}
                  onChange={(e) => setDigitalWalletTid(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>
          )}

          {/* Order Financial Summary & Live Discount Synchronizer */}
          <div className="p-3.5 bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400 font-medium">Gross Items Total:</span>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                {formatPaisaToRupees(totals.grossTotalPaisa)}
              </span>
            </div>

            {/* Special Discount Field */}
            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200 dark:border-slate-800">
              <label className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                <span>Special Discount (PKR):</span>
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-rose-500 font-mono font-bold">-Rs.</span>
                <input
                  type="number"
                  placeholder="0"
                  value={specialDiscountPaisa / 100 || ""}
                  onChange={(e) => handleSpecialDiscountChange(e.target.value)}
                  className="bg-white dark:bg-slate-950 border border-rose-300 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 text-xs rounded-lg px-2.5 py-1 w-28 focus:outline-none focus:ring-2 focus:ring-rose-500/40 font-mono font-bold text-right"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200 dark:border-slate-800">
              <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">Net Payable Due:</span>
              <span className="font-mono text-lg font-extrabold text-amber-600 dark:text-amber-400">
                {formatPaisaToRupees(totals.netPayablePaisa)}
              </span>
            </div>
          </div>

          {/* Cash Tender Input & Denominations */}
          {selectedPaymentMethod === "CASH" && (
            <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl">
              <Input
                label="Cash Received (PKR)"
                type="number"
                value={tenderedCashRupees}
                onChange={(e) => setTenderedCashRupees(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCheckout();
                  }
                }}
                className="font-mono text-lg font-bold text-amber-700 dark:text-amber-400"
              />

              {/* Quick Cash Denomination Buttons */}
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  { label: "Exact", val: totals.netPayablePaisa / 100 },
                  { label: "Rs. 5,000", val: 5000 },
                  { label: "Rs. 10,000", val: 10000 },
                  { label: "Rs. 20,000", val: 20000 },
                  { label: "Rs. 50,000", val: 50000 },
                ].map((btn) => (
                  <button
                    key={btn.label}
                    type="button"
                    onClick={() => setTenderedCashRupees(btn.val.toString())}
                    className="px-2.5 py-1 text-xs bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded font-mono font-medium cursor-pointer transition-colors"
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              {/* Change Calculation */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-600 dark:text-slate-400 font-medium">Change to Return:</span>
                <span className="text-base font-bold font-mono text-emerald-700 dark:text-emerald-400">
                  {formatPaisaToRupees(changeDuePaisa)}
                </span>
              </div>

              {changeDuePaisa > 0 && (
                <button
                  type="button"
                  onClick={handleApplyTenderAsFinalPrice}
                  className="w-full mt-2 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs flex items-center justify-between shadow-md transition-all cursor-pointer select-none"
                >
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-slate-950" />
                    <span>Sell at Rs. {Math.round(tenderedPaisa / 100).toLocaleString()} (No Change Return)</span>
                  </span>
                  <span className="bg-slate-950/20 px-2 py-0.5 rounded text-[11px] font-mono">
                    Adjust Selling Rate
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Direct Thermal Print Toggle Checkbox */}
          <label className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoPrintReceipt}
              onChange={(e) => setAutoPrintReceipt(e.target.checked)}
              className="w-4 h-4 text-amber-500 rounded focus:ring-amber-500"
            />
            <span className="font-medium text-slate-800 dark:text-slate-200">
              🖨️ Auto-print 80mm thermal receipt upon sale completion
            </span>
          </label>

          {/* Privacy Invariant Notice */}
          <div className="p-2.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/20 rounded-xl flex items-center gap-2 text-xs text-amber-900 dark:text-amber-300">
            <ShieldCheck className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>Customer Slip Privacy: Customer print slip will strictly omit staff & cashier names.</span>
          </div>

          {/* Submit Action */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isSubmitting}
            className="w-full gap-2 font-bold text-sm"
          >
            {isSubmitting ? (
              <span>Recording Sale in SQLite...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm Payment & Complete Sale</span>
              </>
            )}
          </Button>
        </form>
      </Dialog>







      {/* 3. Sales History & Invoices Modal */}
      <Dialog
        open={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title="Recent Sales & Invoices History"
        maxWidth="5xl"
      >
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1">
              <Input
                placeholder="Filter by invoice # (e.g. INV-), product name, customer phone, cashier, or salesperson..."
                value={historySearchQuery}
                onChange={(e) => {
                  setHistorySearchQuery(e.target.value);
                  setHistoryPage(1);
                }}
                icon={<Search className="w-4 h-4 text-amber-500" />}
                className="h-9 text-xs"
              />
            </div>

            {/* Date Period Filter Buttons */}
            <div className="flex items-center bg-slate-200 dark:bg-slate-900 p-1 rounded-xl border border-slate-300 dark:border-slate-800 text-xs shrink-0">
              <button
                type="button"
                onClick={() => { setHistoryPeriod("ALL"); setHistoryPage(1); }}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  historyPeriod === "ALL" ? "bg-amber-500 text-slate-950 shadow-xs" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => { setHistoryPeriod("TODAY"); setHistoryPage(1); }}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  historyPeriod === "TODAY" ? "bg-amber-500 text-slate-950 shadow-xs" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => { setHistoryPeriod("WEEK"); setHistoryPage(1); }}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  historyPeriod === "WEEK" ? "bg-amber-500 text-slate-950 shadow-xs" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Weekly
              </button>
              <button
                type="button"
                onClick={() => { setHistoryPeriod("MONTH"); setHistoryPage(1); }}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  historyPeriod === "MONTH" ? "bg-amber-500 text-slate-950 shadow-xs" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => { setHistoryPeriod("YEAR"); setHistoryPage(1); }}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  historyPeriod === "YEAR" ? "bg-amber-500 text-slate-950 shadow-xs" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Yearly
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleOpenHistory}
                disabled={isHistoryLoading}
                className="gap-1.5 text-xs cursor-pointer"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isHistoryLoading ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </Button>
            </div>
          </div>

          {(() => {
            const filteredSales = recentSales.filter((s) => {
              if (!isDateInPKTPeriod(s.invoice_date, historyPeriod)) {
                return false;
              }
              if (!historySearchQuery.trim()) return true;
              const q = historySearchQuery.toLowerCase();
              return (
                s.invoice_number.toLowerCase().includes(q) ||
                s.customer_phone.toLowerCase().includes(q) ||
                (s.product_names && s.product_names.toLowerCase().includes(q)) ||
                (s.cashier_name && s.cashier_name.toLowerCase().includes(q)) ||
                (s.salesperson_name && s.salesperson_name.toLowerCase().includes(q)) ||
                (s.order_source && s.order_source.toLowerCase().includes(q))
              );
            });

            const totalHistoryRevenue = filteredSales.reduce((acc, s) => acc + s.net_payable_paisa, 0);
            const totalHistoryBottles = filteredSales.reduce((acc, s) => acc + s.total_units, 0);
            const totalHistoryPages = Math.max(1, Math.ceil(filteredSales.length / 4));
            const currentHistoryPage = Math.min(Math.max(1, historyPage), totalHistoryPages);
            const pagedSales = filteredSales.slice((currentHistoryPage - 1) * 4, currentHistoryPage * 4);

            return (
              <>
                {/* Summary KPI & Export Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-amber-500/10 dark:bg-amber-500/5 rounded-xl border border-amber-500/20 text-xs">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 font-mono">Period: </span>
                      <span className="font-bold text-amber-600 dark:text-amber-400 font-mono uppercase">{historyPeriod}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 font-mono">Invoices: </span>
                      <span className="font-bold font-mono text-slate-900 dark:text-slate-100">{filteredSales.length}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 font-mono">Total Revenue: </span>
                      <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                        {formatPaisaToRupees(totalHistoryRevenue)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 font-mono">Units Sold: </span>
                      <span className="font-bold font-mono text-purple-600 dark:text-purple-400">{totalHistoryBottles}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        exportSalesHistoryToCSV(filteredSales, `Ameer_POS_Sales_${historyPeriod}`);
                        setHistoryExportFeedback(`✓ Excel Report exported successfully! Saved ${filteredSales.length} invoice records to your Downloads folder.`);
                        setTimeout(() => setHistoryExportFeedback(null), 4000);
                      }}
                      className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 shadow-xs"
                      title="Export filtered sales history to Microsoft Excel (.csv)"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Excel (CSV)</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handlePrintHistoryA4(filteredSales, totalHistoryRevenue, totalHistoryBottles, historyPeriod)}
                      className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                      title="Print comprehensive A4 audit report on laser/inkjet printer"
                    >
                      <FileText className="w-3.5 h-3.5 text-amber-600" />
                      <span>Print A4 Report</span>
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handlePrintHistoryThermal(filteredSales, totalHistoryRevenue, totalHistoryBottles, historyPeriod)}
                      className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Print compact sales history slip on 80mm thermal receipt printer"
                    >
                      <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Print 80mm Slip</span>
                    </Button>
                  </div>
                </div>

                {historyExportFeedback && (
                  <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-800 dark:text-emerald-300 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between shadow-xs animate-fadeIn">
                    <div className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>{historyExportFeedback}</span>
                    </div>
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono bg-emerald-500/20 px-2 py-0.5 rounded">
                      Downloads Folder
                    </span>
                  </div>
                )}
                <div className="max-h-[460px] overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 scrollbar-thin">
                  <table className="min-w-[1050px] w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-900 sticky top-0 text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 select-none">
                      <tr>
                        <th className="py-2.5 px-3 whitespace-nowrap">Invoice #</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Date & Time</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Customer Phone</th>
                        <th className="py-2.5 px-3 min-w-[200px]">Products Sold</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Channel</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Cashier</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Salesperson</th>
                        <th className="py-2.5 px-3 text-center whitespace-nowrap">Items & Qty</th>
                        <th className="py-2.5 px-3 text-center whitespace-nowrap">Payment</th>
                        <th className="py-2.5 px-3 text-right whitespace-nowrap">Net Payable</th>
                        <th className="py-2.5 px-3 text-center whitespace-nowrap">Print Slip</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 bg-white dark:bg-slate-950">
                      {isHistoryLoading ? (
                        <tr>
                          <td colSpan={11} className="py-10 text-center text-slate-500">
                            Loading sales invoices from SQLite...
                          </td>
                        </tr>
                      ) : pagedSales.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="py-10 text-center text-slate-500">
                            No sales records found matching filter.
                          </td>
                        </tr>
                      ) : (
                        pagedSales.map((sale) => (
                          <tr
                            key={sale.invoice_id}
                            className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                          >
                            <td className="py-2.5 px-3 font-mono font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                              <div className="flex items-center gap-1.5 flex-nowrap">
                                <span className="whitespace-nowrap">{sale.invoice_number}</span>
                                {sale.is_returned && (
                                  sale.return_status === "PARTIAL" ? (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-400/40 uppercase tracking-wider whitespace-nowrap" title={`${sale.returned_units} of ${sale.total_units} units returned`}>
                                      <RotateCcw className="w-2.5 h-2.5" />
                                      Partial Return ({sale.returned_units}/{sale.total_units})
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-400/40 uppercase tracking-wider whitespace-nowrap">
                                      <RotateCcw className="w-2.5 h-2.5" />
                                      Full Return
                                    </span>
                                  )
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">
                              {formatLocalDateTime(sale.invoice_date)}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                              {sale.customer_phone || "—"}
                            </td>
                            <td className="py-2.5 px-3">
                              {sale.items_detail && sale.items_detail.length > 0 ? (
                                <div className="flex flex-col gap-1 max-w-[320px]">
                                  {sale.items_detail.map((it, idx) => {
                                    const cleanName = it.product_name
                                      .replace(/\[\s*(\d+)\s*ml\s*Crystal\s*Bottle\s*\]/gi, "($1ml)")
                                      .replace(/\[\s*(\d+)\s*ml\s*Mini\s*Bottle\s*\]/gi, "($1ml)")
                                      .replace(/Crystal\s*Bottle/gi, "")
                                      .replace(/Mini\s*Bottle/gi, "")
                                      .replace(/\s{2,}/g, " ")
                                      .trim();
                                    const isFullRet = it.returned_quantity >= it.quantity && it.quantity > 0;
                                    const isPartRet = it.returned_quantity > 0 && it.returned_quantity < it.quantity;

                                    return (
                                      <div key={idx} className="flex items-center gap-1.5 flex-wrap text-xs">
                                        <span className={isFullRet ? "line-through text-slate-400 dark:text-slate-500" : "text-slate-800 dark:text-slate-200 font-medium"}>
                                          {cleanName}
                                        </span>
                                        {isFullRet && (
                                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800 shrink-0">
                                            Returned ({it.returned_quantity})
                                          </span>
                                        )}
                                        {isPartRet && (
                                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800 shrink-0">
                                            Partially Returned ({it.returned_quantity}/{it.quantity})
                                          </span>
                                        )}
                                        {!isFullRet && !isPartRet && sale.return_status === "PARTIAL" && (
                                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 shrink-0">
                                            Active ({it.quantity})
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div
                                  className="text-xs text-slate-800 dark:text-slate-200 font-medium line-clamp-2 max-w-[280px]"
                                  title={sale.product_names || "Fragrance / Attar"}
                                >
                                  {(sale.product_names || "Fragrance / Attar")
                                    .replace(/\[\s*(\d+)\s*ml\s*Crystal\s*Bottle\s*\]/gi, "($1ml)")
                                    .replace(/\[\s*(\d+)\s*ml\s*Mini\s*Bottle\s*\]/gi, "($1ml)")
                                    .replace(/Crystal\s*Bottle/gi, "")
                                    .replace(/Mini\s*Bottle/gi, "")
                                    .replace(/\s{2,}/g, " ")
                                    .trim()}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <Badge
                                variant={
                                  sale.order_source === "WHATSAPP"
                                    ? "success"
                                    : sale.order_source === "WEBSITE"
                                    ? "gold"
                                    : "neutral"
                                }
                                className="text-[10px] px-2 py-0.5 whitespace-nowrap"
                              >
                                {sale.order_source === "WHATSAPP"
                                  ? "💬 WhatsApp"
                                  : sale.order_source === "WEBSITE"
                                  ? "🌐 Website"
                                  : sale.order_source === "PHONE"
                                  ? "📞 Phone"
                                  : "🏪 Shop"}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                <span>{sale.cashier_name || "Primary Cashier"}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <UserCheck className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span>{sale.salesperson_name || "Direct Store"}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                {sale.total_units || sale.items_count}
                              </span>
                              <span className="text-[10px] text-slate-500 ml-1">
                                ({sale.items_count} {sale.items_count === 1 ? "SKU" : "SKUs"})
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <Badge variant="neutral" className="text-[10px] font-mono whitespace-nowrap">
                                {sale.payment_method === "BANK_TRANSFER"
                                  ? "🏦 Bank"
                                  : sale.payment_method === "CARD"
                                  ? "💳 Card"
                                  : sale.payment_method === "DIGITAL_WALLET"
                                  ? "🟣 Raast"
                                  : sale.payment_method === "EASYPAISA"
                                  ? "📱 EasyPaisa"
                                  : sale.payment_method === "JAZZCASH"
                                  ? "📱 JazzCash"
                                  : "💵 Cash"}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                              {formatPaisaToRupees(sale.net_payable_paisa)}
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => {
                                  const mockInvoice: import("@/types/database").SalesInvoiceResult = {
                                    success: true,
                                    invoice_id: sale.invoice_id,
                                    invoice_number: sale.invoice_number,
                                    invoice_date: sale.invoice_date,
                                    terminal_id: "POS-01",
                                    gross_total_paisa: sale.net_payable_paisa,
                                    discount_paisa: 0,
                                    net_payable_paisa: sale.net_payable_paisa,
                                    change_due_paisa: 0,
                                    items_count: sale.items_count,
                                    receipt_privacy_enforced: true,
                                    store_name: "AMEER PERFUMES",
                                    store_phone: "WhatsApp: 03100988522",
                                    store_address: "Main Branch Sports Complex Bannu",
                                    ntn: "STRN/NTN Registered",
                                    items:
                                      sale.items_detail && sale.items_detail.length > 0
                                        ? sale.items_detail.map((it) => ({
                                            product_name: it.product_name,
                                            size_ml: 50,
                                            quantity: it.quantity,
                                            unit_price_paisa: 0,
                                            line_total_paisa: 0,
                                          }))
                                        : [
                                            {
                                              product_name: sale.product_names || "Fragrance Purchase",
                                              size_ml: 50,
                                              quantity: sale.total_units || 1,
                                              unit_price_paisa: Math.round(sale.net_payable_paisa / (sale.total_units || 1)),
                                              line_total_paisa: sale.net_payable_paisa,
                                            },
                                          ],
                                  };
                                  printReceipt(mockInvoice);
                                }}
                                className="px-2 py-1 text-[11px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 rounded inline-flex items-center gap-1 cursor-pointer transition-colors"
                                title="Reprint 80mm thermal receipt slip"
                              >
                                <Printer className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                <span>Reprint</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    Showing <span className="font-bold text-slate-900 dark:text-slate-100">{pagedSales.length}</span> of{" "}
                    <span className="font-bold text-slate-900 dark:text-slate-100">{filteredSales.length}</span> invoices (Page {currentHistoryPage} of {totalHistoryPages})
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                      disabled={currentHistoryPage <= 1}
                      className="text-xs px-3 py-1 cursor-pointer disabled:opacity-40"
                    >
                      ◀ Previous
                    </Button>
                    <span className="text-xs font-mono px-2 font-bold text-amber-600 dark:text-amber-400">
                      {currentHistoryPage} / {totalHistoryPages}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                      disabled={currentHistoryPage >= totalHistoryPages}
                      className="text-xs px-3 py-1 cursor-pointer disabled:opacity-40"
                    >
                      Next ▶
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setIsHistoryModalOpen(false)}
                      className="text-xs ml-3 px-4"
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </Dialog>



      {/* Special Offers & Promotional Bundles Modal [F7] */}
      <Dialog
        open={isOffersModalOpen}
        onClose={() => setIsOffersModalOpen(false)}
        title="🎁 Special Promotional Offers & Festive Bundles [F7]"
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <div>
              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-amber-500" />
                Curated Bundles & Timed Special Promotions
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Multi-product deals (Attar oils, Perfumes, Combos) with proportional discounts and accurate inventory tracking.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={refreshOffers}
                className="gap-1.5 text-xs"
              >
                <Clock className="w-3.5 h-3.5" />
                Refresh
              </Button>
              {isSuperAdminOrManager && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleOpenCreateOffer}
                  className="gap-2 text-xs font-bold whitespace-nowrap px-4 py-2 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-slate-950 shadow-md shadow-amber-500/25 rounded-xl cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-slate-950 stroke-[3]" />
                  <span>+ Create New Offer / Bundle</span>
                </Button>
              )}
            </div>
          </div>

          {isOffersLoading ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Loading active offers...
            </div>
          ) : offersList.length === 0 ? (
            <div className="p-8 text-center text-slate-500 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl space-y-2">
              <Gift className="w-10 h-10 mx-auto text-amber-500 opacity-60 mb-2" />
              <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">No Promotional Offers Configured</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                No active promotional packages found. Click <strong>+ Create New Offer / Bundle</strong> above to configure timed deals for Attars and Perfumes.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-1">
              {offersList.map((offer) => {
                const timeStatus = formatTimeRemaining(offer.end_date);
                const isAttarBundle = offer.items.some((i) => i.item_type === "ATTAR");
                const isOutOfStock = offer.items.length === 0 || offer.items.some((it) => {
                  if (it.item_type === "PERFUME") {
                    const prod = products.find((p) => p.product_id === it.product_id || p.name.toLowerCase() === it.name.toLowerCase());
                    return !prod || prod.current_stock_units <= 0 || prod.current_stock_units < it.quantity;
                  }
                  if (it.item_type === "ATTAR") {
                    const attId = it.attar_id || it.product_id;
                    const att = attars.find((a) => a.attar_id === attId || a.name.toLowerCase() === it.name.toLowerCase());
                    if (!att) return false;
                    return (att as any).is_active === false || (att as any).is_active === 0;
                  }
                  return false;
                });

                return (
                  <div
                    key={offer.offer_id}
                    className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3.5 transition-all shadow-xs overflow-hidden ${
                      timeStatus.isExpired || isOutOfStock
                        ? "opacity-75 border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/40"
                        : isAttarBundle
                        ? "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50"
                        : "border-blue-500/30 bg-blue-500/5 hover:border-blue-500/50"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="gold" className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5">
                            {offer.tag}
                          </Badge>
                          {isOutOfStock && (
                            <Badge variant="danger" className="text-[10px] font-bold px-2 py-0.5">
                              ⚠️ Out of Stock
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border inline-flex items-center gap-1 whitespace-nowrap shadow-2xs ${timeStatus.badgeClass}`}
                          >
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>{timeStatus.text}</span>
                          </span>
                          {isSuperAdminOrManager && (
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                onClick={() => handleOpenEditOffer(offer)}
                                title="Edit this offer"
                                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteOffer(offer.offer_id)}
                                title="Delete this offer"
                                className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg text-rose-500 hover:text-rose-700 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <h4 className="font-serif font-bold text-slate-900 dark:text-slate-100 text-base mt-2.5">
                        {offer.title}
                      </h4>
                      {offer.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                          {offer.description}
                        </p>
                      )}

                      <div className="mt-3 p-3 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 space-y-1.5 text-xs">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                          Included Products ({offer.items.length} items):
                        </span>
                        {offer.items.map((it, idx) => (
                          <div key={idx} className="flex justify-between items-center text-[11px]">
                            <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                              {it.item_type === "ATTAR" ? (
                                <Droplets className="w-3 h-3 text-amber-500" />
                              ) : it.item_type === "TESTER" ? (
                                <FlaskConical className="w-3 h-3 text-purple-500" />
                              ) : (
                                <FlaskConical className="w-3 h-3 text-blue-500" />
                              )}
                              <strong>{it.quantity > 1 ? `${it.quantity}x ` : ""}</strong>
                              {it.name} <span className="text-slate-400">({it.size_label})</span>
                            </span>
                            <span className="text-slate-500 font-mono">
                              Rs. {(it.unit_regular_price * it.quantity).toLocaleString()}
                            </span>
                          </div>
                        ))}

                        <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between font-mono text-[11px]">
                          <span className="text-slate-400">Regular Total:</span>
                          <span className="line-through text-slate-400 font-semibold">
                            Rs. {offer.regular_total.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 mt-auto">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-baseline gap-2">
                          <span className="font-serif font-bold text-lg sm:text-xl text-amber-600 dark:text-amber-400">
                            Rs. {offer.bundle_price.toLocaleString()}
                          </span>
                          <span className="text-[11px] text-slate-400 line-through">
                            Rs. {offer.regular_total.toLocaleString()}
                          </span>
                        </div>
                        <Badge variant="success" className="text-[10px] font-bold whitespace-nowrap">
                          Save Rs. {offer.savings.toLocaleString()} ({offer.discount_percent}%)
                        </Badge>
                      </div>

                      <Button
                        size="sm"
                        variant={timeStatus.isExpired || isOutOfStock ? "secondary" : "primary"}
                        disabled={timeStatus.isExpired || isOutOfStock}
                        onClick={() => {
                          addPromotionalOfferToCart(offer);
                          setIsOffersModalOpen(false);
                        }}
                        className="w-full gap-1.5 font-bold justify-center py-2 text-xs shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isOutOfStock ? "Out of Stock" : timeStatus.isExpired ? "Expired" : "Add Bundle to Cart"}</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              variant="secondary"
              onClick={() => setIsOffersModalOpen(false)}
              className="text-xs"
            >
              Close
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Offer Creator & Editor Dialog */}
      <Dialog
        open={isOfferEditorOpen}
        onClose={() => setIsOfferEditorOpen(false)}
        title={editingOfferId ? `Edit Offer: ${offerFormTitle}` : "🎁 Create New Promotional Offer / Bundle"}
        description="Design multi-product promotional deals (e.g. 3x 6ml Attar oils for Rs. 2,300, or 2x 50ml Perfume sets) with automatic duration countdowns."
        maxWidth="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Offer Title *
              </label>
              <Input
                placeholder="e.g. Artisan Attar 6ml Trio"
                value={offerFormTitle}
                onChange={(e) => setOfferFormTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Badge / Tag *
              </label>
              <div className="flex gap-1.5">
                <Input
                  placeholder="e.g. 3-DAY FLASH SALE"
                  value={offerFormTag}
                  onChange={(e) => setOfferFormTag(e.target.value)}
                  className="flex-1"
                />
                <select
                  className="px-2 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                  onChange={(e) => {
                    if (e.target.value) setOfferFormTag(e.target.value);
                  }}
                  value=""
                >
                  <option value="" disabled>Presets...</option>
                  <option value="3-DAY FLASH SALE">3-DAY FLASH SALE</option>
                  <option value="WEEKEND SPECIAL">WEEKEND SPECIAL</option>
                  <option value="EID SPECIAL">EID SPECIAL</option>
                  <option value="LIMITED EDITION">LIMITED EDITION</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description (Optional)
            </label>
            <Input
              placeholder="e.g. Any 3 assorted pure concentrated attar oils (6ml bottles). Regular Rs. 3,000, now Rs. 2,300."
              value={offerFormDesc}
              onChange={(e) => setOfferFormDesc(e.target.value)}
            />
          </div>

          {/* Offer Expiration & Validity Duration */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                Offer Validity / Auto-Expiration Countdown
              </span>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-slate-500 mr-1">Quick Presets:</span>
                <button
                  type="button"
                  onClick={() => handleSetExpiryDays(3)}
                  className="px-2 py-0.5 text-[11px] font-bold rounded bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                >
                  3 Days
                </button>
                <button
                  type="button"
                  onClick={() => handleSetExpiryDays(7)}
                  className="px-2 py-0.5 text-[11px] font-bold rounded bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                >
                  7 Days
                </button>
                <button
                  type="button"
                  onClick={() => handleSetExpiryDays(15)}
                  className="px-2 py-0.5 text-[11px] font-bold rounded bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
                >
                  15 Days
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="datetime-local"
                value={offerFormEndDate}
                onChange={(e) => setOfferFormEndDate(e.target.value)}
                className="w-full text-xs font-mono"
              />
              <span className="text-xs text-slate-500 whitespace-nowrap">
                {formatTimeRemaining(offerFormEndDate).text}
              </span>
            </div>
          </div>

          {/* Bundle Item Builder */}
          <div className="p-3 border border-amber-500/30 bg-amber-500/5 rounded-xl space-y-3">
            <span className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Add Products to this Offer Bundle
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Product Category
                </label>
                <select
                  value={pickerType}
                  onChange={(e) => setPickerType(e.target.value as "ATTAR" | "PERFUME" | "TESTER")}
                  className="w-full px-2 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                >
                  <option value="ATTAR">Attar Oil</option>
                  <option value="PERFUME">Perfumes</option>
                  <option value="TESTER">Tester</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Select Fragrance
                </label>
                {pickerType === "ATTAR" ? (
                  <select
                    value={pickerSelectedAttarId}
                    onChange={(e) => setPickerSelectedAttarId(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                  >
                    {attars.map((a) => (
                      <option key={a.attar_id} value={a.attar_id}>
                        {a.name} (Tola: Rs. {Math.round(a.selling_price_per_tola_paisa / 100)})
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={pickerSelectedPerfumeId}
                    onChange={(e) => setPickerSelectedPerfumeId(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                  >
                    {products.map((p) => (
                      <option key={p.product_id} value={p.product_id}>
                        {p.name} ({p.size_ml}ml - Rs. {Math.round(p.retail_price_paisa / 100)})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {pickerType === "ATTAR" ? (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Bottle Size
                  </label>
                  <select
                    value={pickerAttarBottleSize}
                    onChange={(e) => setPickerAttarBottleSize(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                  >
                    <option value="3ml">3ml (1/4 Tola)</option>
                    <option value="6ml">6ml (1/2 Tola)</option>
                    <option value="12ml">12ml (1 Tola)</option>
                  </select>
                </div>
              ) : pickerType === "TESTER" ? (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Sample Portion
                  </label>
                  <select
                    value={pickerTesterMl}
                    onChange={(e) => setPickerTesterMl(Number(e.target.value))}
                    className="w-full px-2 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                  >
                    <option value={1}>1ml Sample</option>
                    <option value={2}>2ml Sample</option>
                    <option value={3}>3ml Sample</option>
                    <option value={5}>5ml Sample</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Quantity
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={pickerQuantity}
                    onChange={(e) => setPickerQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="text-xs"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500">
                  {pickerType === "TESTER" ? "Tester Price (PKR):" : "Regular Unit Price (PKR):"}
                </span>
                <Input
                  type="number"
                  placeholder={pickerType === "TESTER" ? "Enter tester price" : "Auto-calculated"}
                  value={pickerPriceOverride}
                  onChange={(e) => setPickerPriceOverride(e.target.value)}
                  className="w-28 text-xs font-mono"
                />
              </div>

              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={handleAddItemToBundle}
                className="gap-1.5 text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Add to Bundle
              </Button>
            </div>

            {/* List of included bundle items */}
            <div className="mt-2 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-950">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="py-1.5 px-3 text-left">Component Item</th>
                    <th className="py-1.5 px-2 text-center">Type</th>
                    <th className="py-1.5 px-2 text-center">Size</th>
                    <th className="py-1.5 px-2 text-center">Qty</th>
                    <th className="py-1.5 px-3 text-right">Regular Price</th>
                    <th className="py-1.5 px-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                  {offerFormItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-slate-400 italic">
                        No products added yet. Use the selector above to add 2 or more products (e.g. 3x 6ml Attar oils).
                      </td>
                    </tr>
                  ) : (
                    offerFormItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                        <td className="py-1.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                          {item.name}
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          <Badge variant={item.item_type === "ATTAR" ? "gold" : item.item_type === "TESTER" ? "warning" : "neutral"} className="text-[10px]">
                            {item.item_type}
                          </Badge>
                        </td>
                        <td className="py-1.5 px-2 text-center font-mono text-slate-600 dark:text-slate-400">
                          {item.size_label}
                        </td>
                        <td className="py-1.5 px-2 text-center font-bold">
                          {item.quantity}
                        </td>
                        <td className="py-1.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-slate-400 font-mono text-[11px]">Rs.</span>
                            <input
                              type="number"
                              min="0"
                              value={item.unit_regular_price}
                              onChange={(e) => {
                                const val = Math.max(0, parseFloat(e.target.value) || 0);
                                setOfferFormItems((prev) =>
                                  prev.map((it, i) => (i === idx ? { ...it, unit_regular_price: val } : it))
                                );
                              }}
                              className="w-20 px-1.5 py-0.5 text-right font-mono font-bold text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900 focus:ring-1 focus:ring-amber-500 text-slate-800 dark:text-slate-200"
                              title="Edit item price in bundle"
                            />
                          </div>
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItemFromBundle(idx)}
                            className="text-rose-500 hover:text-rose-700 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pricing & Savings Calculation Bar */}
          {(() => {
            const regularTotal = offerFormItems.reduce((acc, it) => acc + it.unit_regular_price * it.quantity, 0);
            const dealPrice = parseFloat(offerFormBundlePrice) || 0;
            const savings = Math.max(0, regularTotal - dealPrice);
            const discountPercent = regularTotal > 0 ? Math.round((savings / regularTotal) * 100) : 0;

            return (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Regular Items Total
                    </label>
                    <div className="text-base font-bold font-mono text-slate-700 dark:text-slate-300">
                      Rs. {regularTotal.toLocaleString()}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
                      Promotional Deal Price (PKR) *
                    </label>
                    <Input
                      type="number"
                      placeholder="e.g. 2300"
                      value={offerFormBundlePrice}
                      onChange={(e) => setOfferFormBundlePrice(e.target.value)}
                      className="text-sm font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Customer Savings & Discount
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-emerald-600 font-mono">
                        Save Rs. {savings.toLocaleString()}
                      </span>
                      {discountPercent > 0 && (
                        <Badge variant="success" className="text-[10px]">
                          {discountPercent}% OFF
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-emerald-500/20 flex justify-end items-center text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                  <span>Selling Price: <strong className="text-emerald-700 dark:text-emerald-400">Rs. {dealPrice.toLocaleString()}</strong></span>
                </div>
              </div>
            );
          })()}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsOfferEditorOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleSaveOffer}
              className="gap-1.5 bg-amber-600 hover:bg-amber-700"
            >
              <CheckCircle2 className="w-4 h-4" />
              Save & Publish Offer
            </Button>
          </div>
        </div>
      </Dialog>



      {/* Quick Attar Decant & Dispense Modal */}
      <Dialog
        open={selectedAttarForDecant !== null}
        onClose={() => setSelectedAttarForDecant(null)}
        title={selectedAttarForDecant ? `Dispense Attar: ${selectedAttarForDecant.name}` : "Attar Decanting"}
        description="Choose decanting bottle size or tola measurement to add directly to the counter order cart."
        maxWidth="md"
      >
        {selectedAttarForDecant && (() => {
          const a = selectedAttarForDecant;
          let unitPricePaisa = 0;
          let unitLabel = "";
          let unitVol = "";

          if (decantUnit === "TOLA") {
            unitPricePaisa = a.selling_price_per_tola_paisa;
            unitLabel = "1 Tola";
            unitVol = "11.66 grams (~11.1 ml)";
          } else if (decantUnit === "HALF_TOLA") {
            unitPricePaisa = a.selling_price_half_tola_paisa;
            unitLabel = "1/2 Tola";
            unitVol = "5.83 grams (~5.5 ml)";
          } else if (decantUnit === "QUARTER_TOLA") {
            unitPricePaisa = a.selling_price_quarter_tola_paisa;
            unitLabel = "1/4 Tola";
            unitVol = "2.92 grams (~2.8 ml)";
          } else if (decantUnit === "12ML") {
            unitPricePaisa = Math.round(a.selling_price_per_ml_paisa * 12);
            unitLabel = "12 ml";
            unitVol = "12.0 ml";
          } else if (decantUnit === "6ML") {
            unitPricePaisa = Math.round(a.selling_price_per_ml_paisa * 6);
            unitLabel = "6 ml";
            unitVol = "6.0 ml";
          } else if (decantUnit === "3ML") {
            unitPricePaisa = Math.round(a.selling_price_per_ml_paisa * 3);
            unitLabel = "3 ml";
            unitVol = "3.0 ml";
          } else if (decantUnit === "CUSTOM_TOLA") {
            const tola = customDecantTola || 1;
            unitPricePaisa = Math.round(a.selling_price_per_tola_paisa * tola);
            unitLabel = `${tola} Tola`;
            unitVol = `${(tola * 11.66).toFixed(2)} grams`;
          } else if (decantUnit === "CUSTOM_ML") {
            const ml = customDecantMl || 1;
            unitPricePaisa = Math.round(a.selling_price_per_ml_paisa * ml);
            unitLabel = `${ml} ml`;
            unitVol = `${ml}.0 ml`;
          }

          const effectiveUnitPricePaisa =
            decantCustomRateRupees.trim() !== "" &&
            !isNaN(Number(decantCustomRateRupees)) &&
            Number(decantCustomRateRupees) > 0
              ? Math.round(Number(decantCustomRateRupees) * 100)
              : unitPricePaisa;
          const lineTotalPaisa = effectiveUnitPricePaisa * decantQty;

          return (
            <div className="space-y-4 pt-1">
              {/* Product Info Banner */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    {a.name}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                    Density: {((a.density_grams_per_ml || 1000) / 1000).toFixed(3)} g/ml
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400">
                  {a.sku}
                </span>
              </div>

              {/* Dispensing Unit Options */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Select Dispensing Portion / Bottle Size:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "TOLA" as const, label: "1 Tola (11.66g)", price: Math.round(a.selling_price_per_tola_paisa / 100) },
                    { id: "HALF_TOLA" as const, label: "1/2 Tola (5.83g)", price: Math.round(a.selling_price_half_tola_paisa / 100) },
                    { id: "QUARTER_TOLA" as const, label: "1/4 Tola (2.92g)", price: Math.round(a.selling_price_quarter_tola_paisa / 100) },
                    { id: "12ML" as const, label: "12 ml", price: Math.round((a.selling_price_per_ml_paisa * 12) / 100) },
                    { id: "6ML" as const, label: "6 ml", price: Math.round((a.selling_price_per_ml_paisa * 6) / 100) },
                    { id: "3ML" as const, label: "3 ml", price: Math.round((a.selling_price_per_ml_paisa * 3) / 100) },
                    { id: "CUSTOM_TOLA" as const, label: "Custom Tola", price: Math.round((a.selling_price_per_tola_paisa * (customDecantTola || 1)) / 100) },
                    { id: "CUSTOM_ML" as const, label: "Custom ML", price: Math.round((a.selling_price_per_ml_paisa * (customDecantMl || 1)) / 100) },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setDecantUnit(opt.id);
                        setDecantCustomRateRupees("");
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        decantUnit === opt.id
                          ? "border-amber-500 bg-amber-500/15 shadow-xs ring-1 ring-amber-500/50"
                          : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 hover:border-amber-500/40"
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {opt.label}
                      </div>
                      <div className="text-[11px] font-mono font-bold text-amber-600 dark:text-amber-400 mt-1">
                        Rs. {opt.price.toLocaleString()}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Tola Input */}
              {decantUnit === "CUSTOM_TOLA" && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Enter Custom Tolas (e.g. 0.75, 1.5, 2):
                    </label>
                    <span className="text-[11px] text-amber-700 dark:text-amber-400 font-mono">
                      Weight: {((customDecantTola || 1) * 11.66).toFixed(2)} grams
                    </span>
                  </div>
                  <Input
                    type="number"
                    min={0.01}
                    step="0.05"
                    value={customDecantTola || ""}
                    onChange={(e) => {
                      setCustomDecantTola(parseFloat(e.target.value) || 0);
                      setDecantCustomRateRupees("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addAttarToCart(a, decantUnit, decantQty, customDecantMl, effectiveUnitPricePaisa, customDecantTola);
                        setSelectedAttarForDecant(null);
                      }
                    }}
                    placeholder="1.0"
                    className="font-mono font-bold text-sm"
                  />
                </div>
              )}

              {/* Custom ML Input */}
              {decantUnit === "CUSTOM_ML" && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Enter Custom Milliliters (ml) (e.g. 5, 10, 25):
                    </label>
                    <span className="text-[11px] text-amber-700 dark:text-amber-400 font-mono">
                      Portion: {customDecantMl || 1} ml
                    </span>
                  </div>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={customDecantMl || ""}
                    onChange={(e) => {
                      setCustomDecantMl(parseInt(e.target.value) || 0);
                      setDecantCustomRateRupees("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addAttarToCart(a, decantUnit, decantQty, customDecantMl, effectiveUnitPricePaisa, customDecantTola);
                        setSelectedAttarForDecant(null);
                      }
                    }}
                    placeholder="10"
                    className="font-mono font-bold text-sm"
                  />
                </div>
              )}

              {/* Custom Selling Rate per Unit (Editable for Cashier / Attendant) */}
              <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Selling Rate per Portion (PKR):
                  </label>
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                    Standard: Rs. {Math.round(unitPricePaisa / 100).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      Rs.
                    </span>
                    <Input
                      type="number"
                      min={1}
                      value={decantCustomRateRupees}
                      onChange={(e) => setDecantCustomRateRupees(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addAttarToCart(a, decantUnit, decantQty, customDecantMl, effectiveUnitPricePaisa, customDecantTola);
                          setSelectedAttarForDecant(null);
                        }
                      }}
                      placeholder={String(Math.round(unitPricePaisa / 100))}
                      className="pl-9 font-mono font-bold text-sm"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDecantCustomRateRupees(Math.round(unitPricePaisa / 100).toString())}
                    className="text-xs whitespace-nowrap active:scale-95"
                    title="Reset to default standard rate"
                  >
                    Reset Standard
                  </Button>
                </div>
              </div>

              {/* Quantity Stepper */}
              <div className="flex items-center justify-between p-3.5 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Number of Bottles / Portions:</span>
                  <span className="text-[11px] text-slate-500 font-mono">{unitLabel} ({unitVol})</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setDecantQty((q) => Math.max(1, q - 1))}
                    className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer font-bold"
                  >
                    -
                  </button>
                  <span className="font-mono font-bold text-lg text-slate-900 dark:text-slate-100 w-8 text-center">
                    {decantQty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDecantQty((q) => q + 1)}
                    className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer font-bold"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Price Calculation Summary */}
              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">Line Total ({decantQty}x):</span>
                  <span className="text-xs font-mono text-slate-600 dark:text-slate-300">
                    Rs. {(effectiveUnitPricePaisa / 100).toLocaleString()} × {decantQty}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-serif font-bold text-2xl text-amber-600 dark:text-amber-400">
                    Rs. {(lineTotalPaisa / 100).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setSelectedAttarForDecant(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    addAttarToCart(a, decantUnit, decantQty, customDecantMl, effectiveUnitPricePaisa, customDecantTola);
                    setSelectedAttarForDecant(null);
                  }}
                  className="gap-2 px-5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Attar to Cart</span>
                </Button>
              </div>
            </div>
          );
        })()}
      </Dialog>

      {/* Fragrance Tester & Decant Sample Modal */}
      <Dialog
        open={selectedCartItemForTester !== null}
        onClose={() => setSelectedCartItemForTester(null)}
        title={selectedCartItemForTester ? `Dispense Tester: ${selectedCartItemForTester.name.replace(/\s*—\s*Tester\s*\(\d+ml\)/i, "")}` : "Tester Sample Dispense"}
        description="Select sample dispense volume (Default 1 ml or Custom ml). Zero stock deduction from boxed retail inventory."
        maxWidth="md"
      >
        {selectedCartItemForTester && (
          <div className="space-y-4 pt-1">
            {/* Product Info Banner */}
            <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>{selectedCartItemForTester.name.replace(/\s*—\s*Tester\s*\(\d+ml\)/i, "")}</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                  SKU: {selectedCartItemForTester.sku} • Counter Display Tester
                </p>
              </div>
              <Badge variant="neutral" className="text-xs font-mono font-bold">
                {selectedCartItemForTester.is_tester ? "Currently: TESTER" : "Currently: BOXED BOTTLE"}
              </Badge>
            </div>

            {/* Volume Presets */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Select Tester Sample Volume (Default: 1 ml):
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { ml: 1, label: "1 ml (Default)" },
                  { ml: 2, label: "2 ml (Sample Vial)" },
                  { ml: 3, label: "3 ml (Pocket Vial)" },
                  { ml: 5, label: "5 ml (Decant)" },
                ].map((preset) => (
                  <button
                    key={preset.ml}
                    type="button"
                    onClick={() => {
                      setTesterPresetMl(preset.ml as 1 | 2 | 3 | 5);
                      setCustomTesterMl(preset.ml);
                    }}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      testerPresetMl === preset.ml
                        ? "border-purple-600 bg-purple-500/15 shadow-xs ring-1 ring-purple-500/50"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 hover:border-purple-500/40"
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {preset.label}
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setTesterPresetMl("CUSTOM")}
                  className={`w-full p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    testerPresetMl === "CUSTOM"
                      ? "border-purple-600 bg-purple-500/15 shadow-xs ring-1 ring-purple-500/50"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 hover:border-purple-500/40"
                  }`}
                >
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Custom Milliliters (ml)
                  </div>
                </button>
              </div>
            </div>

            {/* Custom ML Input */}
            {testerPresetMl === "CUSTOM" && (
              <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Enter Custom Tester Volume (ml):
                </label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={customTesterMl}
                  onChange={(e) => setCustomTesterMl(Math.max(1, parseInt(e.target.value) || 1))}
                  className="font-mono font-bold text-sm"
                  placeholder="1"
                />
              </div>
            )}

            {/* Rate Input */}
            <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Sample Price / Rate (Rs.):
                </label>
                <span className="text-[10px] text-slate-500 font-mono">Rs. 0 = Complimentary Tester</span>
              </div>
              <Input
                type="number"
                min="0"
                step="1"
                value={testerPriceRupees}
                onChange={(e) => setTesterPriceRupees(e.target.value)}
                placeholder="0"
                className="font-mono font-bold text-sm"
              />
            </div>

            {/* Invariant Note */}
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/20 rounded-xl flex items-center gap-2 text-xs text-emerald-900 dark:text-emerald-300">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>Zero Inventory Loss: Boxed perfume bottle stock is NOT reduced. Dispense is logged for tester telemetry.</span>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              {selectedCartItemForTester.is_tester ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setTesterItem(selectedCartItemForTester.product_id, false);
                    setSelectedCartItemForTester(null);
                  }}
                  className="text-xs text-rose-600 border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                >
                  Revert to Full Bottle
                </Button>
              ) : (
                <div></div>
              )}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setSelectedCartItemForTester(null)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    const ml = testerPresetMl === "CUSTOM" ? customTesterMl : (testerPresetMl as number);
                    const ratePaisa = Math.round(Math.max(0, parseFloat(testerPriceRupees) || 0) * 100);
                    setTesterItem(selectedCartItemForTester.product_id, true, ml, ratePaisa);
                    setSelectedCartItemForTester(null);
                  }}
                  className="text-xs gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold"
                >
                  <FlaskConical className="w-4 h-4" />
                  <span>Apply Tester ({testerPresetMl === "CUSTOM" ? customTesterMl : testerPresetMl} ml)</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </Dialog>


    </div>
  );
};
