/**
 * Ameer Perfumes ERP — Professional Excel & CSV Export Utilities
 * Provides UTF-8 BOM formatted CSV generation that natively opens in Microsoft Excel
 * Includes luxury animated toast notifications upon file generation and download.
 */

import {
  RecentSaleSummary,
  FinishedProduct,
  PettyExpense,
  EmployeeSalaryPayout,
  AttarProduct,
  WholesaleInvoiceSummary,
  OnlineOrder,
} from "@/types/database";
import {
  calcOnlineOrderRealizedPaisa,
  calcOnlineOrderPendingCodPaisa,
} from "./online-order-metrics";

export function showExcelExportNotification(
  fileName: string,
  entityLabel: string = "Excel Spreadsheet",
  rowCount?: number,
  sizeBytes?: number
) {
  if (typeof document === "undefined") return;

  let container = document.getElementById("ameer-export-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "ameer-export-toast-container";
    container.style.position = "fixed";
    container.style.top = "20px";
    container.style.right = "20px";
    container.style.zIndex = "99999999";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "10px";
    container.style.maxWidth = "420px";
    container.style.width = "calc(100vw - 40px)";
    container.style.pointerEvents = "none";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.style.pointerEvents = "auto";
  toast.style.background = "#0f172a";
  toast.style.color = "#f8fafc";
  toast.style.border = "2px solid #10b981";
  toast.style.borderRadius = "16px";
  toast.style.padding = "14px 16px";
  toast.style.boxShadow = "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4)";
  toast.style.display = "flex";
  toast.style.flexDirection = "column";
  toast.style.gap = "8px";
  toast.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  toast.style.transition = "all 0.35s cubic-bezier(0.16, 1, 0.3, 1)";
  toast.style.transform = "translateY(-15px) scale(0.97)";
  toast.style.opacity = "0";

  const sizeFormatted = sizeBytes ? `${(sizeBytes / 1024).toFixed(1)} KB` : "";
  const countFormatted = rowCount !== undefined ? `${rowCount} Records` : "";
  const metaBadge = [countFormatted, sizeFormatted].filter(Boolean).join(" • ");

  toast.innerHTML = `
    <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 10px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="width: 38px; height: 38px; border-radius: 10px; background: rgba(16, 185, 129, 0.18); border: 1px solid rgba(16, 185, 129, 0.4); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <svg style="width: 22px; height: 22px; color: #10b981;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <div style="font-weight: 700; font-size: 13px; color: #10b981; display: flex; align-items: center; gap: 6px;">
            <span>✓ Excel File Downloaded Successfully!</span>
          </div>
          <div style="font-size: 11px; color: #cbd5e1; margin-top: 2px;">
            <strong>${entityLabel}</strong> saved to your <strong>Downloads</strong> folder.
          </div>
        </div>
      </div>
      <button style="color: #94a3b8; background: transparent; border: none; font-size: 18px; cursor: pointer; padding: 2px 6px; line-height: 1; border-radius: 6px;" title="Dismiss">✕</button>
    </div>
    <div style="margin-top: 2px; padding: 6px 10px; background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(71, 85, 105, 0.4); border-radius: 8px; display: flex; align-items: center; justify-content: space-between; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px;">
      <span style="color: #38bdf8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 250px;" title="${fileName}">📊 ${fileName}</span>
      ${metaBadge ? `<span style="color: #10b981; font-weight: 700; font-size: 10px; padding: 2px 6px; background: rgba(16, 185, 129, 0.2); border-radius: 4px; margin-left: 8px; flex-shrink: 0;">${metaBadge}</span>` : ""}
    </div>
    <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: #94a3b8; margin-top: 2px;">
      <span>Ready to view in Microsoft Excel or Google Sheets.</span>
      <span style="color: #64748b;">Ameer Perfumes ERP</span>
    </div>
    <div style="height: 3px; background: rgba(51, 65, 85, 0.4); border-radius: 9999px; overflow: hidden; margin-top: 2px;">
      <div class="toast-progress-bar" style="height: 100%; width: 100%; background: #10b981; transition: width 4.5s linear;"></div>
    </div>
  `;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.transform = "translateY(0) scale(1)";
    toast.style.opacity = "1";
    const bar = toast.querySelector(".toast-progress-bar") as HTMLElement;
    if (bar) {
      setTimeout(() => {
        bar.style.width = "0%";
      }, 50);
    }
  });

  const dismiss = () => {
    toast.style.transform = "translateY(-15px) scale(0.97)";
    toast.style.opacity = "0";
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 350);
  };

  const closeBtn = toast.querySelector("button");
  if (closeBtn) {
    closeBtn.onclick = dismiss;
    closeBtn.onmouseenter = () => { closeBtn.style.color = "#ffffff"; };
    closeBtn.onmouseleave = () => { closeBtn.style.color = "#94a3b8"; };
  }

  setTimeout(dismiss, 4500);
}

