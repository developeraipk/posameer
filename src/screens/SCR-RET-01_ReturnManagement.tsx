import React, { useState, useEffect } from "react";
import {
  InvoiceForReturn,
  ReturnItemRequest,
  ReturnVoucherResult,
  QuarantineItem,
  ReturnHistoryEntry,
} from "@/types/database";
import { SystemUser, WorkstationStatus } from "@/types/system";
import {
  searchInvoiceForReturn,
  processRetailReturn,
  getQuarantineItems,
  getReturnHistory,
  getExecutiveDashboard,
} from "@/lib/tauri-bridge";
import { formatPaisaToRupees } from "@/lib/formatters";
import { formatLocalDateTime } from "@/lib/date-utils";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dialog } from "@/components/ui/Dialog";
import {
  RotateCcw,
  Search,
  AlertTriangle,
  Banknote,
  FileText,
  PackageCheck,
  History,
  Smartphone,
  Printer,
} from "lucide-react";

interface ReturnManagementProps {
  currentUser: SystemUser | null;
  status: WorkstationStatus;
}

export const ReturnManagement: React.FC<ReturnManagementProps> = ({ currentUser, status }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [invoice, setInvoice] = useState<InvoiceForReturn | null>(null);
  const [selectedItems, setSelectedItems] = useState<{
    [itemId: string]: {
      selected: boolean;
      returnQty: number;
      condition: "UNDAMAGED_NORMAL" | "DAMAGED_RUINED";
      notes: string;
      deductionRupees: number;
    };
  }>({});
  const [refundMethod, setRefundMethod] = useState<"CASH" | "EASYPAISA" | "JAZZCASH">("CASH");
  const [channelBalances, setChannelBalances] = useState<{
    cash: number;
    easypaisa: number;
    jazzcash: number;
  }>({ cash: 0, easypaisa: 0, jazzcash: 0 });
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voucherResult, setVoucherResult] = useState<ReturnVoucherResult | null>(null);
  const [quarantineItems, setQuarantineItems] = useState<QuarantineItem[]>([]);
  const [returnHistory, setReturnHistory] = useState<ReturnHistoryEntry[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"NEW_RETURN" | "RETURN_HISTORY" | "QUARANTINE">("NEW_RETURN");
  const [historyViewMode, setHistoryViewMode] = useState<"CONSOLIDATED" | "VOUCHERS">("CONSOLIDATED");

  const consolidatedReturns = React.useMemo(() => {
    const map: {
      [prodKey: string]: {
        productName: string;
        totalUnits: number;
        damagedUnits: number;
        restockedUnits: number;
        totalRefundPaisa: number;
        vouchers: string[];
        lastReturnDate: string;
        customerPhones: string[];
        cashiers: string[];
      };
    } = {};

    returnHistory.forEach((item) => {
      const cleanName = item.items_summary.replace(/\s*\(x\d+\)/gi, "").trim() || "Perfume Item";
      if (!map[cleanName]) {
        map[cleanName] = {
          productName: cleanName,
          totalUnits: 0,
          damagedUnits: 0,
          restockedUnits: 0,
          totalRefundPaisa: 0,
          vouchers: [],
          lastReturnDate: item.return_date,
          customerPhones: [],
          cashiers: [],
        };
      }
      const rec = map[cleanName];
      const qty = item.total_units_returned || 1;
      rec.totalUnits += qty;
      if (item.condition_status === "DAMAGED_RUINED") {
        rec.damagedUnits += qty;
      } else {
        rec.restockedUnits += qty;
      }
      rec.totalRefundPaisa += item.total_refund_amount_paisa;
      if (!rec.vouchers.includes(item.return_voucher_number)) {
        rec.vouchers.push(item.return_voucher_number);
      }
      if (item.customer_phone && !rec.customerPhones.includes(item.customer_phone)) {
        rec.customerPhones.push(item.customer_phone);
      }
      if (item.cashier_name && !rec.cashiers.includes(item.cashier_name)) {
        rec.cashiers.push(item.cashier_name);
      }
      if (new Date(item.return_date) > new Date(rec.lastReturnDate)) {
        rec.lastReturnDate = item.return_date;
      }
    });

    return Object.values(map);
  }, [returnHistory]);

  const loadQuarantine = async () => {
    try {
      const list = await getQuarantineItems();
      setQuarantineItems(list);
    } catch (err) {
      console.error("Failed to load quarantine:", err);
    }
  };

  const loadHistory = async () => {
    setIsHistoryLoading(true);
    try {
      const list = await getReturnHistory(100);
      setReturnHistory(list);
    } catch (err) {
      console.error("Failed to load return history:", err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const loadBalances = async () => {
    try {
      const dash = await getExecutiveDashboard("today");
      setChannelBalances({
        cash: dash.all_time_cash_drawer_paisa ?? dash.total_cash_received_paisa ?? dash.cash_in_drawer_paisa ?? 0,
        easypaisa: dash.all_time_easypaisa_paisa ?? dash.total_easypaisa_received_paisa ?? 0,
        jazzcash: dash.all_time_jazzcash_paisa ?? dash.total_jazzcash_received_paisa ?? 0,
      });
    } catch (err) {
      console.error("Failed to load channel balances:", err);
    }
  };

  useEffect(() => {
    loadQuarantine();
    loadHistory();
    loadBalances();
    const handleGlobalRefresh = () => {
      loadQuarantine();
      loadHistory();
      loadBalances();
    };
    window.addEventListener("app:refresh-data", handleGlobalRefresh);
    return () => window.removeEventListener("app:refresh-data", handleGlobalRefresh);
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await searchInvoiceForReturn(searchQuery.trim());
      setInvoice(res);
      if (res) {
        const initialSelections: typeof selectedItems = {};
        res.items.forEach((item) => {
          initialSelections[item.invoice_item_id] = {
            selected: item.quantity_available_to_return > 0,
            returnQty: item.quantity_available_to_return > 0 ? 1 : 0,
            condition: "UNDAMAGED_NORMAL",
            notes: "",
            deductionRupees: 0,
          };
        });
        setSelectedItems(initialSelections);
      }
    } catch (err) {
      console.error("Search failed:", err);
      alert(`Search failed: ${err}`);
    } finally {
      setIsSearching(false);
    }
  };

  // Calculate total refund amount taking damage deductions into account
  const calculateTotalRefund = () => {
    if (!invoice) return 0;
    let total = 0;
    invoice.items.forEach((item) => {
      const sel = selectedItems[item.invoice_item_id];
      if (sel && sel.selected && sel.returnQty > 0) {
        const grossPaisa = sel.returnQty * item.unit_price_paisa;
        const dedPaisa = sel.condition === "DAMAGED_RUINED" ? Math.round((sel.deductionRupees || 0) * 100) : 0;
        total += Math.max(0, grossPaisa - dedPaisa);
      }
    });
    return total;
  };

  const totalRefundPaisa = calculateTotalRefund();

  const handleProcessReturn = async () => {
    if (!invoice || isSubmitting) return;

    const itemsToReturn: ReturnItemRequest[] = [];
    invoice.items.forEach((item) => {
      const sel = selectedItems[item.invoice_item_id];
      if (sel && sel.selected && sel.returnQty > 0) {
        const grossLinePaisa = sel.returnQty * item.unit_price_paisa;
        const dedPaisa = sel.condition === "DAMAGED_RUINED" ? Math.round((sel.deductionRupees || 0) * 100) : 0;
        const netLinePaisa = Math.max(0, grossLinePaisa - dedPaisa);
        itemsToReturn.push({
          original_retail_item_id: item.invoice_item_id,
          product_id: item.product_id,
          quantity_returned: sel.returnQty,
          condition_status: sel.condition,
          condition_notes: sel.notes || (dedPaisa > 0 ? `Damage deduction: Rs ${sel.deductionRupees}` : undefined),
          deduction_amount_paisa: dedPaisa > 0 ? dedPaisa : undefined,
          custom_refund_paisa: netLinePaisa,
        });
      }
    });

    if (itemsToReturn.length === 0) {
      alert("Please select at least one item and quantity to return.");
      return;
    }

    const availableBalancePaisa =
      refundMethod === "CASH"
        ? channelBalances.cash
        : refundMethod === "EASYPAISA"
        ? channelBalances.easypaisa
        : channelBalances.jazzcash;

    if (availableBalancePaisa <= 0) {
      alert(`⚠️ Selected refund method (${refundMethod}) has Rs. 0 balance. Please choose another payment method.`);
      return;
    }

    if (availableBalancePaisa < totalRefundPaisa) {
      alert(
        `⚠️ Selected refund method (${refundMethod}) has insufficient balance (Available: Rs. ${(
          availableBalancePaisa / 100
        ).toLocaleString()}, Required: Rs. ${(
          totalRefundPaisa / 100
        ).toLocaleString()}). Please choose another payment method.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        original_sales_invoice_id: invoice.invoice_id,
        refund_settlement_method: refundMethod,
        cashier_user_id: currentUser?.user_id || "usr_cashier1",
        terminal_id: status.stationId,
        items: itemsToReturn,
      };

      const result = await processRetailReturn(payload);
      setVoucherResult(result);
      setInvoice(null);
      setSearchQuery("");
      await loadQuarantine();
      await loadHistory();
      await loadBalances();
      window.dispatchEvent(new CustomEvent("app:refresh-data"));
    } catch (err) {
      console.error("Return processing failed:", err);
      alert(`Failed to process return: ${err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const printReturnVoucher = (voucher: ReturnVoucherResult) => {
    const printArea = document.getElementById("thermal-print-area");
    if (printArea) {
      printArea.innerHTML = `
        <div style="font-family:'Segoe UI', Roboto, -apple-system, Arial, sans-serif; width:72mm; margin:0 auto; padding:6px 2px; font-size:11px; color:#000000; background:#ffffff; line-height:1.35; -webkit-print-color-adjust:exact; print-color-adjust:exact;">
          <div style="text-align:center; padding-bottom:4px;">
            <img src="/logo-receipt.png" style="width:48mm; height:auto; margin:0 auto 4px auto; display:block; image-rendering:pixelated;" alt="Ameer Perfumes" />
            <div style="font-size:9px; font-weight:800; letter-spacing:0.8px; text-transform:uppercase; margin-top:2px; color:#000000;">Haute Parfumerie & Pure Concentrated Oils</div>
            <div style="font-size:9.5px; font-weight:700; color:#000000; margin-top:2px;">Main Branch Sports Complex Bannu</div>
            <div style="font-size:9.5px; font-weight:700; color:#000000;">WhatsApp: 03100988522</div>
            <div style="border-top:1.5px dashed #000000; margin:6px 0;"></div>
            <div style="font-size:12px; font-weight:900; letter-spacing:1px; text-transform:uppercase; text-align:center; color:#000000;">RETURN & REFUND VOUCHER</div>
          </div>
          <div style="border-top:1.5px dashed #000000; margin:5px 0;"></div>
          <div style="display:flex; justify-content:space-between; margin:2.5px 0;"><span>Voucher #:</span><span style="font-weight:900; font-family:monospace;">${voucher.return_voucher_number}</span></div>
          <div style="display:flex; justify-content:space-between; margin:2.5px 0;"><span>Date & Time:</span><span style="font-weight:700;">${new Date(voucher.return_date).toLocaleString()}</span></div>
          <div style="display:flex; justify-content:space-between; margin:2.5px 0;"><span>Customer:</span><span style="font-weight:700;">${voucher.customer_phone}</span></div>
          <div style="display:flex; justify-content:space-between; margin:2.5px 0;"><span>Refund Method:</span><span style="font-weight:800;">${voucher.refund_settlement_method}</span></div>
          <div style="display:flex; justify-content:space-between; margin:2.5px 0;"><span>Condition:</span><span style="font-weight:700;">${voucher.condition_status}</span></div>
          <div style="border-top:1.5px dashed #000000; margin:6px 0;"></div>
          <div style="display:flex; justify-content:space-between; align-items:baseline; font-size:13px; font-weight:900; margin:4px 0;">
            <span>TOTAL REFUND:</span>
            <span style="font-family:monospace;">Rs. ${(voucher.total_refund_amount_paisa / 100).toLocaleString()}</span>
          </div>
          ${voucher.store_credit_issued_paisa > 0 ? `
            <div style="display:flex; justify-content:space-between; font-size:11px; margin:2px 0;">
              <span>Store Credit Credited:</span>
              <span style="font-weight:800;">Rs. ${(voucher.store_credit_issued_paisa / 100).toLocaleString()}</span>
            </div>
          ` : ''}
          <div style="border-top:1.5px dashed #000000; margin:6px 0 4px 0;"></div>
          <div style="text-align:center; font-size:9px; font-weight:700; color:#000000; line-height:1.35;">
            <div style="font-weight:900; letter-spacing:0.5px;">Software Developed by Global Tech</div>
            <div>Contact: 0329 9969277</div>
          </div>
        </div>
      `;
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

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold font-serif text-slate-900 dark:text-slate-100">
              Retail Returns, Refunds & Audit
            </h2>
            <Badge variant="gold">Anti-Fraud Protection Active</Badge>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Original invoice verification, damaged item deductions, restock triggers, and complete audit history.
          </p>
        </div>

        {/* View Switcher: Process Return, Return History, and Quarantine */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("NEW_RETURN")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === "NEW_RETURN"
                ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            Process Return
          </button>
          <button
            onClick={() => {
              setActiveTab("RETURN_HISTORY");
              loadHistory();
            }}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === "RETURN_HISTORY"
                ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Return History ({returnHistory.length})</span>
          </button>
          <button
            onClick={() => {
              setActiveTab("QUARANTINE");
              loadQuarantine();
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === "QUARANTINE"
                ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            Quarantine Inspection ({quarantineItems.length})
          </button>
        </div>
      </div>

      {activeTab === "NEW_RETURN" && (
        <div className="space-y-6">
          {/* Search Box */}
          <Card variant="elevated" className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200 flex items-center gap-2">
              <Search className="w-4 h-4 text-amber-500" />
              <span>Step 1: Locate Original Purchase Invoice</span>
            </h3>

            <div className="flex items-center gap-3">
              <div className="flex-1 max-w-md">
                <Input
                  placeholder="Enter Invoice # (e.g. INV-20261110-0001) or Customer Phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  icon={<FileText className="w-4 h-4 text-slate-400" />}
                />
              </div>
              <Button
                variant="primary"
                disabled={isSearching || !searchQuery.trim()}
                onClick={handleSearch}
                className="gap-2 text-xs font-semibold"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{isSearching ? "Searching..." : "Lookup Invoice"}</span>
              </Button>
            </div>
          </Card>

          {/* Invoice Found & Item Selection */}
          {invoice && (
            <Card variant="elevated" className="space-y-5 animate-in fade-in duration-200">
              {/* Invoice Metadata Header */}
              <div className="flex flex-wrap items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-4">
                <div>
                  <span className="text-[11px] text-slate-500 font-mono block">Original Invoice</span>
                  <span className="text-lg font-bold font-mono text-amber-700 dark:text-amber-400">
                    {invoice.invoice_number}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Purchase Date</span>
                  <span className="text-xs text-slate-800 dark:text-slate-200 font-mono font-semibold">
                    {new Date(invoice.invoice_date).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Customer Phone</span>
                  <span className="text-xs text-slate-800 dark:text-slate-200 font-mono font-semibold">
                    {invoice.customer_phone}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Original Net Paid</span>
                  <span className="text-base font-bold font-mono text-slate-900 dark:text-slate-100">
                    {formatPaisaToRupees(invoice.net_payable_paisa)}
                  </span>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono">
                    Select Line Items & Condition Status
                  </h4>
                  <span className="text-[11px] text-slate-500 italic">
                    Note: Damaged items allow custom deduction before calculating refund.
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                    <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800 font-mono">
                      <tr>
                        <th className="py-3 px-3 text-center">Return?</th>
                        <th className="py-3 px-3">Fragrance Item</th>
                        <th className="py-3 px-3 text-center">Purchased</th>
                        <th className="py-3 px-3 text-center">Returned</th>
                        <th className="py-3 px-3 text-center">Available</th>
                        <th className="py-3 px-3 text-center">Return Qty</th>
                        <th className="py-3 px-3">Condition</th>
                        <th className="py-3 px-3 text-right">Unit Price</th>
                        <th className="py-3 px-3 text-right">Damage Deduction</th>
                        <th className="py-3 px-3 text-right">Net Refund</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 bg-white dark:bg-slate-900/40">
                      {invoice.items.map((item) => {
                        const sel = selectedItems[item.invoice_item_id] || {
                          selected: false,
                          returnQty: 0,
                          condition: "UNDAMAGED_NORMAL",
                          notes: "",
                          deductionRupees: 0,
                        };

                        const canReturn = item.quantity_available_to_return > 0;
                        const grossLinePaisa = (sel.selected ? sel.returnQty : 0) * item.unit_price_paisa;
                        const dedPaisa = sel.condition === "DAMAGED_RUINED" ? Math.round((sel.deductionRupees || 0) * 100) : 0;
                        const netLinePaisa = Math.max(0, grossLinePaisa - dedPaisa);

                        return (
                          <tr key={item.invoice_item_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                            <td className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                disabled={!canReturn}
                                checked={sel.selected}
                                onChange={(e) =>
                                  setSelectedItems((prev) => ({
                                    ...prev,
                                    [item.invoice_item_id]: {
                                      ...sel,
                                      selected: e.target.checked,
                                      returnQty: e.target.checked && sel.returnQty === 0 ? 1 : sel.returnQty,
                                    },
                                  }))
                                }
                                className="rounded text-amber-500 focus:ring-amber-500 h-4 w-4 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 cursor-pointer"
                              />
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-900 dark:text-slate-100">{item.product_name}</div>
                              <span className="text-[10px] text-slate-500 font-mono">
                                ID: {item.invoice_item_id}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center font-mono">{item.quantity_purchased}</td>
                            <td className="py-3 px-3 text-center font-mono text-slate-500 dark:text-slate-400">
                              {item.quantity_already_returned}
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-bold text-emerald-700 dark:text-emerald-400">
                              {item.quantity_available_to_return}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <input
                                type="number"
                                min={1}
                                max={item.quantity_available_to_return}
                                disabled={!sel.selected || !canReturn}
                                value={sel.returnQty || ""}
                                onChange={(e) => {
                                  const val = Math.min(
                                    item.quantity_available_to_return,
                                    Math.max(1, parseInt(e.target.value) || 1)
                                  );
                                  setSelectedItems((prev) => ({
                                    ...prev,
                                    [item.invoice_item_id]: { ...sel, returnQty: val },
                                  }));
                                }}
                                className="w-14 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-center text-xs py-1 rounded font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                              />
                            </td>
                            <td className="py-3 px-3">
                              <select
                                disabled={!sel.selected}
                                value={sel.condition}
                                onChange={(e) =>
                                  setSelectedItems((prev) => ({
                                    ...prev,
                                    [item.invoice_item_id]: {
                                      ...sel,
                                      condition: e.target.value as "UNDAMAGED_NORMAL" | "DAMAGED_RUINED",
                                    },
                                  }))
                                }
                                className={`text-xs rounded px-2 py-1 font-medium ${
                                  sel.condition === "DAMAGED_RUINED"
                                    ? "bg-rose-50 text-rose-700 border border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-700"
                                    : "bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200"
                                }`}
                              >
                                <option value="UNDAMAGED_NORMAL">Undamaged (Restock)</option>
                                <option value="DAMAGED_RUINED">Damaged (Quarantine)</option>
                              </select>
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                              <span className="font-bold text-slate-900 dark:text-slate-100">
                                {formatPaisaToRupees(item.unit_price_paisa)}
                              </span>
                              {item.original_unit_price_paisa && item.original_unit_price_paisa > item.unit_price_paisa ? (
                                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-sans block line-through opacity-75">
                                  {formatPaisaToRupees(item.original_unit_price_paisa)}
                                </span>
                              ) : null}
                            </td>
                            <td className="py-3 px-3 text-right">
                              {sel.condition === "DAMAGED_RUINED" && sel.selected ? (
                                <div className="flex items-center justify-end gap-1">
                                  <span className="text-[11px] text-rose-600 font-mono font-bold">-Rs</span>
                                  <input
                                    type="number"
                                    min={0}
                                    max={(sel.returnQty * item.unit_price_paisa) / 100}
                                    value={sel.deductionRupees || ""}
                                    onChange={(e) => {
                                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                                      setSelectedItems((prev) => ({
                                        ...prev,
                                        [item.invoice_item_id]: {
                                          ...sel,
                                          deductionRupees: val,
                                        },
                                      }));
                                    }}
                                    placeholder="Deduction"
                                    className="w-20 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-700 text-right text-xs py-1 px-2 rounded font-mono font-bold text-rose-700 dark:text-rose-300 focus:outline-none focus:ring-1 focus:ring-rose-500"
                                    title="Enter amount to deduct for damage"
                                  />
                                </div>
                              ) : (
                                <span className="text-slate-400 font-mono text-xs">Rs 0.00</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-amber-700 dark:text-amber-400">
                              {formatPaisaToRupees(netLinePaisa)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Step 2: Refund Settlement Options */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono block">
                    Refund Settlement Method
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setRefundMethod("CASH")}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                        refundMethod === "CASH"
                          ? "bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-300 font-bold shadow-xs"
                          : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-[11px] font-semibold">Cash Refund</span>
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        Rs. {(channelBalances.cash / 100).toLocaleString()}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRefundMethod("EASYPAISA")}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                        refundMethod === "EASYPAISA"
                          ? "bg-emerald-500/15 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-bold shadow-xs"
                          : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-[11px] font-semibold">EasyPaisa</span>
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        Rs. {(channelBalances.easypaisa / 100).toLocaleString()}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRefundMethod("JAZZCASH")}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                        refundMethod === "JAZZCASH"
                          ? "bg-rose-500/15 border-rose-500 text-rose-800 dark:text-rose-300 font-bold shadow-xs"
                          : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <Smartphone className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                      <span className="text-[11px] font-semibold">JazzCash</span>
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        Rs. {(channelBalances.jazzcash / 100).toLocaleString()}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="space-y-3 text-right">
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1">
                    <span className="text-xs text-slate-600 dark:text-slate-400 block font-medium">
                      Net Refund Amount Calculated:
                    </span>
                    <span className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-400">
                      {formatPaisaToRupees(totalRefundPaisa)}
                    </span>
                  </div>

                  <Button
                    variant="primary"
                    size="lg"
                    disabled={isSubmitting || totalRefundPaisa === 0}
                    onClick={handleProcessReturn}
                    className="w-full gap-2 font-bold"
                  >
                    <PackageCheck className="w-4 h-4" />
                    <span>
                      {isSubmitting ? "Processing Return..." : "Confirm & Issue Return Voucher"}
                    </span>
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Return History & Audit Log Tab */}
      {activeTab === "RETURN_HISTORY" && (
        <Card variant="elevated" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 gap-3">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100">
                  Return Products History & Audit Log
                </h3>
                <p className="text-xs text-slate-500">
                  All processed return vouchers, damaged goods deductions, and restocked merchandise.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setHistoryViewMode("CONSOLIDATED")}
                  className={`px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
                    historyViewMode === "CONSOLIDATED"
                      ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  Consolidated by Product
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryViewMode("VOUCHERS")}
                  className={`px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
                    historyViewMode === "VOUCHERS"
                      ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  Individual Vouchers
                </button>
              </div>

              <div className="w-56">
                <Input
                  placeholder="Filter by product, voucher #, phone..."
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={loadHistory}
                disabled={isHistoryLoading}
                className="gap-1.5 text-xs shrink-0"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isHistoryLoading ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </Button>
            </div>
          </div>

          {historyViewMode === "CONSOLIDATED" ? (
            /* Consolidated Products View */
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800 font-mono">
                  <tr>
                    <th className="py-3 px-3">Fragrance Product</th>
                    <th className="py-3 px-3 text-center">Total Units Returned</th>
                    <th className="py-3 px-3 text-center">Condition Status</th>
                    <th className="py-3 px-3 text-right">Total Refund Paid</th>
                    <th className="py-3 px-3">Associated Vouchers</th>
                    <th className="py-3 px-3">Last Return Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 bg-white dark:bg-slate-900/40">
                  {isHistoryLoading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500 text-xs">
                        Loading consolidated returns...
                      </td>
                    </tr>
                  ) : consolidatedReturns.filter((c) => {
                      if (!historySearchQuery.trim()) return true;
                      const q = historySearchQuery.toLowerCase();
                      return (
                        c.productName.toLowerCase().includes(q) ||
                        c.vouchers.some((v) => v.toLowerCase().includes(q)) ||
                        c.customerPhones.some((p) => p.includes(q))
                      );
                    }).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500 text-xs">
                        No return records found.
                      </td>
                    </tr>
                  ) : (
                    consolidatedReturns
                      .filter((c) => {
                        if (!historySearchQuery.trim()) return true;
                        const q = historySearchQuery.toLowerCase();
                        return (
                          c.productName.toLowerCase().includes(q) ||
                          c.vouchers.some((v) => v.toLowerCase().includes(q)) ||
                          c.customerPhones.some((p) => p.includes(q))
                        );
                      })
                      .map((c, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100 font-sans">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {c.productName.includes("[TESTER]") || c.productName.toLowerCase().includes("tester") ? (
                                <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                  TESTER
                                </span>
                              ) : c.productName.includes("[ATTAR OIL]") || c.productName.toLowerCase().includes("tola") ? (
                                <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/30">
                                  ATTAR OIL
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                                  PERFUME
                                </span>
                              )}
                              <span>
                                {c.productName
                                  .replace("[TESTER]", "")
                                  .replace("[ATTAR OIL]", "")
                                  .replace("[PERFUME]", "")
                                  .trim()}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                            {c.totalUnits} unit{c.totalUnits === 1 ? "" : "s"}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {c.damagedUnits > 0 && (
                                <Badge variant="danger" className="text-[10px] font-bold">
                                  {c.damagedUnits} Damaged
                                </Badge>
                              )}
                              {c.restockedUnits > 0 && (
                                <Badge variant="success" className="text-[10px] font-bold">
                                  {c.restockedUnits} Restocked
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                            {formatPaisaToRupees(c.totalRefundPaisa)}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-wrap gap-1">
                              {c.vouchers.map((v) => (
                                <span
                                  key={v}
                                  className="font-mono text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60 px-1.5 py-0.5 rounded"
                                >
                                  {v}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                            {formatLocalDateTime(c.lastReturnDate)}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* Individual Vouchers View */
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800 font-mono">
                  <tr>
                    <th className="py-3 px-3">Voucher #</th>
                    <th className="py-3 px-3">Date & Time</th>
                    <th className="py-3 px-3">Original Invoice</th>
                    <th className="py-3 px-3">Customer Phone</th>
                    <th className="py-3 px-3">Returned Items</th>
                    <th className="py-3 px-3 text-center">Condition</th>
                    <th className="py-3 px-3 text-center">Refund Method</th>
                    <th className="py-3 px-3 text-right">Net Refund</th>
                    <th className="py-3 px-3">Cashier</th>
                    <th className="py-3 px-3 text-center">Print Slip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 bg-white dark:bg-slate-900/40">
                  {isHistoryLoading ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-500 text-xs">
                        Loading return history from SQLite...
                      </td>
                    </tr>
                  ) : returnHistory.filter((item) => {
                      if (!historySearchQuery.trim()) return true;
                      const q = historySearchQuery.toLowerCase();
                      return (
                        item.return_voucher_number.toLowerCase().includes(q) ||
                        item.original_invoice_number.toLowerCase().includes(q) ||
                        item.customer_phone.toLowerCase().includes(q) ||
                        item.cashier_name.toLowerCase().includes(q) ||
                        item.items_summary.toLowerCase().includes(q)
                      );
                    }).length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-500 text-xs">
                        No return vouchers recorded yet.
                      </td>
                    </tr>
                  ) : (
                    returnHistory
                      .filter((item) => {
                        if (!historySearchQuery.trim()) return true;
                        const q = historySearchQuery.toLowerCase();
                        return (
                          item.return_voucher_number.toLowerCase().includes(q) ||
                          item.original_invoice_number.toLowerCase().includes(q) ||
                          item.customer_phone.toLowerCase().includes(q) ||
                          item.cashier_name.toLowerCase().includes(q) ||
                          item.items_summary.toLowerCase().includes(q)
                        );
                      })
                      .map((item) => (
                        <tr key={item.return_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="py-3 px-3 font-mono font-bold text-amber-700 dark:text-amber-400">
                            {item.return_voucher_number}
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                            {formatLocalDateTime(item.return_date)}
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-800 dark:text-slate-200">
                            {item.original_invoice_number}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-700 dark:text-slate-300">
                            {item.customer_phone}
                          </td>
                          <td className="py-3 px-3 max-w-[340px]">
                            <div className="flex flex-col gap-1 py-0.5">
                              {item.items_summary.split(/,\s*(?=\[)/).map((piece, pIdx) => {
                                const isTester = piece.includes("[TESTER]");
                                const isAttar = piece.includes("[ATTAR OIL]");
                                const isPerfume = piece.includes("[PERFUME]");
                                const displayName = piece
                                  .replace("[TESTER]", "")
                                  .replace("[ATTAR OIL]", "")
                                  .replace("[PERFUME]", "")
                                  .trim();

                                return (
                                  <div key={pIdx} className="flex items-center gap-1.5 text-xs flex-wrap">
                                    {isTester ? (
                                      <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                        TESTER
                                      </span>
                                    ) : isAttar ? (
                                      <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/30">
                                        ATTAR OIL
                                      </span>
                                    ) : isPerfume ? (
                                      <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                                        PERFUME
                                      </span>
                                    ) : null}
                                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                                      {displayName || piece}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <Badge
                              variant={item.condition_status === "DAMAGED_RUINED" ? "danger" : "success"}
                              className="text-[10px] uppercase font-bold"
                            >
                              {item.condition_status === "DAMAGED_RUINED" ? "Damaged" : "Restocked"}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300 font-semibold">
                              {item.refund_settlement_method}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                            {formatPaisaToRupees(item.total_refund_amount_paisa)}
                          </td>
                          <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                            {item.cashier_name}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                const mockVoucher: ReturnVoucherResult = {
                                  success: true,
                                  return_id: item.return_id,
                                  return_voucher_number: item.return_voucher_number,
                                  return_date: item.return_date,
                                  customer_phone: item.customer_phone,
                                  refund_settlement_method: item.refund_settlement_method,
                                  condition_status: item.condition_status,
                                  total_refund_amount_paisa: item.total_refund_amount_paisa,
                                  store_credit_issued_paisa: item.refund_settlement_method === "STORE_CREDIT" ? item.total_refund_amount_paisa : 0,
                                  items_returned_count: item.total_units_returned || item.items_count || 1,
                                  message: `Return voucher for invoice ${item.original_invoice_number}`,
                                };
                                printReturnVoucher(mockVoucher);
                              }}
                              className="px-2 py-1 text-[11px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 rounded inline-flex items-center gap-1 cursor-pointer transition-colors"
                              title="Reprint 80mm return voucher slip"
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
          )}
        </Card>
      )}

      {/* Quarantine Inspection Tab */}
      {activeTab === "QUARANTINE" && (
        <Card variant="elevated" className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              <h3 className="font-bold text-slate-900 dark:text-slate-100">
                Damaged Inventory Quarantine Items (Pending Inspection)
              </h3>
            </div>
            <Badge variant="warning">{quarantineItems.length} Quarantined</Badge>
          </div>

          {quarantineItems.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              Quarantine is clean. No damaged perfumes pending manager disposition.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800 font-mono">
                  <tr>
                    <th className="py-3 px-3">Quarantine ID</th>
                    <th className="py-3 px-3">Item Name & Type</th>
                    <th className="py-3 px-3 text-center">Qty</th>
                    <th className="py-3 px-3 text-right">Sold Rate (PKR)</th>
                    <th className="py-3 px-3 text-right">Discount Given</th>
                    <th className="py-3 px-3 text-right">Net Charged Rate</th>
                    <th className="py-3 px-3 text-right">Damage Deduction</th>
                    <th className="py-3 px-3 text-right">Refund Paid</th>
                    <th className="py-3 px-3">Quarantined At</th>
                    <th className="py-3 px-3 text-center">Disposition Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 bg-white dark:bg-slate-900/40">
                  {quarantineItems.map((q) => {
                    const soldRate = q.sold_rate_paisa ?? q.sold_price_paisa ?? q.unit_cost_paisa ?? 0;
                    const discount = q.discount_paisa ?? 0;
                    const netRate = q.net_rate_paisa ?? (soldRate - discount);
                    const refundPaid = q.refund_amount_paisa ?? 0;
                    const damageDed = q.damage_deduction_paisa ?? Math.max(0, netRate - refundPaid);

                    return (
                      <tr key={q.quarantine_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="py-3 px-3 font-mono text-amber-700 dark:text-amber-400 font-semibold text-[11px]">{q.quarantine_id}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {q.item_type === "TESTER" || q.product_name.toLowerCase().includes("tester") ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30">
                                TESTER
                              </span>
                            ) : q.item_type === "ATTAR" || q.product_name.toLowerCase().includes("tola") ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/30">
                                ATTAR OIL
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                                PERFUME
                              </span>
                            )}
                            <span className="font-bold text-slate-900 dark:text-slate-100">{q.product_name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold">{q.quantity}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          {formatPaisaToRupees(soldRate)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono">
                          {discount > 0 ? (
                            <span className="text-rose-600 dark:text-rose-400 font-bold">
                              -{formatPaisaToRupees(discount)}
                            </span>
                          ) : (
                            <span className="text-slate-400">Rs 0</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                          {formatPaisaToRupees(netRate)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono">
                          {damageDed > 0 ? (
                            <span className="text-rose-600 dark:text-rose-400 font-bold">
                              -{formatPaisaToRupees(damageDed)}
                            </span>
                          ) : (
                            <span className="text-slate-400">{q.damage_reason || "Rs 0"}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {formatPaisaToRupees(refundPaid)}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                          {new Date(q.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <Badge variant="warning" className="text-[10px]">
                            {q.admin_disposition || "PENDING_INSPECTION"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Return Voucher Generated Slip Dialog */}
      <Dialog
        open={voucherResult !== null}
        onClose={() => setVoucherResult(null)}
        title="Return Voucher Slip"
        description="Official return confirmation and refund authorization slip."
        maxWidth="sm"
      >
        {voucherResult && (
          <div className="space-y-4">
            <div className="p-5 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg font-mono text-xs space-y-3 select-text">
              <div className="text-center space-y-1 border-b border-dashed border-slate-300 dark:border-slate-700 pb-3">
                <img
                  src="/logo-rect.png"
                  alt="Ameer Perfumes"
                  className="h-9 w-auto mx-auto object-contain"
                />
                <p className="text-[10px] text-slate-600 dark:text-slate-400 font-bold tracking-wider uppercase">OFFICIAL RETURN VOUCHER</p>
                <p className="text-xs font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
                  {voucherResult.return_voucher_number}
                </p>
              </div>

              <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 dark:border-slate-700 pb-2 text-slate-700 dark:text-slate-300">
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{new Date(voucherResult.return_date).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{voucherResult.customer_phone}</span>
                </div>
                <div className="flex justify-between">
                  <span>Refund Method:</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">{voucherResult.refund_settlement_method}</span>
                </div>
                <div className="flex justify-between">
                  <span>Condition:</span>
                  <span>{voucherResult.condition_status}</span>
                </div>
              </div>

              <div className="pt-2 border-b border-dashed border-slate-300 dark:border-slate-700 pb-2">
                <div className="flex justify-between font-bold text-sm text-slate-900 dark:text-slate-100">
                  <span>REFUND AMOUNT:</span>
                  <span className="text-rose-600 dark:text-rose-400">{formatPaisaToRupees(voucherResult.total_refund_amount_paisa)}</span>
                </div>
                {voucherResult.store_credit_issued_paisa > 0 && (
                  <div className="flex justify-between text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 font-semibold">
                    <span>Store Credit Credited:</span>
                    <span>{formatPaisaToRupees(voucherResult.store_credit_issued_paisa)}</span>
                  </div>
                )}
              </div>

              <div className="text-center text-[10px] text-slate-500 dark:text-slate-400 pt-1 italic">
                [Customer Slip — Privacy Protected]
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="lg"
                onClick={() => printReturnVoucher(voucherResult)}
                className="flex-1 font-bold text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Print Slip</span>
              </Button>
              <Button
                variant="primary"
                size="lg"
                onClick={() => setVoucherResult(null)}
                className="flex-1 font-bold text-xs cursor-pointer"
              >
                <span>Done</span>
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};
