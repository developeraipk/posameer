import { useState, useEffect, useRef } from "react";
import { SystemUser, WorkstationStatus, StoreConfig } from "@/types/system";
import { FinishedProduct } from "@/types/database";
import { Navbar, ActiveScreen } from "@/components/layout/Navbar";
import { LockScreen } from "@/screens/SCR-AUTH-01_LockScreen";
import { RetailBilling } from "@/screens/SCR-POS-01_RetailBilling";
import { ProductCatalog } from "@/screens/SCR-CAT-01_ProductCatalog";
import { Procurement } from "@/screens/SCR-PUR-01_Procurement";
import { Manufacturing } from "@/screens/SCR-MFG-01_Manufacturing";
import { WholesaleInvoicing } from "@/screens/SCR-WHO-01_WholesaleInvoicing";
import { OnlineOrders } from "@/screens/SCR-ONL-01_OnlineOrders";
import { AttarSales } from "@/screens/SCR-ATR-01_AttarSales";
import { ShopExpenses } from "@/screens/SCR-EXP-01_ShopExpenses";
import { EmployeeSalaries } from "@/screens/SCR-SAL-01_EmployeeSalaries";
import { ReturnManagement } from "@/screens/SCR-RET-01_ReturnManagement";
import { Reports } from "@/screens/SCR-REP-01_Reports";
import { OwnerDashboard } from "@/screens/SCR-OWN-01_OwnerDashboard";
import { SyncCenter } from "@/screens/SCR-SNC-01_SyncCenter";
import { BackupDisasterRecovery } from "@/screens/SCR-BAK-01_BackupDisasterRecovery";
import { HardwareSettings } from "@/screens/SCR-SET-01_HardwareSettings";
import { SystemHealth } from "@/screens/SCR-SYS-01_SystemHealth";
import { UserSecurityManagement } from "@/screens/SCR-ADM-01_UserSecurityManagement";
import { getWorkstationStatus, getNetworkStationConfig } from "@/lib/tauri-bridge";
import { configService } from "@/lib/config";
import { usePOSStore } from "@/store/pos-store";
import { getInitialTheme, applyTheme } from "@/lib/theme";
import { ShieldAlert, Lock, Terminal } from "lucide-react";
import {
  DeveloperAccessGate,
  DEVELOPER_ONLY_SCREENS,
  DEVELOPER_SCREEN_LABELS,
} from "@/components/auth/DeveloperAccessGate";

