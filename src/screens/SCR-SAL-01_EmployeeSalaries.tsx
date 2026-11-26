import React, { useState, useEffect } from "react";
import { SystemUser, WorkstationStatus } from "@/types/system";
import { EmployeeSalaryPayout, RecordSalaryPayoutPayload } from "@/types/database";
import {
  getEmployeeSalaryPayouts,
  recordEmployeeSalaryPayout,
  getAllSalespersons,
  getAllUsers,
  getExecutiveDashboard,
} from "@/lib/tauri-bridge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dialog } from "@/components/ui/Dialog";
import { exportSalariesToCSV } from "@/lib/export-utils";
import { getPKTDate, getPKTTime, parseDateToPKT, isDateInPKTPeriod } from "@/lib/date-utils";
import {
  Banknote,
  Smartphone,
  Plus,
  RefreshCw,
  Search,
  Printer,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  ShieldCheck,
  BadgeDollarSign,
  Check,
  Wallet,
  Download,
} from "lucide-react";

interface EmployeeSalariesProps {
  currentUser: SystemUser | null;
  status: WorkstationStatus;
}

export const EmployeeSalaries: React.FC<EmployeeSalariesProps> = ({ currentUser }) => {
  const [payouts, setPayouts] = useState<EmployeeSalaryPayout[]>([]);
  const [staffList, setStaffList] = useState<{ id: string; name: string; role: string; code?: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [payoutType, setPayoutType] = useState<"DAILY_WAGE" | "WEEKLY_PAYOUT" | "MONTHLY_SALARY" | "ADVANCE_PAYMENT" | "COMMISSION">("DAILY_WAGE");
  const [amountRupees, setAmountRupees] = useState("");
  const [payoutDate, setPayoutDate] = useState(() => getPKTDate());
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Voucher Print Modal
  const [selectedPayoutForSlip, setSelectedPayoutForSlip] = useState<EmployeeSalaryPayout | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [periodFilter, setPeriodFilter] = useState<"TODAY" | "WEEK" | "MONTH" | "ALL">("ALL");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterMethod, setFilterMethod] = useState<string>("ALL");
  const [authorizedByName, setAuthorizedByName] = useState("Owner ( Ameer )");

  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Live Treasury Balances for Payout Validation
  const [treasuryBalances, setTreasuryBalances] = useState<{
    cash: number;
    easypaisa: number;
    jazzcash: number;
    netAvailable: number;
  }>({ cash: 0, easypaisa: 0, jazzcash: 0, netAvailable: 0 });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [payoutsData, sps, usrs, dash] = await Promise.all([
        getEmployeeSalaryPayouts(),
        getAllSalespersons(),
        getAllUsers(),
        getExecutiveDashboard("today").catch(() => null),
      ]);

      setPayouts(payoutsData);

      if (dash) {
        setTreasuryBalances({
          cash: dash.all_time_cash_drawer_paisa ?? dash.total_cash_received_paisa ?? dash.cash_in_drawer_paisa ?? 0,
          easypaisa: dash.all_time_easypaisa_paisa ?? dash.total_easypaisa_received_paisa ?? 0,
          jazzcash: dash.all_time_jazzcash_paisa ?? dash.total_jazzcash_received_paisa ?? 0,
          netAvailable: dash.net_available_treasury_paisa ?? (
            (dash.all_time_cash_drawer_paisa ?? 0) +
            (dash.all_time_easypaisa_paisa ?? 0) +
            (dash.all_time_jazzcash_paisa ?? 0)
          ),
        });
      }

      // Combine salespersons and cashier/manager users into staff list
      const combined: { id: string; name: string; role: string; code?: string }[] = [];
      sps.forEach((sp) => {
        combined.push({
          id: sp.salesperson_id,
          name: sp.full_name,
          role: "Floor Salesperson",
          code: sp.employee_code,
        });
      });
      usrs.forEach((u) => {
        if (!combined.some((c) => c.name.toLowerCase() === u.full_name.toLowerCase())) {
          combined.push({
            id: u.user_id,
            name: u.full_name,
            role: u.role === "CASHIER_OPERATOR" ? "Counter Cashier" : u.role === "SHOP_MANAGER" ? "Shop Manager" : "Staff Member",
            code: u.username,
          });
        }
      });

      setStaffList(combined);
      if (combined.length > 0 && !selectedStaffId) {
        setSelectedStaffId(combined[0].id);
      }
    } catch (err) {
      console.error("Failed to load salary payouts:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatPaisa = (paisa: number) => {
    return (paisa / 100).toLocaleString("en-PK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleDisburseSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(amountRupees) || 0;
    const amountPaisa = Math.round(amountNum * 100);

    if (amountPaisa <= 0 || !selectedStaffId) {
      setNotification({
        type: "error",
        message: "Please enter a valid salary payout amount and select an employee.",
      });
      return;
    }

    const netAvailablePaisa = treasuryBalances.netAvailable;

    if (netAvailablePaisa > 0 && amountPaisa > netAvailablePaisa) {
      setNotification({
        type: "error",
        message: `⚠️ Insufficient Treasury Balance: Net Available Treasury is Rs. ${formatPaisa(netAvailablePaisa)}, but payout amount is Rs. ${formatPaisa(amountPaisa)}.`,
      });
      return;
    }

    // Automatically route the disbursement payment method to available funds
    const chosenMethod =
      treasuryBalances.cash >= amountPaisa
        ? "CASH"
        : treasuryBalances.jazzcash >= amountPaisa
        ? "JAZZCASH"
        : treasuryBalances.easypaisa >= amountPaisa
        ? "EASYPAISA"
        : treasuryBalances.cash > 0
        ? "CASH"
        : treasuryBalances.jazzcash > 0
        ? "JAZZCASH"
        : "EASYPAISA";

    const staff = staffList.find((s) => s.id === selectedStaffId);
    const employeeName = staff ? staff.name : "Staff Member";
    const employeeRole = staff ? staff.role : "Staff";

    setIsSubmitting(true);
    try {
      const payload: RecordSalaryPayoutPayload = {
        employee_id: selectedStaffId,
        employee_name: employeeName,
        employee_role: employeeRole,
        payout_type: payoutType,
        amount_paisa: amountPaisa,
        payment_method: chosenMethod,
        disbursed_by_user_id: currentUser?.user_id || "usr_admin",
        disbursed_by_name: authorizedByName.trim() || "Owner ( Ameer )",
        notes: notes.trim() || undefined,
        payout_date: `${payoutDate}T${getPKTTime()}+05:00`,
      };

      const result = await recordEmployeeSalaryPayout(payload);
      setNotification({
        type: "success",
        message: `Salary of Rs. ${formatPaisa(amountPaisa)} successfully disbursed to ${employeeName}!`,
      });
      setIsModalOpen(false);
      setAmountRupees("");
      setPayoutDate(getPKTDate());
      setNotes("");
      loadData();
      window.dispatchEvent(new CustomEvent("app:refresh-data"));
      setSelectedPayoutForSlip(result);
    } catch (err) {
      console.error("Failed to disburse salary:", err);
      setNotification({
        type: "error",
        message: `Failed to record salary payout: ${String(err)}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const printVoucherSlip = (p: EmployeeSalaryPayout) => {
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
            <div style="font-size:12px; font-weight:900; letter-spacing:1px; text-transform:uppercase; text-align:center; color:#000000;">STAFF SALARY VOUCHER</div>
          </div>
          <div style="border-top:1.5px dashed #000000; margin:5px 0;"></div>
          <div style="display:flex; justify-content:space-between; margin:2.5px 0;"><span>Voucher #:</span><span style="font-weight:900; font-family:monospace;">${p.payout_id}</span></div>
          <div style="display:flex; justify-content:space-between; margin:2.5px 0;"><span>Date & Time:</span><span style="font-weight:700;">${new Date(p.payout_date).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}</span></div>
          <div style="display:flex; justify-content:space-between; margin:2.5px 0;"><span>Employee:</span><span style="font-weight:900;">${p.employee_name}</span></div>
          <div style="display:flex; justify-content:space-between; margin:2.5px 0;"><span>Designation:</span><span style="font-weight:700;">${p.employee_role}</span></div>
          <div style="display:flex; justify-content:space-between; margin:2.5px 0;"><span>Payout Type:</span><span style="font-weight:800;">${p.payout_type.replace(/_/g, ' ')}</span></div>
          <div style="display:flex; justify-content:space-between; margin:2.5px 0;"><span>Payment Method:</span><span style="font-weight:800;">${p.payment_method}</span></div>
          <div style="border-top:1.5px dashed #000000; margin:6px 0;"></div>
          <div style="display:flex; justify-content:space-between; align-items:baseline; font-size:14px; font-weight:900; margin:4px 0;">
            <span>AMOUNT PAID:</span>
            <span style="font-family:monospace;">Rs. ${(p.amount_paisa / 100).toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
          </div>
          ${p.notes ? `<div style="font-size:10.5px; margin:4px 0; font-weight:600;"><span>Reason/Notes: </span><i>${p.notes}</i></div>` : ''}
          <div style="border-top:1.5px dashed #000000; margin:6px 0;"></div>
          <div style="display:flex; justify-content:space-between; margin:2.5px 0; font-size:11px;">
            <span style="font-weight:700;">Disbursed & Authorized By:</span>
            <span style="font-weight:900;">${p.disbursed_by_name}</span>
          </div>
          <div style="margin-top:28px; display:flex; justify-content:space-between; font-size:10px; font-weight:700;">
            <div style="text-align:center; border-top:1.5px solid #000; width:45%; padding-top:4px;">Employee Sign</div>
            <div style="text-align:center; border-top:1.5px solid #000; width:45%; padding-top:4px;">Authorized Sign</div>
          </div>
          <div style="border-top:1.5px dashed #000000; margin:8px 0 4px 0;"></div>
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

  // Metrics with strict PKT (Asia/Karachi, UTC+5) Period Filter
  const todayPKT = getPKTDate(new Date());

  const periodFilteredPayouts = payouts.filter((p) =>
    isDateInPKTPeriod(p.payout_date || p.created_at, periodFilter)
  );
  const todayPayouts = payouts.filter(
    (p) => parseDateToPKT(p.payout_date || p.created_at) === todayPKT
  );

  const totalDisbursedPeriod = periodFilteredPayouts.reduce((sum, p) => sum + p.amount_paisa, 0);
  const totalToday = todayPayouts.reduce((sum, p) => sum + p.amount_paisa, 0);
  const totalCashPayouts = periodFilteredPayouts.filter((p) => p.payment_method === "CASH").reduce((sum, p) => sum + p.amount_paisa, 0);
  const totalWalletPayouts = periodFilteredPayouts.filter((p) => p.payment_method !== "CASH").reduce((sum, p) => sum + p.amount_paisa, 0);

  // Filtered List
  const filteredPayouts = periodFilteredPayouts.filter((p) => {
    const matchesQuery =
      searchQuery.trim() === "" ||
      p.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.payout_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.disbursed_by_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = filterType === "ALL" || p.payout_type === filterType;
    const matchesMethod = filterMethod === "ALL" || p.payment_method === filterMethod;

    return matchesQuery && matchesType && matchesMethod;
  });

  return (
    <div className="flex-1 p-6 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col gap-6 select-none overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold font-serif text-slate-900 dark:text-slate-100 tracking-wide flex items-center gap-2">
              <BadgeDollarSign className="w-6 h-6 text-amber-500" />
              <span>Employee Salaries & Wage Disbursals</span>
            </h1>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Disburse daily wages, weekly payouts, monthly salaries, advances, and commission payouts with full authorization auditing
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Period Filter Dropdown (Pic 2) */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="text-xs text-slate-500 font-medium">Period:</span>
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as any)}
              className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today</option>
              <option value="WEEK">Last 7 Days</option>
              <option value="MONTH">This Month</option>
            </select>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setPayoutDate(getPKTDate());
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950"
          >
            <Plus className="w-4 h-4" />
            <span>+ Disburse Salary / Wage</span>
          </Button>
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs animate-in fade-in ${
            notification.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-[11px] underline opacity-80 hover:opacity-100 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-mono">
              {periodFilter === "TODAY" ? "Disbursed Today" : periodFilter === "WEEK" ? "Disbursed (7 Days)" : periodFilter === "MONTH" ? "Disbursed (Month)" : "Total Disbursed"}
            </span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
              <BadgeDollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-400 mt-2">
            Rs. {formatPaisa(totalDisbursedPeriod)}
          </div>
          <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">{periodFilteredPayouts.length} payouts in selected period</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-mono">Disbursed Today</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-2">
            Rs. {formatPaisa(totalToday)}
          </div>
          <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">
            {todayPayouts.length} payouts today
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-mono">Cash Drawer Payouts</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-2">
            Rs. {formatPaisa(totalCashPayouts)}
          </div>
          <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">Physical cash handed out</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-mono">Digital Wallet Payouts</span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-purple-700 dark:text-purple-400 mt-2">
            Rs. {formatPaisa(totalWalletPayouts)}
          </div>
          <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">EasyPaisa & JazzCash transfers</span>
        </div>
      </div>

      {/* Action Strip: Filters & Search */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-[280px]">
          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search employee, voucher ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8.5 w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg pl-9 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500">Type:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="h-8.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
            >
              <option value="ALL" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">All Payout Types</option>
              <option value="DAILY_WAGE" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Daily Wage</option>
              <option value="WEEKLY_PAYOUT" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Weekly Payout</option>
              <option value="MONTHLY_SALARY" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Monthly Salary</option>
              <option value="ADVANCE_PAYMENT" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Advance Payment</option>
              <option value="COMMISSION" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Commission</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500">Method:</span>
            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              className="h-8.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
            >
              <option value="ALL" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">All Methods</option>
              <option value="CASH" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Cash Drawer</option>
              <option value="EASYPAISA" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">EasyPaisa</option>
              <option value="JAZZCASH" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">JazzCash</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-500">
            Showing {filteredPayouts.length} of {payouts.length} records
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => exportSalariesToCSV(filteredPayouts, `Ameer_Salaries_Payouts`)}
            className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 shadow-xs"
            title="Export salary payouts to Microsoft Excel (.csv)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </Button>
        </div>
      </div>

      {/* Disbursals History Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 uppercase font-mono">
              <tr>
                <th className="py-2.5 px-3">Voucher #</th>
                <th className="py-2.5 px-3">Date & Time</th>
                <th className="py-2.5 px-3">Employee Name</th>
                <th className="py-2.5 px-3">Designation</th>
                <th className="py-2.5 px-3">Payout Type</th>
                <th className="py-2.5 px-3">Paid Via</th>
                <th className="py-2.5 px-3 text-right">Amount (PKR)</th>
                <th className="py-2.5 px-3">Authorized By</th>
                <th className="py-2.5 px-3">Notes</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-sans text-slate-800 dark:text-slate-200">
              {filteredPayouts.map((p) => {
                const typeBadgeColor =
                  p.payout_type === "MONTHLY_SALARY"
                    ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30"
                    : p.payout_type === "WEEKLY_PAYOUT"
                    ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30"
                    : p.payout_type === "DAILY_WAGE"
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                    : p.payout_type === "ADVANCE_PAYMENT"
                    ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30"
                    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";

                const methodBadgeColor =
                  p.payment_method === "CASH"
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                    : p.payment_method === "EASYPAISA"
                    ? "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30"
                    : "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30";

                return (
                  <tr key={p.payout_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-amber-700 dark:text-amber-400">
                      {p.payout_id}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                      {new Date(p.payout_date).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" })}{" "}
                      {new Date(p.payout_date).toLocaleTimeString("en-PK", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit", hour12: true })}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-amber-500" />
                      <span>{p.employee_name}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                      {p.employee_role}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${typeBadgeColor}`}>
                        {p.payout_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded border text-[10px] font-bold flex items-center gap-1 w-fit ${methodBadgeColor}`}>
                        {p.payment_method === "CASH" ? <Banknote className="w-3 h-3" /> : <Smartphone className="w-3 h-3" />}
                        <span>{p.payment_method}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                      Rs. {formatPaisa(p.amount_paisa)}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-blue-500" />
                        <span>{p.disbursed_by_name}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 max-w-[160px] truncate" title={p.notes || ""}>
                      {p.notes || "—"}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => printVoucherSlip(p)}
                        className="h-7 px-2 text-[11px] text-slate-600 hover:text-amber-600 gap-1"
                        title="Print Physical Voucher Slip"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Slip</span>
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filteredPayouts.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    <BadgeDollarSign className="w-8 h-8 mx-auto text-slate-400 mb-2 opacity-50" />
                    <p className="font-semibold">No salary payouts found.</p>
                    <p className="text-[11px] mt-0.5">Click "+ Disburse Salary / Wage" to record staff wage payments.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Disburse Salary Modal */}
      <Dialog
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Disburse Staff Salary / Wage Payout"
        description="Record wage payment to floor staff, cashiers, or managers with automatic deduction and authorization audit."
        maxWidth="md"
      >
        <form onSubmit={handleDisburseSalary} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
              Select Employee / Staff Member *
            </label>
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg py-2 px-3 text-xs text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
              required
            >
              {staffList.map((s) => (
                <option key={s.id} value={s.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                  {s.name} ({s.role} {s.code ? `- ${s.code}` : ""})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Payout Type *
              </label>
              <select
                value={payoutType}
                onChange={(e) => setPayoutType(e.target.value as any)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg py-2 px-3 text-xs text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="DAILY_WAGE" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Daily Wage</option>
                <option value="WEEKLY_PAYOUT" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Weekly Payout</option>
                <option value="MONTHLY_SALARY" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Monthly Salary</option>
                <option value="ADVANCE_PAYMENT" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Advance Payment</option>
                <option value="COMMISSION" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Sales Commission</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Disbursement Source *
              </label>
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg py-2 px-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Net Available Treasury
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    Rs. {formatPaisa(treasuryBalances.netAvailable)}
                  </span>
                </div>
              </div>
              <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                Directly deducted from business liquidity & treasury balance
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Amount to Disburse (PKR) *
              </label>
              <Input
                type="number"
                min="1"
                step="any"
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                placeholder="e.g. 15000"
                required
                className="text-sm font-bold font-mono text-emerald-700 dark:text-emerald-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Payout Date
              </label>
              <input
                type="date"
                value={payoutDate}
                onChange={(e) => setPayoutDate(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg py-2 px-3 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
              Reason / Notes / Purpose
            </label>
            <Input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Month of April regular salary, urgent medical advance, etc."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
              Disbursed & Authorized By (Name / Title) *
            </label>
            <Input
              type="text"
              value={authorizedByName}
              onChange={(e) => setAuthorizedByName(e.target.value)}
              placeholder="Owner ( Ameer ) or shop manager"
              required
              className="text-xs font-bold text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="text-xs font-bold gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? "Disbursing..." : "Confirm & Disburse Payout"}</span>
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Post-Disbursal Receipt Voucher Slip Modal */}
      {selectedPayoutForSlip && (
        <Dialog
          open={selectedPayoutForSlip !== null}
          onClose={() => setSelectedPayoutForSlip(null)}
          title="Salary Payout Voucher Generated"
          description="Physical slip formatted for thermal counter receipt printer and manual signature."
          maxWidth="sm"
        >
          <div className="space-y-4">
            <div className="p-4 bg-slate-100 dark:bg-slate-950 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl font-mono text-xs space-y-2">
              <div className="text-center">
                <img src="/logo-rect.png" alt="Ameer Perfumes" className="h-8 w-auto mx-auto object-contain mb-1" />
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">SALARY VOUCHER SLIP</div>
              </div>
              <div className="border-t border-dashed border-slate-400 my-2" />
              <div className="flex justify-between"><span>Voucher:</span><span className="font-bold">{selectedPayoutForSlip.payout_id}</span></div>
              <div className="flex justify-between"><span>Employee:</span><span className="font-bold">{selectedPayoutForSlip.employee_name}</span></div>
              <div className="flex justify-between"><span>Designation:</span><span>{selectedPayoutForSlip.employee_role}</span></div>
              <div className="flex justify-between"><span>Type:</span><span>{selectedPayoutForSlip.payout_type}</span></div>
              <div className="flex justify-between"><span>Method:</span><span>{selectedPayoutForSlip.payment_method}</span></div>
              <div className="border-t border-dashed border-slate-400 my-2" />
              <div className="flex justify-between font-bold text-sm text-emerald-700 dark:text-emerald-400">
                <span>AMOUNT:</span>
                <span>Rs. {formatPaisa(selectedPayoutForSlip.amount_paisa)}</span>
              </div>
              <div className="border-t border-dashed border-slate-400 my-2" />
              <div className="flex justify-between text-[11px]">
                <span>Disbursed By:</span>
                <span>{selectedPayoutForSlip.disbursed_by_name}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => printVoucherSlip(selectedPayoutForSlip)}
                className="flex-1 gap-1.5 text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30"
              >
                <Printer className="w-4 h-4 text-amber-600" />
                <span>🖨️ Print Voucher Slip</span>
              </Button>
              <Button
                variant="primary"
                onClick={() => setSelectedPayoutForSlip(null)}
                className="flex-1 text-xs font-bold"
              >
                Done
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
