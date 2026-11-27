import React, { useState, useEffect } from "react";
import { SystemUser, WorkstationStatus } from "@/types/system";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import {
  Delete,
  Shield,
  KeyRound,
  AlertCircle,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
} from "lucide-react";
import { fastSwitchUser, loginWithCredentials } from "@/lib/tauri-bridge";
import logoSquare from "@/assets/logo-square.jpeg";

interface LockScreenProps {
  status: WorkstationStatus;
  lockedUser?: SystemUser | null;
  onAuthenticated: (user: SystemUser) => void;
  onLogout?: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({
  status: _status,
  lockedUser,
  onAuthenticated,
  onLogout,
}) => {
  const [authMode, setAuthMode] = useState<"PIN" | "PASSWORD">(() => {
    return (localStorage.getItem("pos_auth_mode") as "PIN" | "PASSWORD") || "PASSWORD";
  });

  const handleSwitchAuthMode = (mode: "PIN" | "PASSWORD") => {
    setAuthMode(mode);
    localStorage.setItem("pos_auth_mode", mode);
    setError(null);
  };

  // PIN Mode State
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Password Mode State
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleDigit = (digit: string) => {
    if (authMode !== "PIN") return;
    if (pin.length < 6) {
      setPin((prev) => prev + digit);
      setError(null);
    }
  };

  const handleDelete = () => {
    if (authMode !== "PIN") return;
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    setPin("");
    setError(null);
  };

  useEffect(() => {
    if (authMode !== "PIN") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        handleDigit(e.key);
      } else if (e.key === "Backspace") {
        handleDelete();
      } else if (e.key === "Escape") {
        handleClear();
      } else if (e.key === "Enter" && pin.length >= 4) {
        submitPin(pin);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pin, authMode]);

  useEffect(() => {
    if (authMode === "PIN" && (pin.length === 4 || pin.length === 6)) {
      submitPin(pin);
    }
  }, [pin, authMode]);

  const submitPin = async (enteredPin: string) => {
    setLoading(true);
    setError(null);
    try {
      const user = await fastSwitchUser(enteredPin);
      if (user) {
        onAuthenticated(user);
      } else {
        setError("Invalid Security PIN. Access Denied.");
        setPin("");
      }
    } catch (err: any) {
      setError(typeof err === "string" ? err : err?.message || "Authentication error.");
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const user = await loginWithCredentials(username.trim(), password.trim());
      if (user) {
        setUsername("");
        setPassword("");
        onAuthenticated(user);
      } else {
        setError("Invalid username or password. Access Denied.");
      }
    } catch (err: any) {
      setError(typeof err === "string" ? err : err?.message || "Authentication service unavailable.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 dark:bg-slate-950/90 backdrop-blur-xl select-none">
      <div className="min-h-full flex items-center justify-center p-4 py-8">
        {/* Top Floating Controls */}
        <div className="fixed top-6 right-6 flex items-center gap-3 z-10">
          <ThemeToggle showLabel={true} />
        </div>

        <Card variant="elevated" className="w-full max-w-md border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl relative overflow-hidden my-auto">
          {/* Luxury Gold Ambient Top Glow */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600"></div>

          {/* Brand Header */}
          <div className="text-center mb-5 pt-2">
            <img
              src={logoSquare}
              alt="Ameer Perfumes"
              className="w-20 h-20 rounded-2xl mx-auto shadow-xl shadow-amber-500/25 object-cover mb-3 border-2 border-amber-500/30"
            />
            <h2 className="text-xl font-bold font-serif text-slate-900 dark:text-slate-100 tracking-wider uppercase">
              AMEER PERFUMES
            </h2>
            <p className="text-[11px] font-sans font-medium text-amber-700 dark:text-amber-400 uppercase tracking-widest mt-0.5">
              Haute Parfumerie • Pure Concentrated Oils
            </p>

          {/* Active Operator Locked Banner */}
          {lockedUser ? (
            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between text-left">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-600 to-amber-400 text-slate-950 font-bold flex items-center justify-center text-xs shadow-xs">
                  {lockedUser.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "OP"}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-amber-500" />
                    <span>Workstation Locked</span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400">
                    {lockedUser.full_name} ({lockedUser.role})
                  </div>
                </div>
              </div>
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="text-[10px] text-rose-600 dark:text-rose-400 hover:underline font-semibold cursor-pointer"
                  title="Log out and return to clean sign-in screen"
                >
                  Log Out
                </button>
              )}
            </div>
          ) : (
            <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
              Select Operator or Enter PIN to Start Shift
            </div>
          )}
        </div>

        {/* Auth Mode Toggle Tabs (Fast PIN vs Password) */}
        <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800/80 p-1 mb-5 border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => handleSwitchAuthMode("PIN")}
            className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              authMode === "PIN"
                ? "bg-amber-500 text-slate-950 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Fast PIN Unlock</span>
          </button>
          <button
            type="button"
            onClick={() => handleSwitchAuthMode("PASSWORD")}
            className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              authMode === "PASSWORD"
                ? "bg-amber-500 text-slate-950 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Staff Password Login</span>
          </button>
        </div>

        {/* Error Alert Banner */}
        {error && (
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 p-2.5 rounded-lg mb-4 justify-center animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* MODE 1: Fast 4-to-6 Digit PIN Keypad */}
        {authMode === "PIN" && (
          <div>
            <p className="text-xs text-center text-slate-500 dark:text-slate-400 mb-3">
              Enter your assigned 4 to 6 digit security PIN to unlock:
            </p>

            {/* Masked PIN Indicators */}
            <div className="flex justify-center gap-3 mb-5">
              {[0, 1, 2, 3, 4, 5].slice(0, Math.max(4, pin.length)).map((idx) => (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                    pin.length > idx
                      ? "bg-amber-500 border-amber-500 scale-125 shadow-md shadow-amber-500/50"
                      : "border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60"
                  }`}
                />
              ))}
            </div>

            {/* Numeric Touch Keypad */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleDigit(num)}
                  disabled={loading}
                  className="h-12 rounded-xl bg-slate-100 dark:bg-slate-800/90 hover:bg-amber-50 dark:hover:bg-slate-700 active:scale-95 text-lg font-mono font-bold text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center cursor-pointer shadow-xs hover:border-amber-300 dark:hover:border-amber-500/50"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClear}
                disabled={loading}
                className="h-12 rounded-xl bg-slate-100/60 dark:bg-slate-800/40 hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50 transition-all flex items-center justify-center cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleDigit("0")}
                disabled={loading}
                className="h-12 rounded-xl bg-slate-100 dark:bg-slate-800/90 hover:bg-amber-50 dark:hover:bg-slate-700 active:scale-95 text-lg font-mono font-bold text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center cursor-pointer shadow-xs hover:border-amber-300 dark:hover:border-amber-500/50"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="h-12 rounded-xl bg-slate-100/60 dark:bg-slate-800/40 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50 transition-all flex items-center justify-center cursor-pointer"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            <Button
              type="button"
              variant="primary"
              disabled={loading || pin.length < 4}
              onClick={() => submitPin(pin)}
              className="w-full h-11 gap-2 font-bold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 mb-3"
            >
              <span>{loading ? "Verifying PIN..." : "Unlock with PIN"}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* MODE 2: Staff Username + Password Form */}
        {authMode === "PASSWORD" && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4 mb-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Enter username (e.g. admin)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 pl-9 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  autoFocus
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 pl-9 pr-10 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="w-full h-11 gap-2 font-bold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 mt-2"
            >
              <span>{loading ? "Authenticating..." : "Sign In & Unlock"}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        )}

        {lockedUser && onLogout && (
          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={onLogout}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline cursor-pointer"
            >
              ← Sign out & switch to another operator
            </button>
          </div>
        )}

        {/* Security & Software Credit Notice Footer */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-3 text-center space-y-1">
          <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-amber-500/80" />
            <span>Ameer Perfumes ERP • Secure Operator Authentication</span>
          </p>
          <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-semibold">
            Software Developed by Global Tech • Contact: 0329 9969277
          </p>
        </div>
      </Card>
      </div>
    </div>
  );
};
