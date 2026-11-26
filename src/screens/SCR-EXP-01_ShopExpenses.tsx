import React, { useState, useEffect } from "react";
import { PettyExpense, ShiftSummary, RecordPettyExpensePayload } from "@/types/database";
import { SystemUser, WorkstationStatus } from "@/types/system";
import { getPettyExpenses, getActiveShift, recordPettyExpense } from "@/lib/tauri-bridge";
import { formatPaisaToRupees } from "@/lib/formatters";
import { exportExpensesToCSV } from "@/lib/export-utils";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Receipt,
  Plus,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Coffee,
  Droplet,
  Zap,
  Wrench,
  Car,
  FileText,
  DollarSign,
  Download,
} from "lucide-react";

interface ShopExpensesProps {
  currentUser: SystemUser | null;
  status: WorkstationStatus;
}

export const ShopExpenses: React.FC<ShopExpensesProps> = ({ currentUser, status }) => {
  const [expenses, setExpenses] = useState<PettyExpense[]>([]);
  const [activeShift, setActiveShift] = useState<ShiftSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modal
  const [newExpenseModalOpen, setNewExpenseModalOpen] = useState(false);

  // Form State
  const [category, setCategory] = useState<
    "CHAI_REFRESHMENTS" | "CLEANING_SUPPLIES" | "UTILITIES_MISC" | "OFFICE_STATIONERY" | "REPAIR_MAINTENANCE" | "TRAVEL_CONVEYANCE" | "OTHER"
  >("CHAI_REFRESHMENTS");
  const [amountRupees, setAmountRupees] = useState("");
  const [description, setDescription] = useState("");
  const [recipientPayee, setRecipientPayee] = useState("");
  const [authorizedByName, setAuthorizedByName] = useState("");
  const [broughtByName, setBroughtByName] = useState("");
  const [deductFromDrawer, setDeductFromDrawer] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [exps, shift] = await Promise.all([
        getPettyExpenses(),
        getActiveShift(status.stationId),
      ]);
      setExpenses(exps);
      setActiveShift(shift);
    } catch (err) {
      console.error("Failed to load expenses:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [status.stationId]);

  const handleRecordExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountPaisa = Math.round((parseFloat(amountRupees) || 0) * 100);
    if (amountPaisa <= 0 || !description.trim() || !recipientPayee.trim() || !authorizedByName.trim()) {
      setNotification({
        type: "error",
        message: "Please fill all required expense fields (Category, Amount, Payee, Description, Authorized By).",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const latestShift = deductFromDrawer ? await getActiveShift(status.stationId, currentUser?.role).catch(() => activeShift) : null;
      const effectiveShift = latestShift || activeShift;
      const payload: RecordPettyExpensePayload = {
        shift_id: deductFromDrawer && effectiveShift ? effectiveShift.shift_id : undefined,
        deduct_from_drawer: deductFromDrawer,
        category,
        amount_paisa: amountPaisa,
        description: description.trim(),
        recipient_payee: recipientPayee.trim(),
        authorized_by_name: authorizedByName.trim(),
        brought_by_name: broughtByName.trim() || undefined,
        authorized_by_manager_id: currentUser?.user_id || "usr_admin",
        created_by_user_id: currentUser?.user_id || "usr_cashier1",
      };

      await recordPettyExpense(payload);
      setNotification({
        type: "success",
        message: `Expense of ${formatPaisaToRupees(amountPaisa)} recorded successfully${
          payload.shift_id ? " and deducted from cash drawer" : ""
        }.`,
      });
      setNewExpenseModalOpen(false);
      setAmountRupees("");
      setDescription("");
      setRecipientPayee("");
      setAuthorizedByName("");
      setBroughtByName("");
      loadData();
    } catch (err) {
      setNotification({
        type: "error",
        message: `Failed to record expense: ${String(err)}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Metrics
  const totalExpensePaisa = expenses.reduce((sum, e) => sum + e.amount_paisa, 0);

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "CHAI_REFRESHMENTS":
        return <Coffee className="w-3.5 h-3.5 text-amber-500" />;
      case "CLEANING_SUPPLIES":
        return <Droplet className="w-3.5 h-3.5 text-blue-400" />;
      case "UTILITIES_MISC":
        return <Zap className="w-3.5 h-3.5 text-amber-400" />;
      case "REPAIR_MAINTENANCE":
        return <Wrench className="w-3.5 h-3.5 text-rose-400" />;
      case "TRAVEL_CONVEYANCE":
        return <Car className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Shop Operating Expenses & Petty Cash
              </h1>
              <p className="text-sm text-muted-foreground">
                Daily petty cash vouchers, chai & refreshments, cleaning, transport, and register cash-out linkage
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
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
            onClick={() => setNewExpenseModalOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Record Petty Expense
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Operational Expenses</p>
              <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-slate-100">
                {formatPaisaToRupees(totalExpensePaisa)}
              </p>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-600 dark:text-amber-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{expenses.length} petty cash vouchers</p>
        </Card>

        <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Physical Cash Drawer</p>
              <p className="text-lg font-bold mt-1 text-slate-900 dark:text-slate-100 font-sans">
                Active Till (POS-01)
              </p>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Expenses automatically deduct from counter cash drawer
          </p>
        </Card>

        <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Manager Authorization</p>
              <p className="text-lg font-bold mt-1 text-emerald-700 dark:text-emerald-400">
                {currentUser?.full_name || "Manager on Duty"}
              </p>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Approval trail for financial audits</p>
        </Card>
      </div>

      {/* Expenses History Table */}
      <Card className="overflow-hidden border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs p-0">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-amber-500" />
            Petty Cash Vouchers & Expense Log
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => exportExpensesToCSV(expenses, "Ameer_Shop_Expenses")}
            className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 shadow-xs"
            title="Export all petty cash vouchers to Excel (.csv)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Excel (CSV)</span>
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-950 uppercase font-medium text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3">Voucher #</th>
                <th className="p-3">Category</th>
                <th className="p-3">Date</th>
                <th className="p-3">Recipient / Payee</th>
                <th className="p-3">Description</th>
                <th className="p-3">Authorized By</th>
                <th className="p-3">Brought By</th>
                <th className="p-3 text-right">Amount (Rs.)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 bg-white dark:bg-slate-900/40 text-slate-800 dark:text-slate-200">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-500">
                    No petty cash expenses logged yet.
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr key={exp.expense_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="p-3 font-mono font-semibold text-amber-700 dark:text-amber-400">{exp.expense_id}</td>
                    <td className="p-3">
                      <span className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100">
                        {getCategoryIcon(exp.category)}
                        {exp.category.replace("_", " ")}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-500 dark:text-slate-400">
                      {exp.expense_date.slice(0, 10)}
                    </td>
                    <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">{exp.recipient_payee}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">{exp.description}</td>
                    <td className="p-3 text-slate-800 dark:text-slate-200 font-medium">
                      {exp.authorized_by_name || exp.authorized_by_manager_name}
                    </td>
                    <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">
                      {exp.brought_by_name || "-"}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-rose-700 dark:text-rose-400">
                      {formatPaisaToRupees(exp.amount_paisa)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL: NEW PETTY EXPENSE */}
      {newExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-6 bg-card border-border/60 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                  <Receipt className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-foreground">
                  Record Shop Petty Expense
                </h2>
              </div>
              <button
                onClick={() => setNewExpenseModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordExpense} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Expense Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full bg-input border border-border/50 rounded-lg p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="CHAI_REFRESHMENTS">Chai & Guest Refreshments</option>
                    <option value="CLEANING_SUPPLIES">Cleaning & Janitorial</option>
                    <option value="OFFICE_STATIONERY">Office Stationery & Bags</option>
                    <option value="UTILITIES_MISC">Shop Utilities & Maintenance</option>
                    <option value="REPAIR_MAINTENANCE">Equipment / AC Repair</option>
                    <option value="TRAVEL_CONVEYANCE">Rider & Courier Travel</option>
                    <option value="OTHER">Other Operational Expense</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Amount Paid (Rs.) *
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="1"
                    value={amountRupees}
                    onChange={(e) => setAmountRupees(e.target.value)}
                    placeholder="e.g. 350.00"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Recipient / Payee Name *
                </label>
                <Input
                  value={recipientPayee}
                  onChange={(e) => setRecipientPayee(e.target.value)}
                  placeholder="e.g. Al-Madina Chai Dhaba / Courier Rider"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Authorized / Approved By *
                  </label>
                  <Input
                    value={authorizedByName}
                    onChange={(e) => setAuthorizedByName(e.target.value)}
                    placeholder="e.g. Ibra Khan / Owner / Manager Name"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Purchased / Brought By (Employee)
                  </label>
                  <Input
                    value={broughtByName}
                    onChange={(e) => setBroughtByName(e.target.value)}
                    placeholder="e.g. Employee / Staff / Runner Name"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Expense Description & Purpose *
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Afternoon tea and refreshments for VIP wholesale clients"
                  rows={2}
                  className="w-full bg-input border border-border/50 rounded-lg p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                  required
                />
              </div>

              <div className="p-3 bg-muted/20 border border-border/30 rounded-lg flex items-center gap-2">
                <input
                  type="checkbox"
                  id="deductDrawer"
                  checked={deductFromDrawer}
                  onChange={(e) => setDeductFromDrawer(e.target.checked)}
                  className="accent-amber-500 cursor-pointer"
                />
                <label htmlFor="deductDrawer" className="text-xs text-muted-foreground cursor-pointer select-none">
                  Deduct amount directly from physical cash drawer {activeShift ? `(${activeShift.terminal_id})` : ""}{" "}
                  <span className="text-[11px] opacity-75">(Uncheck if funded externally / owner pocket)</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setNewExpenseModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={isSubmitting}>
                  {isSubmitting ? "Recording..." : "Record Petty Voucher"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
