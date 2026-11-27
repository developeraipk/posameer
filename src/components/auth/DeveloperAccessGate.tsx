import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { verifyDeveloperCredentials } from "@/lib/tauri-bridge";
import type { ActiveScreen } from "@/components/layout/Navbar";
import {
  ShieldCheck,
  Lock,
  User,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowLeft,
  Terminal,
} from "lucide-react";

export const DEVELOPER_ONLY_SCREENS: ActiveScreen[] = [
  "SYNC_CENTER",
  "BACKUP",
  "HARDWARE",
];

export const DEVELOPER_SCREEN_LABELS: Record<string, string> = {
  SYNC_CENTER: "P2P LAN Mesh Sync",
  BACKUP: "Hot Backups & DR",
  HARDWARE: "Receipt & Store Settings",
};

interface DeveloperAccessGateProps {
  mode: "modal" | "screen";
  targetScreen: ActiveScreen;
  onSuccess: () => void;
  onCancel?: () => void;
}

export const DeveloperAccessGate: React.FC<DeveloperAccessGateProps> = ({
  mode,
  targetScreen,
  onSuccess,
  onCancel,
}) => {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setError(null);
  }, [targetScreen]);

  useEffect(() => {
    if (mode !== "modal" || !onCancel) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, onCancel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId.trim() || !password) {
      setError("Please enter both Developer Login ID and Password.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const ok = await verifyDeveloperCredentials(loginId, password);
      if (ok) {
        setLoginId("");
        setPassword("");
        onSuccess();
      } else {
        setError("Invalid Developer Login ID or Password. Access Denied (Developer Only).");
      }
    } catch {
      setError("Developer verification failed. Access Denied.");
    } finally {
      setSubmitting(false);
    }
  };

  const screenTitle = DEVELOPER_SCREEN_LABELS[targetScreen] || "Developer System Settings";

  const cardBody = (
    <Card
      variant="elevated"
      className="w-full max-w-md border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl relative overflow-hidden p-6"
    >
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-600 via-rose-500 to-amber-600" />

      <div className="flex items-start justify-between gap-3 mb-4 pt-1">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-slate-900 dark:bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-500 shadow-sm shrink-0">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Developer Access Required
              </h2>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Target Module: <strong className="text-amber-700 dark:text-amber-400">{screenTitle}</strong>
            </p>
          </div>
        </div>
        <Badge variant="danger" className="text-[9px] font-mono uppercase shrink-0">
          DEV ONLY
        </Badge>
      </div>

      <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-slate-700 dark:text-slate-300 flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <span>
          This administrative configuration screen is locked for <strong>Developer Only</strong> access using immutable system credentials.
        </span>
      </div>

      {error && (
        <div className="mb-4 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Developer Login ID
          </label>
          <Input
            type="text"
            value={loginId}
            onChange={(e) => {
              setLoginId(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Enter developer login ID"
            autoComplete="off"
            autoFocus
            icon={<User className="w-4 h-4 text-slate-400" />}
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Developer Password
          </label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Enter developer password"
              autoComplete="off"
              icon={<KeyRound className="w-4 h-4 text-slate-400" />}
              className="pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 cursor-pointer"
              title={showPassword ? "Hide Password" : "Show Password"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex items-center gap-1.5"
            >
              {mode === "screen" && <ArrowLeft className="w-3.5 h-3.5" />}
              <span>{mode === "screen" ? "Return to POS" : "Cancel"}</span>
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            disabled={submitting}
            className="flex items-center gap-1.5 font-bold"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{submitting ? "Verifying..." : "Unlock Developer Access"}</span>
          </Button>
        </div>
      </form>
    </Card>
  );

  if (mode === "modal") {
    return (
      <div className="fixed inset-0 z-[120] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
        {cardBody}
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-slate-100/60 dark:bg-slate-950/80 min-h-full">
      {cardBody}
    </div>
  );
};
