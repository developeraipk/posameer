import React, { useState, useEffect } from "react";
import { SystemUser, UserRole } from "@/types/system";
import {
  getAllUsers,
  updateUserSecurity,
  createStaffUser,
  getAllSalespersons,
  createSalesperson,
  toggleSalespersonStatus,
  updateSalesperson,
  deleteSalesperson,
  deleteUser,
} from "@/lib/tauri-bridge";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import {
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  KeyRound,
  Lock,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Users,
  UserCheck,
  UserX,
  Plus,
  Trash2,
  Edit3,
} from "lucide-react";

interface UserSecurityManagementProps {
  currentUser: SystemUser | null;
}

export const UserSecurityManagement: React.FC<UserSecurityManagementProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Edit User State (Profile, Role, Status)
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [editFullName, setEditFullName] = useState<string>("");
  const [editUsername, setEditUsername] = useState<string>("");
  const [editRole, setEditRole] = useState<UserRole>("CASHIER_OPERATOR");
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Dedicated PIN / Password State
  const [pinPasswordUser, setPinPasswordUser] = useState<SystemUser | null>(null);
  const [pinPasswordPin, setPinPasswordPin] = useState<string>("");
  const [pinPasswordPwd, setPinPasswordPwd] = useState<string>("");
  const [showPinPasswordPin, setShowPinPasswordPin] = useState<boolean>(false);
  const [showPinPasswordPwd, setShowPinPasswordPwd] = useState<boolean>(false);

  // Terminal Login Preference State
  const [defaultAuthMode, setDefaultAuthMode] = useState<"PIN" | "PASSWORD">(() => {
    return (localStorage.getItem("pos_auth_mode") as "PIN" | "PASSWORD") || "PIN";
  });

  const handleSetDefaultAuthMode = (mode: "PIN" | "PASSWORD") => {
    setDefaultAuthMode(mode);
    localStorage.setItem("pos_auth_mode", mode);
    setSuccessMsg(`Default terminal login screen set to: ${mode === "PIN" ? "Fast PIN Unlock Keypad" : "Username & Password Form"}`);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  // Create User State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newUsername, setNewUsername] = useState<string>("");
  const [newFullName, setNewFullName] = useState<string>("");
  const [newRole, setNewRole] = useState<UserRole>("CASHIER_OPERATOR");
  const [newPin, setNewPin] = useState<string>("");
  const [showNewPin, setShowNewPin] = useState<boolean>(false);
  const [newPassword, setNewPassword] = useState<string>("");
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // Floor Sales Staff State
  const [activeTab, setActiveTab] = useState<"LOGIN_USERS" | "SALES_STAFF">("LOGIN_USERS");
  const [salespersons, setSalespersons] = useState<{
    salesperson_id: string;
    employee_code: string;
    full_name: string;
    phone: string;
    is_active: boolean;
  }[]>([]);
  const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);
  const [newEmpCode, setNewEmpCode] = useState("");
  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpPhone, setNewEmpPhone] = useState("");
  const [isEmpSaving, setIsEmpSaving] = useState(false);

  // Edit Salesperson Modal State
  const [editingSalesperson, setEditingSalesperson] = useState<{
    salesperson_id: string;
    employee_code: string;
    full_name: string;
    phone: string;
  } | null>(null);
  const [editEmpCode, setEditEmpCode] = useState("");
  const [editEmpName, setEditEmpName] = useState("");
  const [editEmpPhone, setEditEmpPhone] = useState("");
  const [isEditEmpSaving, setIsEditEmpSaving] = useState(false);

  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [uList, spList] = await Promise.all([
        getAllUsers(),
        getAllSalespersons(),
      ]);
      setUsers(uList);
      setSalespersons(spList);
    } catch (err: any) {
      setErrorMsg(`Failed to load data: ${err.message || err}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName.trim()) return;
    setIsEmpSaving(true);
    try {
      await createSalesperson({
        employee_code: newEmpCode.trim() || `EMP-${100 + salespersons.length + 1}`,
        full_name: newEmpName.trim(),
        phone: newEmpPhone.trim() || "0300-0000000",
      });
      setIsAddEmployeeModalOpen(false);
      setNewEmpName("");
      setNewEmpCode("");
      setNewEmpPhone("");
      setSuccessMsg("Floor sales employee registered successfully.");
      await loadData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(`Failed to add employee: ${err.message || err}`);
    } finally {
      setIsEmpSaving(false);
    }
  };

  const handleOpenEditSalesperson = (sp: {
    salesperson_id: string;
    employee_code: string;
    full_name: string;
    phone: string;
  }) => {
    setEditingSalesperson(sp);
    setEditEmpCode(sp.employee_code);
    setEditEmpName(sp.full_name);
    setEditEmpPhone(sp.phone || "");
  };

  const handleSaveEditSalesperson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSalesperson || !editEmpName.trim()) return;
    setIsEditEmpSaving(true);
    try {
      await updateSalesperson({
        salesperson_id: editingSalesperson.salesperson_id,
        employee_code: editEmpCode.trim() || editingSalesperson.employee_code,
        full_name: editEmpName.trim(),
        phone: editEmpPhone.trim() || "0300-0000000",
      });
      setSuccessMsg(`Sales staff '${editEmpName.trim()}' successfully updated in SQLite database.`);
      setEditingSalesperson(null);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(`Failed to update salesperson: ${err.message || err}`);
    } finally {
      setIsEditEmpSaving(false);
    }
  };

  const handleToggleSalesperson = async (spId: string, desiredActive: boolean) => {
    try {
      await toggleSalespersonStatus(spId, desiredActive);
      setSuccessMsg(`Sales staff status changed to ${desiredActive ? "Active" : "Deactivated"}.`);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      alert(`Failed to update employee status: ${err.message || err}`);
    }
  };

  const handleDeleteSalesperson = async (spId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove sales staff "${name}"?`)) return;
    try {
      await deleteSalesperson(spId);
      await loadData();
      alert(`Sales staff "${name}" removed successfully.`);
    } catch (err: any) {
      alert(`Failed to delete sales staff: ${err.message || err}`);
    }
  };

  const handleOpenEdit = (user: SystemUser) => {
    setEditingUser(user);
    setEditFullName(user.full_name);
    setEditUsername(user.username);
    setEditRole(user.role);
    setEditIsActive(user.is_active);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;

    if (!editFullName.trim() || !editUsername.trim()) {
      alert("Full Name and Username cannot be empty!");
      return;
    }

    setIsSaving(true);
    try {
      await updateUserSecurity({
        caller_user_id: currentUser?.user_id || "",
        target_user_id: editingUser.user_id,
        new_full_name: editFullName.trim(),
        new_username: editUsername.trim().toLowerCase(),
        new_role: editingUser.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : editRole,
        is_active: editingUser.role === "SUPER_ADMIN" ? true : editIsActive,
      });

      if (editingUser.user_id === currentUser?.user_id) {
        const updatedUser: SystemUser = {
          ...currentUser,
          full_name: editFullName.trim(),
          username: editUsername.trim().toLowerCase(),
        };
        try {
          sessionStorage.setItem("ameer_pos_active_user", JSON.stringify(updatedUser));
        } catch {}
        window.dispatchEvent(new CustomEvent("app:user-updated", { detail: updatedUser }));
      }

      setSuccessMsg(`User profile for @${editUsername.trim()} successfully updated!`);
      setEditingUser(null);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      alert(`Update failed: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenPinPassword = (user: SystemUser) => {
    setPinPasswordUser(user);
    setPinPasswordPin("");
    setPinPasswordPwd("");
    setShowPinPasswordPin(false);
    setShowPinPasswordPwd(false);
  };

  const handleSavePinPassword = async () => {
    if (!pinPasswordUser) return;

    if (!pinPasswordPin.trim() && !pinPasswordPwd.trim()) {
      alert("Please enter a new PIN or new Password to update!");
      return;
    }

    if (pinPasswordPin.trim() && !/^\d{4,6}$/.test(pinPasswordPin.trim())) {
      alert("PIN must be exactly 4 to 6 numeric digits!");
      return;
    }

    if (pinPasswordPwd.trim() && pinPasswordPwd.trim().length < 4) {
      alert("Password must be at least 4 characters long!");
      return;
    }

    setIsSaving(true);
    try {
      await updateUserSecurity({
        caller_user_id: currentUser?.user_id || "",
        target_user_id: pinPasswordUser.user_id,
        new_pin: pinPasswordPin.trim() ? pinPasswordPin.trim() : undefined,
        new_password: pinPasswordPwd.trim() ? pinPasswordPwd.trim() : undefined,
      });

      setSuccessMsg(`Security credentials for @${pinPasswordUser.username} successfully updated!`);
      setPinPasswordUser(null);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      alert(`Update failed: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (user: SystemUser) => {
    if (!currentUser) return;
    if (user.user_id === currentUser.user_id) {
      alert("Cannot delete the currently logged-in Super Admin account.");
      return;
    }
    const confirmed = window.confirm(
      `Are you sure you want to remove user account "${user.full_name}" (@${user.username})?\n\nIf this user has past sales invoices, they will be safely deactivated to protect audit and financial records. If no records exist, the account will be deleted permanently.`
    );
    if (!confirmed) return;
    try {
      await deleteUser(currentUser.user_id, user.user_id);
      setSuccessMsg(`User account '@${user.username}' successfully deleted/deactivated.`);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert("Failed to delete user: " + String(err?.message || err));
    }
  };

  const handleCreateUser = async () => {
    if (!currentUser) return;

    if (!newUsername.trim() || !newFullName.trim()) {
      alert("Username and Full Name are required!");
      return;
    }

    if (!/^\d{4,6}$/.test(newPin.trim())) {
      alert("Security PIN must be 4 to 6 digits!");
      return;
    }

    if (!newPassword.trim() || newPassword.trim().length < 4) {
      alert("Password must be at least 4 characters!");
      return;
    }

    setIsCreating(true);
    try {
      await createStaffUser({
        caller_user_id: currentUser.user_id,
        username: newUsername.trim(),
        full_name: newFullName.trim(),
        role: newRole,
        pin: newPin.trim(),
        password: newPassword.trim(),
      });

      setSuccessMsg(`New staff account '${newUsername.trim()}' created successfully!`);
      setIsCreateModalOpen(false);
      setNewUsername("");
      setNewFullName("");
      setNewPin("");
      setShowNewPin(false);
      setNewPassword("");
      setShowNewPassword(false);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      alert(`User creation failed: ${err.message || err}`);
    } finally {
      setIsCreating(false);
    }
  };

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case "SUPER_ADMIN":
        return "danger";
      case "SHOP_MANAGER":
        return "gold";
      case "CASHIER_OPERATOR":
        return "success";
      case "OWNER":
        return "warning";
      default:
        return "neutral";
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case "SUPER_ADMIN":
        return "Super Admin (Full System)";
      case "SHOP_MANAGER":
        return "Shop Manager (Operations & Cash)";
      case "CASHIER_OPERATOR":
        return "Cashier (POS & Returns Only)";
      case "OWNER":
        return "Owner (Executive Dashboard Only)";
      default:
        return role;
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col p-6 overflow-y-auto bg-slate-50 dark:bg-slate-950 space-y-6 select-none">
      {/* Top Banner Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold font-serif text-slate-900 dark:text-slate-100 tracking-wide">
              Staff Security & Access Control
            </h2>
            <Badge variant="gold" className="text-xs uppercase font-mono px-2 py-0.5">
              Super Admin Authority
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage staff PINs, login passwords, security privileges, and role-based permissions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          {isSuperAdmin && activeTab === "LOGIN_USERS" && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              className="gap-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Staff Account</span>
            </Button>
          )}

          {isSuperAdmin && activeTab === "SALES_STAFF" && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddEmployeeModalOpen(true)}
              className="gap-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950"
            >
              <Plus className="w-4 h-4" />
              <span>Add Sales Employee</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("LOGIN_USERS")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === "LOGIN_USERS"
              ? "bg-amber-500 text-slate-950 shadow"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>System Login Accounts ({users.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("SALES_STAFF")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === "SALES_STAFF"
              ? "bg-amber-500 text-slate-950 shadow"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Floor Sales Staff / Attendants ({salespersons.length})</span>
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-emerald-800 dark:text-emerald-300 text-xs animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3 text-rose-800 dark:text-rose-300 text-xs animate-in fade-in">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {activeTab === "LOGIN_USERS" ? (
        <>
          {/* Terminal Login Screen Mode Switcher */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Terminal Default Login Screen: {defaultAuthMode === "PIN" ? "Fast PIN Unlock" : "Username & Password Form"}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Choose which login screen operators and admin see by default when opening the terminal or locking screen.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => handleSetDefaultAuthMode("PIN")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  defaultAuthMode === "PIN"
                    ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Fast PIN Unlock</span>
              </button>
              <button
                type="button"
                onClick={() => handleSetDefaultAuthMode("PASSWORD")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  defaultAuthMode === "PASSWORD"
                    ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Username & Password</span>
              </button>
            </div>
          </div>

          {/* RBAC Rules Policy Card */}
          <Card variant="elevated" className="p-4 border-amber-500/30 bg-amber-500/5 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Strict Role-Based Access Control (RBAC) Enforced:</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-[11px] text-slate-600 dark:text-slate-400">
              <div className="p-2.5 rounded-lg bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">1. Cashier Operator</span>
                <p>Counter POS billing, attar bar, customer returns, and cashier shift reconciliation only. All admin & financial dashboards hidden.</p>
              </div>
              <div className="p-2.5 rounded-lg bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="font-bold text-amber-600 dark:text-amber-400">2. Shop Manager</span>
                <p>Procurement, manufacturing batches, wholesale invoicing, inventory catalog, expenses, and shift audits.</p>
              </div>
              <div className="p-2.5 rounded-lg bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="font-bold text-purple-600 dark:text-purple-400">3. Owner (Read-Only)</span>
                <p>Executive performance hub, margin reports, balance sheet, and audit trail. Counter sale checkout is prohibited.</p>
              </div>
              <div className="p-2.5 rounded-lg bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="font-bold text-rose-600 dark:text-rose-400">4. Super Admin</span>
                <p>Total access over all 19 ERP modules + exclusive authority to change any staff member's PIN and password.</p>
              </div>
            </div>
          </Card>

          {/* Staff Accounts Table */}
          <Card variant="elevated" className="overflow-hidden border-slate-200 dark:border-slate-800 p-0 shadow-lg">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  Registered System Staff & Credentials
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                {users.length} active user records in SQLite
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-mono text-[11px] uppercase border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3 font-semibold">User Details</th>
                    <th className="px-5 py-3 font-semibold">Username</th>
                    <th className="px-5 py-3 font-semibold">System Role</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Security State</th>
                    <th className="px-5 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                        Loading staff security accounts from SQLite...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                        No staff accounts found in database.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr
                        key={u.user_id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-bold text-amber-600 dark:text-amber-400 text-xs">
                              {u.full_name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-slate-100">
                                {u.full_name}
                              </div>
                              <div className="text-[10px] font-mono text-slate-400">
                                ID: {u.user_id}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-mono font-semibold text-slate-800 dark:text-slate-200">
                          @{u.username}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge variant={getRoleBadgeVariant(u.role)} className="text-[10px] font-medium">
                            {getRoleLabel(u.role)}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5">
                          {u.is_active ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                              Deactivated
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                            <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                            <span>Salted PIN & Password Protected</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {isSuperAdmin ? (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleOpenEdit(u)}
                                className="gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:border-amber-500/50"
                                title="Edit staff profile (name, username, role, active status)"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-amber-500" />
                                <span>Edit</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenPinPassword(u)}
                                className="gap-1.5 text-xs text-slate-600 dark:text-slate-400"
                                title="Change PIN or password"
                              >
                                <Lock className="w-3.5 h-3.5 text-amber-500" />
                                <span>Change PIN / Password</span>
                              </Button>
                              {u.user_id !== currentUser?.user_id && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(u)}
                                  className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                  title="Delete or deactivate user"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              Protected
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        /* Floor Sales Staff Management Table */
        <Card variant="elevated" className="overflow-hidden border-slate-200 dark:border-slate-800 p-0 shadow-lg">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-500" />
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  Floor Sales Staff & Attendants (In-Store & Commissions)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Sales staff can be selected during POS counter checkout to track individual performance.
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddEmployeeModalOpen(true)}
              className="gap-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add New Salesperson</span>
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-mono text-[11px] uppercase border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3 font-semibold">Employee Code</th>
                  <th className="px-5 py-3 font-semibold">Staff Name</th>
                  <th className="px-5 py-3 font-semibold">Contact Phone</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {salespersons.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                      No floor salespersons registered. Click "+ Add New Salesperson" above.
                    </td>
                  </tr>
                ) : (
                  salespersons.map((sp) => (
                    <tr
                      key={sp.salesperson_id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-mono font-bold text-amber-600 dark:text-amber-400">
                        {sp.employee_code}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                        {sp.full_name}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400 font-mono">
                        {sp.phone || "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        {sp.is_active ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <UserCheck className="w-3 h-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            <UserX className="w-3 h-3" /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenEditSalesperson(sp)}
                            className="gap-1 text-xs font-semibold hover:border-amber-500/50"
                            title="Edit sales staff profile and contact phone"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-amber-500" />
                            <span>Edit</span>
                          </Button>
                          <Button
                            variant={sp.is_active ? "outline" : "primary"}
                            size="sm"
                            onClick={() => handleToggleSalesperson(sp.salesperson_id, !sp.is_active)}
                            className={`gap-1 text-xs font-bold ${
                              sp.is_active
                                ? "text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                : "bg-emerald-600 hover:bg-emerald-500 text-white"
                            }`}
                          >
                            {sp.is_active ? "Deactivate" : "Activate"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteSalesperson(sp.salesperson_id, sp.full_name)}
                            className="gap-1 text-xs text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-50 dark:hover:bg-rose-950/30 p-1.5"
                            title="Delete salesperson"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Edit Profile Modal */}
      <Dialog
        open={editingUser !== null}
        onClose={() => setEditingUser(null)}
        title={`Edit Staff Profile: ${editingUser?.full_name || ""}`}
        description="Update staff profile details, system permissions, and account status."
        maxWidth="md"
      >
        {editingUser && (
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Username / Login ID *
                </label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  System Role
                </label>
                {editingUser.role === "SUPER_ADMIN" && (
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                    🔒 Super Admin Role Locked
                  </span>
                )}
              </div>
              <select
                value={editingUser.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : editRole}
                disabled={editingUser.role === "SUPER_ADMIN"}
                onChange={(e) => setEditRole(e.target.value as UserRole)}
                className={`w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                  editingUser.role === "SUPER_ADMIN" ? "opacity-60 cursor-not-allowed bg-slate-200/50 dark:bg-slate-800/50" : ""
                }`}
              >
                <option value="CASHIER_OPERATOR">Cashier (POS & Returns Only)</option>
                <option value="SHOP_MANAGER">Shop Manager (Operations & Cash)</option>
                <option value="OWNER">Owner (Executive Hub Only)</option>
                <option value="SUPER_ADMIN">Super Admin (Full System Access)</option>
              </select>
            </div>

            {/* Active Status Toggle */}
            <div className={`flex items-center justify-between p-3 rounded-lg border ${
              editingUser.role === "SUPER_ADMIN"
                ? "bg-slate-100/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-80"
                : "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            }`}>
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                  Account Status
                </span>
                <span className="text-[10px] text-slate-500">
                  {editingUser.role === "SUPER_ADMIN"
                    ? "Super Admin account cannot be deactivated."
                    : "Deactivated accounts cannot authenticate at any terminal."}
                </span>
              </div>
              <label className={`relative inline-flex items-center ${editingUser.role === "SUPER_ADMIN" ? "cursor-not-allowed" : "cursor-pointer"}`}>
                <input
                  type="checkbox"
                  disabled={editingUser.role === "SUPER_ADMIN"}
                  checked={editingUser.role === "SUPER_ADMIN" ? true : editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 pt-2">
              <Button
                variant="secondary"
                onClick={() => setEditingUser(null)}
                className="flex-1 text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="flex-1 text-xs font-semibold"
              >
                {isSaving ? "Saving..." : "Save Profile Changes"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Dedicated Change PIN / Password Modal */}
      <Dialog
        open={pinPasswordUser !== null}
        onClose={() => setPinPasswordUser(null)}
        title={`Change PIN & Password: ${pinPasswordUser?.full_name || ""}`}
        description="Assign a new 4 to 6 digit numeric security PIN or login password for this staff member."
        maxWidth="md"
      >
        {pinPasswordUser && (
          <div className="space-y-4 pt-1">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-200">
              Updating credentials for <span className="font-bold">@{pinPasswordUser.username}</span> ({pinPasswordUser.full_name}).
            </div>

            {/* New 4-Digit Security PIN */}
            <div className="p-3.5 bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                  <span>Assign New 4-Digit PIN:</span>
                </label>
                <span className="text-[10px] text-slate-400">Leave blank to keep existing</span>
              </div>
              <div className="relative">
                <input
                  type={showPinPasswordPin ? "text" : "password"}
                  maxLength={4}
                  placeholder="Enter 4-digit numeric PIN (e.g. 5566)"
                  value={pinPasswordPin}
                  onChange={(e) => setPinPasswordPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="w-full px-3 py-2 pr-10 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-mono tracking-widest text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPinPasswordPin(!showPinPasswordPin)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  title={showPinPasswordPin ? "Hide PIN" : "Show PIN"}
                >
                  {showPinPasswordPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-500">
                This PIN allows the staff member to unlock the terminal quickly from the Lock Screen.
              </p>
            </div>

            {/* New Password */}
            <div className="p-3.5 bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-blue-500" />
                  <span>Assign New Login Password:</span>
                </label>
                <span className="text-[10px] text-slate-400">Leave blank to keep existing</span>
              </div>
              <div className="relative">
                <input
                  type={showPinPasswordPwd ? "text" : "password"}
                  placeholder="Enter secure password (min 4 chars)"
                  value={pinPasswordPwd}
                  onChange={(e) => setPinPasswordPwd(e.target.value)}
                  className="w-full px-3 py-2 pr-10 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPinPasswordPwd(!showPinPasswordPwd)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPinPasswordPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-500">
                Staff can use username + password to authenticate if they forget their PIN.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 pt-2">
              <Button
                variant="secondary"
                onClick={() => setPinPasswordUser(null)}
                className="flex-1 text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSavePinPassword}
                disabled={isSaving}
                className="flex-1 text-xs font-semibold"
              >
                {isSaving ? "Updating Credentials..." : "Update PIN & Password"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Edit Salesperson Modal */}
      <Dialog
        open={editingSalesperson !== null}
        onClose={() => setEditingSalesperson(null)}
        title={`Edit Sales Staff: ${editingSalesperson?.full_name || ""}`}
        description="Update floor salesperson employee code, full name, and contact phone number."
        maxWidth="sm"
      >
        {editingSalesperson && (
          <form onSubmit={handleSaveEditSalesperson} className="space-y-4 pt-1">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Employee Code *
              </label>
              <input
                type="text"
                value={editEmpCode}
                onChange={(e) => setEditEmpCode(e.target.value)}
                placeholder="e.g. EMP-101"
                required
                className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Staff Full Name *
              </label>
              <input
                type="text"
                value={editEmpName}
                onChange={(e) => setEditEmpName(e.target.value)}
                placeholder="Staff full name"
                required
                className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Contact Phone
              </label>
              <input
                type="text"
                value={editEmpPhone}
                onChange={(e) => setEditEmpPhone(e.target.value)}
                placeholder="e.g. 0300-1234567"
                className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div className="flex gap-2.5 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditingSalesperson(null)}
                className="flex-1 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isEditEmpSaving}
                className="flex-1 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950"
              >
                {isEditEmpSaving ? "Saving..." : "Save Salesperson"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* Add New Staff Account Modal */}
      <Dialog
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add New Staff Account"
        description="Create a new authenticated operator in the persistent SQLite database."
        maxWidth="md"
      >
        <div className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Username (Login Handle) *
              </label>
              <input
                type="text"
                placeholder="e.g. cashier2"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Full Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Ali Raza"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Select Role & Access Level *
            </label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="CASHIER_OPERATOR">Cashier Operator (POS & Returns Only)</option>
              <option value="SHOP_MANAGER">Shop Manager (Operations, Procurement, Shifts)</option>
              <option value="OWNER">Owner (Executive Dashboard Only, Read-Only)</option>
              <option value="SUPER_ADMIN">Super Admin (Full System & Security)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Initial 4-Digit PIN *
              </label>
              <div className="relative">
                <input
                  type={showNewPin ? "text" : "password"}
                  maxLength={4}
                  placeholder="4-digit PIN (e.g. 5566)"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="w-full px-3 py-2 pr-10 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-mono tracking-widest text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPin(!showNewPin)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  title={showNewPin ? "Hide PIN" : "Show PIN"}
                >
                  {showNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Initial Password *
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Min 4 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-300 space-y-1">
            <span className="font-bold">Security Standard:</span>
            <p className="text-[11px]">
              The user can authenticate either by entering their 4-digit PIN on the lock screen or by entering their username & password.
            </p>
          </div>

          <div className="flex gap-2.5 pt-2">
            <Button
              variant="secondary"
              onClick={() => setIsCreateModalOpen(false)}
              className="flex-1 text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={isCreating}
              onClick={handleCreateUser}
              className="flex-1 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950"
            >
              {isCreating ? "Creating in SQLite..." : "Create Staff User"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Add Floor Sales Employee Modal */}
      <Dialog
        open={isAddEmployeeModalOpen}
        onClose={() => setIsAddEmployeeModalOpen(false)}
        title="Register Floor Sales Staff / Attendant"
        description="Add a new salesperson so cashiers can attribute sales to them during POS counter billing."
        maxWidth="sm"
      >
        <form onSubmit={handleCreateEmployee} className="space-y-4 pt-1">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Employee Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Ali Raza"
              value={newEmpName}
              onChange={(e) => setNewEmpName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Employee Code (Optional)
              </label>
              <input
                type="text"
                placeholder={`EMP-${100 + salespersons.length + 1}`}
                value={newEmpCode}
                onChange={(e) => setNewEmpCode(e.target.value)}
                className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Contact Phone
              </label>
              <input
                type="text"
                placeholder="0300-0000000"
                value={newEmpPhone}
                onChange={(e) => setNewEmpPhone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-300">
            <span>Note: This staff member will immediately appear in the Cashier POS salesperson selection dropdown.</span>
          </div>

          <div className="flex gap-2.5 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsAddEmployeeModalOpen(false)}
              className="flex-1 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isEmpSaving}
              className="flex-1 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950"
            >
              {isEmpSaving ? "Saving..." : "Save Employee"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
