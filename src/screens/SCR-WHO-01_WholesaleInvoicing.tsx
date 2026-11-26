import React, { useState, useEffect } from "react";
import {
  WholesaleCustomer,
  WholesaleInvoiceSummary,
  WholesaleInvoiceDetails,
  WholesaleLedgerEntry,
  CreateWholesaleInvoicePayload,
  RecordWholesalePaymentPayload,
  CreateWholesaleCustomerPayload,
  UpdateWholesaleCustomerPayload,
  FinishedProduct,
  AttarProduct,
} from "@/types/database";
import { SystemUser } from "@/types/system";
import {
  getWholesaleCustomers,
  getWholesaleInvoices,
  getWholesaleInvoiceDetails,
  getWholesaleCustomerLedger,
  createWholesaleInvoice,
  recordWholesalePayment,
  createWholesaleCustomer,
  updateWholesaleCustomer,
  deleteWholesaleCustomer,
  getProducts,
  getAttars,
  getSalespersons,
  createSalesperson,
} from "@/lib/tauri-bridge";
import { formatPaisaToRupees } from "@/lib/formatters";
import { formatLocalDateTime, formatLocalDate } from "@/lib/date-utils";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Briefcase,
  Users,
  FileText,
  Plus,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  Building2,
  Phone,
  Trash2,
  Edit3,
  DollarSign,
  Layers,
  Printer,
  Eye,
  History,
  Search,
} from "lucide-react";

interface PrintableWholesaleInvoiceData {
  invoice_number: string;
  invoice_date?: string;
  order_source?: string;
  customer_name: string;
  contact_person: string;
  city: string;
  phone: string;
  items: Array<{
    name: string;
    item_type: string;
    quantity: number;
    unit_price_paisa: number;
    line_total_paisa: number;
  }>;
  subtotal_paisa: number;
  discount_paisa: number;
  net_total_paisa: number;
  paid_amount_paisa: number;
  balance_due_paisa: number;
  payment_method?: string;
  notes?: string;
}

