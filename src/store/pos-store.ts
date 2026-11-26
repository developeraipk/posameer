import { create } from "zustand";
import { FinishedProduct, CartItem, SalesInvoiceResult } from "@/types/database";

interface POSState {
  cart: CartItem[];
  customerPhone: string;
  salespersonId: string;
  specialDiscountPaisa: number;
  selectedCategory: string;
  searchQuery: string;
  completedInvoice: SalesInvoiceResult | null;
  isPaymentModalOpen: boolean;

  // Actions
  addToCart: (product: FinishedProduct) => void;
  toggleTester: (productId: string) => void;
  setTesterItem: (productId: string, isTester: boolean, ml?: number, customRatePaisa?: number) => void;
  addOfferBundleToCart: (bundle: {
    title: string;
    items: FinishedProduct[];
    bundleCostPaisa: number;
    bundlePricePaisa: number;
  }) => void;
  addPromotionalOfferToCart: (offer: import("@/types/offers").PromotionalOffer) => void;
  addAttarToCart: (
    attar: import("@/types/database").AttarProduct,
    unit: "TOLA" | "HALF_TOLA" | "QUARTER_TOLA" | "12ML" | "6ML" | "3ML" | "CUSTOM_ML" | "CUSTOM_GRAM" | "CUSTOM_TOLA",
    quantity: number,
    customMl?: number,
    overrideUnitPricePaisa?: number,
    customTola?: number
  ) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateUnitPrice: (productId: string, unitPricePaisa: number) => void;
  updateItemDiscount: (productId: string, discountPaisa: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  setCustomerPhone: (phone: string) => void;
  setSalespersonId: (id: string) => void;
  setSpecialDiscount: (discountPaisa: number) => void;
  setSelectedCategory: (category: string) => void;
  setSearchQuery: (query: string) => void;
  setCompletedInvoice: (invoice: SalesInvoiceResult | null) => void;
  setIsPaymentModalOpen: (open: boolean) => void;
  getTotals: () => {
    grossTotalPaisa: number;
    itemDiscountPaisa: number;
    specialDiscountPaisa: number;
    netPayablePaisa: number;
    totalQuantity: number;
  };
}

export const usePOSStore = create<POSState>((set, get) => ({
  cart: [],
  customerPhone: "03000000000",
  salespersonId: "",
  specialDiscountPaisa: 0,
  selectedCategory: "ALL",
  searchQuery: "",
  completedInvoice: null,
  isPaymentModalOpen: false,

  addToCart: (product: FinishedProduct) => {
    // ANTI-OVERSELL INVARIANT: Strictly forbid adding out-of-stock items
    if (product.current_stock_units <= 0) {
      alert(`[Stock Exhausted] Cannot add '${product.name}' to cart because available inventory is 0 units.`);
      return;
    }

    set((state) => {
      const existing = state.cart.find((item) => item.product_id === product.product_id);
      if (existing) {
        if (existing.quantity >= product.current_stock_units) {
          alert(`[Stock Limit Reached] Cannot add more. Only ${product.current_stock_units} unit(s) of '${product.name}' available in stock.`);
          return state;
        }
        return {
          cart: state.cart.map((item) =>
            item.product_id === product.product_id
              ? {
                  ...item,
                  quantity: item.quantity + 1,
                  line_total_paisa:
                    (item.quantity + 1) * item.unit_price_paisa - item.discount_paisa,
                }
              : item
          ),
        };
      } else {
        const formattedPerfumeName = product.name.match(/\d+\s*ml/i)
          ? product.name
          : `${product.name} (${product.size_ml}ml)`;

        const newItem: CartItem = {
          product_id: product.product_id,
          sku: product.sku,
          barcode: product.barcode,
          name: formattedPerfumeName,
          size_ml: product.size_ml,
          unit_price_paisa: product.retail_price_paisa,
          unit_cost_paisa: product.latest_batch_cost_paisa || 0,
          quantity: 1,
          max_stock_units: product.current_stock_units,
          discount_paisa: 0,
          line_total_paisa: product.retail_price_paisa,
          item_type: "PERFUME",
        };
        return { cart: [...state.cart, newItem] };
      }
    });
  },

  toggleTester: (productId: string) => {
    set((state) => ({
      cart: state.cart.map((item) => {
        if (item.product_id !== productId) return item;
        const nowTester = !item.is_tester;
        const cleanName = item.name.replace(/\s*—\s*Tester\s*\(\d+ml\)/i, "").replace(/^\[TESTER\]\s*/i, "");
        if (nowTester) {
          // Default to 1 ml tester as requested
          return {
            ...item,
            is_tester: true,
            item_type: "TESTER",
            size_ml: 1,
            measurement_unit: "CUSTOM_ML",
            name: `${cleanName} — Tester (1ml)`,
            unit_price_paisa: 0,
            discount_paisa: 0,
            line_total_paisa: 0,
          };
        } else {
          // Revert to full bottle
          const standardPrice = item.unit_price_paisa > 0 ? item.unit_price_paisa : 200000;
          return {
            ...item,
            is_tester: false,
            item_type: "PERFUME",
            size_ml: 50,
            measurement_unit: "BOTTLE",
            name: cleanName,
            unit_price_paisa: standardPrice,
            discount_paisa: 0,
            line_total_paisa: standardPrice * item.quantity,
          };
        }
      }),
    }));
  },

  setTesterItem: (productId: string, isTester: boolean, ml: number = 1, customRatePaisa?: number) => {
    set((state) => ({
      cart: state.cart.map((item) => {
        if (item.product_id !== productId) return item;
        const cleanName = item.name.replace(/\s*—\s*Tester\s*\(\d+ml\)/i, "").replace(/^\[TESTER\]\s*/i, "");
        if (isTester) {
          const effectiveMl = ml > 0 ? ml : 1;
          const rate = customRatePaisa !== undefined ? customRatePaisa : 0;
          return {
            ...item,
            is_tester: true,
            item_type: "TESTER",
            size_ml: effectiveMl,
            measurement_unit: "CUSTOM_ML",
            name: `${cleanName} — Tester (${effectiveMl}ml)`,
            unit_price_paisa: rate,
            discount_paisa: 0,
            line_total_paisa: rate * item.quantity,
          };
        } else {
          const standardPrice = (customRatePaisa !== undefined && customRatePaisa > 0)
            ? customRatePaisa
            : (item.unit_price_paisa > 0 ? item.unit_price_paisa : 200000);
          return {
            ...item,
            is_tester: false,
            item_type: "PERFUME",
            size_ml: 50,
            measurement_unit: "BOTTLE",
            name: cleanName,
            unit_price_paisa: standardPrice,
            discount_paisa: 0,
            line_total_paisa: standardPrice * item.quantity,
          };
        }
      }),
    }));
  },

  addOfferBundleToCart: (bundle) => {
    const bundleKey = `offer_${Date.now()}`;
    const standardRetailSum = bundle.items.reduce((acc, it) => acc + it.retail_price_paisa, 0);
    const bundleDiscount = Math.max(0, standardRetailSum - bundle.bundlePricePaisa);

    const newItem: CartItem = {
      product_id: bundleKey,
      sku: `BUNDLE-${Date.now() % 10000}`,
      barcode: `OFFER-${Date.now() % 100000}`,
      name: `🎁 [OFFER] ${bundle.title} (${bundle.items.map((i) => i.name).join(" + ")})`,
      size_ml: bundle.items.reduce((acc, it) => acc + it.size_ml, 0),
      unit_price_paisa: standardRetailSum,
      unit_cost_paisa: bundle.bundleCostPaisa,
      quantity: 1,
      max_stock_units: 999,
      discount_paisa: bundleDiscount,
      line_total_paisa: bundle.bundlePricePaisa,
      item_type: "OFFER_BUNDLE",
      offer_bundle_title: bundle.title,
    };

    set((state) => ({ cart: [...state.cart, newItem] }));
  },

  addPromotionalOfferToCart: (offer) => {
    if (!offer.items || offer.items.length === 0) return;

    const totalBundlePaisa = Math.round(offer.bundle_price * 100);
    const regularTotalPaisa = Math.round(offer.regular_total * 100);
    const totalSavingsPaisa = Math.max(0, regularTotalPaisa - totalBundlePaisa);

    // Deduct bundle savings from the highest-priced item(s) first instead of splitting proportionally
    const indexedTotals = offer.items.map((item, idx) => ({
      idx,
      itemRegularTotalPaisa: Math.round(item.unit_regular_price * item.quantity * 100),
    }));
    const sortedByPrice = [...indexedTotals].sort((a, b) => b.itemRegularTotalPaisa - a.itemRegularTotalPaisa);
    let remainingSavings = totalSavingsPaisa;
    const itemDiscountMap = new Map<number, number>();
    for (const entry of sortedByPrice) {
      if (remainingSavings <= 0) {
        itemDiscountMap.set(entry.idx, 0);
      } else {
        const d = Math.min(remainingSavings, entry.itemRegularTotalPaisa);
        itemDiscountMap.set(entry.idx, d);
        remainingSavings -= d;
      }
    }

    const newCartItems: CartItem[] = [];

    offer.items.forEach((item, index) => {
      const itemRegularTotalPaisa = Math.round(item.unit_regular_price * item.quantity * 100);
      const itemDiscountPaisa = itemDiscountMap.get(index) || 0;
      const itemDealTotalPaisa = Math.max(0, itemRegularTotalPaisa - itemDiscountPaisa);
      const unitPricePaisa = Math.round(item.unit_regular_price * 100);
      const unitCostPaisa = Math.round((item.unit_cost_price || item.unit_regular_price * 0.5) * 100);

      const sizeMlMatch = item.size_label.match(/(\d+)\s*ml/i);
      const parsedMl = sizeMlMatch ? parseInt(sizeMlMatch[1], 10) : 12;

      let measurementUnit: CartItem["measurement_unit"] = "BOTTLE";
      if (item.item_type === "ATTAR") {
        if (item.size_label.toLowerCase().includes("6ml")) measurementUnit = "6ML";
        else if (item.size_label.toLowerCase().includes("3ml")) measurementUnit = "3ML";
        else if (item.size_label.toLowerCase().includes("12ml")) measurementUnit = "12ML";
        else if (item.size_label.toLowerCase().includes("tola")) measurementUnit = "TOLA";
        else measurementUnit = "6ML";
      } else if (item.item_type === "TESTER") {
        measurementUnit = "CUSTOM_ML";
      }

      const cartItem: CartItem = {
        product_id: item.product_id || item.attar_id || `offer_${offer.offer_id}_item_${index}`,
        attar_id: item.item_type === "ATTAR" ? (item.attar_id || `attar_offer_${index}`) : undefined,
        sku: `BUNDLE-${offer.offer_id.slice(-6)}-${index + 1}`,
        barcode: `OFR-${Date.now() % 100000}-${index + 1}`,
        name: `🎁 [${offer.title}] ${item.name} (${item.size_label})`,
        size_ml: parsedMl,
        unit_price_paisa: unitPricePaisa,
        unit_cost_paisa: unitCostPaisa,
        quantity: item.quantity,
        discount_paisa: itemDiscountPaisa,
        line_total_paisa: itemDealTotalPaisa,
        item_type: item.item_type,
        measurement_unit: measurementUnit,
        offer_bundle_title: offer.title,
        max_stock_units: 999,
      };

      newCartItems.push(cartItem);
    });

    set((state) => ({ cart: [...state.cart, ...newCartItems] }));
  },

  addAttarToCart: (attar, unit, quantity, customMl, overrideUnitPricePaisa, customTola) => {
    set((state) => {
      let unitSellingPrice = attar.selling_price_per_tola_paisa;
      let unitCostPrice = attar.cost_per_tola_paisa;
      let sizeMl = 12;
      let unitLabel = "1 Tola (12ml)";

      if (unit === "HALF_TOLA") {
        unitSellingPrice = attar.selling_price_half_tola_paisa;
        unitCostPrice = attar.cost_per_half_tola_paisa;
        sizeMl = 6;
        unitLabel = "1/2 Tola (6ml)";
      } else if (unit === "QUARTER_TOLA") {
        unitSellingPrice = attar.selling_price_quarter_tola_paisa;
        unitCostPrice = attar.cost_per_quarter_tola_paisa;
        sizeMl = 3;
        unitLabel = "1/4 Tola (3ml)";
      } else if (unit === "12ML") {
        unitSellingPrice = Math.round(attar.selling_price_per_ml_paisa * 12);
        unitCostPrice = Math.round(attar.cost_per_ml_paisa * 12);
        sizeMl = 12;
        unitLabel = "12ml";
      } else if (unit === "6ML") {
        unitSellingPrice = Math.round(attar.selling_price_per_ml_paisa * 6);
        unitCostPrice = Math.round(attar.cost_per_ml_paisa * 6);
        sizeMl = 6;
        unitLabel = "6ml";
      } else if (unit === "3ML") {
        unitSellingPrice = Math.round(attar.selling_price_per_ml_paisa * 3);
        unitCostPrice = Math.round(attar.cost_per_ml_paisa * 3);
        sizeMl = 3;
        unitLabel = "3ml";
      } else if (unit === "CUSTOM_ML") {
        const ml = customMl || 1;
        unitSellingPrice = Math.round(attar.selling_price_per_ml_paisa * ml);
        unitCostPrice = Math.round(attar.cost_per_ml_paisa * ml);
        sizeMl = ml;
        unitLabel = `${ml}ml`;
      } else if (unit === "CUSTOM_TOLA") {
        const tola = customTola || 1;
        unitSellingPrice = Math.round(attar.selling_price_per_tola_paisa * tola);
        unitCostPrice = Math.round(attar.cost_per_tola_paisa * tola);
        sizeMl = Math.round(12 * tola);
        unitLabel = `${tola} Tola`;
      }

      // If custom selling rate specified (e.g. standard was Rs. 100, sold for Rs. 150)
      if (overrideUnitPricePaisa && overrideUnitPricePaisa > 0) {
        unitSellingPrice = overrideUnitPricePaisa;
      }

      const cartKey = `attar_${attar.attar_id}_${unit}_${sizeMl}_${unitSellingPrice}`;
      const newItem: CartItem = {
        product_id: cartKey,
        sku: attar.sku,
        barcode: `ATTAR-${attar.sku}`,
        name: `${attar.name} (${unitLabel})`,
        size_ml: sizeMl,
        unit_price_paisa: unitSellingPrice,
        unit_cost_paisa: unitCostPrice,
        quantity,
        discount_paisa: 0,
        line_total_paisa: unitSellingPrice * quantity,
        item_type: "ATTAR",
        attar_id: attar.attar_id,
        measurement_unit: unit,
        density_grams_per_ml: attar.density_grams_per_ml,
      };

      return { cart: [...state.cart, newItem] };
    });
  },

  updateQuantity: (productId: string, quantity: number) => {
    if (quantity <= 0) {
      get().removeFromCart(productId);
      return;
    }
    const currentItem = get().cart.find((it) => it.product_id === productId);
    if (currentItem && currentItem.max_stock_units !== undefined && quantity > currentItem.max_stock_units) {
      alert(`[Stock Limit] Maximum available inventory for '${currentItem.name}' is ${currentItem.max_stock_units} unit(s).`);
      quantity = currentItem.max_stock_units;
    }
    set((state) => ({
      cart: state.cart.map((item) =>
        item.product_id === productId
          ? {
              ...item,
              quantity,
              line_total_paisa: quantity * item.unit_price_paisa - item.discount_paisa,
            }
          : item
      ),
    }));
  },

  updateUnitPrice: (productId: string, unitPricePaisa: number) => {
    const validPrice = Math.max(0, unitPricePaisa);
    set((state) => ({
      cart: state.cart.map((item) =>
        item.product_id === productId
          ? {
              ...item,
              unit_price_paisa: validPrice,
              line_total_paisa: Math.max(0, item.quantity * validPrice - item.discount_paisa),
            }
          : item
      ),
    }));
  },

  updateItemDiscount: (productId: string, discountPaisa: number) => {
    const validDiscount = Math.max(0, discountPaisa);
    set((state) => ({
      cart: state.cart.map((item) =>
        item.product_id === productId
          ? {
              ...item,
              discount_paisa: validDiscount,
              line_total_paisa: Math.max(
                0,
                item.quantity * item.unit_price_paisa - validDiscount
              ),
            }
          : item
      ),
    }));
  },

  removeFromCart: (productId: string) => {
    set((state) => ({
      cart: state.cart.filter((item) => item.product_id !== productId),
    }));
  },

  clearCart: () => {
    set({
      cart: [],
      specialDiscountPaisa: 0,
      customerPhone: "03000000000",
      completedInvoice: null,
    });
  },

  setCustomerPhone: (phone: string) => set({ customerPhone: phone }),
  setSalespersonId: (id: string) => set({ salespersonId: id }),
  setSpecialDiscount: (discountPaisa: number) =>
    set({ specialDiscountPaisa: Math.max(0, discountPaisa) }),
  setSelectedCategory: (category: string) => set({ selectedCategory: category }),
  setSearchQuery: (query: string) => set({ searchQuery: query }),
  setCompletedInvoice: (invoice: SalesInvoiceResult | null) =>
    set({ completedInvoice: invoice }),
  setIsPaymentModalOpen: (open: boolean) => set({ isPaymentModalOpen: open }),

  getTotals: () => {
    const { cart, specialDiscountPaisa } = get();
    const grossTotalPaisa = cart.reduce(
      (sum, item) => sum + item.quantity * item.unit_price_paisa,
      0
    );
    const itemDiscountPaisa = cart.reduce((sum, item) => sum + item.discount_paisa, 0);
    const totalDiscount = itemDiscountPaisa + specialDiscountPaisa;
    const netPayablePaisa = Math.max(0, grossTotalPaisa - totalDiscount);
    const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);

    return {
      grossTotalPaisa,
      itemDiscountPaisa,
      specialDiscountPaisa,
      netPayablePaisa,
      totalQuantity,
    };
  },
}));