export function App() {
  // Session persistence: restore authenticated session across window reloads / F5 / Ctrl+R
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(() => {
    try {
      const saved = sessionStorage.getItem("ameer_pos_active_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [lockedUser, setLockedUser] = useState<SystemUser | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    try {
      const saved = sessionStorage.getItem("ameer_pos_active_user");
      return !saved;
    } catch {
      return true;
    }
  });
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>(() => {
    try {
      const savedScreen = sessionStorage.getItem("ameer_pos_active_screen") as ActiveScreen | null;
      if (savedScreen && !DEVELOPER_ONLY_SCREENS.includes(savedScreen)) {
        return savedScreen;
      }
      return "POS";
    } catch {
      return "POS";
    }
  });
  const [isDeveloperUnlocked, setIsDeveloperUnlocked] = useState<boolean>(false);
  const [pendingDevScreen, setPendingDevScreen] = useState<ActiveScreen | null>(null);
  const currentUserRef = useRef<SystemUser | null>(null);
  currentUserRef.current = currentUser;

  const [status, setStatus] = useState<WorkstationStatus>({
    stationId: "POS-01",
    isPrimaryServer: true,
    lanIp: "192.168.1.100",
    meshPort: 7878,
    peerConnected: true,
    peerStationId: "POS-02",
    peerLastHeartbeat: new Date().toISOString(),
    outboxPendingCount: 0,
    quarantineConflictCount: 0,
    sqliteWalSizeKb: 128,
    databaseTablesCount: 46,
    databaseIndexesCount: 105,
    cloudSyncEnabled: true,
    cloudLastSyncedAt: new Date().toISOString(),
    cloudSyncDelayed: false,
  });

  const [storeConfig, setStoreConfig] = useState<StoreConfig>(configService.getConfig());
  const addToCart = usePOSStore((state) => state.addToCart);

  // Client Station Terminal Access Block State (controlled by Master PC-1 Admin via shared SQLite)
  const [isTerminalBlocked, setIsTerminalBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState("");

  useEffect(() => {
    let isMounted = true;
    const checkBlocked = async () => {
      try {
        const cfg = await getNetworkStationConfig();
        if (!isMounted) return;
        if (cfg.station_role === "CLIENT") {
          setIsTerminalBlocked(Boolean(cfg.is_blocked));
          setBlockedReason(cfg.blocked_reason || "PC-2 database access revoked by Admin");
        } else {
          setIsTerminalBlocked(false);
        }
      } catch (err) {
        // ignore
      }
    };

    checkBlocked();
    const interval = setInterval(checkBlocked, 2000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const refreshStatus = async () => {
    try {
      const updated = await getWorkstationStatus();
      setStatus(updated);
      setStoreConfig(configService.getConfig());
    } catch (err) {
      console.error("Failed to refresh status:", err);
    }
    // Broadcast live refresh event to active screens (Dashboard, POS, Reports, etc.)
    window.dispatchEvent(new CustomEvent("app:refresh-data"));
  };

  useEffect(() => {
    // Initialize theme (default: light)
    const initialTheme = getInitialTheme();
    applyTheme(initialTheme);

    refreshStatus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F10") {
        e.preventDefault();
        // Lock workstation terminal for current active operator (requires PIN to unlock, does not logout)
        if (currentUserRef.current) {
          setLockedUser(currentUserRef.current);
        }
        setIsDeveloperUnlocked(false);
        setPendingDevScreen(null);
        setIsLocked(true);
      } else if (e.key === "F5" || ((e.ctrlKey || e.metaKey) && (e.key === "r" || e.key === "R"))) {
        e.preventDefault();
        // Live in-app screen data refresh without window reload or accidental logout
        refreshStatus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    const handleUserUpdated = (e: any) => {
      if (e.detail) {
        setCurrentUser(e.detail);
      }
    };
    window.addEventListener("app:user-updated", handleUserUpdated);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("app:user-updated", handleUserUpdated);
    };
  }, []);

  const handleAuthenticated = (user: SystemUser) => {
    setCurrentUser(user);
    setIsDeveloperUnlocked(false);
    setPendingDevScreen(null);
    try {
      sessionStorage.setItem("ameer_pos_active_user", JSON.stringify(user));
    } catch (e) {
      console.warn("Could not save session:", e);
    }
    const wasLocked = lockedUser !== null;
    setLockedUser(null);
    setIsLocked(false);
    // If not resuming an existing locked session, or if returning to a developer-only screen, land safely
    if (!wasLocked || DEVELOPER_ONLY_SCREENS.includes(activeScreen)) {
      const targetScreen: ActiveScreen = user.role === "OWNER" ? "OWNER_DASHBOARD" : "POS";
      setActiveScreen(targetScreen);
      try {
        sessionStorage.setItem("ameer_pos_active_screen", targetScreen);
      } catch {}
    }
  };

  const handleLockTerminal = () => {
    setLockedUser(currentUser);
    setIsDeveloperUnlocked(false);
    setPendingDevScreen(null);
    setIsLocked(true);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setLockedUser(null);
    setIsDeveloperUnlocked(false);
    setPendingDevScreen(null);
    setIsLocked(true);
    try {
      sessionStorage.removeItem("ameer_pos_active_user");
      sessionStorage.removeItem("ameer_pos_active_screen");
    } catch (e) {
      console.warn("Could not clear session:", e);
    }
  };

  const navigateToScreen = (screen: ActiveScreen) => {
    if (DEVELOPER_ONLY_SCREENS.includes(screen) && !isDeveloperUnlocked) {
      setPendingDevScreen(screen);
      return;
    }
    setActiveScreen(screen);
    try {
      sessionStorage.setItem("ameer_pos_active_screen", screen);
    } catch {}
  };

  const lockDeveloperAccess = () => {
    setIsDeveloperUnlocked(false);
    setPendingDevScreen(null);
    const fallbackScreen: ActiveScreen = currentUser?.role === "OWNER" ? "OWNER_DASHBOARD" : "POS";
    setActiveScreen(fallbackScreen);
    try {
      sessionStorage.setItem("ameer_pos_active_screen", fallbackScreen);
    } catch {}
  };

  const handleNavigateToPOS = (product?: FinishedProduct) => {
    if (product) {
      addToCart(product);
    }
    setActiveScreen("POS");
    try {
      sessionStorage.setItem("ameer_pos_active_screen", "POS");
    } catch {}
  };

  // RBAC Route Guard: Enforce strict role-based dashboard access
  useEffect(() => {
    if (!currentUser) return;
    const role = currentUser.role;

    if (role === "OWNER") {
      const allowedOwnerScreens: ActiveScreen[] = [
        "OWNER_DASHBOARD",
        "AUDIT_REPORTS",
        "WHOLESALE",
        "ONLINE_ORDERS",
        "CATALOG",
        "ATTAR",
        "POS",
        "RETURNS",
        "SALARIES",
      ];
      if (!allowedOwnerScreens.includes(activeScreen)) {
        setActiveScreen("OWNER_DASHBOARD");
      }
    } else if (role === "CASHIER_OPERATOR") {
      const allowedCashierScreens: ActiveScreen[] = [
        "POS",
        "ONLINE_ORDERS",
        "RETURNS",
        "ATTAR",
        "CATALOG",
        "EXPENSES",
      ];
      if (!allowedCashierScreens.includes(activeScreen)) {
        setActiveScreen("POS");
      }
    } else if (role === "SHOP_MANAGER") {
      const forbiddenManagerScreens: ActiveScreen[] = [
        "USER_MANAGEMENT",
        "BACKUP",
        "HARDWARE",
        "SYSTEM_HEALTH",
        "OWNER_DASHBOARD",
      ];
      if (forbiddenManagerScreens.includes(activeScreen)) {
        setActiveScreen("POS");
      }
    }
  }, [currentUser, activeScreen]);

  return (
    <div className="h-screen max-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans select-none w-full max-w-full relative overflow-hidden">
      {/* Top Application Navbar with Categorized Dropdowns & Brand Identity */}
      <Navbar
        currentUser={currentUser}
        status={status}
        storeConfig={storeConfig}
        activeScreen={activeScreen}
        isDeveloperUnlocked={isDeveloperUnlocked}
        onNavigate={navigateToScreen}
        onLockTerminal={handleLockTerminal}
        onLogout={handleLogout}
        onRefreshStatus={refreshStatus}
      />

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col min-w-0 w-full max-w-full">
        {activeScreen === "POS" && (
          <RetailBilling
            currentUser={currentUser}
            status={status}
            onSwitchUser={handleAuthenticated}
          />
        )}
        {activeScreen === "CATALOG" && (
          <div className="flex-1 overflow-y-auto min-w-0">
            <ProductCatalog
              currentUser={currentUser}
              onNavigateToPOS={handleNavigateToPOS}
            />
          </div>
        )}
        {activeScreen === "PROCUREMENT" && (
          <div className="flex-1 overflow-y-auto min-w-0">
            <Procurement currentUser={currentUser} />
          </div>
        )}
        {activeScreen === "MANUFACTURING" && (
          <div className="flex-1 overflow-y-auto min-w-0">
            <Manufacturing currentUser={currentUser} />
          </div>
        )}
        {activeScreen === "WHOLESALE" && (
          <div className="flex-1 overflow-y-auto min-w-0">
            <WholesaleInvoicing currentUser={currentUser} />
          </div>
        )}
        {activeScreen === "ONLINE_ORDERS" && (
          <div className="flex-1 overflow-y-auto min-w-0">
            <OnlineOrders currentUser={currentUser} />
          </div>
        )}
        {activeScreen === "ATTAR" && (
          <div className="flex-1 overflow-y-auto min-w-0">
            <AttarSales currentUser={currentUser} onNavigateToPOS={handleNavigateToPOS} />
          </div>
        )}
        {activeScreen === "EXPENSES" && (
          <div className="flex-1 overflow-y-auto min-w-0">
            <ShopExpenses currentUser={currentUser} status={status} />
          </div>
        )}
        {activeScreen === "SALARIES" && (
          <div className="flex-1 overflow-y-auto min-w-0">
            <EmployeeSalaries currentUser={currentUser} status={status} />
          </div>
        )}
        {activeScreen === "RETURNS" && (
          <div className="flex-1 overflow-y-auto min-w-0">
            <ReturnManagement currentUser={currentUser} status={status} />
          </div>
        )}
        {activeScreen === "AUDIT_REPORTS" && (
          <div className="flex-1 overflow-y-auto min-w-0">
            <Reports currentUser={currentUser} />
          </div>
        )}
        {activeScreen === "OWNER_DASHBOARD" && (
          <div className="flex-1 overflow-y-auto min-w-0">
            <OwnerDashboard currentUser={currentUser} status={status} />
          </div>
        )}
        {DEVELOPER_ONLY_SCREENS.includes(activeScreen) && (
          isDeveloperUnlocked ? (
            <div className="flex-1 flex flex-col min-h-0 min-w-0">
              <div className="px-4 py-2 bg-slate-900 text-slate-100 border-b border-amber-500/30 flex items-center justify-between gap-3 text-xs shrink-0">
                <div className="flex items-center gap-2 font-mono">
                  <Terminal className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-bold text-amber-400">DEVELOPER MODE</span>
                  <span className="text-slate-400 hidden sm:inline">•</span>
                  <span className="text-slate-300 hidden sm:inline">
                    {DEVELOPER_SCREEN_LABELS[activeScreen] || activeScreen}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={lockDeveloperAccess}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-semibold cursor-pointer transition-colors"
                >
                  <Lock className="w-3 h-3" />
                  <span>Lock Developer Access</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto min-w-0">
                {activeScreen === "SYNC_CENTER" && <SyncCenter currentUser={currentUser} status={status} />}
                {activeScreen === "BACKUP" && <BackupDisasterRecovery currentUser={currentUser} status={status} />}
                {activeScreen === "HARDWARE" && <HardwareSettings currentUser={currentUser} status={status} />}
              </div>
            </div>
          ) : (
            <DeveloperAccessGate
              mode="screen"
              targetScreen={activeScreen}
              onSuccess={() => setIsDeveloperUnlocked(true)}
              onCancel={lockDeveloperAccess}
            />
          )
        )}
        {activeScreen === "SYSTEM_HEALTH" && (
          <div className="flex-1 overflow-y-auto min-w-0">
            <SystemHealth
              status={status}
              storeConfig={storeConfig}
              currentUser={currentUser}
              onRefresh={refreshStatus}
            />
          </div>
        )}
        {activeScreen === "USER_MANAGEMENT" && (
          <div className="flex-1 overflow-y-auto min-w-0">
            <UserSecurityManagement currentUser={currentUser} />
          </div>
        )}
      </main>

      {/* Developer Only Authentication Modal for Restricted Admin Screens */}
      {pendingDevScreen && !isDeveloperUnlocked && (
        <DeveloperAccessGate
          mode="modal"
          targetScreen={pendingDevScreen}
          onSuccess={() => {
            const target = pendingDevScreen;
            setIsDeveloperUnlocked(true);
            setPendingDevScreen(null);
            setActiveScreen(target);
            try {
              sessionStorage.setItem("ameer_pos_active_screen", target);
            } catch {}
          }}
          onCancel={() => setPendingDevScreen(null)}
        />
      )}

      {/* Luxury PIN Staff Login Screen Modal (SCR-AUTH-01) */}
      {isLocked && (
        <LockScreen
          status={status}
          lockedUser={lockedUser}
          onAuthenticated={handleAuthenticated}
          onLogout={handleLogout}
        />
      )}

      {/* Station Access Blocked Lockout Modal (PC-2 Admin Restriction) */}
      {isTerminalBlocked && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-white select-none">
          <div className="max-w-md w-full bg-slate-900 border-2 border-rose-500 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center space-y-5 animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 rounded-full bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center text-rose-500 shadow-lg shadow-rose-500/20">
              <ShieldAlert className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold uppercase tracking-widest">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                Access Restricted
              </div>
              <h2 className="text-2xl font-black text-rose-100 font-serif">
                Station 2 (PC-2) Access Blocked
              </h2>
              <p className="text-xs text-rose-300/80 leading-relaxed">
                {blockedReason || "PC-2 database access revoked by Admin"}
              </p>
            </div>

            <div className="w-full bg-rose-950/40 border border-rose-800/50 rounded-2xl p-4 text-xs text-left space-y-2 text-rose-200">
              <div className="flex items-center justify-between border-b border-rose-800/40 pb-2">
                <span className="text-slate-400">Terminal Role:</span>
                <span className="font-mono font-bold text-amber-400">CLIENT (Counter Terminal)</span>
              </div>
              <div className="flex items-center justify-between border-b border-rose-800/40 pb-2">
                <span className="text-slate-400">Master Authority:</span>
                <span className="font-bold text-slate-200">PC-1 (Main Server Admin)</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-400">Status:</span>
                <span className="font-bold text-rose-400 animate-pulse">LOCKDOWN ACTIVE</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              Sales, inventory updates, and billing operations are temporarily suspended. As soon as the PC-1 Admin clicks <strong className="text-emerald-400">"Unblock PC-2"</strong>, this terminal will automatically unlock and resume instantly.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