export const printA4WholesaleInvoice = (data: PrintableWholesaleInvoiceData) => {

  const itemsRows = data.items
    .map(
      (it, idx) => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 10px 8px; text-align: center; font-size: 11px; color: #64748b;">${idx + 1}</td>
      <td style="padding: 10px 8px; font-size: 12px; font-weight: 700; color: #0f172a;">${it.name}</td>
      <td style="padding: 10px 8px; text-align: center; font-size: 11px; color: #475569;">
        <span style="background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-weight: 600; text-transform: uppercase; font-size: 10px;">${it.item_type}</span>
      </td>
      <td style="padding: 10px 8px; text-align: center; font-size: 12px; font-weight: 700; color: #0f172a;">${it.quantity}</td>
      <td style="padding: 10px 8px; text-align: right; font-size: 12px; font-family: monospace; font-weight: 600; color: #334155;">Rs. ${(
        it.unit_price_paisa / 100
      ).toLocaleString()}</td>
      <td style="padding: 10px 8px; text-align: right; font-size: 12px; font-family: monospace; font-weight: 700; color: #0f172a;">Rs. ${(
        it.line_total_paisa / 100
      ).toLocaleString()}</td>
    </tr>
  `
    )
    .join("");

  const savedSettings = JSON.parse(localStorage.getItem("ameer_receipt_settings") || "{}");
  const branchAddress = savedSettings.address || "Main Branch Sports Complex Bannu";
  const contactPhone = savedSettings.phone || "WhatsApp: 03100988522";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Commercial Wholesale Invoice - ${data.invoice_number}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 15mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 0;
            background: #ffffff;
            font-size: 12px;
            line-height: 1.4;
          }
          .invoice-box {
            width: 100%;
            max-width: 100%;
            min-height: 265mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .footer-section {
            margin-top: auto;
          }
        </style>
      </head>
      <body>
        <div class="invoice-box">
          <div>
            <!-- Header with Logo and Brand Identity -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 2.5px solid #0f172a;">
            <div style="display: flex; align-items: center; gap: 14px;">
              <img src="/logo-rect.png" style="height: 52px; width: auto; object-fit: contain;" alt="Ameer Perfumes" />
              <div>
                <h1 style="margin: 0; font-size: 21px; font-weight: 800; letter-spacing: 1px; color: #0f172a;">AMEER PERFUMES</h1>
                <div style="font-size: 11px; font-weight: 700; color: #b45309; text-transform: uppercase; letter-spacing: 0.5px;">Haute Parfumerie & Pure Concentrated Oils</div>
                <div style="font-size: 10.5px; color: #475569; margin-top: 3px;">${branchAddress} | ${contactPhone}</div>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 19px; font-weight: 900; letter-spacing: 0.5px; color: #0f172a;">WHOLESALE INVOICE</div>
              <div style="font-family: monospace; font-size: 14px; font-weight: 800; color: #b45309; margin-top: 2px;"># ${data.invoice_number}</div>
              <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">Date: ${data.invoice_date || new Date().toLocaleString()}</div>
            </div>
          </div>

          <!-- Customer & Order Channel Information -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 16px 0; padding: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div>
              <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 4px;">Commercial Buyer / Bill To:</div>
              <div style="font-size: 14px; font-weight: 800; color: #0f172a;">${data.customer_name}</div>
              <div style="font-size: 11.5px; color: #334155; margin-top: 2px;">Attention: <strong>${data.contact_person}</strong></div>
              <div style="font-size: 11.5px; color: #334155;">City / Station: <strong>${data.city}</strong></div>
              <div style="font-size: 11.5px; color: #334155;">Phone / Mobile: <strong>${data.phone}</strong></div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 4px;">Order Status & Terms:</div>
              <div style="font-size: 11.5px; color: #334155;">Channel: <strong>${data.order_source || "B2B Wholesale"}</strong></div>
              <div style="font-size: 11.5px; color: #334155; margin-top: 3px;">Payment Status: 
                <span style="display: inline-block; padding: 3px 10px; border-radius: 4px; font-weight: 800; font-size: 11px; background: ${
                  data.balance_due_paisa <= 0 ? "#dcfce7; color: #166534;" : data.paid_amount_paisa > 0 ? "#fef3c7; color: #92400e;" : "#fee2e2; color: #991b1b;"
                }">
                  ${data.balance_due_paisa <= 0 ? "PAID IN FULL" : data.paid_amount_paisa > 0 ? "PARTIALLY PAID" : "BALANCE OUTSTANDING"}
                </span>
              </div>
              ${data.payment_method ? `<div style="font-size: 11.5px; color: #334155; margin-top: 2px;">Upfront Method: <strong>${data.payment_method}</strong></div>` : ""}
            </div>
          </div>

          <!-- Line Items Table -->
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
              <tr style="background: #0f172a; color: #ffffff;">
                <th style="padding: 9px 8px; font-size: 10.5px; font-weight: 700; text-align: center; width: 35px;">#</th>
                <th style="padding: 9px 8px; font-size: 10.5px; font-weight: 700; text-align: left;">Product Description</th>
                <th style="padding: 9px 8px; font-size: 10.5px; font-weight: 700; text-align: center; width: 100px;">Category</th>
                <th style="padding: 9px 8px; font-size: 10.5px; font-weight: 700; text-align: center; width: 60px;">Qty</th>
                <th style="padding: 9px 8px; font-size: 10.5px; font-weight: 700; text-align: right; width: 115px;">Unit Rate (PKR)</th>
                <th style="padding: 9px 8px; font-size: 10.5px; font-weight: 700; text-align: right; width: 125px;">Total (PKR)</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <!-- Financial Calculation Summary -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 18px;">
            <div style="width: 52%; font-size: 11px; color: #475569; padding-right: 20px;">
              ${
                data.notes
                  ? `<div style="background: #f1f5f9; padding: 10px; border-radius: 6px; border-left: 3px solid #b45309; margin-bottom: 10px;">
                <strong style="color: #0f172a; display: block; margin-bottom: 2px;">Dispatch & Order Notes:</strong>
                ${data.notes}
              </div>`
                  : ""
              }
              <div style="background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px dashed #cbd5e1; font-size: 10px; line-height: 1.5;">
                <strong style="color: #0f172a;">Commercial Guarantee & Terms:</strong><br />
                • All goods supplied are guaranteed 100% authentic Ameer Perfumes formulations.<br />
                • Check goods upon arrival. Claims for transit damage accepted within 48 hours of dispatch.<br />
                • Remaining balance is recorded in client ledger under commercial trading terms.
              </div>
            </div>

            <div style="width: 44%;">
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px;">
                <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 11.5px; color: #475569;">
                  <span>Subtotal Amount:</span>
                  <span style="font-family: monospace; font-weight: 700; color: #0f172a;">Rs. ${(data.subtotal_paisa / 100).toLocaleString()}</span>
                </div>
                ${
                  data.discount_paisa > 0
                    ? `
                  <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 11.5px; color: #dc2626;">
                    <span>Trade Discount:</span>
                    <span style="font-family: monospace; font-weight: 700;">- Rs. ${(data.discount_paisa / 100).toLocaleString()}</span>
                  </div>
                `
                    : ""
                }
                <div style="display: flex; justify-content: space-between; padding: 8px 0 6px 0; border-top: 1.5px solid #cbd5e1; border-bottom: 1.5px solid #cbd5e1; margin: 4px 0; font-size: 13px; font-weight: 800; color: #0f172a;">
                  <span>Net Invoice Total:</span>
                  <span style="font-family: monospace; color: #b45309; font-size: 14px;">Rs. ${(data.net_total_paisa / 100).toLocaleString()}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 11.5px; color: #166534; font-weight: 700;">
                  <span>Paid Upfront:</span>
                  <span style="font-family: monospace;">Rs. ${(data.paid_amount_paisa / 100).toLocaleString()}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 6px 0; border-top: 1px dashed #cbd5e1; font-size: 12.5px; font-weight: 800; color: #991b1b;">
                  <span>Balance Added to Ledger:</span>
                  <span style="font-family: monospace; font-size: 13.5px;">Rs. ${(data.balance_due_paisa / 100).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="footer-section">
            <!-- Dual Stamp & Signature Section -->
            <div style="display: flex; justify-content: space-between; margin-top: 40px; padding-top: 10px;">
              <div style="width: 40%; text-align: center;">
                <div style="border-top: 1.5px solid #0f172a; padding-top: 6px; font-size: 11px; font-weight: 700; color: #0f172a;">
                  Authorized Ameer Perfumes Sales Desk
                </div>
                <div style="font-size: 9.5px; color: #64748b;">Prepared & Verified By Official Authority</div>
              </div>
              <div style="width: 40%; text-align: center;">
                <div style="border-top: 1.5px solid #0f172a; padding-top: 6px; font-size: 11px; font-weight: 700; color: #0f172a;">
                  Client Authorized Receiver
                </div>
                <div style="font-size: 9.5px; color: #64748b;">Stamp, Signature & Date</div>
              </div>
            </div>

            <!-- Global Tech Footer -->
            <div style="margin-top: 30px; padding-top: 10px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 10px; color: #64748b;">
              <div>Software Developed by <strong>Global Tech</strong> • Contact: <strong>0329 9969277</strong></div>
              <div>Ameer Perfumes ERP • Official Commercial Wholesale Invoice</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  const printArea = document.getElementById("wholesale-print-area");
  if (printArea) {
    printArea.innerHTML = html;
    document.body.classList.add("printing-wholesale-a4");
    document.body.classList.remove("printing-report");
    document.body.classList.remove("printing-reports-master");
    setTimeout(() => {
      window.print();
      const cleanUp = () => {
        document.body.classList.remove("printing-wholesale-a4");
        if (printArea) printArea.innerHTML = "";
        window.removeEventListener("afterprint", cleanUp);
      };
      window.addEventListener("afterprint", cleanUp);
    }, 80);
  } else {
    window.print();
  }
};

interface WholesaleProps {
  currentUser: SystemUser | null;
}

export const WholesaleInvoicing: React.FC<WholesaleProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<"INVOICES" | "CUSTOMERS" | "NEW_INVOICE">("INVOICES");
  const [customers, setCustomers] = useState<WholesaleCustomer[]>([]);
  const [invoices, setInvoices] = useState<WholesaleInvoiceSummary[]>([]);
  const [products, setProducts] = useState<FinishedProduct[]>([]);
  const [attars, setAttars] = useState<AttarProduct[]>([]);
  const [salespersons, setSalespersons] = useState<
    {
      salesperson_id: string;
      employee_code: string;
      full_name: string;
    }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter States
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<"ALL" | "PAID" | "UNPAID">("ALL");
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [clientBalanceFilter, setClientBalanceFilter] = useState<"ALL" | "HAS_BALANCE" | "CLEARED">("ALL");

  const filteredInvoices = invoices.filter((inv) => {
    const q = invoiceSearchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      inv.invoice_number.toLowerCase().includes(q) ||
      inv.customer_name.toLowerCase().includes(q) ||
      (inv.salesperson_name && inv.salesperson_name.toLowerCase().includes(q));
    if (!matchesSearch) return false;
    if (invoiceStatusFilter === "PAID") return inv.balance_due_paisa <= 0;
    if (invoiceStatusFilter === "UNPAID") return inv.balance_due_paisa > 0;
    return true;
  });

  const filteredCustomers = customers.filter((cust) => {
    const q = clientSearchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      cust.business_name.toLowerCase().includes(q) ||
      cust.contact_person.toLowerCase().includes(q) ||
      cust.city.toLowerCase().includes(q) ||
      cust.phone.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (clientBalanceFilter === "HAS_BALANCE") return cust.current_balance_paisa > 0;
    if (clientBalanceFilter === "CLEARED") return cust.current_balance_paisa <= 0;
    return true;
  });

  // Ledger Statement Drawer State
  const [selectedCustomerForLedger, setSelectedCustomerForLedger] = useState<WholesaleCustomer | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<WholesaleLedgerEntry[]>([]);
  const [isLedgerLoading, setIsLedgerLoading] = useState(false);

  // Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedCustomerForPayment, setSelectedCustomerForPayment] = useState<WholesaleCustomer | null>(null);
  const [paymentAmountRupees, setPaymentAmountRupees] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "EASYPAISA" | "JAZZCASH">("CASH");
  const [paymentRefNumber, setPaymentRefNumber] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<string>("");

  // Invoice Details Modal State
  const [selectedInvoiceDetails, setSelectedInvoiceDetails] = useState<WholesaleInvoiceDetails | null>(null);

  // Add Customer Modal State
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [newCustBusiness, setNewCustBusiness] = useState("");
  const [newCustContact, setNewCustContact] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustCity, setNewCustCity] = useState("");

  // Edit Customer Modal State
  const [editingCustomer, setEditingCustomer] = useState<WholesaleCustomer | null>(null);
  const [editCustBusiness, setEditCustBusiness] = useState("");
  const [editCustContact, setEditCustContact] = useState("");
  const [editCustPhone, setEditCustPhone] = useState("");
  const [editCustCity, setEditCustCity] = useState("");
  const [isEditCustomerModalOpen, setIsEditCustomerModalOpen] = useState(false);

  // Add Sales Staff Modal State
  const [isAddStaffModalOpen, setIsAddStaffModalOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffCode, setNewStaffCode] = useState("");
  const [newStaffPhone, setNewStaffPhone] = useState("");
  const [isStaffSaving, setIsStaffSaving] = useState(false);

  // New Wholesale Invoice Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedSalespersonId, setSelectedSalespersonId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [orderSource, setOrderSource] = useState<"DIRECT" | "WHATSAPP" | "PHONE">("WHATSAPP");
  const [discountRupees, setDiscountRupees] = useState("");
  const [upfrontPaidRupees, setUpfrontPaidRupees] = useState("");
  const [upfrontPaymentMethod, setUpfrontPaymentMethod] = useState<"CASH" | "EASYPAISA" | "JAZZCASH">("CASH");
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [invoiceLines, setInvoiceLines] = useState<
    {
      item_type: "PERFUME" | "ATTAR";
      item_id: string;
      quantity: string;
      agreed_price_rupees: string;
    }[]
  >([{ item_type: "PERFUME", item_id: "", quantity: "10", agreed_price_rupees: "" }]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [custs, invs, prods, atts, sps] = await Promise.all([
        getWholesaleCustomers(),
        getWholesaleInvoices(),
        getProducts(),
        getAttars(),
        getSalespersons(),
      ]);
      setCustomers(custs);
      setInvoices(invs);
      setProducts(prods);
      setAttars(atts);
      setSalespersons(sps);

      if (custs.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(custs[0].customer_id);
      }
      if (sps.length > 0 && !selectedSalespersonId) {
        setSelectedSalespersonId(sps[0].salesperson_id);
      }
      setInvoiceNumber(`WI-${new Date().getFullYear()}-${String(invs.length + 1).padStart(4, "0")}`);
    } catch (err) {
      console.error("Failed to load wholesale data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openLedgerStatement = async (cust: WholesaleCustomer) => {
    setSelectedCustomerForLedger(cust);
    setIsLedgerLoading(true);
    try {
      const entries = await getWholesaleCustomerLedger(cust.customer_id);
      setLedgerEntries(entries);
    } catch (err) {
      console.error("Failed to load ledger:", err);
    } finally {
      setIsLedgerLoading(false);
    }
  };

  const handleItemSelection = (index: number, itemType: "PERFUME" | "ATTAR", itemId: string) => {
    const updated = [...invoiceLines];
    updated[index].item_type = itemType;
    updated[index].item_id = itemId;
    if (itemType === "PERFUME") {
      const prod = products.find((p) => p.product_id === itemId);
      if (prod) {
        updated[index].agreed_price_rupees = (prod.wholesale_price_paisa / 100).toString();
      }
    } else {
      const att = attars.find((a) => a.attar_id === itemId);
      if (att) {
        updated[index].agreed_price_rupees = (att.selling_price_per_tola_paisa / 100).toString();
      }
    }
    setInvoiceLines(updated);
  };

  const addLine = () => {
    setInvoiceLines([
      ...invoiceLines,
      { item_type: "PERFUME", item_id: "", quantity: "10", agreed_price_rupees: "" },
    ]);
  };

  const removeLine = (idx: number) => {
    if (invoiceLines.length > 1) {
      setInvoiceLines(invoiceLines.filter((_, i) => i !== idx));
    }
  };

  // Live Invoice Totals Calculation
  const parsedLines = invoiceLines.map((l) => {
    const qty = parseInt(l.quantity) || 0;
    const pricePaisa = Math.round((parseFloat(l.agreed_price_rupees) || 0) * 100);
    return {
      item_type: l.item_type,
      item_id: l.item_id,
      quantity: qty,
      agreed_wholesale_price_paisa: pricePaisa,
      line_total_paisa: qty * pricePaisa,
    };
  });

  const invoiceSubtotalPaisa = parsedLines.reduce(
    (sum, l) => sum + l.line_total_paisa,
    0
  );
  const invoiceDiscountPaisa = Math.round(
    (parseFloat(discountRupees) || 0) * 100
  );
  const invoiceNetTotalPaisa = Math.max(0, invoiceSubtotalPaisa - invoiceDiscountPaisa);
  const invoicePaidPaisa = Math.min(
    invoiceNetTotalPaisa,
    Math.round((parseFloat(upfrontPaidRupees) || 0) * 100)
  );
  const invoiceBalanceDuePaisa = invoiceNetTotalPaisa - invoicePaidPaisa;

  // Selected customer credit limit check
  const activeCustomer = customers.find((c) => c.customer_id === selectedCustomerId);
  const potentialBalance = activeCustomer
    ? activeCustomer.current_balance_paisa + invoiceBalanceDuePaisa
    : 0;
  const isCreditExceeded =
    activeCustomer &&
    activeCustomer.credit_limit_paisa > 0 &&
    potentialBalance > activeCustomer.credit_limit_paisa;

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || parsedLines.length === 0) {
      setNotification({
        type: "error",
        message: "Please complete customer and line item fields.",
      });
      return;
    }

    if (parsedLines.some((l) => !l.item_id || l.quantity <= 0)) {
      setNotification({
        type: "error",
        message: "Each line item must have a selected perfume or attar oil and quantity greater than zero.",
      });
      return;
    }

    if (isCreditExceeded) {
      setNotification({
        type: "error",
        message: `Customer credit limit exceeded! Max credit allowed: ${formatPaisaToRupees(
          activeCustomer.credit_limit_paisa
        )}.`,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const spId = selectedSalespersonId || (salespersons[0]?.salesperson_id || "sp_01");
      const payload: CreateWholesaleInvoicePayload = {
        customer_id: selectedCustomerId,
        invoice_number: invoiceNumber.trim().toUpperCase(),
        order_source: orderSource,
        salesperson_id: spId,
        items: parsedLines.map((l) => ({
          item_type: l.item_type,
          finished_product_id: l.item_type === "PERFUME" ? l.item_id : undefined,
          attar_id: l.item_type === "ATTAR" ? l.item_id : undefined,
          quantity: l.quantity,
          agreed_wholesale_price_paisa: l.agreed_wholesale_price_paisa,
        })),
        discount_paisa: invoiceDiscountPaisa,
        paid_amount_paisa: invoicePaidPaisa,
        payment_method: invoicePaidPaisa > 0 ? upfrontPaymentMethod : undefined,
        received_by_user_id: currentUser?.user_id || "usr_admin",
        notes: invoiceNotes.trim() || undefined,
      };

      const result = await createWholesaleInvoice(payload);
      setNotification({
        type: "success",
        message: `${result.message} Printing A4 Wholesale Invoice...`,
      });

      // Automatically print professional A4 B2B Wholesale Invoice
      if (activeCustomer) {
        const printableItems = parsedLines.map((line) => {
          let name = "Custom Item";
          if (line.item_type === "PERFUME") {
            const p = products.find((prod) => prod.product_id === line.item_id);
            name = p ? `${p.name} (${p.size_ml}ml)` : line.item_id;
          } else {
            const a = attars.find((at) => at.attar_id === line.item_id);
            name = a ? `${a.name} (Pure Attar)` : line.item_id;
          }
          return {
            name,
            item_type: line.item_type,
            quantity: line.quantity,
            unit_price_paisa: line.agreed_wholesale_price_paisa,
            line_total_paisa: line.quantity * line.agreed_wholesale_price_paisa,
          };
        });

        const invoicePrintData: PrintableWholesaleInvoiceData = {
          invoice_number: payload.invoice_number,
          invoice_date: new Date().toLocaleString(),
          order_source: orderSource === "WHATSAPP" ? "WhatsApp B2B Order" : orderSource === "DIRECT" ? "Direct Showroom Visit" : "Telephone Confirmation",
          customer_name: activeCustomer.business_name,
          contact_person: activeCustomer.contact_person,
          city: activeCustomer.city,
          phone: activeCustomer.phone,
          items: printableItems,
          subtotal_paisa: invoiceSubtotalPaisa,
          discount_paisa: invoiceDiscountPaisa,
          net_total_paisa: invoiceNetTotalPaisa,
          paid_amount_paisa: invoicePaidPaisa,
          balance_due_paisa: invoiceBalanceDuePaisa,
          payment_method: invoicePaidPaisa > 0 ? upfrontPaymentMethod : undefined,
          notes: invoiceNotes.trim() || undefined,
        };

        printA4WholesaleInvoice(invoicePrintData);
      }

      // Reset form & reload
      setInvoiceLines([{ item_type: "PERFUME", item_id: "", quantity: "10", agreed_price_rupees: "" }]);
      setDiscountRupees("");
      setUpfrontPaidRupees("");
      setInvoiceNotes("");
      setActiveTab("INVOICES");
      loadData();
    } catch (err) {
      setNotification({
        type: "error",
        message: `Failed to issue invoice: ${String(err)}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerForPayment) return;
    const amountPaisa = Math.round((parseFloat(paymentAmountRupees) || 0) * 100);
    if (amountPaisa <= 0) {
      setNotification({
        type: "error",
        message: "Please enter a valid payment amount.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: RecordWholesalePaymentPayload = {
        customer_id: selectedCustomerForPayment.customer_id,
        wholesale_invoice_id: paymentInvoiceId ? paymentInvoiceId : undefined,
        amount_paid_paisa: amountPaisa,
        payment_method: paymentMethod,
        reference_number: paymentRefNumber.trim() || undefined,
        notes: paymentNotes.trim() || undefined,
        received_by_user_id: currentUser?.user_id || "usr_admin",
      };

      await recordWholesalePayment(payload);
      setNotification({
        type: "success",
        message: `Payment of ${formatPaisaToRupees(amountPaisa)} recorded for ${
          selectedCustomerForPayment.business_name
        }. Invoice balances and statuses updated immediately.`,
      });
      setPaymentModalOpen(false);
      setSelectedCustomerForPayment(null);
      setPaymentInvoiceId("");
      setPaymentAmountRupees("");
      setPaymentRefNumber("");
      setPaymentNotes("");
      await loadData();
    } catch (err) {
      setNotification({
        type: "error",
        message: `Failed to record payment: ${String(err)}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustBusiness.trim()) {
      setNotification({ type: "error", message: "Business name is required." });
      return;
    }
    setIsSubmitting(true);
    try {
      const payload: CreateWholesaleCustomerPayload = {
        business_name: newCustBusiness.trim(),
        contact_person: newCustContact.trim() || newCustBusiness.trim(),
        phone: newCustPhone.trim() || "0300-0000000",
        city: newCustCity.trim() || "General",
        credit_limit_paisa: 0,
        initial_balance_paisa: 0,
      };
      await createWholesaleCustomer(payload);
      setNotification({
        type: "success",
        message: `Wholesale client "${payload.business_name}" registered successfully.`,
      });
      setIsAddCustomerModalOpen(false);
      setNewCustBusiness("");
      setNewCustContact("");
      setNewCustPhone("");
      setNewCustCity("");
      await loadData();
    } catch (err) {
      setNotification({
        type: "error",
        message: `Failed to create wholesale client: ${String(err)}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEditCustomer = (cust: WholesaleCustomer) => {
    setEditingCustomer(cust);
    setEditCustBusiness(cust.business_name);
    setEditCustContact(cust.contact_person);
    setEditCustPhone(cust.phone);
    setEditCustCity(cust.city);
    setIsEditCustomerModalOpen(true);
  };

  const handleSaveCustomerEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    setIsSubmitting(true);
    try {
      const payload: UpdateWholesaleCustomerPayload = {
        customer_id: editingCustomer.customer_id,
        business_name: editCustBusiness.trim(),
        contact_person: editCustContact.trim() || editCustBusiness.trim(),
        phone: editCustPhone.trim() || "0300-0000000",
        city: editCustCity.trim() || "General",
        credit_limit_paisa: editingCustomer.credit_limit_paisa || 0,
      };
      await updateWholesaleCustomer(payload);
      setNotification({
        type: "success",
        message: `Wholesale client "${payload.business_name}" updated successfully.`,
      });
      setIsEditCustomerModalOpen(false);
      setEditingCustomer(null);
      await loadData();
    } catch (err) {
      setNotification({
        type: "error",
        message: `Failed to update wholesale client: ${String(err)}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCustomer = async (cust: WholesaleCustomer) => {
    const ok = window.confirm(
      `Are you sure you want to remove wholesale client "${cust.business_name}"?\n\nThis will remove them from the active B2B client directory.`
    );
    if (!ok) return;

    try {
      await deleteWholesaleCustomer(cust.customer_id);
      setNotification({
        type: "success",
        message: `Wholesale client "${cust.business_name}" archived / removed.`,
      });
      await loadData();
    } catch (err) {
      setNotification({
        type: "error",
        message: `Failed to delete wholesale client: ${String(err)}`,
      });
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim()) return;
    setIsStaffSaving(true);
    try {
      const code = newStaffCode.trim() || `EMP-${100 + salespersons.length + 1}`;
      const newSp = await createSalesperson({
        full_name: newStaffName.trim(),
        employee_code: code,
        phone: newStaffPhone.trim() || "0300-0000000",
      });
      const updatedList = await getSalespersons();
      setSalespersons(updatedList);
      setSelectedSalespersonId(newSp.salesperson_id);
      setIsAddStaffModalOpen(false);
      setNewStaffName("");
      setNewStaffCode("");
      setNewStaffPhone("");
      setNotification({
        type: "success",
        message: `Sales staff member "${newSp.full_name}" registered successfully.`,
      });
    } catch (err: any) {
      setNotification({
        type: "error",
        message: `Failed to register staff: ${String(err)}`,
      });
    } finally {
      setIsStaffSaving(false);
    }
  };

  // Metrics
  const totalReceivablesPaisa = customers.reduce(
    (sum, c) => sum + c.current_balance_paisa,
    0
  );
  const totalWholesaleBilledPaisa = invoices.reduce(
    (sum, i) => sum + i.net_total_paisa,
    0
  );
  const unpaidInvoicesCount = invoices.filter(
    (i) => i.payment_status === "UNPAID" || i.payment_status === "PARTIALLY_PAID"
  ).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Wholesale Operations & Customer Ledgers
              </h1>
              <p className="text-sm text-muted-foreground">
                B2B bulk orders, customized client pricing, credit limits, and running ledger statements
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            onClick={() => setIsAddCustomerModalOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 hover:from-amber-400 hover:to-amber-500 font-bold text-xs shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Wholesale Client</span>
          </Button>
          <Button
            variant="outline"
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RotateCcw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="primary"
            onClick={() => setActiveTab("NEW_INVOICE")}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Wholesale Invoice
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
            notification.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/30 text-rose-400"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-card/60 backdrop-blur border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Receivables</p>
              <p className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">
                {formatPaisaToRupees(totalReceivablesPaisa)}
              </p>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-600 dark:text-amber-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">B2B outstanding client ledger</p>
        </Card>

        <Card className="p-4 bg-card/60 backdrop-blur border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Active Wholesale Buyers</p>
              <p className="text-2xl font-bold mt-1 text-foreground">{customers.length}</p>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Registered boutiques & distributors</p>
        </Card>

        <Card className="p-4 bg-card/60 backdrop-blur border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total B2B Volume</p>
              <p className="text-2xl font-bold mt-1 text-emerald-400">
                {formatPaisaToRupees(totalWholesaleBilledPaisa)}
              </p>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Historical invoiced revenue</p>
        </Card>

        <Card className="p-4 bg-card/60 backdrop-blur border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Unpaid Invoices</p>
              <p className="text-2xl font-bold mt-1 text-rose-400">{unpaidInvoicesCount}</p>
            </div>
            <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Open / partial payments</p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/40 gap-6">
        <button
          onClick={() => setActiveTab("INVOICES")}
          className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === "INVOICES"
              ? "border-amber-500 text-amber-600 dark:text-amber-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="w-4 h-4" />
          Wholesale Invoices ({invoices.length})
        </button>
        <button
          onClick={() => setActiveTab("CUSTOMERS")}
          className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === "CUSTOMERS"
              ? "border-amber-500 text-amber-600 dark:text-amber-400 font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Building2 className="w-4 h-4 text-amber-500" />
          <span>👥 Wholesale Clients ({customers.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("NEW_INVOICE")}
          className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === "NEW_INVOICE"
              ? "border-amber-500 text-amber-600 dark:text-amber-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Plus className="w-4 h-4" />
          New B2B Invoicing
        </button>
      </div>

      {/* TAB 1: WHOLESALE INVOICES */}
      {activeTab === "INVOICES" && (
        <Card className="overflow-hidden border-border/50 space-y-4 p-4">
          {/* Invoices Search & Filter Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search invoice #, customer, salesperson..."
                value={invoiceSearchQuery}
                onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0">Payment:</span>
              <select
                value={invoiceStatusFilter}
                onChange={(e) => setInvoiceStatusFilter(e.target.value as any)}
                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
              >
                <option value="ALL">All Invoices ({invoices.length})</option>
                <option value="UNPAID">Has Balance Due ({invoices.filter((i) => i.balance_due_paisa > 0).length})</option>
                <option value="PAID">Paid in Full ({invoices.filter((i) => i.balance_due_paisa <= 0).length})</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border/40">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase font-medium text-muted-foreground border-b border-border/50">
                <tr>
                  <th className="p-3.5">Invoice #</th>
                  <th className="p-3.5">Customer & Salesperson</th>
                  <th className="p-3.5 text-center">Order Source</th>
                  <th className="p-3.5 text-right">Net Total</th>
                  <th className="p-3.5 text-right">Paid Amount</th>
                  <th className="p-3.5 text-right">Balance Due</th>
                  <th className="p-3.5 text-center">Payment Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      {invoices.length === 0
                        ? 'No wholesale invoices issued yet. Click "New B2B Invoicing" to create one.'
                        : "No invoices match the specified search or filter criteria."}
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => {
                    const hasBalance = inv.balance_due_paisa > 0;
                    return (
                      <tr key={inv.wholesale_invoice_id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3.5 font-mono font-medium text-amber-600 dark:text-amber-400">
                          {inv.invoice_number}
                          <span className="block text-xs font-sans text-muted-foreground font-normal">
                            {formatLocalDate(inv.invoice_date)}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="font-medium text-foreground block">
                            {inv.customer_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Salesperson: {inv.salesperson_name}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          <Badge variant="neutral" className="text-xs">
                            {inv.order_source}
                          </Badge>
                        </td>
                        <td className="p-3.5 text-right font-mono font-semibold text-foreground">
                          {formatPaisaToRupees(inv.net_total_paisa)}
                        </td>
                        <td className="p-3.5 text-right font-mono text-emerald-400">
                          {formatPaisaToRupees(inv.paid_amount_paisa)}
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                          {formatPaisaToRupees(inv.balance_due_paisa)}
                        </td>
                        <td className="p-3.5 text-center">
                          <Badge
                            variant={
                              inv.payment_status === "PAID"
                                ? "success"
                                : inv.payment_status === "PARTIALLY_PAID"
                                ? "warning"
                                : "danger"
                            }
                            className="text-xs"
                          >
                            {inv.payment_status}
                          </Badge>
                        </td>
                        <td className="p-3.5 text-right flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                const details = await getWholesaleInvoiceDetails(inv.wholesale_invoice_id);
                                if (details) {
                                  setSelectedInvoiceDetails(details);
                                  return;
                                }
                              } catch (err) {
                                console.error("Error fetching invoice details:", err);
                              }
                              const cust = customers.find((c) => c.customer_id === inv.customer_id);
                              setSelectedInvoiceDetails({
                                wholesale_invoice_id: inv.wholesale_invoice_id,
                                invoice_number: inv.invoice_number,
                                customer_id: inv.customer_id,
                                customer_name: inv.customer_name,
                                contact_person: cust?.contact_person || inv.customer_name,
                                phone: cust?.phone || "N/A",
                                city: cust?.city || "General",
                                current_balance_paisa: cust?.current_balance_paisa || inv.balance_due_paisa,
                                invoice_date: inv.invoice_date,
                                order_source: inv.order_source,
                                salesperson_name: inv.salesperson_name,
                                subtotal_paisa: inv.net_total_paisa,
                                discount_paisa: 0,
                                net_total_paisa: inv.net_total_paisa,
                                paid_amount_paisa: inv.paid_amount_paisa,
                                balance_due_paisa: inv.balance_due_paisa,
                                payment_status: inv.payment_status,
                                is_voided: false,
                                items: [],
                                payments: [],
                              });
                            }}
                            className="text-xs h-8 gap-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 cursor-pointer font-medium"
                            title="View complete invoice details and recovery payment history"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-500" />
                            <span>Details</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              const cust = customers.find((c) => c.customer_id === inv.customer_id);
                              try {
                                const details = await getWholesaleInvoiceDetails(inv.wholesale_invoice_id);
                                if (details && details.items.length > 0) {
                                  printA4WholesaleInvoice({
                                    invoice_number: details.invoice_number,
                                    invoice_date: formatLocalDateTime(details.invoice_date),
                                    order_source: details.order_source,
                                    customer_name: details.customer_name,
                                    contact_person: details.contact_person,
                                    city: details.city,
                                    phone: details.phone,
                                    items: details.items.map((it) => ({
                                      name: it.name,
                                      item_type: it.item_type,
                                      quantity: it.quantity,
                                      unit_price_paisa: it.unit_price_paisa,
                                      line_total_paisa: it.line_total_paisa,
                                    })),
                                    subtotal_paisa: details.subtotal_paisa,
                                    discount_paisa: details.discount_paisa,
                                    net_total_paisa: details.net_total_paisa,
                                    paid_amount_paisa: details.paid_amount_paisa,
                                    balance_due_paisa: details.balance_due_paisa,
                                    payment_method: details.payments.length > 0 ? details.payments[0].payment_method : "DIRECT",
                                  });
                                  return;
                                }
                              } catch (e) {
                                console.error("Error loading invoice for A4 print:", e);
                              }
                              printA4WholesaleInvoice({
                                invoice_number: inv.invoice_number,
                                invoice_date: formatLocalDateTime(inv.invoice_date || new Date().toISOString()),
                                order_source: inv.order_source || "B2B Wholesale",
                                customer_name: inv.customer_name,
                                contact_person: cust?.contact_person || inv.customer_name,
                                city: cust?.city || "General",
                                phone: cust?.phone || "0300-0000000",
                                items: [
                                  {
                                    name: "B2B Commercial Fragrance Order",
                                    item_type: "WHOLESALE",
                                    quantity: 1,
                                    unit_price_paisa: (inv as any).subtotal_paisa || inv.net_total_paisa,
                                    line_total_paisa: (inv as any).subtotal_paisa || inv.net_total_paisa,
                                  },
                                ],
                                subtotal_paisa: (inv as any).subtotal_paisa || inv.net_total_paisa,
                                discount_paisa: (inv as any).discount_paisa || 0,
                                net_total_paisa: inv.net_total_paisa,
                                paid_amount_paisa: inv.paid_amount_paisa,
                                balance_due_paisa: inv.balance_due_paisa,
                                payment_method: inv.paid_amount_paisa > 0 ? "DIRECT" : undefined,
                              });
                            }}
                            className="text-xs h-8 gap-1 border-amber-500/40 hover:bg-amber-500/10 text-amber-700 dark:text-amber-400"
                            title="Print Official A4 B2B Wholesale Invoice"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Print A4</span>
                          </Button>
                          {hasBalance && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const cust = customers.find((c) => c.customer_id === inv.customer_id);
                                if (cust) {
                                  setSelectedCustomerForPayment(cust);
                                  setPaymentInvoiceId(inv.wholesale_invoice_id);
                                  setPaymentAmountRupees((inv.balance_due_paisa / 100).toString());
                                  setPaymentModalOpen(true);
                                }
                              }}
                              className="text-xs h-8"
                            >
                              Receive Payment
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 2: CUSTOMERS & LEDGERS */}
      {activeTab === "CUSTOMERS" && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-card/60 border border-border/50 rounded-xl">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-500" />
                Wholesale Clients & Receivables Directory
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manage commercial fragrance accounts, track balances, record invoice payments, and inspect statements.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search client, contact, phone, city..."
                  value={clientSearchQuery}
                  onChange={(e) => setClientSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                />
              </div>
              <select
                value={clientBalanceFilter}
                onChange={(e) => setClientBalanceFilter(e.target.value as any)}
                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
              >
                <option value="ALL">All Clients ({customers.length})</option>
                <option value="HAS_BALANCE">Has Balance ({customers.filter((c) => c.current_balance_paisa > 0).length})</option>
                <option value="CLEARED">Cleared / Zero ({customers.filter((c) => c.current_balance_paisa <= 0).length})</option>
              </select>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsAddCustomerModalOpen(true)}
                className="gap-1.5 text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Wholesale Client</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCustomers.length === 0 ? (
            <div className="col-span-full p-12 text-center text-muted-foreground border border-dashed border-border/60 rounded-2xl">
              {customers.length === 0 ? "No wholesale clients registered yet." : "No wholesale clients match your search criteria."}
            </div>
          ) : (
            filteredCustomers.map((cust) => {
            return (
              <Card
                key={cust.customer_id}
                className="p-5 border-border/50 bg-card/60 backdrop-blur space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-base text-foreground">
                        {cust.business_name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {cust.contact_person} • {cust.city}
                      </p>
                    </div>
                    <Badge variant="gold" className="text-xs">
                      {cust.city}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="w-3.5 h-3.5 text-amber-500" />
                    <span>{cust.phone}</span>
                  </div>

                  <div className="pt-2 border-t border-border/30 text-xs">
                    <div className="p-2.5 bg-muted/20 rounded-lg flex items-center justify-between">
                      <span className="text-muted-foreground block text-[11px] font-semibold">Outstanding Due:</span>
                      <span className="font-mono text-sm font-bold text-amber-600 dark:text-amber-400">
                        {formatPaisaToRupees(cust.current_balance_paisa)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-border/40 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openLedgerStatement(cust)}
                      className="text-xs flex-1"
                    >
                      Statement Ledger
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setSelectedCustomerForPayment(cust);
                        setPaymentInvoiceId("");
                        setPaymentAmountRupees(
                          cust.current_balance_paisa > 0
                            ? (cust.current_balance_paisa / 100).toString()
                            : ""
                        );
                        setPaymentModalOpen(true);
                      }}
                      className="text-xs flex-1"
                    >
                      Collect Payment
                    </Button>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-border/20 text-xs">
                    <button
                      type="button"
                      onClick={() => handleStartEditCustomer(cust)}
                      className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 flex items-center gap-1 font-semibold cursor-pointer"
                      title="Edit this wholesale client details"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Client</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomer(cust)}
                      className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 flex items-center gap-1 font-semibold cursor-pointer"
                      title="Archive or delete this wholesale client"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Client</span>
                    </button>
                  </div>
                </div>
              </Card>
            );
          }))}
        </div>
        </div>
      )}

      {/* TAB 3: NEW WHOLESALE INVOICE FORM */}
      {activeTab === "NEW_INVOICE" && (
        <Card className="p-6 border-border/50 bg-card/60 backdrop-blur space-y-6">
          <div className="border-b border-border/40 pb-4">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-500" />
              Generate B2B Wholesale Invoice
            </h2>
            <p className="text-xs text-muted-foreground">
              Inventory deduction, client-specific negotiated pricing, and real-time ledger accounting
            </p>
          </div>

          <form onSubmit={handleCreateInvoice} className="space-y-6">
            {/* Top Customer / Salesperson Controls */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-muted-foreground block">
                    Wholesale Buyer *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddCustomerModalOpen(true)}
                    className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-semibold cursor-pointer"
                  >
                    + Register New Buyer
                  </button>
                </div>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full bg-input border border-border/50 rounded-lg p-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                  required
                >
                  {customers.map((c) => (
                    <option key={c.customer_id} value={c.customer_id}>
                      {c.business_name} ({c.city})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Order Channel *
                </label>
                <select
                  value={orderSource}
                  onChange={(e) => setOrderSource(e.target.value as any)}
                  className="w-full bg-input border border-border/50 rounded-lg p-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="WHATSAPP">WhatsApp B2B Order</option>
                  <option value="DIRECT">Direct Showroom Visit</option>
                  <option value="PHONE">Telephone Confirmation</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Invoice Number *
                </label>
                <Input
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Line Items Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  B2B Line Items & Negotiated Pricing
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLine}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Product
                </Button>
              </div>

              <div className="border border-border/40 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 uppercase font-medium text-muted-foreground border-b border-border/40">
                    <tr>
                      <th className="p-3 w-1/2">Finished Perfume Product</th>
                      <th className="p-3 text-center">Stock</th>
                      <th className="p-3 text-center w-28">Units</th>
                      <th className="p-3 text-right w-36">Agreed Price (Rs.)</th>
                      <th className="p-3 text-right">Line Total</th>
                      <th className="p-3 text-center w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {invoiceLines.map((line, idx) => {
                      const prod = line.item_type === "PERFUME" ? products.find((p) => p.product_id === line.item_id) : null;
                      const att = line.item_type === "ATTAR" ? attars.find((a) => a.attar_id === line.item_id) : null;
                      const qty = parseInt(line.quantity) || 0;
                      const price = parseFloat(line.agreed_price_rupees) || 0;
                      const lineTotal = qty * price;
                      const isLowStock = prod && prod.current_stock_units < qty;

                      return (
                        <tr key={idx} className="hover:bg-muted/10">
                          <td className="p-3">
                            <select
                              value={line.item_id ? `${line.item_type}:${line.item_id}` : ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (!val) {
                                  handleItemSelection(idx, "PERFUME", "");
                                  return;
                                }
                                const [type, id] = val.split(":");
                                handleItemSelection(idx, type as "PERFUME" | "ATTAR", id);
                              }}
                              className="w-full bg-input border border-border/50 rounded-lg p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                              required
                            >
                              <option value="">Select Fragrance (Perfume or Attar Oil)...</option>
                              <optgroup label="Luxury Finished Perfumes">
                                {products.map((p) => (
                                  <option key={`PERFUME:${p.product_id}`} value={`PERFUME:${p.product_id}`}>
                                    {p.name} ({p.size_ml}ml - {p.sku}) • Stock: {p.current_stock_units} • Base Whs: Rs. {Math.round(p.wholesale_price_paisa / 100).toLocaleString()}
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="💧 Pure Artisan Attar Oils">
                                {attars.map((a) => (
                                  <option key={`ATTAR:${a.attar_id}`} value={`ATTAR:${a.attar_id}`}>
                                    {a.name} ({a.sku}) • Rate/Tola: Rs. {Math.round(a.selling_price_per_tola_paisa / 100).toLocaleString()}
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                          </td>
                          <td className="p-3 text-center font-mono">
                            {prod ? (
                              <span className={isLowStock ? "text-rose-400 font-bold" : "text-emerald-400"}>
                                {prod.current_stock_units}
                              </span>
                            ) : att ? (
                              <span className="text-amber-400 font-semibold text-xs">Attar Bar</span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="p-3">
                            <Input
                              type="number"
                              min="1"
                              value={line.quantity}
                              onChange={(e) => {
                                const up = [...invoiceLines];
                                up[idx].quantity = e.target.value;
                                setInvoiceLines(up);
                              }}
                              className="text-center font-mono"
                              required
                            />
                          </td>
                          <td className="p-3">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.agreed_price_rupees}
                              onChange={(e) => {
                                const up = [...invoiceLines];
                                up[idx].agreed_price_rupees = e.target.value;
                                setInvoiceLines(up);
                              }}
                              className="text-right font-mono"
                              required
                            />
                          </td>
                          <td className="p-3 text-right font-mono font-semibold text-foreground">
                            Rs. {Math.round(lineTotal).toLocaleString()}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => removeLine(idx)}
                              className="text-muted-foreground hover:text-rose-400 transition-colors"
                              disabled={invoiceLines.length === 1}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Calculations & Upfront Settlement */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/40">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Order Delivery & Wholesale Notes
                  </label>
                  <textarea
                    value={invoiceNotes}
                    onChange={(e) => setInvoiceNotes(e.target.value)}
                    placeholder="e.g. Dispatched via Daewoo Cargo to Lahore showroom. Tracking #109823."
                    rows={3}
                    className="w-full bg-input border border-border/50 rounded-lg p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">
                      Upfront Payment (Rs.)
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={upfrontPaidRupees}
                      onChange={(e) => setUpfrontPaidRupees(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">
                      Payment Channel
                    </label>
                    <select
                      value={upfrontPaymentMethod}
                      onChange={(e) => setUpfrontPaymentMethod(e.target.value as any)}
                      className="w-full bg-input border border-border/50 rounded-lg p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="CASH">Cash in Hand</option>
                      <option value="EASYPAISA">EasyPaisa</option>
                      <option value="JAZZCASH">JazzCash</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Invoice Summary Box */}
              <div className="p-5 bg-muted/20 border border-border/40 rounded-xl space-y-3">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Subtotal Amount:</span>
                  <span className="font-mono text-foreground font-semibold">
                    {formatPaisaToRupees(invoiceSubtotalPaisa)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Trade Discount (Rs.):</span>
                  <div className="w-32">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={discountRupees}
                      onChange={(e) => setDiscountRupees(e.target.value)}
                      placeholder="0.00"
                      className="text-right h-8 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-between text-sm font-semibold border-t border-border/30 pt-2 text-foreground">
                  <span>Net Wholesale Total:</span>
                  <span className="font-mono text-base text-amber-600 dark:text-amber-400">
                    {formatPaisaToRupees(invoiceNetTotalPaisa)}
                  </span>
                </div>

                <div className="flex justify-between text-xs text-emerald-400">
                  <span>Paid Upfront:</span>
                  <span className="font-mono">
                    {formatPaisaToRupees(invoicePaidPaisa)}
                  </span>
                </div>

                <div className="flex justify-between text-sm font-bold border-t border-border/30 pt-2 text-foreground">
                  <span>Balance Added to Customer Ledger:</span>
                  <span className="font-mono text-base text-amber-600 dark:text-amber-400">
                    {formatPaisaToRupees(invoiceBalanceDuePaisa)}
                  </span>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full mt-3"
                  disabled={isSubmitting || isCreditExceeded}
                >
                  {isSubmitting ? "Generating..." : "Confirm & Post Wholesale Invoice"}
                </Button>
              </div>
            </div>
          </form>
        </Card>
      )}

      {/* DRAWER: CUSTOMER STATEMENT LEDGER */}
      {selectedCustomerForLedger && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] p-6 bg-card border-border/60 shadow-2xl flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  Statement Ledger: {selectedCustomerForLedger.business_name}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {selectedCustomerForLedger.contact_person} • {selectedCustomerForLedger.city} • Phone: {selectedCustomerForLedger.phone}
                </p>
              </div>
              <button
                onClick={() => setSelectedCustomerForLedger(null)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            {/* Current Balance Summary */}
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-muted/30 rounded-lg">
                <span className="text-muted-foreground block">Credit Limit</span>
                <span className="font-mono text-base font-semibold text-foreground">
                  {selectedCustomerForLedger.credit_limit_paisa > 0
                    ? formatPaisaToRupees(selectedCustomerForLedger.credit_limit_paisa)
                    : "Unlimited"}
                </span>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <span className="text-muted-foreground block">Current Balance Due</span>
                <span className="font-mono text-base font-bold text-amber-600 dark:text-amber-400">
                  {formatPaisaToRupees(selectedCustomerForLedger.current_balance_paisa)}
                </span>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <span className="text-muted-foreground block">Available Credit</span>
                <span className="font-mono text-base font-semibold text-emerald-400">
                  {selectedCustomerForLedger.credit_limit_paisa > 0
                    ? formatPaisaToRupees(
                        Math.max(
                          0,
                          selectedCustomerForLedger.credit_limit_paisa -
                            selectedCustomerForLedger.current_balance_paisa
                        )
                      )
                    : "Unlimited"}
                </span>
              </div>
            </div>

            {/* Statement Table */}
            <div className="flex-1 overflow-y-auto border border-border/40 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 uppercase font-medium text-muted-foreground border-b border-border/40 sticky top-0">
                  <tr>
                    <th className="p-2.5">Date & Time</th>
                    <th className="p-2.5">Transaction Type</th>
                    <th className="p-2.5">Reference</th>
                    <th className="p-2.5 text-right">Debit (+)</th>
                    <th className="p-2.5 text-right">Credit (-)</th>
                    <th className="p-2.5 text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {isLedgerLoading ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-muted-foreground">
                        Loading statement records...
                      </td>
                    </tr>
                  ) : ledgerEntries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-muted-foreground">
                        No transactions recorded in ledger yet.
                      </td>
                    </tr>
                  ) : (
                    ledgerEntries.map((entry) => (
                      <tr key={entry.ledger_entry_id} className="hover:bg-muted/10">
                        <td className="p-2.5 font-mono text-muted-foreground">
                          {formatLocalDateTime(entry.transaction_timestamp)}
                        </td>
                        <td className="p-2.5 font-medium text-foreground">
                          {entry.transaction_type}
                        </td>
                        <td className="p-2.5 font-mono text-xs text-muted-foreground">
                          {entry.reference_id}
                        </td>
                        <td className="p-2.5 text-right font-mono text-amber-600 dark:text-amber-400">
                          {entry.debit_paisa > 0 ? formatPaisaToRupees(entry.debit_paisa) : "—"}
                        </td>
                        <td className="p-2.5 text-right font-mono text-emerald-400">
                          {entry.credit_paisa > 0 ? formatPaisaToRupees(entry.credit_paisa) : "—"}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-foreground">
                          {formatPaisaToRupees(entry.running_balance_paisa)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2 border-t border-border/40">
              <Button
                variant="outline"
                onClick={() => setSelectedCustomerForLedger(null)}
              >
                Close Statement
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: COLLECT ACCOUNT PAYMENT */}
      {paymentModalOpen && selectedCustomerForPayment && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 bg-card border-border/60 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    Record Customer Payment
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {selectedCustomerForPayment.business_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPaymentModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="p-3 bg-muted/20 rounded-lg text-xs flex justify-between items-center border border-border/30">
                <span className="text-muted-foreground">Current Balance Due:</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">
                  {formatPaisaToRupees(selectedCustomerForPayment.current_balance_paisa)}
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Target Invoice (Specific Invoice or Auto-FIFO)
                </label>
                <select
                  value={paymentInvoiceId}
                  onChange={(e) => setPaymentInvoiceId(e.target.value)}
                  className="w-full bg-input border border-border/50 rounded-lg p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                >
                  <option value="">⚡ Automatic FIFO (Oldest unpaid invoices cleared first)</option>
                  {invoices
                    .filter((inv) => inv.customer_id === selectedCustomerForPayment.customer_id && inv.payment_status !== "PAID")
                    .map((inv) => (
                      <option key={inv.wholesale_invoice_id} value={inv.wholesale_invoice_id}>
                        {inv.invoice_number} — Due: {formatPaisaToRupees(inv.balance_due_paisa)} ({inv.payment_status})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Payment Amount Received (Rs.) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={paymentAmountRupees}
                  onChange={(e) => setPaymentAmountRupees(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Settlement Method *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full bg-input border border-border/50 rounded-lg p-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="CASH">Cash in Hand</option>
                  <option value="EASYPAISA">EasyPaisa</option>
                  <option value="JAZZCASH">JazzCash</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Transaction Reference / TID (Optional)
                </label>
                <Input
                  value={paymentRefNumber}
                  onChange={(e) => setPaymentRefNumber(e.target.value)}
                  placeholder="e.g. EasyPaisa / JazzCash TID or Cash Voucher #"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Payment Notes
                </label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. Cleared via Meezan Bank main corporate account"
                  rows={2}
                  className="w-full bg-input border border-border/50 rounded-lg p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPaymentModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={isSubmitting}>
                  {isSubmitting ? "Processing..." : "Confirm & Credit Account"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: ADD NEW WHOLESALE CUSTOMER */}
      {isAddCustomerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-6 bg-card border-border/60 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    Register New Wholesale Client
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Add new shop or business client profile to directory
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddCustomerModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Business / Shop Name *
                  </label>
                  <Input
                    value={newCustBusiness}
                    onChange={(e) => setNewCustBusiness(e.target.value)}
                    placeholder="e.g. Al-Madina Luxury Attars"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Contact Person Name
                  </label>
                  <Input
                    value={newCustContact}
                    onChange={(e) => setNewCustContact(e.target.value)}
                    placeholder="e.g. Bilal Ahmed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Phone / WhatsApp *
                  </label>
                  <Input
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    placeholder="e.g. 0300-0000000"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    City *
                  </label>
                  <Input
                    value={newCustCity}
                    onChange={(e) => setNewCustCity(e.target.value)}
                    placeholder="e.g. Bannu"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddCustomerModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create Wholesale Client"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: EDIT WHOLESALE CUSTOMER */}
      {isEditCustomerModalOpen && editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <Card className="w-full max-w-lg p-6 bg-card border-border shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-500" />
                Edit Wholesale Client Profile
              </h3>
              <button
                onClick={() => {
                  setIsEditCustomerModalOpen(false);
                  setEditingCustomer(null);
                }}
                className="text-muted-foreground hover:text-foreground text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCustomerEdit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Business / Shop Name *
                </label>
                <Input
                  value={editCustBusiness}
                  onChange={(e) => setEditCustBusiness(e.target.value)}
                  placeholder="e.g. Al-Madina Fragrance Center"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Contact Person Name *
                  </label>
                  <Input
                    value={editCustContact}
                    onChange={(e) => setEditCustContact(e.target.value)}
                    placeholder="e.g. Haji Muhammad Tariq"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Phone / WhatsApp *
                  </label>
                  <Input
                    value={editCustPhone}
                    onChange={(e) => setEditCustPhone(e.target.value)}
                    placeholder="e.g. 0300-0000000"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  City *
                </label>
                <Input
                  value={editCustCity}
                  onChange={(e) => setEditCustCity(e.target.value)}
                  placeholder="e.g. Bannu"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditCustomerModalOpen(false);
                    setEditingCustomer(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
      {/* Register Staff Modal */}
      {isAddStaffModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md p-6 bg-card border-border/80 shadow-2xl">
            <h3 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-500" />
              <span>Register Sales Floor Staff</span>
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Add a new staff member to attribute wholesale or retail counter orders.
            </p>
            <form onSubmit={handleCreateStaff} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Full Name *
                </label>
                <Input
                  required
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  placeholder="e.g. Tariq Mehmood"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Employee Code
                  </label>
                  <Input
                    value={newStaffCode}
                    onChange={(e) => setNewStaffCode(e.target.value)}
                    placeholder={`EMP-${100 + salespersons.length + 1}`}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Phone
                  </label>
                  <Input
                    value={newStaffPhone}
                    onChange={(e) => setNewStaffPhone(e.target.value)}
                    placeholder="0300-1234567"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddStaffModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={isStaffSaving}>
                  {isStaffSaving ? "Saving..." : "Save Staff"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Official Wholesale Invoice Details & Payment History Modal */}
      {selectedInvoiceDetails && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
          <Card className="w-full max-w-4xl max-h-[94vh] flex flex-col bg-white dark:bg-slate-900 border-border/80 shadow-2xl overflow-hidden rounded-2xl">
            {/* Modal Top Bar */}
            <div className="flex items-center justify-between p-4 border-b border-border/60 bg-slate-50 dark:bg-slate-800/90 shrink-0">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Wholesale Invoice Details & Payment Breakdown</span>
                    <Badge variant="gold" className="font-mono text-xs">
                      #{selectedInvoiceDetails.invoice_number}
                    </Badge>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        selectedInvoiceDetails.balance_due_paisa <= 0
                          ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                          : selectedInvoiceDetails.paid_amount_paisa > 0
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                          : "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                      }`}
                    >
                      {selectedInvoiceDetails.balance_due_paisa <= 0
                        ? "PAID IN FULL"
                        : selectedInvoiceDetails.paid_amount_paisa > 0
                        ? "PARTIALLY PAID"
                        : "UNPAID"}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Complete transaction breakdown: purchased stock, dispatch timestamp, cash paid upfront, and follow-up recoveries.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    printA4WholesaleInvoice({
                      invoice_number: selectedInvoiceDetails.invoice_number,
                      invoice_date: formatLocalDateTime(selectedInvoiceDetails.invoice_date),
                      order_source: selectedInvoiceDetails.order_source,
                      customer_name: selectedInvoiceDetails.customer_name,
                      contact_person: selectedInvoiceDetails.contact_person,
                      city: selectedInvoiceDetails.city,
                      phone: selectedInvoiceDetails.phone,
                      items: selectedInvoiceDetails.items.map((it) => ({
                        name: it.name,
                        item_type: it.item_type,
                        quantity: it.quantity,
                        unit_price_paisa: it.unit_price_paisa,
                        line_total_paisa: it.line_total_paisa,
                      })),
                      subtotal_paisa: selectedInvoiceDetails.subtotal_paisa,
                      discount_paisa: selectedInvoiceDetails.discount_paisa,
                      net_total_paisa: selectedInvoiceDetails.net_total_paisa,
                      paid_amount_paisa: selectedInvoiceDetails.paid_amount_paisa,
                      balance_due_paisa: selectedInvoiceDetails.balance_due_paisa,
                      payment_method: selectedInvoiceDetails.payments.length > 0 ? selectedInvoiceDetails.payments[0].payment_method : "DIRECT",
                    });
                  }}
                  className="gap-2 bg-gradient-to-r from-amber-500 to-amber-600 font-bold shadow-md cursor-pointer text-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print A4</span>
                </Button>
                {selectedInvoiceDetails.balance_due_paisa > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const cust = customers.find((c) => c.customer_id === selectedInvoiceDetails.customer_id);
                      if (cust) {
                        setSelectedCustomerForPayment(cust);
                        setPaymentInvoiceId(selectedInvoiceDetails.wholesale_invoice_id);
                        setPaymentAmountRupees((selectedInvoiceDetails.balance_due_paisa / 100).toString());
                        setPaymentModalOpen(true);
                      }
                    }}
                    className="gap-1.5 text-xs border-amber-500/40 text-amber-700 dark:text-amber-400 font-semibold"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Receive Payment</span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedInvoiceDetails(null)}
                  className="cursor-pointer"
                >
                  Close
                </Button>
              </div>
            </div>

            {/* Modal Scrollable Content */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
              {/* Buyer & Order Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Billed To Wholesale Client:
                  </span>
                  <div className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {selectedInvoiceDetails.customer_name}
                  </div>
                  {selectedInvoiceDetails.contact_person && (
                    <div className="text-slate-600 dark:text-slate-400 mt-0.5">
                      Contact Person: <strong className="text-slate-800 dark:text-slate-200">{selectedInvoiceDetails.contact_person}</strong>
                    </div>
                  )}
                  <div className="text-slate-600 dark:text-slate-400 mt-0.5">
                    Phone / Mobile: <span className="font-mono font-semibold">{selectedInvoiceDetails.phone}</span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 mt-0.5">
                    City / Station: <span>{selectedInvoiceDetails.city}</span>
                  </div>
                </div>

                <div className="md:text-right space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Order Timestamp & Sales Rep:
                  </span>
                  <div className="text-slate-700 dark:text-slate-300">
                    Dispatch Date: <strong className="font-mono text-slate-900 dark:text-slate-100">{formatLocalDateTime(selectedInvoiceDetails.invoice_date)}</strong>
                  </div>
                  <div className="text-slate-700 dark:text-slate-300">
                    Salesperson: <strong className="text-amber-700 dark:text-amber-400">{selectedInvoiceDetails.salesperson_name}</strong>
                  </div>
                  <div className="text-slate-700 dark:text-slate-300">
                    Order Channel: <Badge variant="neutral" className="text-[10px]">{selectedInvoiceDetails.order_source}</Badge>
                  </div>
                </div>
              </div>

              {/* Stock Items Purchased */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-500" />
                  <span>Purchased Fragrance Stock & Quantities</span>
                </h4>
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 font-bold text-slate-700 dark:text-slate-300">
                      <tr>
                        <th className="p-2.5 text-center w-10">#</th>
                        <th className="p-2.5 text-left">Product Description</th>
                        <th className="p-2.5 text-center w-24">Type</th>
                        <th className="p-2.5 text-center w-20">Quantity</th>
                        <th className="p-2.5 text-right w-28">Rate (PKR)</th>
                        <th className="p-2.5 text-right w-32">Line Total (PKR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {selectedInvoiceDetails.items.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-slate-400 italic">
                            No individual line item details recorded.
                          </td>
                        </tr>
                      ) : (
                        selectedInvoiceDetails.items.map((it, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                            <td className="p-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                            <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100">
                              {it.name} {it.size_ml ? `(${it.size_ml}ml)` : ""}
                            </td>
                            <td className="p-2.5 text-center">
                              <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-semibold">
                                {it.item_type}
                              </span>
                            </td>
                            <td className="p-2.5 text-center font-bold text-slate-900 dark:text-slate-100">
                              {it.quantity}
                            </td>
                            <td className="p-2.5 text-right font-mono text-slate-700 dark:text-slate-300">
                              Rs. {(it.unit_price_paisa / 100).toLocaleString()}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                              Rs. {(it.line_total_paisa / 100).toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Order Financial Calculation Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] font-semibold text-slate-500">Order Subtotal</div>
                  <div className="text-sm font-bold font-mono mt-1 text-slate-900 dark:text-slate-100">
                    Rs. {(selectedInvoiceDetails.subtotal_paisa / 100).toLocaleString()}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] font-semibold text-slate-500">Trade Discount</div>
                  <div className="text-sm font-bold font-mono mt-1 text-rose-600">
                    -Rs. {(selectedInvoiceDetails.discount_paisa / 100).toLocaleString()}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <div className="text-[10px] font-bold text-amber-700 dark:text-amber-400">Net Invoice Total</div>
                  <div className="text-sm font-black font-mono mt-1 text-amber-800 dark:text-amber-300">
                    Rs. {(selectedInvoiceDetails.net_total_paisa / 100).toLocaleString()}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">Total Paid (Wasool)</div>
                  <div className="text-sm font-bold font-mono mt-1 text-emerald-800 dark:text-emerald-300">
                    Rs. {(selectedInvoiceDetails.paid_amount_paisa / 100).toLocaleString()}
                  </div>
                </div>
                <div className={`p-3 rounded-xl border ${
                  selectedInvoiceDetails.balance_due_paisa <= 0
                    ? "bg-emerald-500/10 border-emerald-500/20"
                    : "bg-rose-500/10 border-rose-500/20"
                }`}>
                  <div className={`text-[10px] font-bold ${
                    selectedInvoiceDetails.balance_due_paisa <= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
                  }`}>
                    {selectedInvoiceDetails.balance_due_paisa <= 0 ? "Balance Cleared" : "Balance Due"}
                  </div>
                  <div className={`text-sm font-black font-mono mt-1 ${
                    selectedInvoiceDetails.balance_due_paisa <= 0 ? "text-emerald-800 dark:text-emerald-300" : "text-rose-700 dark:text-rose-400"
                  }`}>
                    Rs. {(selectedInvoiceDetails.balance_due_paisa / 100).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Subsequent Recovery Payments Log */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Payment History & Subsequent Recoveries</span>
                </h4>
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 font-bold text-slate-700 dark:text-slate-300">
                      <tr>
                        <th className="p-2.5 text-left">Payment Date & Time</th>
                        <th className="p-2.5 text-center w-28">Method</th>
                        <th className="p-2.5 text-right w-32">Amount Paid (PKR)</th>
                        <th className="p-2.5 text-left w-36">Reference #</th>
                        <th className="p-2.5 text-left w-36">Received By</th>
                        <th className="p-2.5 text-left">Notes / Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {selectedInvoiceDetails.payments.length === 0 ? (
                        selectedInvoiceDetails.paid_amount_paisa > 0 ? (
                          <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 bg-emerald-500/5">
                            <td className="p-2.5 font-mono text-slate-800 dark:text-slate-200">
                              {formatLocalDateTime(selectedInvoiceDetails.invoice_date)}
                            </td>
                            <td className="p-2.5 text-center">
                              <Badge variant="gold" className="text-[10px]">
                                UPFRONT PAYMENT
                              </Badge>
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              Rs. {(selectedInvoiceDetails.paid_amount_paisa / 100).toLocaleString()}
                            </td>
                            <td className="p-2.5 font-mono text-slate-500">
                              {selectedInvoiceDetails.invoice_number}
                            </td>
                            <td className="p-2.5 text-slate-700 dark:text-slate-300">
                              {selectedInvoiceDetails.salesperson_name || "Sales Desk"}
                            </td>
                            <td className="p-2.5 text-slate-500 dark:text-slate-400 text-xs">
                              Initial upfront deposit received at invoice creation
                            </td>
                          </tr>
                        ) : (
                          <tr>
                            <td colSpan={6} className="p-4 text-center text-slate-400 italic">
                              No payments recorded yet for this invoice (Full Credit / Pending).
                            </td>
                          </tr>
                        )
                      ) : (
                        selectedInvoiceDetails.payments.map((p, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                            <td className="p-2.5 font-mono text-slate-800 dark:text-slate-200">
                              {formatLocalDateTime(p.payment_date)}
                            </td>
                            <td className="p-2.5 text-center">
                              <Badge variant="gold" className="text-[10px]">
                                {p.payment_method}
                              </Badge>
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              Rs. {(p.amount_paid_paisa / 100).toLocaleString()}
                            </td>
                            <td className="p-2.5 font-mono text-slate-500">
                              {p.reference_number || "-"}
                            </td>
                            <td className="p-2.5 text-slate-700 dark:text-slate-300">
                              {p.received_by}
                            </td>
                            <td className="p-2.5 text-slate-500 dark:text-slate-400">
                              {p.notes || "-"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

    </div>
  );
};
