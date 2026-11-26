import React, { useState, useRef, useEffect } from "react";
import { SystemUser, WorkstationStatus, StoreConfig } from "@/types/system";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import {
  Lock,
  LogOut,
  ShoppingBag,
  Package,
  Droplet,
  Briefcase,
  RotateCcw,
  Banknote,
  LayoutDashboard,
  ArrowRightLeft,
  FolderArchive,
  Printer,
  ChevronDown,
  RefreshCw,
  SlidersHorizontal,
  KeyRound,
  ShieldCheck,
  BadgeDollarSign,
  TrendingUp,
  Globe,
  Truck,
} from "lucide-react";
import logoNavbar from "@/assets/logo-rect.png";

export type ActiveScreen =
  | "POS"
  | "ONLINE_ORDERS"
  | "CATALOG"
  | "ATTAR"
  | "PROCUREMENT"
  | "MANUFACTURING"
  | "WHOLESALE"
  | "EXPENSES"
  | "SALARIES"
  | "RETURNS"
  | "AUDIT_REPORTS"
  | "OWNER_DASHBOARD"
  | "SYNC_CENTER"
  | "BACKUP"
  | "HARDWARE"
  | "SYSTEM_HEALTH"
  | "USER_MANAGEMENT";

interface NavbarProps {
  currentUser: SystemUser | null;
  status: WorkstationStatus;
  storeConfig: StoreConfig;
  activeScreen: ActiveScreen;
  onNavigate: (screen: ActiveScreen) => void;
  onLockTerminal: () => void;
  onLogout?: () => void;
  onRefreshStatus: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  status,
  storeConfig,
  activeScreen,
  onNavigate,
  onLockTerminal,
  onLogout,
  onRefreshStatus,
}) => {
  const [openDropdown, setOpenDropdown] = useState<"commercial" | "operations" | "finance" | "system" | "user" | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getRoleBadgeVariant = (role?: string) => {
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

  const formatRoleName = (role?: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return "Super Admin";
      case "SHOP_MANAGER":
        return "Shop Manager";
      case "CASHIER_OPERATOR":
        return "Cashier";
      case "OWNER":
        return "Owner (Read-Only)";
      default:
        return "Authorized Staff";
    }
  };

  const renderFormattedName = (fullName: string) => {
    const cleanName = fullName.replace(/\s*\([^)]*\)/g, "").trim();
    const words = cleanName.split(/\s+/).filter(Boolean);
    if (words.length >= 3) {
      const firstLine = words.slice(0, -1).join(" ");
      const secondLine = words.slice(-1).join(" ");
      return (
        <div className="font-bold text-slate-900 dark:text-slate-100 text-xs leading-tight" title={cleanName}>
          <div className="whitespace-nowrap">{firstLine}</div>
          <div className="whitespace-nowrap text-slate-700 dark:text-slate-300 font-semibold">{secondLine}</div>
        </div>
      );
    } else if (words.length === 2 && cleanName.length > 12) {
      return (
        <div className="font-bold text-slate-900 dark:text-slate-100 text-xs leading-tight" title={cleanName}>
          <div className="whitespace-nowrap">{words[0]}</div>
          <div className="whitespace-nowrap text-slate-700 dark:text-slate-300 font-semibold">{words[1]}</div>
        </div>
      );
    }
    return (
      <div className="font-bold text-slate-900 dark:text-slate-100 text-xs leading-tight" title={cleanName}>
        {cleanName}
      </div>
    );
  };

  const userRole = currentUser?.role || "CASHIER_OPERATOR";
  const isOwner = userRole === "OWNER";
  const isCashier = userRole === "CASHIER_OPERATOR";
  const isManager = userRole === "SHOP_MANAGER";
  const isSuperAdmin = userRole === "SUPER_ADMIN";

  const isCommercialActive = activeScreen === "WHOLESALE" || activeScreen === "ONLINE_ORDERS";

  const isFinanceActive = [
    "EXPENSES",
    "SALARIES",
  ].includes(activeScreen);

  const isSystemActive = [
    "SYNC_CENTER",
    "BACKUP",
    "HARDWARE",
    "USER_MANAGEMENT",
  ].includes(activeScreen);

  const handleSelectScreen = (screen: ActiveScreen) => {
    onNavigate(screen);
    setOpenDropdown(null);
  };

  return (
    <header
      ref={navRef}
      className="h-20 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md px-2.5 sm:px-4 flex items-center justify-between gap-1.5 sm:gap-2 select-none sticky top-0 z-50 shadow-sm w-full max-w-full overflow-visible"
    >
      {/* Left: Luxury Brand Emblem & Store Info with Quick Utilities (Theme & Refresh) neatly stacked underneath */}
      <div className="flex flex-col justify-center shrink-0 select-none py-1">
        <div
          onClick={() => handleSelectScreen("POS")}
          className="flex items-center cursor-pointer group"
          title={storeConfig?.storeName || "Ameer Perfumes POS"}
        >
          <img
            src={logoNavbar}
            alt="Ameer Perfumes"
            className="h-10 sm:h-11 w-auto object-contain shrink-0 group-hover:scale-[1.02] transition-transform duration-150 drop-shadow-xs"
          />
        </div>

        {/* Quick Utilities (Light/Dark Toggle & Refresh Button) positioned directly under AMEER PERFUMES */}
        <div className="flex items-center gap-1.5 mt-1 pl-0.5">
          <ThemeToggle showLabel={false} />
          <Button
            variant="secondary"
            size="sm"
            onClick={onRefreshStatus}
            title="Refresh System Data & Diagnostics [F5 / Ctrl+R]"
            className="p-1 h-7 w-7 rounded-lg shrink-0 flex items-center justify-center cursor-pointer border border-slate-200/80 dark:border-slate-800/80 hover:border-amber-400 hover:bg-slate-200/50 dark:hover:bg-slate-800"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200" />
          </Button>
          <span className="text-[9px] text-slate-400 font-mono tracking-tight">
            {status.stationId}
          </span>
        </div>
      </div>

      {/* Center: Navigation Bar (Role-Filtered RBAC, Professional & Spacious) */}
      <nav
        className="flex items-center gap-1.5 xl:gap-2 bg-slate-100/90 dark:bg-slate-900/90 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs relative overflow-visible flex-nowrap shrink"
      >
        {/* 1. OWNER ROLE VIEW: POS, Wholesale, Attar, Perfumes, Dashboard, Salaries (Petty Expenses Hidden) */}
        {isOwner && (
          <>
            <button
              onClick={() => handleSelectScreen("POS")}
              className={`h-[44px] flex items-center gap-2 px-3.5 xl:px-4 py-2 rounded-xl text-[13px] font-semibold cursor-pointer transition-all duration-150 select-none whitespace-nowrap shrink-0 ${
                activeScreen === "POS"
                  ? "bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/25 ring-1 ring-amber-400/50 scale-[1.01]"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800/90 hover:shadow-xs active:scale-[0.98]"
              }`}
            >
              <ShoppingBag className="w-4 h-4 shrink-0" />
              <span>POS</span>
            </button>

            {/* Consolidated Dropdown: Commercial Sales (Wholesale & Online Orders) */}
            <div className="relative">
              <button
                onClick={() => setOpenDropdown(openDropdown === "commercial" ? null : "commercial")}
                className={`h-[44px] flex items-center gap-2 px-3.5 xl:px-4 py-2 rounded-xl text-[13px] font-semibold cursor-pointer transition-all duration-150 select-none whitespace-nowrap shrink-0 ${
                  isCommercialActive
                    ? "bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/25 ring-1 ring-amber-400/50 scale-[1.01]"
                    : openDropdown === "commercial"
                    ? "bg-slate-200/80 dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800/90 hover:shadow-xs active:scale-[0.98]"
                }`}
                title="B2B Wholesale & Online Commerce Hub"
              >
                <Truck className="w-4 h-4 text-blue-500 shrink-0" />
                <span>Commercial Sales</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openDropdown === "commercial" ? "rotate-180" : ""}`} />
              </button>

              {openDropdown === "commercial" && (
                <div className="absolute top-full left-0 mt-2 w-64 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-2 z-[999] animate-in fade-in zoom-in-95 duration-150">
                  <button
                    onClick={() => handleSelectScreen("WHOLESALE")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors text-left cursor-pointer ${
                      activeScreen === "WHOLESALE"
                        ? "bg-amber-500 text-slate-950 font-semibold"
                        : "text-slate-700 dark:text-slate-300 hover:bg-amber-500/10 hover:text-amber-900 dark:hover:text-amber-200"
                    }`}
                  >
                    <Briefcase className="w-4 h-4 text-blue-500 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">Wholesale (B2B)</div>
                      <div className="text-[10px] opacity-75">Bulk invoicing & customer ledger</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleSelectScreen("ONLINE_ORDERS")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors text-left cursor-pointer ${
                      activeScreen === "ONLINE_ORDERS"
                        ? "bg-amber-500 text-slate-950 font-semibold"
                        : "text-slate-700 dark:text-slate-300 hover:bg-amber-500/10 hover:text-amber-900 dark:hover:text-amber-200"
                    }`}
                  >
                    <Globe className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">Online Orders Hub</div>
                      <div className="text-[10px] opacity-75">WhatsApp & Web orders, COD dispatch</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => handleSelectScreen("ATTAR")}
              className={`h-[44px] flex items-center gap-2 px-3.5 xl:px-4 py-2 rounded-xl text-[13px] font-semibold cursor-pointer transition-all duration-150 select-none whitespace-nowrap shrink-0 ${
                activeScreen === "ATTAR"
                  ? "bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/25 ring-1 ring-amber-400/50 scale-[1.01]"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800/90 hover:shadow-xs active:scale-[0.98]"
              }`}
            >
              <Droplet className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Attar</span>
            </button>

            <button
              onClick={() => handleSelectScreen("CATALOG")}
              className={`h-[44px] flex items-center gap-2 px-3.5 xl:px-4 py-2 rounded-xl text-[13px] font-semibold cursor-pointer transition-all duration-150 select-none whitespace-nowrap shrink-0 ${
                activeScreen === "CATALOG"
                  ? "bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/25 ring-1 ring-amber-400/50 scale-[1.01]"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800/90 hover:shadow-xs active:scale-[0.98]"
              }`}
            >
              <Package className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
              <span>Perfumes</span>
            </button>

            <button
              onClick={() => handleSelectScreen("RETURNS")}
              className={`h-[44px] flex items-center gap-2 px-3.5 xl:px-4 py-2 rounded-xl text-[13px] font-semibold cursor-pointer transition-all duration-150 select-none whitespace-nowrap shrink-0 ${
                activeScreen === "RETURNS"
                  ? "bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/25 ring-1 ring-amber-400/50 scale-[1.01]"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800/90 hover:shadow-xs active:scale-[0.98]"
              }`}
            >
              <RotateCcw className="w-4 h-4 text-rose-500 shrink-0" />
              <span>Returns</span>
            </button>

            {/* Separator */}
            <div className="h-7 w-px bg-slate-300/80 dark:bg-slate-700/80 mx-1 shrink-0" />

            <button
              onClick={() => handleSelectScreen("OWNER_DASHBOARD")}
              className={`h-[44px] flex items-center gap-2 px-3.5 xl:px-4 py-2 rounded-xl text-[13px] font-semibold cursor-pointer transition-all duration-150 select-none whitespace-nowrap shrink-0 ${
                activeScreen === "OWNER_DASHBOARD"
                  ? "bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/25 ring-1 ring-amber-400/50 scale-[1.01]"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800/90 hover:shadow-xs active:scale-[0.98]"
              }`}
              title="Executive Dashboard"
            >
              <LayoutDashboard className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => handleSelectScreen("SALARIES")}
              className={`h-[44px] flex items-center gap-2 px-3.5 xl:px-4 py-2 rounded-xl text-[13px] font-semibold cursor-pointer transition-all duration-150 select-none whitespace-nowrap shrink-0 ${
                activeScreen === "SALARIES"
                  ? "bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/25 ring-1 ring-amber-400/50 scale-[1.01]"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800/90 hover:shadow-xs active:scale-[0.98]"
              }`}
              title="Staff Salaries & Wages"
            >
              <BadgeDollarSign className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Salaries</span>
            </button>
          </>
        )}

        {/* 2. CASHIER OPERATOR VIEW: POS Counter, Attar Bar, Perfumes, Returns, Expenses (Wholesale & Online Orders hidden for Cashiers) */}
        {isCashier && (
          <>
            <button
              onClick={() => handleSelectScreen("POS")}
              className={`h-[44px] flex items-center gap-2 px-3.5 xl:px-4 py-2 rounded-xl text-[13px] font-semibold cursor-pointer transition-all duration-150 select-none whitespace-nowrap shrink-0 ${
                activeScreen === "POS"
                  ? "bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/25 ring-1 ring-amber-400/50 scale-[1.01]"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800/90 hover:shadow-xs active:scale-[0.98]"
              }`}
            >
              <ShoppingBag className="w-4 h-4 shrink-0" />
              <span>POS</span>
            </button>

            <button
              onClick={() => handleSelectScreen("ATTAR")}
              className={`h-[44px] flex items-center gap-2 px-3.5 xl:px-4 py-2 rounded-xl text-[13px] font-semibold cursor-pointer transition-all duration-150 select-none whitespace-nowrap shrink-0 ${
                activeScreen === "ATTAR"
                  ? "bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/25 ring-1 ring-amber-400/50 scale-[1.01]"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800/90 hover:shadow-xs active:scale-[0.98]"
              }`}
            >
              <Droplet className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Attar</span>
            </button>

            <button
              onClick={() => handleSelectScreen("CATALOG")}
              className={`h-[44px] flex items-center gap-2 px-3.5 xl:px-4 py-2 rounded-xl text-[13px] font-semibold cursor-pointer transition-all duration-150 select-none whitespace-nowrap shrink-0 ${
                activeScreen === "CATALOG"
                  ? "bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/25 ring-1 ring-amber-400/50 scale-[1.01]"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800/90 hover:shadow-xs active:scale-[0.98]"
              }`}
            >
              <Package className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
              <span>Perfumes</span>
            </button>

            <button
              onClick={() => handleSelectScreen("RETURNS")}
              className={`h-[44px] flex items-center gap-2 px-3.5 xl:px-4 py-2 rounded-xl text-[13px] font-semibold cursor-pointer transition-all duration-150 select-none whitespace-nowrap shrink-0 ${
                activeScreen === "RETURNS"
                  ? "bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/25 ring-1 ring-amber-400/50 scale-[1.01]"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800/90 hover:shadow-xs active:scale-[0.98]"
              }`}
            >
              <RotateCcw className="w-4 h-4 text-rose-500 shrink-0" />
              <span>Returns</span>
            </button>

            <button
              onClick={() => handleSelectScreen("EXPENSES")}
              className={`h-[44px] flex items-center gap-2 px-3.5 xl:px-4 py-2 rounded-xl text-[13px] font-semibold cursor-pointer transition-all duration-150 select-none whitespace-nowrap shrink-0 ${
                activeScreen === "EXPENSES"
                  ? "bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/25 ring-1 ring-amber-400/50 scale-[1.01]"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800/90 hover:shadow-xs active:scale-[0.98]"
              }`}
            >
              <Banknote className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Petty Expenses</span>
            </button>
          </>
        )}

        {/* 3. MANAGER & SUPER ADMIN: POS, Wholesale, Attar, Perfumes + Categorized Suites */}
        {(isManager || isSuperAdmin) && (
          <>
            {/* Quick Primary Tab: POS Retail Billing */}
            <button
              onClick={() => handleSelectScreen("POS")}
              className={`h-[44px] flex items-center gap-2 px-3.5 xl:px-4 py-2 rounded-xl text-[13px] font-semibold cursor-pointer transition-all duration-150 select-none whitespace-nowrap shrink-0 ${
                activeScreen === "POS"
                  ? "bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/25 ring-1 ring-amber-400/50 scale-[1.01]"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800/90 hover:shadow-xs active:scale-[0.98]"
              }`}
            >
              <ShoppingBag className="w-4 h-4 shrink-0" />
              <span>POS</span>
            </button>

            {/* Quick Primary Tab: Returns */}
            <button
              onClick={() => handleSelectScreen("RETURNS")}
              className={`h-[44px] flex items-center gap-2 px-3.5 xl:px-4 py-2 rounded-xl text-[13px] font-semibold cursor-pointer transition-all duration-150 select-none whitespace-nowrap shrink-0 ${
                activeScreen === "RETURNS"
                  ? "bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/25 ring-1 ring-amber-400/50 scale-[1.01]"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800/90 hover:shadow-xs active:scale-[0.98]"
              }`}
            >
              <RotateCcw className="w-4 h-4 text-rose-500 shrink-0" />
              <span>Returns</span>
            </button>

            {/* Quick Primary Tab: Attar Bar */}
            <button
              onClick={() => handleSelectScreen("ATTAR")}
              className={`h-[44px] flex items-center gap-2 px-3.5 xl:px-4 py-2 rounded-xl text-[13px] font-semibold cursor-pointer transition-all duration-150 select-none whitespace-nowrap shrink-0 ${
                activeScreen === "ATTAR"
                  ? "bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/25 ring-1 ring-amber-400/50 scale-[1.01]"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800/90 hover:shadow-xs active:scale-[0.98]"
              }`}
            >
              <Droplet className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Attar</span>
            </button>

            {/* Quick Primary Tab: Perfumes Catalog */}
            <button
              onClick={() => handleSelectScreen("CATALOG")}
              className={`h-[44px] flex items-center gap-2 px-3.5 xl:px-4 py-2 rounded-xl text-[13px] font-semibold cursor-pointer transition-all duration-150 select-none whitespace-nowrap shrink-0 ${
                activeScreen === "CATALOG"
                  ? "bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/25 ring-1 ring-amber-400/50 scale-[1.01]"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800/90 hover:shadow-xs active:scale-[0.98]"
              }`}
            >
              <Package className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
              <span>Perfumes</span>
            </button>

            {/* Quick Primary Tab: Owner Dashboard (Super Admin Only) */}
            {isSuperAdmin && (
              <button
                onClick={() => handleSelectScreen("OWNER_DASHBOARD")}
                className={`h-[44px] flex items-center gap-2 px-3.5 xl:px-4 py-2 rounded-xl text-[13px] font-semibold cursor-pointer transition-all duration-150 select-none whitespace-nowrap shrink-0 ${
                  activeScreen === "OWNER_DASHBOARD"
                    ? "bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/25 ring-1 ring-amber-400/50 scale-[1.01]"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800/90 hover:shadow-xs active:scale-[0.98]"
                }`}
                title="Executive Dashboard"
              >
                <LayoutDashboard className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Dashboard</span>
              </button>
            )}

            {/* Consolidated Dropdown: Commercial Sales (Wholesale & Online Orders) */}
            <div className="relative">
              <button
                onClick={() => setOpenDropdown(openDropdown === "commercial" ? null : "commercial")}
                className={`h-[44px] flex items-center gap-2 px-3.5 xl:px-4 py-2 rounded-xl text-[13px] font-semibold cursor-pointer transition-all duration-150 select-none whitespace-nowrap shrink-0 ${
                  isCommercialActive
                    ? "bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/25 ring-1 ring-amber-400/50 scale-[1.01]"
                    : openDropdown === "commercial"
                    ? "bg-slate-200/80 dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800/90 hover:shadow-xs active:scale-[0.98]"
                }`}
                title="B2B Wholesale & Online Commerce Hub"
              >
                <Truck className="w-4 h-4 text-blue-500 shrink-0" />
                <span>Commercial Sales</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openDropdown === "commercial" ? "rotate-180" : ""}`} />
              </button>

              {openDropdown === "commercial" && (
                <div className="absolute top-full left-0 mt-2 w-64 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-2 z-[999] animate-in fade-in zoom-in-95 duration-150">
                  <button
                    onClick={() => handleSelectScreen("WHOLESALE")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors text-left cursor-pointer ${
                      activeScreen === "WHOLESALE"
                        ? "bg-amber-500 text-slate-950 font-semibold"
                        : "text-slate-700 dark:text-slate-300 hover:bg-amber-500/10 hover:text-amber-900 dark:hover:text-amber-200"
                    }`}
                  >
                    <Briefcase className="w-4 h-4 text-blue-500 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">Wholesale (B2B)</div>
                      <div className="text-[10px] opacity-75">Bulk invoicing & customer ledger</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleSelectScreen("ONLINE_ORDERS")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors text-left cursor-pointer ${
                      activeScreen === "ONLINE_ORDERS"
                        ? "bg-amber-500 text-slate-950 font-semibold"
                        : "text-slate-700 dark:text-slate-300 hover:bg-amber-500/10 hover:text-amber-900 dark:hover:text-amber-200"
                    }`}
                  >
                    <Globe className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">Online Orders Hub</div>
                      <div className="text-[10px] opacity-75">WhatsApp & Web orders, COD dispatch</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Category Separator */}
            <div className="h-7 w-px bg-slate-300/80 dark:bg-slate-700/80 mx-1 shrink-0" />

            {/* Dropdown 1: Finance */}
            <div className="relative">
              <button
                onClick={() => setOpenDropdown(openDropdown === "finance" ? null : "finance")}
                className={`h-[44px] flex items-center gap-2 px-3.5 xl:px-4 py-2 rounded-xl text-[13px] font-semibold cursor-pointer transition-all duration-150 select-none whitespace-nowrap shrink-0 ${
                  isFinanceActive
                    ? "bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/30 font-bold shadow-xs"
                    : openDropdown === "finance"
                    ? "bg-slate-200/80 dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800/90 hover:shadow-xs active:scale-[0.98]"
                }`}
                title="Finance Suite"
              >
                <Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Finance</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openDropdown === "finance" ? "rotate-180" : ""}`} />
              </button>

              {openDropdown === "finance" && (
                <div className="absolute top-full right-0 sm:left-0 mt-2 w-64 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-2 z-[999] animate-in fade-in zoom-in-95 duration-150">
                  <button
                    onClick={() => handleSelectScreen("EXPENSES")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors text-left ${
                      activeScreen === "EXPENSES"
                        ? "bg-amber-500 text-slate-950 font-semibold"
                        : "text-slate-700 dark:text-slate-300 hover:bg-amber-500/10 hover:text-amber-900 dark:hover:text-amber-200"
                    }`}
                  >
                    <Banknote className="w-4 h-4 text-amber-500 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">Petty Expenses</div>
                      <div className="text-[10px] opacity-75">Daily shop vouchers</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleSelectScreen("SALARIES")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors text-left ${
                      activeScreen === "SALARIES"
                        ? "bg-amber-500 text-slate-950 font-semibold"
                        : "text-slate-700 dark:text-slate-300 hover:bg-amber-500/10 hover:text-amber-900 dark:hover:text-amber-200"
                    }`}
                  >
                    <BadgeDollarSign className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">Staff Salaries & Wages</div>
                      <div className="text-[10px] opacity-75">Daily, weekly & monthly payouts</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleSelectScreen("AUDIT_REPORTS")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors text-left ${
                      activeScreen === "AUDIT_REPORTS"
                        ? "bg-amber-500 text-slate-950 font-semibold"
                        : "text-slate-700 dark:text-slate-300 hover:bg-amber-500/10 hover:text-amber-900 dark:hover:text-amber-200"
                    }`}
                  >
                    <TrendingUp className="w-4 h-4 text-amber-500 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">Master Reports & Analytics</div>
                      <div className="text-[10px] opacity-75">Daily, weekly, yearly, Excel & backups</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Dropdown 2: Admin & System (Super Admin Only) */}
            {isSuperAdmin && (
              <div className="relative">
                <button
                  onClick={() => setOpenDropdown(openDropdown === "system" ? null : "system")}
                  className={`h-[44px] flex items-center gap-2 px-3.5 xl:px-4 py-2 rounded-xl text-[13px] font-semibold cursor-pointer transition-all duration-150 select-none whitespace-nowrap shrink-0 ${
                    isSystemActive
                      ? "bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/30 font-bold shadow-xs"
                      : openDropdown === "system"
                      ? "bg-slate-200/80 dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800/90 hover:shadow-xs active:scale-[0.98]"
                  }`}
                  title="System Administration"
                >
                  <SlidersHorizontal className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                  <span>Admin</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openDropdown === "system" ? "rotate-180" : ""}`} />
                </button>

                {openDropdown === "system" && (
                  <div className="absolute top-full right-0 mt-2 w-72 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-2 z-[999] animate-in fade-in zoom-in-95 duration-150">
                    {/* MASTER REPORTS & DATA CENTER */}
                    <button
                      onClick={() => handleSelectScreen("AUDIT_REPORTS")}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors text-left ${
                        activeScreen === "AUDIT_REPORTS"
                          ? "bg-amber-500 text-slate-950 font-semibold"
                          : "text-slate-700 dark:text-slate-300 hover:bg-amber-500/10 hover:text-amber-900 dark:hover:text-amber-200"
                      }`}
                    >
                      <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">Master Reports & Backups</div>
                        <div className="text-[10px] opacity-75">Daily, weekly, yearly, Excel & DB export</div>
                      </div>
                    </button>

                    {/* USER SECURITY MANAGEMENT (PINs & Passwords) */}
                    <button
                      onClick={() => handleSelectScreen("USER_MANAGEMENT")}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors text-left ${
                        activeScreen === "USER_MANAGEMENT"
                          ? "bg-amber-500 text-slate-950 font-semibold"
                          : "text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20"
                      }`}
                    >
                      <KeyRound className="w-4 h-4 text-amber-500 shrink-0" />
                      <div>
                        <div className="font-bold">Staff Security & PINs</div>
                        <div className="text-[10px] opacity-80">Change passwords, PINs & roles</div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleSelectScreen("SYNC_CENTER")}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors text-left ${
                        activeScreen === "SYNC_CENTER"
                          ? "bg-amber-500 text-slate-950 font-semibold"
                          : "text-slate-700 dark:text-slate-300 hover:bg-amber-500/10 hover:text-amber-900 dark:hover:text-amber-200"
                      }`}
                    >
                      <ArrowRightLeft className="w-4 h-4 text-sky-500 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">P2P LAN Mesh Sync</div>
                        <div className="text-[10px] opacity-75">Station 1 & 2 replication</div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleSelectScreen("BACKUP")}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors text-left ${
                        activeScreen === "BACKUP"
                          ? "bg-amber-500 text-slate-950 font-semibold"
                          : "text-slate-700 dark:text-slate-300 hover:bg-amber-500/10 hover:text-amber-900 dark:hover:text-amber-200"
                      }`}
                    >
                      <FolderArchive className="w-4 h-4 text-amber-500 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">Hot Backups & DR</div>
                        <div className="text-[10px] opacity-75">Atomic snapshot & restore</div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleSelectScreen("HARDWARE")}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors text-left ${
                        activeScreen === "HARDWARE"
                          ? "bg-amber-500 text-slate-950 font-semibold"
                          : "text-slate-700 dark:text-slate-300 hover:bg-amber-500/10 hover:text-amber-900 dark:hover:text-amber-200"
                      }`}
                    >
                      <Printer className="w-4 h-4 text-emerald-500 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">Receipt & Store Settings</div>
                        <div className="text-[10px] opacity-75">Branch address & receipt header</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </nav>

      {/* Right: Active Staff Profile and Lock / Logout */}
      <div className="flex items-center gap-1.5 shrink-0 z-40 bg-white/95 dark:bg-slate-950/95 relative mr-1 sm:mr-2 min-w-fit">
        {/* User Profile & Action Dropdown (Lock Terminal, Logout, User Security) */}
        {currentUser && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === "user" ? null : "user")}
              className={`min-h-[46px] h-auto py-1 flex items-center gap-2 bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 px-2.5 sm:px-3 rounded-2xl shadow-xs shrink-0 cursor-pointer transition-colors ${
                openDropdown === "user" ? "border-amber-500 ring-2 ring-amber-500/20" : "hover:border-amber-400/60"
              }`}
              title="Click to view user profile, Lock [F10], Logout, or Reset DB"
            >
              <div className="text-left shrink-0 max-w-[150px] block">
                {renderFormattedName(currentUser.full_name)}
                <div className="text-[9px] mt-0.5">
                  <Badge variant={getRoleBadgeVariant(currentUser.role)} className="py-0 px-1 text-[8.5px] font-semibold leading-tight">
                    {formatRoleName(currentUser.role)}
                  </Badge>
                </div>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${openDropdown === "user" ? "rotate-180 text-amber-500" : ""}`} />
            </button>

            {/* Dropdown Menu */}
            {openDropdown === "user" && (
              <div className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2 z-50">
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800/80">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100 break-words" title={currentUser.full_name}>
                    {currentUser.full_name}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Username: <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{currentUser.username}</span>
                  </p>
                  <div className="mt-1.5">
                    <Badge variant={getRoleBadgeVariant(currentUser.role)} className="text-[10px]">
                      {formatRoleName(currentUser.role)}
                    </Badge>
                  </div>
                </div>

                <div className="py-1 space-y-0.5">
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectScreen("USER_MANAGEMENT");
                        setOpenDropdown(null);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-amber-500/10 hover:text-amber-900 dark:hover:text-amber-200 text-left transition-colors cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">User Management</div>
                        <div className="text-[10px] opacity-75">Roles, passwords & PINs</div>
                      </div>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setOpenDropdown(null);
                      onLockTerminal();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 text-left transition-colors cursor-pointer"
                  >
                    <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                    <div className="flex-1 flex items-center justify-between">
                      <span className="font-semibold">Lock Terminal</span>
                      <kbd className="text-[10px] font-mono px-1.5 py-0.5 bg-amber-500/20 text-amber-800 dark:text-amber-200 rounded">F10</kbd>
                    </div>
                  </button>

                  {onLogout && (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenDropdown(null);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-left transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-500 shrink-0" />
                      <div className="flex-1">
                        <span className="font-semibold">Log Out</span>
                        <p className="text-[10px] text-slate-400">Exit active workstation session</p>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