function downloadCsvBlob(
  csvContent: string,
  fileName: string,
  entityLabel: string = "Excel Spreadsheet",
  rowCount?: number
) {
  // UTF-8 BOM ensures Excel automatically renders special characters properly
  const bom = "\uFEFF";
  const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  // Trigger professional luxury toast notification
  showExcelExportNotification(fileName, entityLabel, rowCount, blob.size);
}

function escapeCsvField(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export function exportSalesHistoryToCSV(sales: RecentSaleSummary[], filenamePrefix: string = "Ameer_Perfumes_Sales_History") {
  const headers = [
    "Invoice #",
    "Date & Time",
    "Customer Phone",
    "Products Sold",
    "Channel",
    "Cashier",
    "Salesperson",
    "Total Units",
    "Payment Method",
    "Discount (PKR)",
    "Net Payable (PKR)",
    "Return Status",
    "Returned Units"
  ];

  const rows = sales.map((s) => [
    escapeCsvField(s.invoice_number),
    escapeCsvField(new Date(s.invoice_date).toLocaleString()),
    escapeCsvField(s.customer_phone || "Walk-in"),
    escapeCsvField(s.product_names || "Fragrance"),
    escapeCsvField(s.order_source || "SHOP"),
    escapeCsvField(s.cashier_name || "Cashier"),
    escapeCsvField(s.salesperson_name || "Direct"),
    escapeCsvField(s.total_units),
    escapeCsvField(s.payment_method || "CASH"),
    escapeCsvField(((s.discount_paisa || 0) / 100).toFixed(2)),
    escapeCsvField((s.net_payable_paisa / 100).toFixed(2)),
    escapeCsvField(s.return_status || "NONE"),
    escapeCsvField(s.returned_units || 0)
  ]);

  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadCsvBlob(csv, `${filenamePrefix}_${dateStr}.csv`, "Sales & Invoices History", sales.length);
}

export function exportProductsInventoryToCSV(products: FinishedProduct[], filenamePrefix: string = "Ameer_Perfumes_Inventory_Valuation") {
  const headers = [
    "SKU",
    "Product Name",
    "Category",
    "Bottle Size (ml)",
    "Stock (Units)",
    "Cost Price (PKR)",
    "Retail Price (PKR)",
    "Total Cost Valuation (PKR)",
    "Total Retail Potential (PKR)",
    "Barcode"
  ];

  const rows = products.map((p) => {
    const cost = p.latest_batch_cost_paisa ? p.latest_batch_cost_paisa / 100 : 0;
    const retail = p.retail_price_paisa / 100;
    const stock = p.current_stock_units;
    return [
      escapeCsvField(p.sku),
      escapeCsvField(p.name),
      escapeCsvField(p.category),
      escapeCsvField(p.size_ml),
      escapeCsvField(stock),
      escapeCsvField(cost.toFixed(2)),
      escapeCsvField(retail.toFixed(2)),
      escapeCsvField((cost * stock).toFixed(2)),
      escapeCsvField((retail * stock).toFixed(2)),
      escapeCsvField(p.barcode || "")
    ];
  });

  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadCsvBlob(csv, `${filenamePrefix}_${dateStr}.csv`, "Product Stock & Inventory Valuation", products.length);
}

export function exportAttarsInventoryToCSV(attars: AttarProduct[], filenamePrefix: string = "Ameer_Perfumes_Attar_Inventory") {
  const headers = [
    "SKU",
    "Attar Name",
    "Rate per Tola (PKR)",
    "Cost per Tola (PKR)",
    "Rate per Half Tola (PKR)",
    "Rate per Quarter Tola (PKR)",
    "Density (g/ml)"
  ];

  const rows = attars.map((a) => [
    escapeCsvField(a.sku),
    escapeCsvField(a.name),
    escapeCsvField((a.selling_price_per_tola_paisa / 100).toFixed(2)),
    escapeCsvField((a.cost_per_tola_paisa / 100).toFixed(2)),
    escapeCsvField((a.selling_price_half_tola_paisa / 100).toFixed(2)),
    escapeCsvField((a.selling_price_quarter_tola_paisa / 100).toFixed(2)),
    escapeCsvField(a.density_grams_per_ml ? (a.density_grams_per_ml / 1000).toFixed(3) : "1.000")
  ]);

  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadCsvBlob(csv, `${filenamePrefix}_${dateStr}.csv`, "Attars Inventory & Pricing", attars.length);
}

export function exportExpensesToCSV(expenses: PettyExpense[], filenamePrefix: string = "Ameer_Perfumes_Expenses_Ledger") {
  const headers = [
    "Voucher #",
    "Date & Time",
    "Expense Category",
    "Amount (PKR)",
    "Authorized By",
    "Brought By",
    "Payee Recipient",
    "Description",
    "Drawer Deducted"
  ];

  const rows = expenses.map((e) => [
    escapeCsvField(e.expense_id),
    escapeCsvField(new Date(e.created_at || e.expense_date).toLocaleString()),
    escapeCsvField(e.category),
    escapeCsvField((e.amount_paisa / 100).toFixed(2)),
    escapeCsvField(e.authorized_by_name || e.authorized_by_manager_name || "Admin"),
    escapeCsvField(e.brought_by_name || "Staff"),
    escapeCsvField(e.recipient_payee || ""),
    escapeCsvField(e.description || ""),
    escapeCsvField(e.shift_id ? "YES" : "NO")
  ]);

  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadCsvBlob(csv, `${filenamePrefix}_${dateStr}.csv`, "Shop Petty Expenses Ledger", expenses.length);
}

export function exportSalariesToCSV(salaries: EmployeeSalaryPayout[], filenamePrefix: string = "Ameer_Perfumes_Salaries_Ledger") {
  const headers = [
    "Payout #",
    "Date & Time",
    "Staff Name",
    "Payout Mode",
    "Amount (PKR)",
    "Payment Mode",
    "Authorized By",
    "Notes"
  ];

  const rows = salaries.map((s) => [
    escapeCsvField(s.payout_id),
    escapeCsvField(new Date(s.payout_date || s.created_at).toLocaleString()),
    escapeCsvField(s.employee_name),
    escapeCsvField(s.payout_type),
    escapeCsvField((s.amount_paisa / 100).toFixed(2)),
    escapeCsvField(s.payment_method),
    escapeCsvField(s.disbursed_by_name),
    escapeCsvField(s.notes || "")
  ]);

  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadCsvBlob(csv, `${filenamePrefix}_${dateStr}.csv`, "Employee Salaries & Payouts Ledger", salaries.length);
}

/**
 * Master Consolidated Audit Exporter — Exports all 5 core ERP database tables
 * (Sales, Perfumes Inventory, Attars Inventory, Expenses, Salaries) into ONE SINGLE
 * comprehensive UTF-8 BOM CSV spreadsheet file that natively opens in Microsoft Excel.
 */
export function exportAllTablesToSingleCSV(
  sales: RecentSaleSummary[],
  products: FinishedProduct[],
  attars: AttarProduct[],
  expenses: PettyExpense[],
  salaries: EmployeeSalaryPayout[],
  period: string = "All Time",
  filenamePrefix: string = "Ameer_Perfumes_Master_Consolidated_Audit",
  wholesaleInvoices: WholesaleInvoiceSummary[] = [],
  onlineOrders: OnlineOrder[] = []
) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const nowFormatted = new Date().toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const totalSalesUnits = sales.reduce((acc, s) => acc + s.total_units, 0);
  const totalSalesPaisa = sales.reduce((acc, s) => acc + s.net_payable_paisa, 0);
  const totalRetailDiscountsPaisa = sales.reduce((acc, s) => acc + (s.discount_paisa || 0), 0);
  const totalOnlineDiscountsPaisa = onlineOrders
    .filter((o) => o.delivery_status !== "CANCELLED")
    .reduce((acc, o) => acc + (o.discount_paisa || 0), 0);
  const totalWholesaleDiscountsPaisa = wholesaleInvoices.reduce((acc, w) => acc + (w.discount_paisa || 0), 0);
  const totalDiscountsPaisa = totalRetailDiscountsPaisa + totalOnlineDiscountsPaisa + totalWholesaleDiscountsPaisa;
  const totalPerfumeStock = products.reduce((acc, p) => acc + p.current_stock_units, 0);
  const totalPerfumeCostPaisa = products.reduce((acc, p) => acc + ((p.latest_batch_cost_paisa || 0) * p.current_stock_units), 0);
  const totalPerfumeRetailPaisa = products.reduce((acc, p) => acc + (p.retail_price_paisa * p.current_stock_units), 0);
  const totalExpensesPaisa = expenses.reduce((acc, e) => acc + e.amount_paisa, 0);
  const totalSalariesPaisa = salaries.reduce((acc, s) => acc + s.amount_paisa, 0);
  const totalOnlineCollectedPaisa = onlineOrders.reduce((acc, o) => acc + calcOnlineOrderRealizedPaisa(o), 0);
  const totalOnlinePendingCodPaisa = onlineOrders.reduce((acc, o) => acc + calcOnlineOrderPendingCodPaisa(o), 0);
  const totalWholesaleCollectedPaisa = wholesaleInvoices.reduce((acc, w) => acc + (w.paid_amount_paisa || 0), 0);
  const totalWholesalePendingUdarPaisa = wholesaleInvoices.reduce((acc, w) => acc + (w.balance_due_paisa || 0), 0);
  const totalRealizedRevenuePaisa = totalSalesPaisa + totalOnlineCollectedPaisa + totalWholesaleCollectedPaisa;
  const netCashflowPaisa = totalRealizedRevenuePaisa - totalExpensesPaisa - totalSalariesPaisa;
  const totalCombinedRows = sales.length + products.length + attars.length + expenses.length + salaries.length + wholesaleInvoices.length + onlineOrders.length;

  const lines: string[] = [];

  // Master Header Banner
  lines.push(escapeCsvField("AMEER PERFUMES — MASTER CONSOLIDATED AUDIT REPORT (ALL 5 TABLES IN 1 FILE)"));
  lines.push(`${escapeCsvField("Report Title:")},${escapeCsvField("Master Enterprise Audit Spreadsheet")}`);
  lines.push(`${escapeCsvField("Generated Date & Time:")},${escapeCsvField(nowFormatted)}`);
  lines.push(`${escapeCsvField("Reporting Period:")},${escapeCsvField(period)}`);
  lines.push(`${escapeCsvField("Store Branch:")},${escapeCsvField("Ameer Perfumes Main Branch Sports Complex Bannu (03100988522)")}`);
  lines.push(`${escapeCsvField("Total Records Across All Tables:")},${escapeCsvField(`${totalCombinedRows} Entries`)}`);
  lines.push("");

  // Executive KPI Summary Section
  lines.push(escapeCsvField("=== EXECUTIVE KPI SUMMARY (FINANCIAL & INVENTORY METRICS) ==="));
  lines.push(`${escapeCsvField("Metric Category")},${escapeCsvField("Audit Value")},${escapeCsvField("Notes & Scope")}`);
  lines.push(`${escapeCsvField("Retail POS Net Sales Revenue")},${escapeCsvField(`PKR ${(totalSalesPaisa / 100).toFixed(2)}`)},${escapeCsvField(`Across ${sales.length} completed transactions`)}`);
  lines.push(`${escapeCsvField("Online Realized Collections")},${escapeCsvField(`PKR ${(totalOnlineCollectedPaisa / 100).toFixed(2)}`)},${escapeCsvField(`Excludes Pending COD: PKR ${(totalOnlinePendingCodPaisa / 100).toFixed(2)}`)}`);
  lines.push(`${escapeCsvField("Wholesale Realized Collections")},${escapeCsvField(`PKR ${(totalWholesaleCollectedPaisa / 100).toFixed(2)}`)},${escapeCsvField(`Excludes Pending Udar: PKR ${(totalWholesalePendingUdarPaisa / 100).toFixed(2)}`)}`);
  lines.push(`${escapeCsvField("Total Realized Net Sales Revenue")},${escapeCsvField(`PKR ${(totalRealizedRevenuePaisa / 100).toFixed(2)}`)},${escapeCsvField("Strict Cash/Collected Basis across Retail, Online & Wholesale")}`);
  lines.push(`${escapeCsvField("Total Discounts Given")},${escapeCsvField(`PKR ${(totalDiscountsPaisa / 100).toFixed(2)}`)},${escapeCsvField("Promotional and item discounts applied")}`);
  lines.push(`${escapeCsvField("Total Fragrance Bottles / Units Sold")},${escapeCsvField(`${totalSalesUnits} Units`)},${escapeCsvField("Retail sales units")}`);
  lines.push(`${escapeCsvField("Finished Perfumes Stock Units")},${escapeCsvField(`${totalPerfumeStock} Bottles`)},${escapeCsvField(`Across ${products.length} active SKUs`)}`);
  lines.push(`${escapeCsvField("Perfumes Inventory Cost Valuation")},${escapeCsvField(`PKR ${(totalPerfumeCostPaisa / 100).toFixed(2)}`)},${escapeCsvField("Manufacturing & purchase cost")}`);
  lines.push(`${escapeCsvField("Perfumes Inventory Retail Potential")},${escapeCsvField(`PKR ${(totalPerfumeRetailPaisa / 100).toFixed(2)}`)},${escapeCsvField("Full retail realization value")}`);
  lines.push(`${escapeCsvField("Active Attars & Decants SKUs")},${escapeCsvField(`${attars.length} Products`)},${escapeCsvField("Concentrated perfume oils")}`);
  lines.push(`${escapeCsvField("Total Shop Petty Expenses")},${escapeCsvField(`PKR ${(totalExpensesPaisa / 100).toFixed(2)}`)},${escapeCsvField(`Across ${expenses.length} expense vouchers`)}`);
  lines.push(`${escapeCsvField("Total Staff Salaries Disbursed")},${escapeCsvField(`PKR ${(totalSalariesPaisa / 100).toFixed(2)}`)},${escapeCsvField(`Across ${salaries.length} salary payouts`)}`);
  lines.push(`${escapeCsvField("Net Operating Cashflow (Realized Revenue - Outflows)")},${escapeCsvField(`PKR ${(netCashflowPaisa / 100).toFixed(2)}`)},${escapeCsvField("Realized Cash minus Expenses and Salaries (Excl. Pending COD/Udar)")}`);
  lines.push("");
  lines.push("");

  // SECTION 1: Sales & Invoices History
  lines.push(escapeCsvField(`=== TABLE 1 OF 5: SALES & REVENUE INVOICES AUDIT (${sales.length} Records) ===`));
  const salesHeaders = [
    "Invoice #", "Date & Time", "Customer Phone", "Products Sold", "Channel",
    "Cashier", "Salesperson", "Total Units", "Payment Method", "Discount (PKR)", "Net Payable (PKR)",
    "Return Status", "Returned Units"
  ];
  lines.push(salesHeaders.map(escapeCsvField).join(","));
  sales.forEach((s) => {
    lines.push([
      escapeCsvField(s.invoice_number),
      escapeCsvField(new Date(s.invoice_date).toLocaleString()),
      escapeCsvField(s.customer_phone || "Walk-in"),
      escapeCsvField(s.product_names || "Fragrance"),
      escapeCsvField(s.order_source || "SHOP"),
      escapeCsvField(s.cashier_name || "Cashier"),
      escapeCsvField(s.salesperson_name || "Direct"),
      escapeCsvField(s.total_units),
      escapeCsvField(s.payment_method || "CASH"),
      escapeCsvField(((s.discount_paisa || 0) / 100).toFixed(2)),
      escapeCsvField((s.net_payable_paisa / 100).toFixed(2)),
      escapeCsvField(s.return_status || "NONE"),
      escapeCsvField(s.returned_units || 0)
    ].join(","));
  });
  lines.push([
    escapeCsvField("TOTALS:"), "", "", "", "", "", "",
    escapeCsvField(totalSalesUnits),
    "",
    escapeCsvField((totalSalesPaisa / 100).toFixed(2)),
    "", ""
  ].join(","));
  lines.push("");
  lines.push("");

  // SECTION 2: Finished Perfumes Inventory
  lines.push(escapeCsvField(`=== TABLE 2 OF 5: FINISHED PERFUMES INVENTORY & VALUATION (${products.length} Records) ===`));
  const productHeaders = [
    "SKU", "Product Name", "Category", "Bottle Size (ml)", "Stock (Units)",
    "Cost Price (PKR)", "Retail Price (PKR)", "Total Cost Valuation (PKR)", "Total Retail Potential (PKR)", "Barcode"
  ];
  lines.push(productHeaders.map(escapeCsvField).join(","));
  products.forEach((p) => {
    const cost = p.latest_batch_cost_paisa ? p.latest_batch_cost_paisa / 100 : 0;
    const retail = p.retail_price_paisa / 100;
    const stock = p.current_stock_units;
    lines.push([
      escapeCsvField(p.sku),
      escapeCsvField(p.name),
      escapeCsvField(p.category),
      escapeCsvField(p.size_ml),
      escapeCsvField(stock),
      escapeCsvField(cost.toFixed(2)),
      escapeCsvField(retail.toFixed(2)),
      escapeCsvField((cost * stock).toFixed(2)),
      escapeCsvField((retail * stock).toFixed(2)),
      escapeCsvField(p.barcode || "")
    ].join(","));
  });
  lines.push([
    escapeCsvField("TOTALS:"), "", "", "",
    escapeCsvField(totalPerfumeStock),
    "", "",
    escapeCsvField((totalPerfumeCostPaisa / 100).toFixed(2)),
    escapeCsvField((totalPerfumeRetailPaisa / 100).toFixed(2)),
    ""
  ].join(","));
  lines.push("");
  lines.push("");

  // SECTION 3: Attars & Concentrated Oils Inventory
  lines.push(escapeCsvField(`=== TABLE 3 OF 5: ATTARS & CONCENTRATED OILS INVENTORY (${attars.length} Records) ===`));
  const attarHeaders = [
    "SKU", "Attar Name", "Rate per Tola (PKR)", "Cost per Tola (PKR)",
    "Rate per Half Tola (PKR)", "Rate per Quarter Tola (PKR)", "Density (g/ml)"
  ];
  lines.push(attarHeaders.map(escapeCsvField).join(","));
  attars.forEach((a) => {
    lines.push([
      escapeCsvField(a.sku),
      escapeCsvField(a.name),
      escapeCsvField((a.selling_price_per_tola_paisa / 100).toFixed(2)),
      escapeCsvField((a.cost_per_tola_paisa / 100).toFixed(2)),
      escapeCsvField((a.selling_price_half_tola_paisa / 100).toFixed(2)),
      escapeCsvField((a.selling_price_quarter_tola_paisa / 100).toFixed(2)),
      escapeCsvField(a.density_grams_per_ml ? (a.density_grams_per_ml / 1000).toFixed(3) : "1.000")
    ].join(","));
  });
  lines.push("");
  lines.push("");

  // SECTION 4: Shop Petty Expenses Ledger
  lines.push(escapeCsvField(`=== TABLE 4 OF 5: SHOP PETTY EXPENSES LEDGER (${expenses.length} Records) ===`));
  const expenseHeaders = [
    "Voucher #", "Date & Time", "Expense Category", "Amount (PKR)",
    "Authorized By", "Brought By", "Payee Recipient", "Description", "Drawer Deducted"
  ];
  lines.push(expenseHeaders.map(escapeCsvField).join(","));
  expenses.forEach((e) => {
    lines.push([
      escapeCsvField(e.expense_id),
      escapeCsvField(new Date(e.created_at || e.expense_date).toLocaleString()),
      escapeCsvField(e.category),
      escapeCsvField((e.amount_paisa / 100).toFixed(2)),
      escapeCsvField(e.authorized_by_name || e.authorized_by_manager_name || "Admin"),
      escapeCsvField(e.brought_by_name || "Staff"),
      escapeCsvField(e.recipient_payee || ""),
      escapeCsvField(e.description || ""),
      escapeCsvField(e.shift_id ? "YES" : "NO")
    ].join(","));
  });
  lines.push([
    escapeCsvField("TOTALS:"), "", "",
    escapeCsvField((totalExpensesPaisa / 100).toFixed(2)),
    "", "", "", "", ""
  ].join(","));
  lines.push("");
  lines.push("");

  // SECTION 5: Staff Salaries & Disbursals
  lines.push(escapeCsvField(`=== TABLE 5 OF 5: EMPLOYEE SALARIES & DISBURSEMENTS (${salaries.length} Records) ===`));
  const salaryHeaders = [
    "Payout #", "Date & Time", "Staff Name", "Payout Mode", "Amount (PKR)",
    "Payment Mode", "Authorized By", "Notes"
  ];
  lines.push(salaryHeaders.map(escapeCsvField).join(","));
  salaries.forEach((s) => {
    lines.push([
      escapeCsvField(s.payout_id),
      escapeCsvField(new Date(s.payout_date || s.created_at).toLocaleString()),
      escapeCsvField(s.employee_name),
      escapeCsvField(s.payout_type),
      escapeCsvField((s.amount_paisa / 100).toFixed(2)),
      escapeCsvField(s.payment_method),
      escapeCsvField(s.disbursed_by_name),
      escapeCsvField(s.notes || "")
    ].join(","));
  });
  lines.push([
    escapeCsvField("TOTALS:"), "", "", "",
    escapeCsvField((totalSalariesPaisa / 100).toFixed(2)),
    "", "", ""
  ].join(","));
  lines.push("");
  // SECTION 6: Online Orders & Social Commerce (Optional)
  if (onlineOrders.length > 0) {
    lines.push("");
    lines.push(escapeCsvField(`=== TABLE 6: ONLINE ORDERS & SOCIAL COMMERCE (WHATSAPP & WEB) (${onlineOrders.length} Records) ===`));
    const onlineHeaders = [
      "Order #", "Date & Time", "Channel", "Customer Name", "Customer Phone",
      "City", "Shipping Address", "Items Summary", "Subtotal (PKR)", "Delivery Charges (PKR)",
      "Discount (PKR)", "Total (PKR)", "Advance Paid (PKR)", "COD Balance (PKR)",
      "Courier Partner", "Tracking #", "Delivery Status", "Payment Status"
    ];
    lines.push(onlineHeaders.map(escapeCsvField).join(","));
    onlineOrders.forEach((o) => {
      let itemsSummary = "";
      try {
        const parsed = JSON.parse(o.items_json);
        itemsSummary = parsed.map((it: any) => `${it.name || it.product_name || "Item"} (x${it.quantity || 1})`).join("; ");
      } catch {
        itemsSummary = "Assorted Items";
      }

      lines.push([
        escapeCsvField(o.order_number),
        escapeCsvField(new Date(o.created_at).toLocaleString()),
        escapeCsvField(o.channel),
        escapeCsvField(o.customer_name),
        escapeCsvField(o.customer_phone),
        escapeCsvField(o.city),
        escapeCsvField(o.shipping_address),
        escapeCsvField(itemsSummary),
        escapeCsvField((o.subtotal_paisa / 100).toFixed(2)),
        escapeCsvField((o.delivery_charges_paisa / 100).toFixed(2)),
        escapeCsvField(((o.discount_paisa || 0) / 100).toFixed(2)),
        escapeCsvField((o.total_amount_paisa / 100).toFixed(2)),
        escapeCsvField((o.advance_paid_paisa / 100).toFixed(2)),
        escapeCsvField((o.cod_balance_paisa / 100).toFixed(2)),
        escapeCsvField(o.courier_partner || ""),
        escapeCsvField(o.tracking_number || ""),
        escapeCsvField(o.delivery_status),
        escapeCsvField(o.payment_status)
      ].join(","));
    });
    lines.push("");
  }

  // SECTION 7: Wholesale Invoices (Optional)
  if (wholesaleInvoices.length > 0) {
    lines.push("");
    lines.push(escapeCsvField(`=== TABLE 7: WHOLESALE COMMERCIAL INVOICES & RECEIVABLES (${wholesaleInvoices.length} Records) ===`));
    const wholesaleHeaders = [
      "Invoice #", "Date & Time", "Customer Name", "Channel / Source", "Salesperson",
      "Gross Subtotal (PKR)", "Discount (PKR)", "Net Total (PKR)", "Paid Amount (PKR)", "Balance Due (Udar) (PKR)", "Payment Status"
    ];
    lines.push(wholesaleHeaders.map(escapeCsvField).join(","));
    wholesaleInvoices.forEach((w) => {
      const grossPaisa = (w.subtotal_paisa && w.subtotal_paisa > 0) ? w.subtotal_paisa : (w.net_total_paisa + (w.discount_paisa || 0));
      lines.push([
        escapeCsvField(w.invoice_number),
        escapeCsvField(new Date(w.invoice_date).toLocaleString()),
        escapeCsvField(w.customer_name),
        escapeCsvField(w.order_source || "DIRECT"),
        escapeCsvField(w.salesperson_name || ""),
        escapeCsvField((grossPaisa / 100).toFixed(2)),
        escapeCsvField(((w.discount_paisa || 0) / 100).toFixed(2)),
        escapeCsvField((w.net_total_paisa / 100).toFixed(2)),
        escapeCsvField((w.paid_amount_paisa / 100).toFixed(2)),
        escapeCsvField((w.balance_due_paisa / 100).toFixed(2)),
        escapeCsvField(w.payment_status)
      ].join(","));
    });
    lines.push("");
  }

  lines.push(escapeCsvField("=== END OF MASTER CONSOLIDATED AUDIT SPREADSHEET ==="));

  const csvContent = lines.join("\r\n");
  const fileName = `${filenamePrefix}_${period.replace(/\s+/g, "_")}_${dateStr}.csv`;
  downloadCsvBlob(csvContent, fileName, "Master All-in-One Audit (All 5 Tables Consolidated)", totalCombinedRows);
}
