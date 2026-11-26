import React, { useState, useEffect, useMemo } from "react";
import { SystemUser } from "@/types/system";
import {
  InventoryValuationReport,
  RecentSaleSummary,
  FinishedProduct,
  AttarProduct,
  PettyExpense,
  EmployeeSalaryPayout,
  WholesaleInvoiceSummary,
  WholesaleCustomer,
  OnlineOrder,
  ReturnHistoryEntry,
} from "@/types/database";
import {
  getInventoryValuation,
  getRecentSales,
  getProducts,
  getAttars,
  getPettyExpenses,
  getEmployeeSalaryPayouts,
  getWholesaleInvoices,
  getWholesaleCustomers,
  getOnlineOrders,
  getReturnHistory,
  exportDatabaseToDesktop,
  openDatabaseFolder,
} from "@/lib/tauri-bridge";
import {
  exportSalesHistoryToCSV,
  exportProductsInventoryToCSV,
  exportExpensesToCSV,
  exportAllTablesToSingleCSV,
} from "@/lib/export-utils";
import { getPKTDate, parseDateToPKT } from "@/lib/date-utils";
import {
  calcOnlineOrderRealizedPaisa,
  calcOnlineOrderPendingCodPaisa,
  calcOnlineOrderReturnValuePaisa,
} from "@/lib/online-order-metrics";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  RefreshCw,
  Printer,
  Package,
  TrendingUp,
  Receipt,
  Banknote,
  BadgeDollarSign,
  Percent,
  Droplet,
  Download,
  Database,
  Search,
  FolderOpen,
  FileSpreadsheet,
  Briefcase,
  Clock,
  Globe,
  RotateCcw,
  Landmark,
} from "lucide-react";

interface ReportsProps {
  currentUser?: SystemUser | null;
}

type PeriodFilter = "TODAY" | "WEEK" | "MONTH" | "YEAR" | "ALL";
type ChannelAuditFilter = "ALL" | "POS" | "ONLINE" | "WHOLESALE";
type ActiveTab = "SALES" | "ONLINE" | "WHOLESALE" | "INVENTORY" | "EXPENSES" | "BACKUP";

export const Reports: React.FC<ReportsProps> = ({ currentUser }) => {
  const [period, setPeriod] = useState<PeriodFilter>("MONTH");
  const [channelFilter, setChannelFilter] = useState<ChannelAuditFilter>("ALL");
  const [activeTab, setActiveTab] = useState<ActiveTab>("SALES");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Datasets
  const [inventoryVal, setInventoryVal] = useState<InventoryValuationReport | null>(null);
  const [sales, setSales] = useState<RecentSaleSummary[]>([]);
  const [onlineOrders, setOnlineOrders] = useState<OnlineOrder[]>([]);
  const [products, setProducts] = useState<FinishedProduct[]>([]);
  const [attars, setAttars] = useState<AttarProduct[]>([]);
  const [expenses, setExpenses] = useState<PettyExpense[]>([]);
  const [salaries, setSalaries] = useState<EmployeeSalaryPayout[]>([]);
  const [wholesaleInvoices, setWholesaleInvoices] = useState<WholesaleInvoiceSummary[]>([]);
  const [wholesaleCustomers, setWholesaleCustomers] = useState<WholesaleCustomer[]>([]);
  const [returnHistory, setReturnHistory] = useState<ReturnHistoryEntry[]>([]);

  // Search queries for tables
  const [salesSearch, setSalesSearch] = useState("");
  const [onlineSearch, setOnlineSearch] = useState("");
  const [wholesaleSearch, setWholesaleSearch] = useState("");
  const [inventorySearch, setInventorySearch] = useState("");
  const [expensesSearch, setExpensesSearch] = useState("");

  const loadData = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const [inv, recentSalesList, onlOrders, prods, atts, expList, salList, wInvoices, wCustomers, retHist] = await Promise.all([
        getInventoryValuation(),
        getRecentSales(2000),
        getOnlineOrders(),
        getProducts(),
        getAttars(),
        getPettyExpenses(),
        getEmployeeSalaryPayouts(),
        getWholesaleInvoices(),
        getWholesaleCustomers(),
        getReturnHistory(2000),
      ]);

      setInventoryVal(inv);
      setSales(recentSalesList);
      setOnlineOrders(onlOrders || []);
      setProducts(prods);
      setAttars(atts);
      setExpenses(expList);
      setSalaries(salList);
      setWholesaleInvoices(wInvoices || []);
      setWholesaleCustomers(wCustomers || []);
      setReturnHistory(retHist || []);
    } catch (err: any) {
      console.error("Failed to load comprehensive reports data:", err);
      setFeedback({
        type: "error",
        text: typeof err === "string" ? err : err.message || "Failed to load reports data",
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

  // Filter Helper based on selected period (Strict Pakistan Local Time UTC+5, 12:00 AM Midnight Day-end)
  const filterByPeriod = useMemo(() => {
    const todayPKT = getPKTDate(new Date());
    const currentMonthPKT = todayPKT.slice(0, 7);
    const currentYearPKT = todayPKT.slice(0, 4);

    const d7 = new Date();
    d7.setDate(d7.getDate() - 7);
    const weekAgoPKT = getPKTDate(d7);

    return (dateStr?: string) => {
      if (!dateStr || period === "ALL") return true;
      const recordPKT = parseDateToPKT(dateStr);
      if (!recordPKT) return true;

      if (period === "TODAY") {
        return recordPKT === todayPKT;
      }
      if (period === "WEEK") {
        return recordPKT >= weekAgoPKT && recordPKT <= todayPKT;
      }
      if (period === "MONTH") {
        return recordPKT.startsWith(currentMonthPKT);
      }
      if (period === "YEAR") {
        return recordPKT.startsWith(currentYearPKT);
      }
      return true;
    };
  }, [period]);

  // Filtered Datasets
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      if (!filterByPeriod(s.invoice_date)) return false;
      if (!salesSearch.trim()) return true;
      const q = salesSearch.toLowerCase();
      return (
        s.invoice_number.toLowerCase().includes(q) ||
        s.customer_phone.toLowerCase().includes(q) ||
        (s.product_names && s.product_names.toLowerCase().includes(q)) ||
        (s.cashier_name && s.cashier_name.toLowerCase().includes(q)) ||
        (s.salesperson_name && s.salesperson_name.toLowerCase().includes(q))
      );
    });
  }, [sales, filterByPeriod, salesSearch]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (!filterByPeriod(e.created_at)) return false;
      if (!expensesSearch.trim()) return true;
      const q = expensesSearch.toLowerCase();
      return (
        e.expense_id.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        (e.description && e.description.toLowerCase().includes(q)) ||
        (e.authorized_by_name && e.authorized_by_name.toLowerCase().includes(q)) ||
        (e.brought_by_name && e.brought_by_name.toLowerCase().includes(q))
      );
    });
  }, [expenses, filterByPeriod, expensesSearch]);

  const filteredSalaries = useMemo(() => {
    return salaries.filter((s) => {
      return filterByPeriod(s.payout_date || s.created_at);
    });
  }, [salaries, filterByPeriod]);

  const filteredProducts = useMemo(() => {
    if (!inventorySearch.trim()) return products;
    const q = inventorySearch.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  }, [products, inventorySearch]);

  const filteredWholesaleInvoices = useMemo(() => {
    return wholesaleInvoices.filter((w) => {
      if (!filterByPeriod(w.invoice_date)) return false;
      if (!wholesaleSearch.trim()) return true;
      const q = wholesaleSearch.toLowerCase();
      return (
        w.invoice_number.toLowerCase().includes(q) ||
        w.customer_name.toLowerCase().includes(q) ||
        (w.salesperson_name && w.salesperson_name.toLowerCase().includes(q))
      );
    });
  }, [wholesaleInvoices, filterByPeriod, wholesaleSearch]);

  const matchesOnlineSearch = (o: OnlineOrder) => {
    if (!onlineSearch.trim()) return true;
    const q = onlineSearch.toLowerCase();
    return (
      o.order_number.toLowerCase().includes(q) ||
      o.customer_name.toLowerCase().includes(q) ||
      o.customer_phone.toLowerCase().includes(q) ||
      o.city.toLowerCase().includes(q) ||
      (o.courier_partner && o.courier_partner.toLowerCase().includes(q)) ||
      (o.tracking_number && o.tracking_number.toLowerCase().includes(q))
    );
  };

  // Online Orders Filtered Dataset (Booked within selected period)
  const filteredOnlineOrders = useMemo(() => {
    return onlineOrders.filter((o) => {
      if (!filterByPeriod(o.created_at)) return false;
      return matchesOnlineSearch(o);
    });
  }, [onlineOrders, filterByPeriod, onlineSearch]);

  // Online Orders settled/collected within selected period (supports earlier orders collected today)
  const collectedOnlineOrders = useMemo(() => {
    return onlineOrders.filter((o) => {
      if (o.delivery_status === "CANCELLED") return false;
      if (!filterByPeriod(o.collected_at || o.created_at)) return false;
      return matchesOnlineSearch(o);
    });
  }, [onlineOrders, filterByPeriod, onlineSearch]);

  // Retail Returns from Return History & Sales Invoices
  const filteredReturnHistory = useMemo(() => {
    return returnHistory.filter((r) => filterByPeriod(r.return_date));
  }, [returnHistory, filterByPeriod]);

  const returnedSalesInvoices = useMemo(() => {
    return filteredSales.filter(
      (s) => s.is_returned || s.return_status === "FULL" || s.return_status === "PARTIAL" || ((s.returned_units || 0) > 0)
    );
  }, [filteredSales]);

  // Honor exact return voucher refunds (after damage deductions) instead of overwriting with full invoice net_payable_paisa
  const voucherInvoiceNumbers = new Set(
    returnHistory
      .map((r) => r.original_invoice_number)
      .filter((num): num is string => Boolean(num))
  );
  const totalRetailReturnsFromHistoryPaisa = filteredReturnHistory.reduce(
    (acc, r) => acc + (r.total_refund_amount_paisa || 0),
    0
  );
  const orphanReturnedSalesInvoices = returnedSalesInvoices.filter(
    (s) => !voucherInvoiceNumbers.has(s.invoice_number)
  );
  const totalRetailReturnsFromOrphanSalesPaisa = orphanReturnedSalesInvoices.reduce((acc, s) => {
    const retUnits = s.returned_units || 0;
    if (s.return_status === "FULL" || (s.total_units > 0 && retUnits >= s.total_units)) {
      return acc + s.net_payable_paisa;
    }
    if (s.total_units > 0 && retUnits > 0) {
      return acc + Math.round((s.net_payable_paisa * retUnits) / s.total_units);
    }
    return acc + s.net_payable_paisa;
  }, 0);

  const totalRetailReturnsPaisa =
    totalRetailReturnsFromHistoryPaisa + totalRetailReturnsFromOrphanSalesPaisa;
  const totalRetailReturnsCount =
    filteredReturnHistory.length + orphanReturnedSalesInvoices.length;

  // Retail Sales Metrics:
  // Gross sales before any discounts or returns (100% Unadjusted)
  const totalRetailGrossPaisa = filteredSales.reduce(
    (acc, s) => acc + (s.gross_total_paisa || (s.net_payable_paisa + (s.discount_paisa || 0))),
    0
  );
  // Net sales revenue: User requirement - POS returns MUST cut from Net Sales Revenue
  const totalRetailGrossPayablePaisa = filteredSales.reduce((acc, s) => acc + s.net_payable_paisa, 0);
  const totalRetailNetRevenuePaisa = Math.max(0, totalRetailGrossPayablePaisa - totalRetailReturnsPaisa);
  const totalRetailDiscountsPaisa = filteredSales.reduce((acc, s) => acc + (s.discount_paisa || 0), 0);
  const totalRetailDiscountedInvoicesCount = filteredSales.filter((s) => (s.discount_paisa || 0) > 0).length;
  const totalRetailBottlesSold = filteredSales.reduce((acc, s) => acc + s.total_units, 0);

  // Wholesale Metrics:
  const totalWholesaleGrossPaisa = filteredWholesaleInvoices.reduce((acc, w) => acc + w.net_total_paisa, 0);
  const totalWholesaleBilledPaisa = totalWholesaleGrossPaisa;
  const totalWholesalePaidPaisa = filteredWholesaleInvoices.reduce((acc, w) => acc + w.paid_amount_paisa, 0);
  const totalWholesaleUdarPaisa = filteredWholesaleInvoices.reduce((acc, w) => acc + w.balance_due_paisa, 0);
  const totalAllCustomersUdarPaisa = wholesaleCustomers.reduce((acc, c) => acc + (c.current_balance_paisa || 0), 0);
  const totalPendingUdarToDisplay =
    period === "ALL"
      ? Math.max(totalWholesaleUdarPaisa, totalAllCustomersUdarPaisa)
      : totalWholesaleUdarPaisa;
  const totalWholesaleDiscountsPaisa = 0;
  const totalWholesaleDiscountedCount = 0;
  const totalWholesaleUnits = filteredWholesaleInvoices.length;

  // Robust Gross calculation: Pure unadjusted items volume before any returns or deductions
  const calcOnlineOrderGrossPaisa = (o: any): number => {
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
    return (o.total_amount_paisa || 0) + (o.discount_paisa || 0) + (o.refund_amount_paisa || 0) + (o.deduction_amount_paisa || 0);
  };

  // Online Orders Metrics (Strict distinction between billed volume, pending COD, and realized cash collected):
  const activeFilteredOnlineOrders = filteredOnlineOrders.filter(
    (o) => o.delivery_status !== "CANCELLED"
  );
  const totalOnlineGrossPaisa = activeFilteredOnlineOrders.reduce(
    (acc, o) => acc + calcOnlineOrderGrossPaisa(o),
    0
  );
  const totalOnlineBilledPaisa = activeFilteredOnlineOrders.reduce((acc, o) => acc + o.total_amount_paisa, 0);
  const totalOnlineNetCollectedPaisa = collectedOnlineOrders.reduce(
    (acc, o) => acc + calcOnlineOrderRealizedPaisa(o),
    0
  );
  const totalOnlinePendingCodPaisa = activeFilteredOnlineOrders.reduce(
    (acc, o) => acc + calcOnlineOrderPendingCodPaisa(o),
    0
  );
  const totalOnlineDiscountsPaisa = activeFilteredOnlineOrders.reduce((acc, o) => acc + (o.discount_paisa || 0), 0);
  const totalOnlineDiscountedOrdersCount = activeFilteredOnlineOrders.filter((o) => (o.discount_paisa || 0) > 0).length;
  const totalOnlineUnits = activeFilteredOnlineOrders.reduce((acc, o) => {
    try {
      const its = JSON.parse(o.items_json);
      return acc + its.reduce((sub: number, it: any) => sub + (it.quantity || 1), 0);
    } catch {
      return acc + 1;
    }
  }, 0);

  // Online Returns & RTOs:
  const returnedOnlineOrders = activeFilteredOnlineOrders.filter(
    (o) =>
      o.payment_status === "RETURNED" ||
      (o.delivery_status as string) === "RETURNED_RTO" ||
      (o.delivery_status as string) === "PARTIAL_RETURN" ||
      (typeof o.refund_amount_paisa === "number" && o.refund_amount_paisa > 0)
  );
  const totalOnlineReturnsPaisa = returnedOnlineOrders.reduce(
    (acc, o) => acc + calcOnlineOrderReturnValuePaisa(o),
    0
  );
  const totalOnlineReturnsCount = returnedOnlineOrders.length;

  // Combined Channel Returns:
  let displayReturnsPaisa = 0;
  let displayReturnsCount = 0;
  if (channelFilter === "POS") {
    displayReturnsPaisa = totalRetailReturnsPaisa;
    displayReturnsCount = totalRetailReturnsCount;
  } else if (channelFilter === "ONLINE") {
    displayReturnsPaisa = totalOnlineReturnsPaisa;
    displayReturnsCount = totalOnlineReturnsCount;
  } else if (channelFilter === "WHOLESALE") {
    displayReturnsPaisa = 0;
    displayReturnsCount = 0;
  } else {
    displayReturnsPaisa = totalRetailReturnsPaisa + totalOnlineReturnsPaisa;
    displayReturnsCount = totalRetailReturnsCount + totalOnlineReturnsCount;
  }

  // Channel-Filtered Metrics for Header KPIs (Cash Realized Basis: Excludes Pending COD & Pending Udar until received)
  let displayGrossRevenuePaisa = 0;
  let displayRealizedRevenuePaisa = 0;
  let displayDiscountsPaisa = 0;
  let displayUnitsSold = 0;
  let displayDiscountedCount = 0;

  if (channelFilter === "POS") {
    displayGrossRevenuePaisa = totalRetailGrossPaisa;
    displayRealizedRevenuePaisa = totalRetailNetRevenuePaisa;
    displayDiscountsPaisa = totalRetailDiscountsPaisa;
    displayUnitsSold = totalRetailBottlesSold;
    displayDiscountedCount = totalRetailDiscountedInvoicesCount;
  } else if (channelFilter === "ONLINE") {
    displayGrossRevenuePaisa = totalOnlineGrossPaisa;
    displayRealizedRevenuePaisa = totalOnlineNetCollectedPaisa;
    displayDiscountsPaisa = totalOnlineDiscountsPaisa;
    displayUnitsSold = totalOnlineUnits;
    displayDiscountedCount = totalOnlineDiscountedOrdersCount;
  } else if (channelFilter === "WHOLESALE") {
    displayGrossRevenuePaisa = totalWholesaleGrossPaisa;
    displayRealizedRevenuePaisa = totalWholesalePaidPaisa;
    displayDiscountsPaisa = totalWholesaleDiscountsPaisa;
    displayUnitsSold = totalWholesaleUnits;
    displayDiscountedCount = totalWholesaleDiscountedCount;
  } else {
    // ALL Channels Combined
    displayGrossRevenuePaisa = totalRetailGrossPaisa + totalWholesaleGrossPaisa + totalOnlineGrossPaisa;
    displayRealizedRevenuePaisa = totalRetailNetRevenuePaisa + totalWholesalePaidPaisa + totalOnlineNetCollectedPaisa;
    displayDiscountsPaisa = totalRetailDiscountsPaisa + totalWholesaleDiscountsPaisa + totalOnlineDiscountsPaisa;
    displayUnitsSold = totalRetailBottlesSold + totalWholesaleUnits + totalOnlineUnits;
    displayDiscountedCount = totalRetailDiscountedInvoicesCount + totalWholesaleDiscountedCount + totalOnlineDiscountedOrdersCount;
  }

  const totalExpensesPaisa = filteredExpenses.reduce((acc, e) => acc + e.amount_paisa, 0);
  const totalSalariesPaisa = filteredSalaries.reduce((acc, s) => acc + s.amount_paisa, 0);

  // Net Operating Margin = Realized Cash Revenue - Petty Expenses - Salaries
  const netEstimatedMarginPaisa = displayRealizedRevenuePaisa - totalExpensesPaisa - totalSalariesPaisa;

  const handleExportDatabase = async () => {
    try {
      const savedPath = await exportDatabaseToDesktop();
      setFeedback({
        type: "success",
        text: `Full atomic database backup saved successfully to Desktop: ${savedPath}. This .db file contains all 46 tables, history and schemas.`,
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: typeof err === "string" ? err : err.message || "Failed to export database backup",
      });
    }
  };

  const handleOpenDbDir = async () => {
    try {
      await openDatabaseFolder();
    } catch (err: any) {
      alert("Failed to open folder: " + err);
    }
  };

  const handleExportAllToSingleExcel = () => {
    exportAllTablesToSingleCSV(
      filteredSales,
      products,
      attars,
      filteredExpenses,
      filteredSalaries,
      period,
      `Ameer_Perfumes_Master_Consolidated_Audit`,
      filteredWholesaleInvoices,
      filteredOnlineOrders
    );
    setFeedback({
      type: "success",
      text: `✓ Master Consolidated Audit Report (All core tables including POS, Online, Wholesale, Stock & Expenses) exported to Excel (.csv) successfully! Check your Downloads folder.`,
    });
  };

  const handlePrintAllTablesMasterReport = () => {
    const printArea = document.getElementById("reports-print-area");
    if (!printArea) {
      window.print();
      return;
    }

    const userLabel = currentUser?.full_name || currentUser?.username || "Authorized Administrator";
    const printedAt = new Date().toLocaleString("en-PK", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const totalSalesUnits = filteredSales.reduce((acc, s) => acc + s.total_units, 0);
    const totalSalesGross = filteredSales.reduce((acc, s) => acc + s.net_payable_paisa, 0);
    const totalBottles = products.reduce((acc, p) => acc + p.current_stock_units, 0);
    const totalCostValPaisa = products.reduce((acc, p) => acc + ((p.latest_batch_cost_paisa || 0) * p.current_stock_units), 0);
    const totalRetailValPaisa = products.reduce((acc, p) => acc + (p.retail_price_paisa * p.current_stock_units), 0);
    const totalExpPaisa = filteredExpenses.reduce((acc, e) => acc + e.amount_paisa, 0);
    const totalSalPaisa = filteredSalaries.reduce((acc, s) => acc + s.amount_paisa, 0);

    // 1. Sales Rows
    const salesRowsHtml = filteredSales
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
                return `<div style="color: #991b1b; font-weight: 700; margin: 1px 0;">• ${it.product_name} <span style="background: #fee2e2; color: #991b1b; padding: 1px 3px; border-radius: 3px; font-size: 8px; border: 1px solid #fca5a5;">↩ ${retTag}</span></div>`;
              }
              return `<div style="color: #1e293b; margin: 1px 0;">• ${it.product_name} <span style="color: #64748b; font-family: monospace;">(x${it.quantity})</span></div>`;
            })
            .join("");
        } else {
          itemsText = `<div style="color: #1e293b;">${s.product_names || "Fragrance"}</div>`;
        }

        let statusBadge = "";
        if (s.return_status === "FULL" || (s.is_returned && (!s.return_status || s.return_status === "FULL"))) {
          statusBadge = `<span style="background: #fee2e2; color: #991b1b; border: 1px solid #f87171; padding: 1px 4px; border-radius: 3px; font-weight: 800; font-size: 8px;">FULL RETURN</span>`;
        } else if (s.return_status === "PARTIAL" || (s.returned_units && s.returned_units > 0)) {
          statusBadge = `<span style="background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; padding: 1px 4px; border-radius: 3px; font-weight: 800; font-size: 8px;">PARTIAL (${s.returned_units}/${s.total_units})</span>`;
        } else {
          statusBadge = `<span style="background: #dcfce7; color: #166534; border: 1px solid #86efac; padding: 1px 4px; border-radius: 3px; font-weight: 800; font-size: 8px;">COMPLETED</span>`;
        }

        const invDate = new Date(s.invoice_date).toLocaleString("en-PK", {
          dateStyle: "short",
          timeStyle: "short",
        });

        return `
          <tr style="border-bottom: 1px solid #e2e8f0; font-size: 9px; background: ${idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">
            <td style="padding: 4px 3px; text-align: center; color: #64748b;">${idx + 1}</td>
            <td style="padding: 4px 5px; font-family: monospace; font-weight: 800; color: #b45309; white-space: nowrap;">${s.invoice_number}</td>
            <td style="padding: 4px 5px; font-family: monospace; color: #475569; white-space: nowrap;">${invDate}</td>
            <td style="padding: 4px 5px; font-family: monospace; color: #334155;">${s.customer_phone || "Walk-in"}</td>
            <td style="padding: 4px 5px; font-size: 8.5px; max-width: 220px;">${itemsText}</td>
            <td style="padding: 4px 5px; color: #334155;">${s.cashier_name || "Cashier"}</td>
            <td style="padding: 4px 5px; text-align: center; font-family: monospace; font-weight: 700;">${s.total_units}</td>
            <td style="padding: 4px 5px; text-align: center; font-size: 8.5px; font-weight: 700; color: #475569;">${s.payment_method || "CASH"}</td>
            <td style="padding: 4px 5px; text-align: right; font-family: monospace; font-weight: 800; color: #0f172a; white-space: nowrap;">
              Rs. ${formatRs(s.net_payable_paisa)}
              ${(s.discount_paisa || 0) > 0 ? `<div style="font-size: 7.5px; color: #dc2626; font-weight: normal;">Disc: -Rs. ${formatRs(s.discount_paisa || 0)}</div>` : ""}
            </td>
            <td style="padding: 4px 3px; text-align: center;">${statusBadge}</td>
          </tr>
        `;
      })
      .join("");

    // 2. Perfume Rows
    const prodRowsHtml = products
      .map((p, idx) => {
        const retVal = p.current_stock_units * p.retail_price_paisa;
        const costVal = p.current_stock_units * (p.latest_batch_cost_paisa || 0);
        return `
          <tr style="border-bottom: 1px solid #e2e8f0; font-size: 9px; background: ${idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">
            <td style="padding: 4px 3px; text-align: center; color: #64748b;">${idx + 1}</td>
            <td style="padding: 4px 5px; font-family: monospace; font-weight: 700; color: #b45309;">${p.sku}</td>
            <td style="padding: 4px 5px; font-weight: 700; color: #0f172a;">${p.name}</td>
            <td style="padding: 4px 5px; color: #475569;">${p.category}</td>
            <td style="padding: 4px 5px; font-family: monospace; text-align: center;">${p.size_ml} ml</td>
            <td style="padding: 4px 5px; text-align: center; font-family: monospace; font-weight: 700; color: ${p.current_stock_units <= 5 ? "#dc2626" : "#0f172a"};">${p.current_stock_units}</td>
            <td style="padding: 4px 5px; text-align: right; font-family: monospace; color: #475569;">Rs. ${formatRs(p.latest_batch_cost_paisa || 0)}</td>
            <td style="padding: 4px 5px; text-align: right; font-family: monospace; font-weight: 700;">Rs. ${formatRs(p.retail_price_paisa)}</td>
            <td style="padding: 4px 5px; text-align: right; font-family: monospace; color: #475569;">Rs. ${formatRs(costVal)}</td>
            <td style="padding: 4px 5px; text-align: right; font-family: monospace; font-weight: 800; color: #b45309;">Rs. ${formatRs(retVal)}</td>
          </tr>
        `;
      })
      .join("");

    // 3. Attar Rows
    const attarRowsHtml = attars
      .map((a, idx) => `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 9px; background: ${idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">
          <td style="padding: 4px 3px; text-align: center; color: #64748b;">${idx + 1}</td>
          <td style="padding: 4px 5px; font-family: monospace; font-weight: 700; color: #0891b2;">${a.sku}</td>
          <td style="padding: 4px 5px; font-weight: 700; color: #0f172a;">${a.name}</td>
          <td style="padding: 4px 5px; text-align: right; font-family: monospace; font-weight: 700; color: #0f172a;">Rs. ${formatRs(a.selling_price_per_tola_paisa)}</td>
          <td style="padding: 4px 5px; text-align: right; font-family: monospace; color: #64748b;">Rs. ${formatRs(a.cost_per_tola_paisa)}</td>
          <td style="padding: 4px 5px; text-align: right; font-family: monospace; color: #334155;">Rs. ${formatRs(a.selling_price_half_tola_paisa)}</td>
          <td style="padding: 4px 5px; text-align: right; font-family: monospace; color: #334155;">Rs. ${formatRs(a.selling_price_quarter_tola_paisa)}</td>
          <td style="padding: 4px 5px; text-align: center; font-family: monospace; color: #475569;">${(a.density_grams_per_ml / 1000).toFixed(3)} g/ml</td>
        </tr>
      `)
      .join("");

    // 4. Expense Rows
    const expRowsHtml = filteredExpenses
      .map((e, idx) => {
        const expDate = new Date(e.created_at || e.expense_date).toLocaleString("en-PK", {
          dateStyle: "short",
          timeStyle: "short",
        });
        return `
          <tr style="border-bottom: 1px solid #e2e8f0; font-size: 9px; background: ${idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">
            <td style="padding: 4px 3px; text-align: center; color: #64748b;">${idx + 1}</td>
            <td style="padding: 4px 5px; font-family: monospace; font-weight: 700; color: #b45309;">${e.expense_id}</td>
            <td style="padding: 4px 5px; font-family: monospace; color: #475569; white-space: nowrap;">${expDate}</td>
            <td style="padding: 4px 5px; font-weight: 700; color: #0f172a;">${e.category}</td>
            <td style="padding: 4px 5px; color: #334155;">${e.authorized_by_name || e.authorized_by_manager_name || "Admin"}</td>
            <td style="padding: 4px 5px; color: #475569;">${e.brought_by_name || "Staff"}</td>
            <td style="padding: 4px 5px; color: #334155;">${e.description || "Operational"}</td>
            <td style="padding: 4px 5px; text-align: center; font-size: 8px; font-weight: 700;">${e.shift_id ? "DRAWER" : "DIRECT"}</td>
            <td style="padding: 4px 5px; text-align: right; font-family: monospace; font-weight: 800; color: #dc2626; white-space: nowrap;">Rs. ${formatRs(e.amount_paisa)}</td>
          </tr>
        `;
      })
      .join("");

    // 5. Salary Rows
    const salRowsHtml = filteredSalaries
      .map((s, idx) => {
        const salDate = new Date(s.payout_date || s.created_at).toLocaleString("en-PK", {
          dateStyle: "short",
          timeStyle: "short",
        });
        return `
          <tr style="border-bottom: 1px solid #e2e8f0; font-size: 9px; background: ${idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">
            <td style="padding: 4px 3px; text-align: center; color: #64748b;">${idx + 1}</td>
            <td style="padding: 4px 5px; font-family: monospace; font-weight: 700; color: #b45309;">${s.payout_id}</td>
            <td style="padding: 4px 5px; font-family: monospace; color: #475569; white-space: nowrap;">${salDate}</td>
            <td style="padding: 4px 5px; font-weight: 700; color: #0f172a;">${s.employee_name}</td>
            <td style="padding: 4px 5px; text-align: center; font-size: 8.5px; font-weight: 700; color: #475569;">${s.payout_type}</td>
            <td style="padding: 4px 5px; color: #334155;">${s.disbursed_by_name || "Admin"}</td>
            <td style="padding: 4px 5px; text-align: center; font-size: 8.5px; font-weight: 700; color: #475569;">${s.payment_method}</td>
            <td style="padding: 4px 5px; color: #64748b; font-size: 8.5px;">${s.notes || "-"}</td>
            <td style="padding: 4px 5px; text-align: right; font-family: monospace; font-weight: 800; color: #dc2626; white-space: nowrap;">Rs. ${formatRs(s.amount_paisa)}</td>
          </tr>
        `;
      })
      .join("");

    // 6. Online Orders Rows
    const onlineRowsHtml = filteredOnlineOrders
      .map((o, idx) => {
        let itemsCount = 0;
        let itemsSummary = "";
        try {
          const parsed = JSON.parse(o.items_json);
          itemsCount = parsed.reduce((sum: number, it: any) => sum + (it.quantity || 1), 0);
          itemsSummary = parsed.map((it: any) => `• ${it.product_name} (x${it.quantity || 1})`).join(", ");
        } catch {
          itemsSummary = "Assorted Fragrance Items";
          itemsCount = 1;
        }

        const orderDate = new Date(o.created_at).toLocaleString("en-PK", {
          dateStyle: "short",
          timeStyle: "short",
        });

        let payBadge = "";
        if (o.payment_status === "PAID") {
          payBadge = `<span style="background: #dcfce7; color: #166534; border: 1px solid #86efac; padding: 1px 4px; border-radius: 3px; font-weight: 800; font-size: 8px;">COLLECTED</span>`;
        } else if (o.payment_status === "PARTIAL") {
          payBadge = `<span style="background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; padding: 1px 4px; border-radius: 3px; font-weight: 800; font-size: 8px;">PARTIAL ADV</span>`;
        } else if (o.payment_status === "RETURNED") {
          payBadge = `<span style="background: #fee2e2; color: #991b1b; border: 1px solid #f87171; padding: 1px 4px; border-radius: 3px; font-weight: 800; font-size: 8px;">RETURNED</span>`;
        } else {
          payBadge = `<span style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; padding: 1px 4px; border-radius: 3px; font-weight: 800; font-size: 8px;">PENDING COD</span>`;
        }

        return `
          <tr style="border-bottom: 1px solid #e2e8f0; font-size: 9px; background: ${idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">
            <td style="padding: 4px 3px; text-align: center; color: #64748b;">${idx + 1}</td>
            <td style="padding: 4px 5px; font-family: monospace; font-weight: 800; color: #0891b2; white-space: nowrap;">${o.order_number}</td>
            <td style="padding: 4px 5px; font-family: monospace; color: #475569; white-space: nowrap;">${orderDate}</td>
            <td style="padding: 4px 5px; text-align: center; font-size: 8px; font-weight: 800; color: ${o.channel === "WHATSAPP" ? "#16a34a" : "#2563eb"};">${o.channel}</td>
            <td style="padding: 4px 5px;">
              <div style="font-weight: 700; color: #0f172a;">${o.customer_name}</div>
              <div style="font-size: 8px; font-family: monospace; color: #64748b;">${o.customer_phone} • ${o.city}</div>
            </td>
            <td style="padding: 4px 5px; font-size: 8.5px; max-width: 200px; color: #334155;">${itemsSummary}</td>
            <td style="padding: 4px 5px; text-align: center; font-family: monospace; font-weight: 700;">${itemsCount}</td>
            <td style="padding: 4px 5px; text-align: right; font-family: monospace; font-weight: 800; color: #0f172a; white-space: nowrap;">
              Rs. ${formatRs(o.total_amount_paisa)}
              ${(o.cod_balance_paisa || 0) > 0 ? `<div style="font-size: 7.5px; color: #d97706; font-weight: 700;">COD: Rs. ${formatRs(o.cod_balance_paisa)}</div>` : ""}
            </td>
            <td style="padding: 4px 3px; text-align: center;">${payBadge}</td>
          </tr>
        `;
      })
      .join("");

    // 7. Wholesale Rows
    const wholesaleRowsHtml = filteredWholesaleInvoices
      .map((w, idx) => {
        const invDate = new Date(w.invoice_date).toLocaleString("en-PK", {
          dateStyle: "short",
          timeStyle: "short",
        });

        let payBadge = "";
        if (w.payment_status === "PAID") {
          payBadge = `<span style="background: #dcfce7; color: #166534; border: 1px solid #86efac; padding: 1px 4px; border-radius: 3px; font-weight: 800; font-size: 8px;">PAID</span>`;
        } else if (w.payment_status === "PARTIAL") {
          payBadge = `<span style="background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; padding: 1px 4px; border-radius: 3px; font-weight: 800; font-size: 8px;">PARTIAL UDAR</span>`;
        } else {
          payBadge = `<span style="background: #fee2e2; color: #991b1b; border: 1px solid #f87171; padding: 1px 4px; border-radius: 3px; font-weight: 800; font-size: 8px;">UNPAID UDAR</span>`;
        }

        return `
          <tr style="border-bottom: 1px solid #e2e8f0; font-size: 9px; background: ${idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">
            <td style="padding: 4px 3px; text-align: center; color: #64748b;">${idx + 1}</td>
            <td style="padding: 4px 5px; font-family: monospace; font-weight: 800; color: #4338ca; white-space: nowrap;">${w.invoice_number}</td>
            <td style="padding: 4px 5px; font-family: monospace; color: #475569; white-space: nowrap;">${invDate}</td>
            <td style="padding: 4px 5px; font-weight: 700; color: #0f172a;">${w.customer_name}</td>
            <td style="padding: 4px 5px; color: #475569;">${w.salesperson_name || "Direct Commercial"}</td>
            <td style="padding: 4px 5px; text-align: center; font-family: monospace; font-size: 8px; font-weight: 700;">${w.order_source || "DIRECT"}</td>
            <td style="padding: 4px 5px; text-align: right; font-family: monospace; font-weight: 800; color: #0f172a; white-space: nowrap;">
              Rs. ${formatRs(w.net_total_paisa)}
            </td>
            <td style="padding: 4px 5px; text-align: right; font-family: monospace; font-weight: 800; color: #166534; white-space: nowrap;">
              Rs. ${formatRs(w.paid_amount_paisa)}
            </td>
            <td style="padding: 4px 5px; text-align: right; font-family: monospace; font-weight: 800; color: ${w.balance_due_paisa > 0 ? "#dc2626" : "#64748b"}; white-space: nowrap;">
              Rs. ${formatRs(w.balance_due_paisa)}
            </td>
            <td style="padding: 4px 3px; text-align: center;">${payBadge}</td>
          </tr>
        `;
      })
      .join("");

    const channelLabelText =
      channelFilter === "ALL"
        ? "All Channels"
        : channelFilter === "POS"
        ? "Retail POS Counter Only"
        : channelFilter === "ONLINE"
        ? "Online Orders (WhatsApp & Web)"
        : "Wholesale Commercial";

    const masterHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; width: 100%;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <img src="/logo-rect.png" style="height: 48px; width: auto; object-fit: contain;" alt="Ameer Perfumes" />
            <div>
              <h1 style="margin: 0; font-size: 20px; font-weight: 900; letter-spacing: 1px; color: #0f172a;">AMEER PERFUMES</h1>
              <div style="font-size: 10px; font-weight: 700; color: #b45309; text-transform: uppercase; letter-spacing: 0.5px;">Haute Parfumerie & Pure Concentrated Oils</div>
              <div style="font-size: 9px; color: #475569; margin-top: 2px;">Main Branch Sports Complex Bannu | Contact: 0329 9969277</div>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 15px; font-weight: 900; color: #0f172a; letter-spacing: 0.5px;">MASTER CONSOLIDATED AUDIT REPORT</div>
            <div style="font-size: 10px; font-weight: 700; color: #b45309; margin-top: 1px;">Period: ${period} • Filter: ${channelLabelText}</div>
            <div style="font-size: 9px; color: #64748b; margin-top: 1px;">Generated: ${printedAt}</div>
            <div style="font-size: 8.5px; color: #64748b;">Auditor: <strong>${userLabel}</strong></div>
          </div>
        </div>

        <!-- Executive KPI Cards Grid (5 columns x 2 rows = 10 cards) -->
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 7px; margin-bottom: 16px;">
          <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 8px;">
            <div style="font-size: 8px; font-weight: 800; text-transform: uppercase; color: #475569;">Total Gross Sales</div>
            <div style="font-size: 13px; font-weight: 900; font-family: monospace; color: #0f172a; margin-top: 1px;">Rs. ${formatRs(displayGrossRevenuePaisa)}</div>
            <div style="font-size: 7.5px; color: #64748b;">Unadjusted Topline Sales</div>
          </div>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 6px 8px;">
            <div style="font-size: 8px; font-weight: 800; text-transform: uppercase; color: #166534;">Net Sales Revenue</div>
            <div style="font-size: 13px; font-weight: 900; font-family: monospace; color: #15803d; margin-top: 1px;">Rs. ${formatRs(displayRealizedRevenuePaisa)}</div>
            <div style="font-size: 7.5px; color: #166534;">Realized Cash (Excl. Pending)</div>
          </div>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 6px 8px;">
            <div style="font-size: 8px; font-weight: 800; text-transform: uppercase; color: #991b1b;">Customer Returns & RTO</div>
            <div style="font-size: 13px; font-weight: 900; font-family: monospace; color: #b91c1c; margin-top: 1px;">-Rs. ${formatRs(displayReturnsPaisa)}</div>
            <div style="font-size: 7.5px; color: #991b1b;">${displayReturnsCount} Returns Recorded</div>
          </div>
          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 6px 8px;">
            <div style="font-size: 8px; font-weight: 800; text-transform: uppercase; color: #b45309;">Wholesale Credit (Udar)</div>
            <div style="font-size: 13px; font-weight: 900; font-family: monospace; color: #d97706; margin-top: 1px;">Rs. ${formatRs(totalPendingUdarToDisplay)}</div>
            <div style="font-size: 7.5px; color: #b45309;">Pending Wholesale Receivables</div>
          </div>
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 6px 8px;">
            <div style="font-size: 8px; font-weight: 800; text-transform: uppercase; color: #1d4ed8;">Online Pending (COD)</div>
            <div style="font-size: 13px; font-weight: 900; font-family: monospace; color: #2563eb; margin-top: 1px;">Rs. ${formatRs(totalOnlinePendingCodPaisa)}</div>
            <div style="font-size: 7.5px; color: #1e40af;">Courier Cash on Delivery</div>
          </div>
          <div style="background: #fdf2f8; border: 1px solid #fbcfe8; border-radius: 6px; padding: 6px 8px;">
            <div style="font-size: 8px; font-weight: 800; text-transform: uppercase; color: #be185d;">Discounts Given</div>
            <div style="font-size: 13px; font-weight: 900; font-family: monospace; color: #db2777; margin-top: 1px;">Rs. ${formatRs(displayDiscountsPaisa)}</div>
            <div style="font-size: 7.5px; color: #be185d;">${displayDiscountedCount} Discounted Orders</div>
          </div>
          <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 6px; padding: 6px 8px;">
            <div style="font-size: 8px; font-weight: 800; text-transform: uppercase; color: #7e22ce;">Bottles & Items Sold</div>
            <div style="font-size: 13px; font-weight: 900; font-family: monospace; color: #9333ea; margin-top: 1px;">${displayUnitsSold} Units</div>
            <div style="font-size: 7.5px; color: #7e22ce;">Channel Volume</div>
          </div>
          <div style="background: #fff7ed; border: 1px solid #ffedd5; border-radius: 6px; padding: 6px 8px;">
            <div style="font-size: 8px; font-weight: 800; text-transform: uppercase; color: #c2410c;">Operating Outflows</div>
            <div style="font-size: 13px; font-weight: 900; font-family: monospace; color: #ea580c; margin-top: 1px;">Rs. ${formatRs(totalExpensesPaisa + totalSalariesPaisa)}</div>
            <div style="font-size: 7.5px; color: #c2410c;">Petty: Rs. ${formatRs(totalExpensesPaisa)} | Salaries: Rs. ${formatRs(totalSalariesPaisa)}</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 8px;">
            <div style="font-size: 8px; font-weight: 800; text-transform: uppercase; color: #475569;">Staff Salaries Paid</div>
            <div style="font-size: 13px; font-weight: 900; font-family: monospace; color: #d97706; margin-top: 1px;">Rs. ${formatRs(totalSalariesPaisa)}</div>
            <div style="font-size: 7.5px; color: #475569;">${filteredSalaries.length} Salary Payouts</div>
          </div>
          <div style="background: ${netEstimatedMarginPaisa >= 0 ? "#f0fdf4" : "#fef2f2"}; border: 1px solid ${netEstimatedMarginPaisa >= 0 ? "#bbf7d0" : "#fecaca"}; border-radius: 6px; padding: 6px 8px;">
            <div style="font-size: 8px; font-weight: 800; text-transform: uppercase; color: ${netEstimatedMarginPaisa >= 0 ? "#166534" : "#991b1b"};">Net Operating Margin</div>
            <div style="font-size: 13px; font-weight: 900; font-family: monospace; color: ${netEstimatedMarginPaisa >= 0 ? "#15803d" : "#dc2626"}; margin-top: 1px;">Rs. ${formatRs(netEstimatedMarginPaisa)}</div>
            <div style="font-size: 7.5px; color: ${netEstimatedMarginPaisa >= 0 ? "#166534" : "#991b1b"};">Realized Cashflow</div>
          </div>
        </div>

        <!-- CONDITIONAL CHANNEL TABLES -->
        ${(channelFilter === "ALL" || channelFilter === "POS") ? `
        <!-- TABLE 1: Sales & Transactions Audit -->
        <div style="margin-top: 12px; margin-bottom: 4px; border-bottom: 1.5px solid #0f172a; padding-bottom: 3px; display: flex; justify-content: space-between; align-items: baseline;">
          <span style="font-size: 11px; font-weight: 900; text-transform: uppercase; color: #0f172a; letter-spacing: 0.5px;">1. Retail POS Counter Sales & Transactions Audit</span>
          <span style="font-size: 9px; font-family: monospace; color: #64748b;">${filteredSales.length} Invoices • Period: ${period}</span>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
          <thead>
            <tr style="background: #0f172a; color: #ffffff; font-size: 8.5px; text-transform: uppercase;">
              <th style="padding: 5px 3px; text-align: center; width: 24px;">#</th>
              <th style="padding: 5px 4px; text-align: left; width: 95px;">Invoice #</th>
              <th style="padding: 5px 4px; text-align: left; width: 90px;">Date & Time</th>
              <th style="padding: 5px 4px; text-align: left; width: 85px;">Customer</th>
              <th style="padding: 5px 4px; text-align: left;">Products & Breakdown</th>
              <th style="padding: 5px 4px; text-align: left; width: 75px;">Cashier</th>
              <th style="padding: 5px 4px; text-align: center; width: 35px;">Qty</th>
              <th style="padding: 5px 4px; text-align: center; width: 50px;">Pay</th>
              <th style="padding: 5px 4px; text-align: right; width: 80px;">Amount</th>
              <th style="padding: 5px 3px; text-align: center; width: 70px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${salesRowsHtml || `<tr><td colspan="10" style="padding: 10px; text-align: center; color: #64748b; font-size: 9px;">No sales recorded for this period.</td></tr>`}
          </tbody>
          <tfoot>
            <tr style="background: #f1f5f9; font-size: 9.5px; font-weight: 800; border-top: 1.5px solid #0f172a;">
              <td colspan="6" style="padding: 5px 4px; text-align: right; text-transform: uppercase;">Total Sales:</td>
              <td style="padding: 5px 4px; text-align: center; font-family: monospace;">${totalSalesUnits}</td>
              <td></td>
              <td style="padding: 5px 4px; text-align: right; font-family: monospace; color: #b45309;">Rs. ${formatRs(totalSalesGross)}</td>
              <td></td>
            </tr>
            ${totalRetailReturnsCount > 0 ? `
            <tr style="background: #fef2f2; font-size: 9px; font-weight: 800; color: #991b1b; border-top: 1px dashed #fca5a5;">
              <td colspan="6" style="padding: 4px; text-align: right; text-transform: uppercase;">Retail Returns & Refunds (${totalRetailReturnsCount} vouchers):</td>
              <td style="padding: 4px; text-align: center;">-</td>
              <td></td>
              <td style="padding: 4px; text-align: right; font-family: monospace; color: #b91c1c;">-Rs. ${formatRs(totalRetailReturnsPaisa)}</td>
              <td style="padding: 4px; text-align: center; font-size: 8px;">Deducted from Net</td>
            </tr>
            <tr style="background: #f0fdf4; font-size: 9.5px; font-weight: 900; color: #166534; border-top: 1px solid #86efac;">
              <td colspan="6" style="padding: 5px 4px; text-align: right; text-transform: uppercase;">Net Realized Retail Sales:</td>
              <td style="padding: 5px 4px; text-align: center;">-</td>
              <td></td>
              <td style="padding: 5px 4px; text-align: right; font-family: monospace; color: #15803d;">Rs. ${formatRs(totalRetailNetRevenuePaisa)}</td>
              <td></td>
            </tr>
            ` : ""}
          </tfoot>
        </table>
        ` : ""}

        ${(channelFilter === "ALL" || channelFilter === "ONLINE") ? `
        <!-- TABLE: Online Orders & Social Commerce Transactions (WhatsApp & Web) -->
        <div style="margin-top: 14px; margin-bottom: 4px; border-bottom: 1.5px solid #0891b2; padding-bottom: 3px; display: flex; justify-content: space-between; align-items: baseline; page-break-before: auto;">
          <span style="font-size: 11px; font-weight: 900; text-transform: uppercase; color: #0891b2; letter-spacing: 0.5px;">Online & Social Commerce Orders (WhatsApp & Web)</span>
          <span style="font-size: 9px; font-family: monospace; color: #64748b;">${filteredOnlineOrders.length} Orders • Period: ${period}</span>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
          <thead>
            <tr style="background: #0891b2; color: #ffffff; font-size: 8.5px; text-transform: uppercase;">
              <th style="padding: 5px 3px; text-align: center; width: 24px;">#</th>
              <th style="padding: 5px 4px; text-align: left; width: 90px;">Order #</th>
              <th style="padding: 5px 4px; text-align: left; width: 85px;">Date & Time</th>
              <th style="padding: 5px 4px; text-align: center; width: 65px;">Source</th>
              <th style="padding: 5px 4px; text-align: left; width: 115px;">Customer</th>
              <th style="padding: 5px 4px; text-align: left;">Items Summary</th>
              <th style="padding: 5px 4px; text-align: center; width: 35px;">Qty</th>
              <th style="padding: 5px 4px; text-align: right; width: 90px;">Total & COD</th>
              <th style="padding: 5px 3px; text-align: center; width: 75px;">Payment</th>
            </tr>
          </thead>
          <tbody>
            ${onlineRowsHtml || `<tr><td colspan="9" style="padding: 10px; text-align: center; color: #64748b; font-size: 9px;">No online orders found for this period.</td></tr>`}
          </tbody>
          <tfoot>
            <tr style="background: #ecfeff; font-size: 9.5px; font-weight: 800; border-top: 1.5px solid #0891b2;">
              <td colspan="6" style="padding: 5px 4px; text-align: right; text-transform: uppercase;">Total Online Gross Billed:</td>
              <td style="padding: 5px 4px; text-align: center; font-family: monospace;">${totalOnlineUnits}</td>
              <td style="padding: 5px 4px; text-align: right; font-family: monospace; color: #0891b2;">Rs. ${formatRs(totalOnlineBilledPaisa)}</td>
              <td></td>
            </tr>
            ${totalOnlineReturnsCount > 0 ? `
            <tr style="background: #fef2f2; font-size: 9px; font-weight: 800; color: #991b1b; border-top: 1px dashed #fca5a5;">
              <td colspan="6" style="padding: 4px; text-align: right; text-transform: uppercase;">Online Returns & RTOs (${totalOnlineReturnsCount} orders):</td>
              <td style="padding: 4px; text-align: center;">-</td>
              <td style="padding: 4px; text-align: right; font-family: monospace; color: #b91c1c;">-Rs. ${formatRs(totalOnlineReturnsPaisa)}</td>
              <td style="padding: 4px; text-align: center; font-size: 8px;">Deducted from Net</td>
            </tr>
            ` : ""}
            ${totalOnlinePendingCodPaisa > 0 ? `
            <tr style="background: #eff6ff; font-size: 9px; font-weight: 800; color: #1d4ed8; border-top: 1px dashed #93c5fd;">
              <td colspan="6" style="padding: 4px; text-align: right; text-transform: uppercase;">Pending Courier COD (Not Yet Received):</td>
              <td style="padding: 4px; text-align: center;">-</td>
              <td style="padding: 4px; text-align: right; font-family: monospace; color: #2563eb;">Rs. ${formatRs(totalOnlinePendingCodPaisa)}</td>
              <td style="padding: 4px; text-align: center; font-size: 8px;">Excluded</td>
            </tr>
            ` : ""}
            <tr style="background: #f0fdf4; font-size: 9.5px; font-weight: 900; color: #166534; border-top: 1px solid #86efac;">
              <td colspan="6" style="padding: 5px 4px; text-align: right; text-transform: uppercase;">Net Realized Online Sales (Cash Received):</td>
              <td style="padding: 5px 4px; text-align: center;">-</td>
              <td style="padding: 5px 4px; text-align: right; font-family: monospace; color: #15803d;">Rs. ${formatRs(totalOnlineNetCollectedPaisa)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        ` : ""}

        ${(channelFilter === "ALL" || channelFilter === "WHOLESALE") ? `
        <!-- TABLE: Wholesale Commercial Invoices Ledger -->
        <div style="margin-top: 14px; margin-bottom: 4px; border-bottom: 1.5px solid #4338ca; padding-bottom: 3px; display: flex; justify-content: space-between; align-items: baseline; page-break-before: auto;">
          <span style="font-size: 11px; font-weight: 900; text-transform: uppercase; color: #4338ca; letter-spacing: 0.5px;">Wholesale Commercial Invoices & Ledger</span>
          <span style="font-size: 9px; font-family: monospace; color: #64748b;">${filteredWholesaleInvoices.length} Invoices • Period: ${period}</span>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
          <thead>
            <tr style="background: #4338ca; color: #ffffff; font-size: 8.5px; text-transform: uppercase;">
              <th style="padding: 5px 3px; text-align: center; width: 24px;">#</th>
              <th style="padding: 5px 4px; text-align: left; width: 90px;">Invoice #</th>
              <th style="padding: 5px 4px; text-align: left; width: 85px;">Date & Time</th>
              <th style="padding: 5px 4px; text-align: left;">Customer & Merchant</th>
              <th style="padding: 5px 4px; text-align: left; width: 90px;">Salesperson</th>
              <th style="padding: 5px 4px; text-align: center; width: 55px;">Source</th>
              <th style="padding: 5px 4px; text-align: right; width: 85px;">Net Total</th>
              <th style="padding: 5px 4px; text-align: right; width: 85px;">Paid Amount</th>
              <th style="padding: 5px 4px; text-align: right; width: 85px;">Udar (Due)</th>
              <th style="padding: 5px 3px; text-align: center; width: 75px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${wholesaleRowsHtml || `<tr><td colspan="10" style="padding: 10px; text-align: center; color: #64748b; font-size: 9px;">No wholesale invoices found for this period.</td></tr>`}
          </tbody>
          <tfoot>
            <tr style="background: #eef2ff; font-size: 9.5px; font-weight: 800; border-top: 1.5px solid #4338ca;">
              <td colspan="5" style="padding: 5px 4px; text-align: right; text-transform: uppercase;">Total Wholesale:</td>
              <td style="padding: 5px 4px; text-align: center; font-family: monospace;">${filteredWholesaleInvoices.length} Inv</td>
              <td style="padding: 5px 4px; text-align: right; font-family: monospace; color: #4338ca;">Rs. ${formatRs(totalWholesaleBilledPaisa)}</td>
              <td style="padding: 5px 4px; text-align: right; font-family: monospace; color: #166534;">Rs. ${formatRs(totalWholesalePaidPaisa)}</td>
              <td style="padding: 5px 4px; text-align: right; font-family: monospace; color: #dc2626;">Rs. ${formatRs(totalWholesaleUdarPaisa)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        ` : ""}

        <!-- TABLE 2: Finished Perfumes Stock & Inventory Valuation -->
        <div style="margin-top: 14px; margin-bottom: 4px; border-bottom: 1.5px solid #0f172a; padding-bottom: 3px; display: flex; justify-content: space-between; align-items: baseline; page-break-before: auto;">
          <span style="font-size: 11px; font-weight: 900; text-transform: uppercase; color: #0f172a; letter-spacing: 0.5px;">2. Finished Bottled Perfumes Stock & Valuation</span>
          <span style="font-size: 9px; font-family: monospace; color: #64748b;">${products.length} SKUs • Total Bottles: ${totalBottles}</span>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
          <thead>
            <tr style="background: #0f172a; color: #ffffff; font-size: 8.5px; text-transform: uppercase;">
              <th style="padding: 5px 3px; text-align: center; width: 24px;">#</th>
              <th style="padding: 5px 4px; text-align: left; width: 80px;">SKU</th>
              <th style="padding: 5px 4px; text-align: left;">Product Name</th>
              <th style="padding: 5px 4px; text-align: left; width: 75px;">Category</th>
              <th style="padding: 5px 4px; text-align: center; width: 45px;">Size</th>
              <th style="padding: 5px 4px; text-align: center; width: 40px;">Stock</th>
              <th style="padding: 5px 4px; text-align: right; width: 65px;">Cost</th>
              <th style="padding: 5px 4px; text-align: right; width: 65px;">Retail</th>
              <th style="padding: 5px 4px; text-align: right; width: 75px;">Total Cost</th>
              <th style="padding: 5px 4px; text-align: right; width: 75px;">Total Retail</th>
            </tr>
          </thead>
          <tbody>
            ${prodRowsHtml || `<tr><td colspan="10" style="padding: 10px; text-align: center; color: #64748b; font-size: 9px;">No perfume products found.</td></tr>`}
          </tbody>
          <tfoot>
            <tr style="background: #f1f5f9; font-size: 9.5px; font-weight: 800; border-top: 1.5px solid #0f172a;">
              <td colspan="5" style="padding: 5px 4px; text-align: right; text-transform: uppercase;">Total Perfumes Inventory:</td>
              <td style="padding: 5px 4px; text-align: center; font-family: monospace;">${totalBottles}</td>
              <td colspan="2"></td>
              <td style="padding: 5px 4px; text-align: right; font-family: monospace; color: #475569;">Rs. ${formatRs(totalCostValPaisa)}</td>
              <td style="padding: 5px 4px; text-align: right; font-family: monospace; color: #b45309;">Rs. ${formatRs(totalRetailValPaisa)}</td>
            </tr>
          </tfoot>
        </table>

        <!-- TABLE 3: Attars & Concentrated Oils Inventory -->
        <div style="margin-top: 14px; margin-bottom: 4px; border-bottom: 1.5px solid #0f172a; padding-bottom: 3px; display: flex; justify-content: space-between; align-items: baseline; page-break-before: auto;">
          <span style="font-size: 11px; font-weight: 900; text-transform: uppercase; color: #0f172a; letter-spacing: 0.5px;">3. Attars & Bulk Concentrated Oils Inventory</span>
          <span style="font-size: 9px; font-family: monospace; color: #64748b;">${attars.length} Attar SKUs</span>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
          <thead>
            <tr style="background: #0891b2; color: #ffffff; font-size: 8.5px; text-transform: uppercase;">
              <th style="padding: 5px 3px; text-align: center; width: 24px;">#</th>
              <th style="padding: 5px 4px; text-align: left; width: 85px;">SKU</th>
              <th style="padding: 5px 4px; text-align: left;">Attar Name</th>
              <th style="padding: 5px 4px; text-align: right; width: 85px;">Rate/Tola</th>
              <th style="padding: 5px 4px; text-align: right; width: 85px;">Cost/Tola</th>
              <th style="padding: 5px 4px; text-align: right; width: 85px;">Half Tola</th>
              <th style="padding: 5px 4px; text-align: right; width: 85px;">Quarter Tola</th>
              <th style="padding: 5px 4px; text-align: center; width: 75px;">Density</th>
            </tr>
          </thead>
          <tbody>
            ${attarRowsHtml || `<tr><td colspan="8" style="padding: 10px; text-align: center; color: #64748b; font-size: 9px;">No attar products recorded.</td></tr>`}
          </tbody>
        </table>

        <!-- TABLE 4: Shop Petty Expenses Ledger -->
        <div style="margin-top: 14px; margin-bottom: 4px; border-bottom: 1.5px solid #0f172a; padding-bottom: 3px; display: flex; justify-content: space-between; align-items: baseline; page-break-before: auto;">
          <span style="font-size: 11px; font-weight: 900; text-transform: uppercase; color: #0f172a; letter-spacing: 0.5px;">4. Shop Petty Expenses Ledger</span>
          <span style="font-size: 9px; font-family: monospace; color: #64748b;">${filteredExpenses.length} Vouchers • Period: ${period}</span>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
          <thead>
            <tr style="background: #0f172a; color: #ffffff; font-size: 8.5px; text-transform: uppercase;">
              <th style="padding: 5px 3px; text-align: center; width: 24px;">#</th>
              <th style="padding: 5px 4px; text-align: left; width: 85px;">Voucher #</th>
              <th style="padding: 5px 4px; text-align: left; width: 95px;">Date & Time</th>
              <th style="padding: 5px 4px; text-align: left; width: 85px;">Category</th>
              <th style="padding: 5px 4px; text-align: left; width: 80px;">Auth By</th>
              <th style="padding: 5px 4px; text-align: left; width: 75px;">Brought By</th>
              <th style="padding: 5px 4px; text-align: left;">Description</th>
              <th style="padding: 5px 4px; text-align: center; width: 55px;">Source</th>
              <th style="padding: 5px 4px; text-align: right; width: 80px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${expRowsHtml || `<tr><td colspan="9" style="padding: 10px; text-align: center; color: #64748b; font-size: 9px;">No expense records for this period.</td></tr>`}
          </tbody>
          <tfoot>
            <tr style="background: #f1f5f9; font-size: 9.5px; font-weight: 800; border-top: 1.5px solid #0f172a;">
              <td colspan="8" style="padding: 5px 4px; text-align: right; text-transform: uppercase;">Total Petty Expenses:</td>
              <td style="padding: 5px 4px; text-align: right; font-family: monospace; color: #dc2626;">Rs. ${formatRs(totalExpPaisa)}</td>
            </tr>
          </tfoot>
        </table>

        <!-- TABLE 5: Employee Salaries & Disbursals -->
        <div style="margin-top: 14px; margin-bottom: 4px; border-bottom: 1.5px solid #0f172a; padding-bottom: 3px; display: flex; justify-content: space-between; align-items: baseline; page-break-before: auto;">
          <span style="font-size: 11px; font-weight: 900; text-transform: uppercase; color: #0f172a; letter-spacing: 0.5px;">5. Employee Salaries & Disbursals Ledger</span>
          <span style="font-size: 9px; font-family: monospace; color: #64748b;">${filteredSalaries.length} Payouts • Period: ${period}</span>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px;">
          <thead>
            <tr style="background: #1e293b; color: #ffffff; font-size: 8.5px; text-transform: uppercase;">
              <th style="padding: 5px 3px; text-align: center; width: 24px;">#</th>
              <th style="padding: 5px 4px; text-align: left; width: 85px;">Payout #</th>
              <th style="padding: 5px 4px; text-align: left; width: 95px;">Date & Time</th>
              <th style="padding: 5px 4px; text-align: left;">Employee Name</th>
              <th style="padding: 5px 4px; text-align: center; width: 70px;">Mode</th>
              <th style="padding: 5px 4px; text-align: left; width: 75px;">Disbursed By</th>
              <th style="padding: 5px 4px; text-align: center; width: 60px;">Channel</th>
              <th style="padding: 5px 4px; text-align: left; width: 90px;">Notes</th>
              <th style="padding: 5px 4px; text-align: right; width: 80px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${salRowsHtml || `<tr><td colspan="9" style="padding: 10px; text-align: center; color: #64748b; font-size: 9px;">No salary payouts for this period.</td></tr>`}
          </tbody>
          <tfoot>
            <tr style="background: #f1f5f9; font-size: 9.5px; font-weight: 800; border-top: 1.5px solid #0f172a;">
              <td colspan="8" style="padding: 5px 4px; text-align: right; text-transform: uppercase;">Total Salaries:</td>
              <td style="padding: 5px 4px; text-align: right; font-family: monospace; color: #dc2626;">Rs. ${formatRs(totalSalPaisa)}</td>
            </tr>
          </tfoot>
        </table>

        <!-- Verification Signatures & Stamp Blocks -->
        <div style="display: flex; justify-content: space-between; margin-top: 25px; page-break-inside: avoid;">
          <div style="width: 38%; text-align: center;">
            <div style="border-top: 1.5px solid #0f172a; padding-top: 4px; font-size: 10px; font-weight: 700; color: #0f172a;">
              Prepared By: ${userLabel}
            </div>
            <div style="font-size: 8.5px; color: #64748b;">Enterprise Systems Auditor & In-Charge</div>
          </div>
          <div style="width: 38%; text-align: center;">
            <div style="border-top: 1.5px solid #0f172a; padding-top: 4px; font-size: 10px; font-weight: 700; color: #0f172a;">
              Authorized Store Manager
            </div>
            <div style="font-size: 8.5px; color: #64748b;">Stamp, Signature & Audit Approval</div>
          </div>
        </div>

        <!-- Master Document Footer -->
        <div style="margin-top: 20px; padding-top: 6px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 8.5px; color: #64748b;">
          <div>Software Developed by <strong>Global Tech</strong> • Contact: <strong>0329 9969277</strong></div>
          <div>Ameer Perfumes ERP • Master Consolidated Audit Report (All 5 Tables in 1 Document)</div>
        </div>
      </div>
    `;

    printArea.innerHTML = masterHtml;
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

  const handlePrintReport = () => {
    const printArea = document.getElementById("reports-print-area");
    if (!printArea) {
      window.print();
      return;
    }

    let reportTitle = "EXECUTIVE MASTER AUDIT REPORT";
    let htmlContent = "";

    const userLabel = currentUser?.full_name || currentUser?.username || "Authorized Administrator";
    const printedAt = new Date().toLocaleString("en-PK", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    if (activeTab === "SALES") {
      reportTitle = "SALES & REVENUE AUDIT REPORT";
      const totalUnits = filteredSales.reduce((acc, s) => acc + s.total_units, 0);
      const totalSalesBilledPaisa = filteredSales.reduce((acc, s) => acc + s.net_payable_paisa, 0);

      const rowsHtml = filteredSales
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
              <td style="padding: 6px 6px; font-size: 9.5px; max-width: 260px;">${itemsText}</td>
              <td style="padding: 6px 6px; color: #334155;">${s.cashier_name || "Counter 1"}</td>
              <td style="padding: 6px 6px; text-align: center; font-family: monospace; font-weight: 700;">${s.total_units}</td>
              <td style="padding: 6px 6px; text-align: center; font-size: 9px; font-weight: 700; color: #475569;">${s.payment_method || "CASH"}</td>
              <td style="padding: 6px 6px; text-align: right; font-family: monospace; font-weight: 800; color: #0f172a; white-space: nowrap;">
                Rs. ${formatRs(s.net_payable_paisa)}
                ${(s.discount_paisa || 0) > 0 ? `<div style="font-size: 8px; color: #dc2626; font-weight: normal;">Disc: -Rs. ${formatRs(s.discount_paisa || 0)}</div>` : ""}
              </td>
              <td style="padding: 6px 4px; text-align: center;">${statusBadge}</td>
            </tr>
          `;
        })
        .join("");

      htmlContent = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; width: 100%;">
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 14px;">
              <img src="/logo-rect.png" style="height: 50px; width: auto; object-fit: contain;" alt="Ameer Perfumes" />
              <div>
                <h1 style="margin: 0; font-size: 20px; font-weight: 900; letter-spacing: 1px; color: #0f172a;">AMEER PERFUMES</h1>
                <div style="font-size: 10px; font-weight: 700; color: #b45309; text-transform: uppercase; letter-spacing: 0.5px;">Haute Parfumerie & Pure Concentrated Oils</div>
                <div style="font-size: 9.5px; color: #475569; margin-top: 2px;">Main Branch Sports Complex Bannu | Contact: 0329 9969277</div>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 16px; font-weight: 900; color: #0f172a; letter-spacing: 0.5px;">${reportTitle}</div>
              <div style="font-size: 10.5px; font-weight: 700; color: #b45309; margin-top: 2px;">Period: ${period}</div>
              <div style="font-size: 9.5px; color: #64748b; margin-top: 1px;">Generated: ${printedAt}</div>
              <div style="font-size: 9px; color: #64748b;">Auditor: <strong>${userLabel}</strong></div>
            </div>
          </div>

          <!-- KPI Summary Cards (6 cards) -->
          <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 16px;">
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px 9px;">
              <div style="font-size: 8.5px; font-weight: 800; text-transform: uppercase; color: #475569;">Gross Sales</div>
              <div style="font-size: 14px; font-weight: 900; font-family: monospace; color: #0f172a; margin-top: 1px;">Rs. ${formatRs(totalRetailGrossPaisa)}</div>
              <div style="font-size: 7.5px; color: #64748b;">Unadjusted Billed</div>
            </div>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 7px 9px;">
              <div style="font-size: 8.5px; font-weight: 800; text-transform: uppercase; color: #166534;">Net Sales Revenue</div>
              <div style="font-size: 14px; font-weight: 900; font-family: monospace; color: #15803d; margin-top: 1px;">Rs. ${formatRs(totalRetailNetRevenuePaisa)}</div>
              <div style="font-size: 7.5px; color: #166534;">Net of Returns</div>
            </div>
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 7px 9px;">
              <div style="font-size: 8.5px; font-weight: 800; text-transform: uppercase; color: #991b1b;">Retail Returns</div>
              <div style="font-size: 14px; font-weight: 900; font-family: monospace; color: #b91c1c; margin-top: 1px;">-Rs. ${formatRs(totalRetailReturnsPaisa)}</div>
              <div style="font-size: 7.5px; color: #991b1b;">${totalRetailReturnsCount} Vouchers</div>
            </div>
            <div style="background: #fdf2f8; border: 1px solid #fbcfe8; border-radius: 6px; padding: 7px 9px;">
              <div style="font-size: 8.5px; font-weight: 800; text-transform: uppercase; color: #be185d;">Discounts Given</div>
              <div style="font-size: 14px; font-weight: 900; font-family: monospace; color: #db2777; margin-top: 1px;">Rs. ${formatRs(totalRetailDiscountsPaisa)}</div>
              <div style="font-size: 7.5px; color: #be185d;">${totalRetailDiscountedInvoicesCount} Orders</div>
            </div>
            <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 6px; padding: 7px 9px;">
              <div style="font-size: 8.5px; font-weight: 800; text-transform: uppercase; color: #7e22ce;">Bottles Sold</div>
              <div style="font-size: 14px; font-weight: 900; font-family: monospace; color: #9333ea; margin-top: 1px;">${totalUnits} Units</div>
              <div style="font-size: 7.5px; color: #7e22ce;">Volume</div>
            </div>
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px 9px;">
              <div style="font-size: 8.5px; font-weight: 800; text-transform: uppercase; color: #64748b;">Total Invoices</div>
              <div style="font-size: 14px; font-weight: 900; font-family: monospace; color: #0f172a; margin-top: 1px;">${filteredSales.length}</div>
              <div style="font-size: 7.5px; color: #64748b;">Transactions</div>
            </div>
          </div>

          <!-- Sales Table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background: #0f172a; color: #ffffff; font-size: 9.5px; text-transform: uppercase;">
                <th style="padding: 7px 4px; text-align: center; width: 28px;">#</th>
                <th style="padding: 7px 6px; text-align: left; width: 110px;">Invoice #</th>
                <th style="padding: 7px 6px; text-align: left; width: 100px;">Date & Time</th>
                <th style="padding: 7px 6px; text-align: left; width: 90px;">Customer</th>
                <th style="padding: 7px 6px; text-align: left;">Products & Returns Breakdown</th>
                <th style="padding: 7px 6px; text-align: left; width: 85px;">Cashier</th>
                <th style="padding: 7px 6px; text-align: center; width: 40px;">Qty</th>
                <th style="padding: 7px 6px; text-align: center; width: 55px;">Pay</th>
                <th style="padding: 7px 6px; text-align: right; width: 85px;">Amount</th>
                <th style="padding: 7px 4px; text-align: center; width: 75px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="10" style="padding: 20px; text-align: center; color: #64748b;">No sales records found for ${period}.</td></tr>`}
            </tbody>
            <tfoot>
              <tr style="background: #f1f5f9; font-size: 10px; font-weight: 800; border-top: 2px solid #0f172a;">
                <td colspan="6" style="padding: 8px 6px; text-align: right; text-transform: uppercase;">Total Billed Sales (${filteredSales.length} Invoices):</td>
                <td style="padding: 8px 6px; text-align: center; font-family: monospace;">${totalUnits}</td>
                <td></td>
                <td style="padding: 8px 6px; text-align: right; font-family: monospace; color: #b45309; font-size: 11px;">Rs. ${formatRs(totalSalesBilledPaisa)}</td>
                <td></td>
              </tr>
              ${totalRetailReturnsCount > 0 ? `
              <tr style="background: #fef2f2; font-size: 9.5px; font-weight: 800; color: #991b1b; border-top: 1px dashed #fca5a5;">
                <td colspan="6" style="padding: 6px; text-align: right; text-transform: uppercase;">Retail Returns & Refunds (${totalRetailReturnsCount} vouchers):</td>
                <td style="padding: 6px; text-align: center;">-</td>
                <td></td>
                <td style="padding: 6px; text-align: right; font-family: monospace; color: #b91c1c;">-Rs. ${formatRs(totalRetailReturnsPaisa)}</td>
                <td style="padding: 6px; text-align: center; font-size: 8.5px;">Deducted from Net</td>
              </tr>
              <tr style="background: #f0fdf4; font-size: 10px; font-weight: 900; color: #166534; border-top: 1.5px solid #86efac;">
                <td colspan="6" style="padding: 7px 6px; text-align: right; text-transform: uppercase;">Net Realized Retail Sales:</td>
                <td style="padding: 7px 6px; text-align: center;">-</td>
                <td></td>
                <td style="padding: 7px 6px; text-align: right; font-family: monospace; color: #15803d; font-size: 11.5px;">Rs. ${formatRs(totalRetailNetRevenuePaisa)}</td>
                <td></td>
              </tr>
              ` : ""}
            </tfoot>
          </table>

          <!-- Dual Stamp & Signatures -->
          <div style="display: flex; justify-content: space-between; margin-top: 35px; page-break-inside: avoid;">
            <div style="width: 38%; text-align: center;">
              <div style="border-top: 1.5px solid #0f172a; padding-top: 5px; font-size: 10.5px; font-weight: 700; color: #0f172a;">
                Prepared By: ${userLabel}
              </div>
              <div style="font-size: 9px; color: #64748b;">System Sales Auditor & Attendant</div>
            </div>
            <div style="width: 38%; text-align: center;">
              <div style="border-top: 1.5px solid #0f172a; padding-top: 5px; font-size: 10.5px; font-weight: 700; color: #0f172a;">
                Authorized Store Manager
              </div>
              <div style="font-size: 9px; color: #64748b;">Stamp, Signature & Audit Approval</div>
            </div>
          </div>

          <!-- Footer -->
          <div style="margin-top: 24px; padding-top: 8px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 9px; color: #64748b;">
            <div>Software Developed by <strong>Global Tech</strong> • Contact: <strong>0329 9969277</strong></div>
            <div>Ameer Perfumes ERP • Official Sales & Revenue Audit Report</div>
          </div>
        </div>
      `;
    } else if (activeTab === "INVENTORY") {
      reportTitle = "STOCK & INVENTORY VALUATION REPORT";
      const totalCostPaisa = inventoryVal ? inventoryVal.total_cost_valuation_paisa : 0;
      const totalRetailPaisa = inventoryVal ? inventoryVal.total_retail_valuation_paisa : 0;
      const totalBottles = products.reduce((acc, p) => acc + p.current_stock_units, 0);

      const prodRows = filteredProducts
        .map((p, idx) => {
          const retVal = p.current_stock_units * p.retail_price_paisa;
          return `
            <tr style="border-bottom: 1px solid #e2e8f0; font-size: 10px; background: ${idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">
              <td style="padding: 6px 4px; text-align: center; color: #64748b;">${idx + 1}</td>
              <td style="padding: 6px 6px; font-family: monospace; font-weight: 700; color: #b45309;">${p.sku}</td>
              <td style="padding: 6px 6px; font-weight: 700; color: #0f172a;">${p.name}</td>
              <td style="padding: 6px 6px; color: #475569;">${p.category}</td>
              <td style="padding: 6px 6px; font-family: monospace; text-align: center;">${p.size_ml} ml</td>
              <td style="padding: 6px 6px; text-align: center; font-family: monospace; font-weight: 700; color: ${p.current_stock_units <= 5 ? "#dc2626" : "#0f172a"};">${p.current_stock_units}</td>
              <td style="padding: 6px 6px; text-align: right; font-family: monospace; color: #475569;">Rs. ${formatRs(p.latest_batch_cost_paisa || 0)}</td>
              <td style="padding: 6px 6px; text-align: right; font-family: monospace; font-weight: 700;">Rs. ${formatRs(p.retail_price_paisa)}</td>
              <td style="padding: 6px 6px; text-align: right; font-family: monospace; font-weight: 800; color: #b45309;">Rs. ${formatRs(retVal)}</td>
            </tr>
          `;
        })
        .join("");

      const attarRows = attars
        .map((a, idx) => {
          const densityStr = a.density_grams_per_ml ? (a.density_grams_per_ml / 1000).toFixed(3) + " g/ml" : "1.000 g/ml";
          return `
            <tr style="border-bottom: 1px solid #e2e8f0; font-size: 10px; background: ${idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">
              <td style="padding: 6px 4px; text-align: center; color: #64748b;">${idx + 1}</td>
              <td style="padding: 6px 6px; font-family: monospace; font-weight: 700; color: #b45309;">${a.sku}</td>
              <td style="padding: 6px 6px; font-weight: 700; color: #0f172a;">${a.name}</td>
              <td style="padding: 6px 6px; text-align: right; font-family: monospace; font-weight: 700; color: #b45309;">Rs. ${formatRs(a.selling_price_per_tola_paisa)}</td>
              <td style="padding: 6px 6px; text-align: right; font-family: monospace; color: #475569;">Rs. ${formatRs(a.cost_per_tola_paisa)}</td>
              <td style="padding: 6px 6px; text-align: right; font-family: monospace;">Rs. ${formatRs(a.selling_price_half_tola_paisa)}</td>
              <td style="padding: 6px 6px; text-align: right; font-family: monospace;">Rs. ${formatRs(a.selling_price_quarter_tola_paisa)}</td>
              <td style="padding: 6px 6px; text-align: center; font-family: monospace; color: #64748b;">${densityStr}</td>
            </tr>
          `;
        })
        .join("");

      htmlContent = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; width: 100%;">
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 14px;">
              <img src="/logo-rect.png" style="height: 50px; width: auto; object-fit: contain;" alt="Ameer Perfumes" />
              <div>
                <h1 style="margin: 0; font-size: 20px; font-weight: 900; letter-spacing: 1px; color: #0f172a;">AMEER PERFUMES</h1>
                <div style="font-size: 10px; font-weight: 700; color: #b45309; text-transform: uppercase; letter-spacing: 0.5px;">Haute Parfumerie & Pure Concentrated Oils</div>
                <div style="font-size: 9.5px; color: #475569; margin-top: 2px;">Main Branch Sports Complex Bannu | Contact: 0329 9969277</div>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 16px; font-weight: 900; color: #0f172a; letter-spacing: 0.5px;">${reportTitle}</div>
              <div style="font-size: 9.5px; color: #64748b; margin-top: 2px;">Generated: ${printedAt}</div>
              <div style="font-size: 9px; color: #64748b;">Auditor: <strong>${userLabel}</strong></div>
            </div>
          </div>

          <!-- KPI Summary Cards -->
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px;">
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px;">
              <div style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: #64748b;">Perfumes SKUs</div>
              <div style="font-size: 16px; font-weight: 900; font-family: monospace; color: #0f172a; margin-top: 2px;">${products.length} Items</div>
            </div>
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px;">
              <div style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: #64748b;">In-Stock Bottles</div>
              <div style="font-size: 16px; font-weight: 900; font-family: monospace; color: #0f172a; margin-top: 2px;">${totalBottles} Units</div>
            </div>
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px;">
              <div style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: #64748b;">Total Batch Cost</div>
              <div style="font-size: 16px; font-weight: 900; font-family: monospace; color: #475569; margin-top: 2px;">Rs. ${formatRs(totalCostPaisa)}</div>
            </div>
            <div style="background: #fefce8; border: 1px solid #fef08a; border-radius: 6px; padding: 8px 10px;">
              <div style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: #854d0e;">Retail Stock Potential</div>
              <div style="font-size: 16px; font-weight: 900; font-family: monospace; color: #b45309; margin-top: 2px;">Rs. ${formatRs(totalRetailPaisa)}</div>
            </div>
          </div>

          <!-- Bottled Perfumes Section -->
          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-bottom: 6px; letter-spacing: 0.5px;">1. Finished Bottled Perfumes Inventory</div>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
            <thead>
              <tr style="background: #0f172a; color: #ffffff; font-size: 9px; text-transform: uppercase;">
                <th style="padding: 6px 4px; text-align: center; width: 28px;">#</th>
                <th style="padding: 6px 6px; text-align: left; width: 80px;">SKU</th>
                <th style="padding: 6px 6px; text-align: left;">Product Name</th>
                <th style="padding: 6px 6px; text-align: left; width: 85px;">Category</th>
                <th style="padding: 6px 6px; text-align: center; width: 50px;">Size</th>
                <th style="padding: 6px 6px; text-align: center; width: 55px;">Stock</th>
                <th style="padding: 6px 6px; text-align: right; width: 75px;">Unit Cost</th>
                <th style="padding: 6px 6px; text-align: right; width: 80px;">Retail</th>
                <th style="padding: 6px 6px; text-align: right; width: 95px;">Valuation</th>
              </tr>
            </thead>
            <tbody>
              ${prodRows}
            </tbody>
          </table>

          <!-- Attar Oils Section -->
          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-bottom: 6px; letter-spacing: 0.5px; page-break-before: auto;">2. Pure Concentrated Attar Oils Inventory</div>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background: #1e293b; color: #ffffff; font-size: 9px; text-transform: uppercase;">
                <th style="padding: 6px 4px; text-align: center; width: 28px;">#</th>
                <th style="padding: 6px 6px; text-align: left; width: 80px;">SKU</th>
                <th style="padding: 6px 6px; text-align: left;">Attar Name</th>
                <th style="padding: 6px 6px; text-align: right; width: 95px;">Rate / Tola</th>
                <th style="padding: 6px 6px; text-align: right; width: 95px;">Cost / Tola</th>
                <th style="padding: 6px 6px; text-align: right; width: 85px;">Rate 1/2 Tola</th>
                <th style="padding: 6px 6px; text-align: right; width: 85px;">Rate 1/4 Tola</th>
                <th style="padding: 6px 6px; text-align: center; width: 70px;">Density</th>
              </tr>
            </thead>
            <tbody>
              ${attarRows}
            </tbody>
          </table>

          <!-- Signatures -->
          <div style="display: flex; justify-content: space-between; margin-top: 30px; page-break-inside: avoid;">
            <div style="width: 38%; text-align: center;">
              <div style="border-top: 1.5px solid #0f172a; padding-top: 5px; font-size: 10.5px; font-weight: 700; color: #0f172a;">
                Inventory Officer: ${userLabel}
              </div>
              <div style="font-size: 9px; color: #64748b;">Stock Verification & Audit</div>
            </div>
            <div style="width: 38%; text-align: center;">
              <div style="border-top: 1.5px solid #0f172a; padding-top: 5px; font-size: 10.5px; font-weight: 700; color: #0f172a;">
                Authorized Store Manager
              </div>
              <div style="font-size: 9px; color: #64748b;">Stamp, Signature & Audit Approval</div>
            </div>
          </div>

          <!-- Footer -->
          <div style="margin-top: 24px; padding-top: 8px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 9px; color: #64748b;">
            <div>Software Developed by <strong>Global Tech</strong> • Contact: <strong>0329 9969277</strong></div>
            <div>Ameer Perfumes ERP • Official Stock & Inventory Valuation Report</div>
          </div>
        </div>
      `;
    } else {
      // EXPENSES OR BACKUP TAB
      reportTitle = "SHOP EXPENSES & EMPLOYEE PAYROLL REPORT";
      const totalExpPaisa = filteredExpenses.reduce((acc, e) => acc + e.amount_paisa, 0);
      const totalSalPaisa = filteredSalaries.reduce((acc, s) => acc + s.amount_paisa, 0);
      const combinedOutflow = totalExpPaisa + totalSalPaisa;

      const expRows = filteredExpenses
        .map((e, idx) => {
          return `
            <tr style="border-bottom: 1px solid #e2e8f0; font-size: 10px; background: ${idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">
              <td style="padding: 6px 4px; text-align: center; color: #64748b;">${idx + 1}</td>
              <td style="padding: 6px 6px; font-family: monospace; font-weight: 700; color: #b45309;">${e.expense_id}</td>
              <td style="padding: 6px 6px; font-family: monospace; color: #475569;">${new Date(e.created_at).toLocaleString("en-PK", { dateStyle: "short", timeStyle: "short" })}</td>
              <td style="padding: 6px 6px; font-weight: 700; color: #0f172a;">${e.category}</td>
              <td style="padding: 6px 6px; color: #334155;">${e.authorized_by_name || "Admin"}</td>
              <td style="padding: 6px 6px; color: #334155;">${e.brought_by_name || "Staff"}</td>
              <td style="padding: 6px 6px; color: #475569; font-size: 9.5px;">${e.description || "-"}</td>
              <td style="padding: 6px 6px; text-align: right; font-family: monospace; font-weight: 800; color: #dc2626;">Rs. ${formatRs(e.amount_paisa)}</td>
            </tr>
          `;
        })
        .join("");

      const salRows = filteredSalaries
        .map((s, idx) => {
          return `
            <tr style="border-bottom: 1px solid #e2e8f0; font-size: 10px; background: ${idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">
              <td style="padding: 6px 4px; text-align: center; color: #64748b;">${idx + 1}</td>
              <td style="padding: 6px 6px; font-family: monospace; font-weight: 700; color: #b45309;">${s.payout_id}</td>
              <td style="padding: 6px 6px; font-family: monospace; color: #475569;">${new Date(s.payout_date || s.created_at).toLocaleString("en-PK", { dateStyle: "short", timeStyle: "short" })}</td>
              <td style="padding: 6px 6px; font-weight: 700; color: #0f172a;">${s.employee_name || "Staff"}</td>
              <td style="padding: 6px 6px; text-align: center; font-size: 9px; font-weight: 700; color: #475569;">${s.payout_type || "SALARY"}</td>
              <td style="padding: 6px 6px; color: #334155;">${s.disbursed_by_name || "Admin"}</td>
              <td style="padding: 6px 6px; text-align: center; font-size: 9px; font-weight: 700; color: #475569;">${s.payment_method || "CASH"}</td>
              <td style="padding: 6px 6px; text-align: right; font-family: monospace; font-weight: 800; color: #dc2626;">Rs. ${formatRs(s.amount_paisa)}</td>
            </tr>
          `;
        })
        .join("");

      htmlContent = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; width: 100%;">
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 14px;">
              <img src="/logo-rect.png" style="height: 50px; width: auto; object-fit: contain;" alt="Ameer Perfumes" />
              <div>
                <h1 style="margin: 0; font-size: 20px; font-weight: 900; letter-spacing: 1px; color: #0f172a;">AMEER PERFUMES</h1>
                <div style="font-size: 10px; font-weight: 700; color: #b45309; text-transform: uppercase; letter-spacing: 0.5px;">Haute Parfumerie & Pure Concentrated Oils</div>
                <div style="font-size: 9.5px; color: #475569; margin-top: 2px;">Main Branch Sports Complex Bannu | Contact: 0329 9969277</div>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 16px; font-weight: 900; color: #0f172a; letter-spacing: 0.5px;">${reportTitle}</div>
              <div style="font-size: 10.5px; font-weight: 700; color: #b45309; margin-top: 2px;">Period: ${period}</div>
              <div style="font-size: 9.5px; color: #64748b; margin-top: 1px;">Generated: ${printedAt}</div>
              <div style="font-size: 9px; color: #64748b;">Auditor: <strong>${userLabel}</strong></div>
            </div>
          </div>

          <!-- KPI Summary Cards -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px;">
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 12px;">
              <div style="font-size: 9.5px; font-weight: 800; text-transform: uppercase; color: #64748b;">Total Petty Expenses</div>
              <div style="font-size: 17px; font-weight: 900; font-family: monospace; color: #dc2626; margin-top: 2px;">Rs. ${formatRs(totalExpPaisa)}</div>
            </div>
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 12px;">
              <div style="font-size: 9.5px; font-weight: 800; text-transform: uppercase; color: #64748b;">Total Staff Salaries</div>
              <div style="font-size: 17px; font-weight: 900; font-family: monospace; color: #dc2626; margin-top: 2px;">Rs. ${formatRs(totalSalPaisa)}</div>
            </div>
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 10px 12px;">
              <div style="font-size: 9.5px; font-weight: 800; text-transform: uppercase; color: #991b1b;">Combined Operational Outflow</div>
              <div style="font-size: 17px; font-weight: 900; font-family: monospace; color: #991b1b; margin-top: 2px;">Rs. ${formatRs(combinedOutflow)}</div>
            </div>
          </div>

          <!-- Section 1: Shop Expenses -->
          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-bottom: 6px; letter-spacing: 0.5px;">1. Shop Petty Expenses (${filteredExpenses.length} Vouchers)</div>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
            <thead>
              <tr style="background: #0f172a; color: #ffffff; font-size: 9px; text-transform: uppercase;">
                <th style="padding: 6px 4px; text-align: center; width: 28px;">#</th>
                <th style="padding: 6px 6px; text-align: left; width: 95px;">Voucher #</th>
                <th style="padding: 6px 6px; text-align: left; width: 105px;">Date & Time</th>
                <th style="padding: 6px 6px; text-align: left; width: 100px;">Category</th>
                <th style="padding: 6px 6px; text-align: left; width: 90px;">Authorized By</th>
                <th style="padding: 6px 6px; text-align: left; width: 85px;">Brought By</th>
                <th style="padding: 6px 6px; text-align: left;">Description</th>
                <th style="padding: 6px 6px; text-align: right; width: 90px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${expRows || `<tr><td colspan="8" style="padding: 15px; text-align: center; color: #64748b;">No petty expenses in ${period}.</td></tr>`}
            </tbody>
            <tfoot>
              <tr style="background: #f1f5f9; font-size: 10px; font-weight: 800; border-top: 2px solid #0f172a;">
                <td colspan="7" style="padding: 6px 6px; text-align: right; text-transform: uppercase;">Total Petty Expenses:</td>
                <td style="padding: 6px 6px; text-align: right; font-family: monospace; color: #dc2626;">Rs. ${formatRs(totalExpPaisa)}</td>
              </tr>
            </tfoot>
          </table>

          <!-- Section 2: Salaries -->
          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-bottom: 6px; letter-spacing: 0.5px; page-break-before: auto;">2. Employee Salaries Disbursed (${filteredSalaries.length} Payouts)</div>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background: #1e293b; color: #ffffff; font-size: 9px; text-transform: uppercase;">
                <th style="padding: 6px 4px; text-align: center; width: 28px;">#</th>
                <th style="padding: 6px 6px; text-align: left; width: 95px;">Payout #</th>
                <th style="padding: 6px 6px; text-align: left; width: 105px;">Date & Time</th>
                <th style="padding: 6px 6px; text-align: left;">Employee Name</th>
                <th style="padding: 6px 6px; text-align: center; width: 75px;">Payout Mode</th>
                <th style="padding: 6px 6px; text-align: left; width: 90px;">Authorized By</th>
                <th style="padding: 6px 6px; text-align: center; width: 70px;">Pay Method</th>
                <th style="padding: 6px 6px; text-align: right; width: 90px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${salRows || `<tr><td colspan="8" style="padding: 15px; text-align: center; color: #64748b;">No salary payouts in ${period}.</td></tr>`}
            </tbody>
            <tfoot>
              <tr style="background: #f1f5f9; font-size: 10px; font-weight: 800; border-top: 2px solid #0f172a;">
                <td colspan="7" style="padding: 6px 6px; text-align: right; text-transform: uppercase;">Total Salaries:</td>
                <td style="padding: 6px 6px; text-align: right; font-family: monospace; color: #dc2626;">Rs. ${formatRs(totalSalPaisa)}</td>
              </tr>
            </tfoot>
          </table>

          <!-- Signatures -->
          <div style="display: flex; justify-content: space-between; margin-top: 30px; page-break-inside: avoid;">
            <div style="width: 38%; text-align: center;">
              <div style="border-top: 1.5px solid #0f172a; padding-top: 5px; font-size: 10.5px; font-weight: 700; color: #0f172a;">
                Accounts Officer: ${userLabel}
              </div>
              <div style="font-size: 9px; color: #64748b;">Expense Verification & Ledger Audit</div>
            </div>
            <div style="width: 38%; text-align: center;">
              <div style="border-top: 1.5px solid #0f172a; padding-top: 5px; font-size: 10.5px; font-weight: 700; color: #0f172a;">
                Authorized Store Manager
              </div>
              <div style="font-size: 9px; color: #64748b;">Stamp, Signature & Audit Approval</div>
            </div>
          </div>

          <!-- Footer -->
          <div style="margin-top: 24px; padding-top: 8px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 9px; color: #64748b;">
            <div>Software Developed by <strong>Global Tech</strong> • Contact: <strong>0329 9969277</strong></div>
            <div>Ameer Perfumes ERP • Official Expenses & Salaries Ledger Report</div>
          </div>
        </div>
      `;
    }

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

  const formatRs = (paisa: number) => {
    return (paisa / 100).toLocaleString("en-PK", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  return (
    <div className="flex-1 p-6 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col gap-6 select-none overflow-y-auto">

      {/* Screen Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold font-serif text-slate-900 dark:text-slate-100 tracking-wide flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-500" />
              Executive Master Reports & Analytics Center
            </h1>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Comprehensive audit reports, sales analytics, inventory valuations, expense ledgers, and database backups.
          </p>
        </div>

        {/* Global Period Selector, Channel Filter & Primary Actions - All 5 in 1 Single Professional Row */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 shrink-0 flex-nowrap">
          {/* 1. Period Filter Dropdown */}
          <div className="flex items-center bg-white dark:bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-300 dark:border-slate-700 shadow-2xs hover:border-amber-500/50 transition-colors h-8.5 shrink-0">
            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0 mr-1.5" />
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-1.5 font-mono">
              Period:
            </span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
              className="bg-transparent text-slate-900 dark:text-slate-100 font-bold text-xs outline-none cursor-pointer pr-1"
            >
              <option value="TODAY" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium">Daily (Today)</option>
              <option value="WEEK" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium">Weekly</option>
              <option value="MONTH" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium">Monthly</option>
              <option value="YEAR" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium">Yearly</option>
              <option value="ALL" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium">All Records</option>
            </select>
          </div>

          {/* 2. Channel Filter Dropdown */}
          <div className="flex items-center bg-white dark:bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-300 dark:border-slate-700 shadow-2xs hover:border-amber-500/50 transition-colors h-8.5 shrink-0">
            <Globe className="w-3.5 h-3.5 text-amber-500 shrink-0 mr-1.5" />
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-1.5 font-mono">
              Channel:
            </span>
            <select
              value={channelFilter}
              onChange={(e) => {
                const newCh = e.target.value as ChannelAuditFilter;
                setChannelFilter(newCh);
                if (newCh === "POS") setActiveTab("SALES");
                else if (newCh === "ONLINE") setActiveTab("ONLINE");
                else if (newCh === "WHOLESALE") setActiveTab("WHOLESALE");
              }}
              className="bg-transparent text-slate-900 dark:text-slate-100 font-bold text-xs outline-none cursor-pointer pr-1"
            >
              <option value="ALL" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium">All Channels</option>
              <option value="POS" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium">Retail POS</option>
              <option value="ONLINE" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium">Online Orders</option>
              <option value="WHOLESALE" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium">Wholesale</option>
            </select>
          </div>

          {/* 3. Refresh Action Button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="h-8.5 flex items-center gap-1.5 text-xs font-semibold cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          {/* 4. Print Current Tab Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintReport}
            className="h-8.5 flex items-center gap-1.5 text-xs font-semibold cursor-pointer border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 whitespace-nowrap shrink-0"
            title="Prints the currently active report tab"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Current Tab</span>
          </Button>

          {/* 5. Print Master Audit Report Button */}
          <Button
            variant="primary"
            size="sm"
            onClick={handlePrintAllTablesMasterReport}
            className="h-8.5 flex items-center gap-1.5 text-xs font-bold cursor-pointer bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 shadow-sm whitespace-nowrap shrink-0"
            title="Prints all tables filtered by selected channel & period in one master audit report"
          >
            <Printer className="w-3.5 h-3.5 text-slate-950" />
            <span>Print Master Audit Report</span>
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

      {/* Executive KPI Summary Cards (Arranged in 2 Rows of 5 Cards = 10 Professional Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Card 0: Total Gross Sales (Pure 100% Unadjusted Sales - Zero Deductions) */}
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 uppercase font-mono font-bold">
            <span>Total Gross Sales</span>
            <Landmark className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-lg sm:text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1 block">
            Rs. {formatRs(displayGrossRevenuePaisa)}
          </span>
          <span className="text-[10px] text-slate-500 font-mono mt-0.5 block truncate" title="Pure Unadjusted Billed Revenue (No deductions: Zero discount, return, salary, or expense cuts)">
            {channelFilter === "POS"
              ? "Retail Counter Gross"
              : channelFilter === "ONLINE"
              ? "Online Gross Billed"
              : channelFilter === "WHOLESALE"
              ? "Wholesale Billed Invoices"
              : `Retail: Rs. ${formatRs(totalRetailGrossPaisa)} | W.Sale: Rs. ${formatRs(totalWholesaleGrossPaisa)} | Onl: Rs. ${formatRs(totalOnlineGrossPaisa)}`}
          </span>
        </div>

        {/* Card 1: Net Sales Revenue (Realized Cash net of Returns) */}
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 uppercase font-mono font-bold">
            <span>Net Sales Revenue</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <span className="text-lg sm:text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 block">
            Rs. {formatRs(displayRealizedRevenuePaisa)}
          </span>
          <span className="text-[10px] text-slate-500 font-mono mt-0.5 block truncate" title={`Retail Net: Rs. ${formatRs(totalRetailNetRevenuePaisa)} • Wholesale Realized: Rs. ${formatRs(totalWholesalePaidPaisa)} • Online Net Collected: Rs. ${formatRs(totalOnlineNetCollectedPaisa)}`}>
            {channelFilter === "POS"
              ? "Retail Counter Realized (Net of Returns)"
              : channelFilter === "ONLINE"
              ? "Online Realized Net Advances"
              : channelFilter === "WHOLESALE"
              ? "Wholesale Realized Cash"
              : `Retail: Rs. ${formatRs(totalRetailNetRevenuePaisa)} | W.Sale: Rs. ${formatRs(totalWholesalePaidPaisa)} | Onl: Rs. ${formatRs(totalOnlineNetCollectedPaisa)}`}
          </span>
        </div>

        {/* Card 2: Customer Returns & Parcel RTO */}
        <div className="bg-rose-500/5 dark:bg-rose-950/20 border border-rose-500/30 p-3.5 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-rose-700 dark:text-rose-400 uppercase font-mono font-bold">
            <span>Customer Returns & RTO</span>
            <RotateCcw className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <span className="text-lg sm:text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1 block">
            -Rs. {formatRs(displayReturnsPaisa)}
          </span>
          <span className="text-[10px] text-rose-700/80 dark:text-rose-400/80 font-mono mt-0.5 block truncate" title={`Retail: ${totalRetailReturnsCount} • Online: ${totalOnlineReturnsCount}`}>
            {displayReturnsCount} Returns recorded ({channelFilter === "ALL" ? `Retail: ${totalRetailReturnsCount} | Online: ${totalOnlineReturnsCount}` : `${channelFilter} channel`})
          </span>
        </div>

        {/* Card 3: Wholesale Credit (Udar / Pending Receivables) */}
        <div className="bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/30 p-3.5 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-400 uppercase font-mono font-bold">
            <span>Wholesale Credit (Udar)</span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <span className="text-lg sm:text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1 block">
            Rs. {formatRs(channelFilter === "POS" || channelFilter === "ONLINE" ? 0 : totalPendingUdarToDisplay)}
          </span>
          <span className="text-[10px] text-amber-700/80 dark:text-amber-400/80 font-mono mt-0.5 block truncate">
            {channelFilter === "POS" || channelFilter === "ONLINE"
              ? "Not applicable for this channel"
              : `${filteredWholesaleInvoices.filter(w => w.balance_due_paisa > 0).length} Unsettled Invoices (Receivable)`}
          </span>
        </div>

        {/* Card 4: Online Orders Pending (COD Receivables) */}
        <div className="bg-blue-500/5 dark:bg-blue-950/20 border border-blue-500/30 p-3.5 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-blue-700 dark:text-blue-400 uppercase font-mono font-bold">
            <span>Online Orders Pending (COD)</span>
            <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <span className="text-lg sm:text-xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1 block">
            Rs. {formatRs(channelFilter === "POS" || channelFilter === "WHOLESALE" ? 0 : totalOnlinePendingCodPaisa)}
          </span>
          <span className="text-[10px] text-blue-700/80 dark:text-blue-400/80 font-mono mt-0.5 block truncate">
            {channelFilter === "POS" || channelFilter === "WHOLESALE"
              ? "Not applicable for this channel"
              : `${activeFilteredOnlineOrders.filter((o) => calcOnlineOrderPendingCodPaisa(o) > 0).length} Pending Shipments / Courier COD`}
          </span>
        </div>

        {/* Card 5: Discounts Given */}
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 uppercase font-mono font-bold">
            <span>Discounts Given</span>
            <Percent className="w-4 h-4 text-rose-500" />
          </div>
          <span className="text-lg sm:text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1 block">
            Rs. {formatRs(displayDiscountsPaisa)}
          </span>
          <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
            {displayDiscountedCount} Discounted transactions
          </span>
        </div>

        {/* Card 6: Bottles / Units Sold */}
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 uppercase font-mono font-bold">
            <span>Bottles Sold</span>
            <Package className="w-4 h-4 text-purple-500" />
          </div>
          <span className="text-lg sm:text-xl font-bold font-mono text-purple-600 dark:text-purple-400 mt-1 block">
            {displayUnitsSold} Units
          </span>
          <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
            Fragrance units dispensed
          </span>
        </div>

        {/* Card 7: Petty Expenses */}
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 uppercase font-mono font-bold">
            <span>Petty Expenses</span>
            <Banknote className="w-4 h-4 text-rose-500" />
          </div>
          <span className="text-lg sm:text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1 block">
            Rs. {formatRs(totalExpensesPaisa)}
          </span>
          <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
            {filteredExpenses.length} Vouchers recorded
          </span>
        </div>

        {/* Card 8: Staff Salaries Paid */}
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 uppercase font-mono font-bold">
            <span>Staff Salaries Paid</span>
            <BadgeDollarSign className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-lg sm:text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1 block">
            Rs. {formatRs(totalSalariesPaisa)}
          </span>
          <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
            {filteredSalaries.length} Payouts disbursed
          </span>
        </div>

        {/* Card 9: Net Operating Margin */}
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 uppercase font-mono font-bold">
            <span>Net Operating Margin</span>
            <Receipt className="w-4 h-4 text-blue-500" />
          </div>
          <span
            className={`text-lg sm:text-xl font-bold font-mono mt-1 block ${
              netEstimatedMarginPaisa >= 0
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-rose-700 dark:text-rose-400"
            }`}
          >
            Rs. {formatRs(netEstimatedMarginPaisa)}
          </span>
          <span className="text-[10px] text-slate-500 font-mono mt-0.5 block truncate" title="Cash Realized Basis (Excludes Pending Wholesale Udar & Pending Online COD)">
            Cash Basis (Excl. Pending Receivables)
          </span>
        </div>
      </div>

      {/* Tab Navigation & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveTab("SALES")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
              activeTab === "SALES"
                ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900"
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Retail POS Audit ({filteredSales.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("ONLINE")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
              activeTab === "ONLINE"
                ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900"
            }`}
          >
            <Globe className="w-4 h-4 text-emerald-500" />
            <span>Online Orders Audit ({filteredOnlineOrders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("WHOLESALE")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
              activeTab === "WHOLESALE"
                ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900"
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Wholesale & Credit Audit ({filteredWholesaleInvoices.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("INVENTORY")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
              activeTab === "INVENTORY"
                ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900"
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Stock & Inventory Valuation ({products.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("EXPENSES")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
              activeTab === "EXPENSES"
                ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900"
            }`}
          >
            <Banknote className="w-4 h-4" />
            <span>Expenses & Salaries Ledger</span>
          </button>

          <button
            onClick={() => setActiveTab("BACKUP")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
              activeTab === "BACKUP"
                ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900"
            }`}
          >
            <Database className="w-4 h-4 text-emerald-500" />
            <span>Database Backup & Safety Center</span>
          </button>
        </div>

        {/* Tab Specific Quick Download Button */}
        <div className="flex items-center gap-2">
          {activeTab === "SALES" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                exportSalesHistoryToCSV(filteredSales, `Ameer_Sales_${period}`);
                setFeedback({
                  type: "success",
                  text: `✓ Sales History (${filteredSales.length} records) exported to Excel successfully! Check your Downloads folder.`,
                });
              }}
              className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 shadow-xs whitespace-nowrap px-3 py-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Sales (Excel)</span>
            </Button>
          )}

          {activeTab === "ONLINE" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const header = "Order #,Channel,Customer,Phone,City,Courier,Tracking #,Total (PKR),Advance (PKR),COD Balance (PKR),Payment Status,Delivery Status,Date\n";
                const rows = filteredOnlineOrders.map(o => 
                  `"${o.order_number}","${o.channel}","${o.customer_name}","${o.customer_phone}","${o.city}","${o.courier_partner}","${o.tracking_number || ''}",${o.total_amount_paisa/100},${o.advance_paid_paisa/100},${o.cod_balance_paisa/100},"${o.payment_status}","${o.delivery_status}","${o.created_at}"`
                ).join("\n");
                const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `Ameer_Online_Orders_${period}.csv`;
                a.click();
                URL.revokeObjectURL(url);
                setFeedback({
                  type: "success",
                  text: `✓ Online Orders (${filteredOnlineOrders.length} records) exported to Excel successfully!`,
                });
              }}
              className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 shadow-xs whitespace-nowrap px-3 py-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Online (Excel)</span>
            </Button>
          )}

          {activeTab === "WHOLESALE" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const header = "Invoice #,Customer,Date,Source,Salesperson,Net Total (PKR),Paid (PKR),Balance Due (Udar),Payment Status\n";
                const rows = filteredWholesaleInvoices.map(w => 
                  `"${w.invoice_number}","${w.customer_name}","${w.invoice_date}","${w.order_source}","${w.salesperson_name || ''}",${w.net_total_paisa/100},${w.paid_amount_paisa/100},${w.balance_due_paisa/100},"${w.payment_status}"`
                ).join("\n");
                const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `Ameer_Wholesale_Invoices_${period}.csv`;
                a.click();
                URL.revokeObjectURL(url);
                setFeedback({
                  type: "success",
                  text: `✓ Wholesale & Credit Invoices (${filteredWholesaleInvoices.length} records) exported to Excel successfully!`,
                });
              }}
              className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 shadow-xs whitespace-nowrap px-3 py-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Wholesale (Excel)</span>
            </Button>
          )}

          {activeTab === "INVENTORY" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                exportProductsInventoryToCSV(products, `Ameer_Perfumes_Inventory`);
                setFeedback({
                  type: "success",
                  text: `✓ Products Inventory (${products.length} products) exported to Excel successfully! Check your Downloads folder.`,
                });
              }}
              className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 shadow-xs whitespace-nowrap px-3 py-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Inventory (Excel)</span>
            </Button>
          )}

          {activeTab === "EXPENSES" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                exportExpensesToCSV(filteredExpenses, `Ameer_Expenses_${period}`);
                setFeedback({
                  type: "success",
                  text: `✓ Expenses Ledger (${filteredExpenses.length} entries) exported to Excel successfully! Check your Downloads folder.`,
                });
              }}
              className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 shadow-xs whitespace-nowrap px-3 py-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Expenses (Excel)</span>
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={handleExportAllToSingleExcel}
            className="flex items-center gap-1.5 text-xs font-bold cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs whitespace-nowrap px-3.5 py-1.5"
            title="Downloads all database tables combined into one single Excel spreadsheet (.csv)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Master Audit (Excel)</span>
          </Button>
        </div>
      </div>

      {/* TAB 1: SALES & TRANSACTIONS AUDIT */}
      {activeTab === "SALES" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="w-full sm:w-96">
              <Input
                placeholder="Search invoice #, customer phone, cashier, or salesperson..."
                value={salesSearch}
                onChange={(e) => setSalesSearch(e.target.value)}
                icon={<Search className="w-4 h-4 text-amber-500" />}
                className="h-9 text-xs"
              />
            </div>
            <span className="text-xs font-mono text-slate-500">
              Showing {filteredSales.length} of {sales.length} invoices
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto shadow-xs">
            <table className="min-w-[950px] w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 font-mono uppercase text-[11px] text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="py-2.5 px-3">Invoice #</th>
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Customer Phone</th>
                  <th className="py-2.5 px-3">Products Sold</th>
                  <th className="py-2.5 px-3">Cashier</th>
                  <th className="py-2.5 px-3 text-center">Units</th>
                  <th className="py-2.5 px-3 text-center">Payment</th>
                  <th className="py-2.5 px-3 text-right">Net Amount</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-sans">
                {filteredSales.map((sale) => (
                  <tr key={sale.invoice_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-mono font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                      {sale.invoice_number}
                    </td>
                    <td className="py-2 px-3 text-slate-600 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">
                      {new Date(sale.invoice_date).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 font-mono">{sale.customer_phone || "Walk-in"}</td>
                    <td className="py-2 px-3 max-w-[320px]">
                      {sale.items_detail && sale.items_detail.length > 0 ? (
                        <div className="flex flex-col gap-1 py-0.5">
                          {sale.items_detail.map((it, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-[11px] leading-tight">
                              {it.returned_quantity > 0 ? (
                                <span className="inline-flex items-center gap-1 font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900/50">
                                  <span>↩</span>
                                  <span>{it.product_name}</span>
                                  <span className="text-[10px] bg-rose-600 text-white px-1 rounded-xs font-mono">
                                    {it.returned_quantity === it.quantity
                                      ? `ALL ${it.quantity} RETURNED`
                                      : `${it.returned_quantity}/${it.quantity} RETURNED`}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-slate-800 dark:text-slate-200">
                                  • {it.product_name} <span className="text-slate-600 dark:text-slate-400 font-mono text-[10px]">(x{it.quantity})</span>
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="truncate block" title={sale.product_names || "Fragrance"}>
                          {sale.product_names || "Fragrance"}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-medium">{sale.cashier_name || "Cashier"}</td>
                    <td className="py-2 px-3 text-center font-mono font-bold">{sale.total_units}</td>
                    <td className="py-2 px-3 text-center font-mono text-[11px] uppercase">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {sale.payment_method || "CASH"}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                      <div>Rs. {formatRs(sale.net_payable_paisa)}</div>
                      {(sale.discount_paisa || 0) > 0 && (
                        <div className="text-[10px] text-rose-500 font-normal">
                          Disc: -Rs. {formatRs(sale.discount_paisa || 0)}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      {sale.return_status === "FULL" || (sale.is_returned && (!sale.return_status || sale.return_status === "FULL")) ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                          FULL RETURN
                        </span>
                      ) : sale.return_status === "PARTIAL" || (sale.returned_units && sale.returned_units > 0) ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                          PARTIAL RETURN ({sale.returned_units}/{sale.total_units})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          COMPLETED
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredSales.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500">
                      No sales records found for the selected period ({period}).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: ONLINE ORDERS AUDIT */}
      {activeTab === "ONLINE" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="w-full sm:w-96">
              <Input
                placeholder="Search online order #, customer, phone, courier..."
                value={onlineSearch}
                onChange={(e) => setOnlineSearch(e.target.value)}
                icon={<Search className="w-4 h-4 text-emerald-500" />}
                className="h-9 text-xs"
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs font-mono text-slate-500">
                Showing {filteredOnlineOrders.length} of {onlineOrders.length} online orders
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-500 uppercase font-mono text-[11px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Order #</th>
                  <th className="py-2.5 px-3">Channel</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Customer & Phone</th>
                  <th className="py-2.5 px-3">City / Address</th>
                  <th className="py-2.5 px-3">Courier & Tracking</th>
                  <th className="py-2.5 px-3 text-right">Order Value</th>
                  <th className="py-2.5 px-3 text-right">Advance Paid</th>
                  <th className="py-2.5 px-3 text-right">Pending COD</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-sans">
                {filteredOnlineOrders.map((ord) => (
                  <tr key={ord.order_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      {ord.order_number}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        ord.channel === "WHATSAPP"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                          : "bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30"
                      }`}>
                        {ord.channel === "WHATSAPP" ? "💬 WhatsApp" : "🌐 Website"}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-600 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">
                      {new Date(ord.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{ord.customer_name}</div>
                      <div className="text-[11px] font-mono text-slate-500">{ord.customer_phone}</div>
                    </td>
                    <td className="py-2 px-3 text-slate-700 dark:text-slate-300 max-w-[200px] truncate" title={`${ord.city} • ${ord.shipping_address}`}>
                      <span className="font-semibold">{ord.city}</span>
                      <span className="text-[11px] text-slate-500 block truncate">{ord.shipping_address}</span>
                    </td>
                    <td className="py-2 px-3 font-mono text-[11px]">
                      <div>{ord.courier_partner}</div>
                      {ord.tracking_number && (
                        <div className="text-amber-600 font-semibold">{ord.tracking_number}</div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                      Rs. {formatRs(ord.total_amount_paisa)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      Rs. {formatRs(ord.advance_paid_paisa)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                      {ord.cod_balance_paisa > 0 && ord.payment_status !== "RETURNED" && ord.delivery_status !== "RETURNED_RTO" ? (
                        <span>Rs. {formatRs(ord.cod_balance_paisa)}</span>
                      ) : (
                        <span className="text-slate-400 font-normal">Rs. 0</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        ord.payment_status === "PAID"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                          : ord.payment_status === "PARTIAL"
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                          : ord.payment_status === "RETURNED" || ord.delivery_status === "RETURNED_RTO"
                          ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                          : "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                      }`}>
                        {ord.payment_status === "RETURNED" || ord.delivery_status === "RETURNED_RTO"
                          ? "RETURNED (RTO)"
                          : ord.payment_status}
                      </span>
                      {ord.refund_amount_paisa && ord.refund_amount_paisa > 0 ? (
                        <div className="text-[9px] font-mono text-rose-600 font-bold mt-0.5">
                          ↩ Ref: Rs. {formatRs(ord.refund_amount_paisa)}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {filteredOnlineOrders.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-500">
                      No online orders found for the selected period ({period}).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: WHOLESALE & CREDIT AUDIT */}
      {activeTab === "WHOLESALE" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="w-full sm:w-96">
              <Input
                placeholder="Search wholesale invoice #, customer, or salesperson..."
                value={wholesaleSearch}
                onChange={(e) => setWholesaleSearch(e.target.value)}
                icon={<Search className="w-4 h-4 text-amber-500" />}
                className="h-9 text-xs"
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs font-mono text-slate-500">
                Showing {filteredWholesaleInvoices.length} of {wholesaleInvoices.length} wholesale invoices
              </div>
            </div>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900/40 shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 font-mono uppercase text-[10px]">
                  <th className="py-2.5 px-3">Invoice #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Customer (B2B)</th>
                  <th className="py-2.5 px-3">Salesperson</th>
                  <th className="py-2.5 px-3 text-right">Billed Amount</th>
                  <th className="py-2.5 px-3 text-right">Paid (Realized)</th>
                  <th className="py-2.5 px-3 text-right">Credit (Udar Due)</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                {filteredWholesaleInvoices.map((w) => (
                  <tr key={w.wholesale_invoice_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-amber-600 dark:text-amber-400">{w.invoice_number}</td>
                    <td className="py-2.5 px-3 text-slate-500">{w.invoice_date}</td>
                    <td className="py-2.5 px-3 font-sans font-medium text-slate-900 dark:text-slate-100">{w.customer_name}</td>
                    <td className="py-2.5 px-3 text-slate-500 font-sans">{w.salesperson_name || "—"}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">Rs. {formatRs(w.net_total_paisa)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">Rs. {formatRs(w.paid_amount_paisa)}</td>
                    <td className="py-2.5 px-3 text-right font-bold">
                      {w.balance_due_paisa > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                          Rs. {formatRs(w.balance_due_paisa)}
                        </span>
                      ) : (
                        <span className="text-slate-400">Rs. 0</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        w.payment_status === "PAID"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                          : w.payment_status === "PARTIAL"
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                          : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                      }`}>
                        {w.payment_status}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredWholesaleInvoices.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 font-sans">
                      No wholesale invoices found for the selected period ({period}).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: INVENTORY & STOCK VALUATION */}
      {activeTab === "INVENTORY" && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-3">
            <div className="w-full sm:w-96">
              <Input
                placeholder="Search perfumes by name, SKU or category..."
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
                icon={<Search className="w-4 h-4 text-amber-500" />}
                className="h-9 text-xs"
              />
            </div>
            <span className="text-xs font-mono text-slate-500">
              Total Perfumes: {products.length} | Total Attar Oils: {attars.length}
            </span>
          </div>

          {/* Finished Perfumes Table */}
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto shadow-xs">
            <div className="p-3 bg-slate-100/70 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Finished Bottled Perfumes Inventory
                </h3>
              </div>
              {inventoryVal && (
                <div className="text-xs font-mono text-slate-600 dark:text-slate-400">
                  Total Cost: <span className="font-bold text-slate-900 dark:text-slate-100">Rs. {formatRs(inventoryVal.total_cost_valuation_paisa)}</span> | Retail Potential: <span className="font-bold text-amber-600 dark:text-amber-400">Rs. {formatRs(inventoryVal.total_retail_valuation_paisa)}</span>
                </div>
              )}
            </div>

            <table className="min-w-[950px] w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 font-mono uppercase text-[11px] text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Bottle Size</th>
                  <th className="py-2.5 px-3 text-right">Available Stock</th>
                  <th className="py-2.5 px-3 text-right">Unit Cost</th>
                  <th className="py-2.5 px-3 text-right">Retail Rate</th>
                  <th className="py-2.5 px-3 text-right">Total Retail Potential</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-sans">
                {filteredProducts.map((p) => {
                  const retailValPaisa = p.current_stock_units * p.retail_price_paisa;
                  return (
                    <tr key={p.product_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2 px-3 font-mono font-bold text-amber-700 dark:text-amber-400">{p.sku}</td>
                      <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">{p.name}</td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{p.category}</td>
                      <td className="py-2 px-3 font-mono">{p.size_ml} ml</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">
                        <span className={p.current_stock_units <= 5 ? "text-rose-600 dark:text-rose-400 font-bold" : ""}>
                          {p.current_stock_units} Bottles
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                        Rs. {formatRs(p.latest_batch_cost_paisa || 0)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold">
                        Rs. {formatRs(p.retail_price_paisa)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-amber-700 dark:text-amber-400">
                        Rs. {formatRs(retailValPaisa)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Attar Oils Inventory Table */}
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto shadow-xs">
            <div className="p-3 bg-slate-100/70 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Droplet className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Pure Concentrated Attar Oils Inventory
                </h3>
              </div>
            </div>

            <table className="min-w-[850px] w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 font-mono uppercase text-[11px] text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3">Attar Name</th>
                  <th className="py-2.5 px-3 text-right">Selling Rate / Tola</th>
                  <th className="py-2.5 px-3 text-right">Cost Rate / Tola</th>
                  <th className="py-2.5 px-3 text-right">Rate / 1/2 Tola</th>
                  <th className="py-2.5 px-3 text-right">Rate / 1/4 Tola</th>
                  <th className="py-2.5 px-3 text-right">Density</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-sans">
                {attars.map((a) => {
                  const densityStr = a.density_grams_per_ml ? (a.density_grams_per_ml / 1000).toFixed(3) + " g/ml" : "1.000 g/ml";
                  return (
                    <tr key={a.attar_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2 px-3 font-mono font-bold text-amber-700 dark:text-amber-400">{a.sku}</td>
                      <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">{a.name}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                        Rs. {formatRs(a.selling_price_per_tola_paisa)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                        Rs. {formatRs(a.cost_per_tola_paisa)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        Rs. {formatRs(a.selling_price_half_tola_paisa)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        Rs. {formatRs(a.selling_price_quarter_tola_paisa)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-500">
                        {densityStr}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: EXPENSES & SALARIES LEDGER */}
      {activeTab === "EXPENSES" && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-3">
            <div className="w-full sm:w-96">
              <Input
                placeholder="Search expense category, authorized by, brought by..."
                value={expensesSearch}
                onChange={(e) => setExpensesSearch(e.target.value)}
                icon={<Search className="w-4 h-4 text-amber-500" />}
                className="h-9 text-xs"
              />
            </div>
            <span className="text-xs font-mono text-slate-500">
              Period: {period} | Total Expenses: Rs. {formatRs(totalExpensesPaisa)} | Salaries: Rs. {formatRs(totalSalariesPaisa)}
            </span>
          </div>

          {/* Petty Expenses Table */}
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto shadow-xs">
            <div className="p-3 bg-slate-100/70 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Banknote className="w-4 h-4 text-rose-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Shop Petty Expenses ({filteredExpenses.length})
                </h3>
              </div>
            </div>

            <table className="min-w-[850px] w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 font-mono uppercase text-[11px] text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="py-2.5 px-3">Voucher #</th>
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Authorized By</th>
                  <th className="py-2.5 px-3">Brought By</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-right">Amount (PKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-sans">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.expense_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-mono font-bold text-amber-700 dark:text-amber-400">{exp.expense_id}</td>
                    <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                      {new Date(exp.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">{exp.category}</td>
                    <td className="py-2 px-3">{exp.authorized_by_name || "Admin"}</td>
                    <td className="py-2 px-3">{exp.brought_by_name || "Staff"}</td>
                    <td className="py-2 px-3 text-slate-600 dark:text-slate-400 max-w-[200px] truncate">{exp.description}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                      Rs. {formatRs(exp.amount_paisa)}
                    </td>
                  </tr>
                ))}
                {filteredExpenses.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500">
                      No petty expenses recorded in {period}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Salaries Table */}
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto shadow-xs">
            <div className="p-3 bg-slate-100/70 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BadgeDollarSign className="w-4 h-4 text-emerald-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Staff Salaries Disbursed ({filteredSalaries.length})
                </h3>
              </div>
            </div>

            <table className="min-w-[850px] w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 font-mono uppercase text-[11px] text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="py-2.5 px-3">Payout #</th>
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Staff Name</th>
                  <th className="py-2.5 px-3">Payout Mode</th>
                  <th className="py-2.5 px-3">Authorized By</th>
                  <th className="py-2.5 px-3">Payment Mode</th>
                  <th className="py-2.5 px-3 text-right">Amount (PKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-sans">
                {filteredSalaries.map((sal) => (
                  <tr key={sal.payout_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-mono font-bold text-amber-700 dark:text-amber-400">{sal.payout_id}</td>
                    <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                      {new Date(sal.payout_date || sal.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">{sal.employee_name}</td>
                    <td className="py-2 px-3 font-mono text-[11px] uppercase">{sal.payout_type}</td>
                    <td className="py-2 px-3">{sal.disbursed_by_name}</td>
                    <td className="py-2 px-3 font-mono text-[11px] uppercase">{sal.payment_method}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                      Rs. {formatRs(sal.amount_paisa)}
                    </td>
                  </tr>
                ))}
                {filteredSalaries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500">
                      No staff salaries disbursed in {period}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: DATABASE BACKUP & MASTER SAFETY CENTER */}
      {activeTab === "BACKUP" && (
        <div className="flex flex-col gap-6 max-w-4xl">
          {/* High Priority Admin Safety Banner */}
          <div className="p-5 rounded-2xl border-2 border-amber-500/50 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent flex flex-col gap-3 shadow-md">
            <div className="flex items-center gap-3">
              <Database className="w-6 h-6 text-amber-500 shrink-0" />
              <h2 className="text-base font-bold text-amber-900 dark:text-amber-200">
                Important: Download Full Backup Before Resetting or Clearing Database!
              </h2>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              Before resetting system data or clearing test transactions, download a complete SQLite database backup (<code className="bg-amber-500/20 px-1 py-0.5 rounded font-mono">.db file</code>) and Excel CSV tables to your Desktop or a USB drive. This atomic hot backup safely captures all 46 tables, sales invoices, stock inventory, attar decanting logs, and audit records.
            </p>
          </div>

          {/* Quick Backup Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                  <Database className="w-5 h-5" />
                  <span>Download Complete Database (.db)</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                  Save the entire SQLite database (ameer_pos_backup.db) directly to your Desktop with one click. This file can be restored anytime to recover full store history.
                </p>
              </div>

              <Button
                variant="primary"
                onClick={handleExportDatabase}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Save Full Database (.db) to Desktop</span>
              </Button>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm">
                  <FileSpreadsheet className="w-5 h-5" />
                  <span>Export All 5 Tables to Excel (1 Consolidated File)</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                  Export all 5 primary tables (Invoices, Finished Perfumes, Attars, Shop Expenses, and Staff Salaries) consolidated into 1 single Excel spreadsheet (.csv) file in your Downloads folder.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="primary"
                  onClick={handleExportAllToSingleExcel}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Master Audit (Excel)</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={handlePrintAllTablesMasterReport}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold cursor-pointer border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Master Audit Report</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Database Physical Location & Folder Access */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-amber-500" />
              Windows Physical Database Location & Folder Access
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              The live Ameer Perfumes database file is stored in this physical directory:
            </p>
            <div className="bg-slate-100 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-xs text-amber-700 dark:text-amber-400 break-all select-all">
              %APPDATA%\AmeerPerfumes\ameer_pos.db
            </div>
            <div className="flex items-center gap-3 mt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenDbDir}
                className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Open Database Folder in Windows Explorer</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
