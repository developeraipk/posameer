import React, { useState, useEffect } from "react";
import { SystemUser, WorkstationStatus } from "@/types/system";
import {
  triggerLanReplication,
  enqueueSyncEvent,
  triggerCloudSync,
  getCloudSyncSettings,
  saveCloudSyncSettings,
  testCloudConnection,
  triggerFullCloudSnapshotSync,
  uploadCloudBackup,
  clearSyncJournal,
  getNetworkStationConfig,
  saveNetworkStationConfig,
  testNetworkDbConnection,
  openDatabaseFolder,
  enableWindowsLanSharing,
  setTerminalBlockedStatus,
  NetworkStationConfig,
} from "@/lib/tauri-bridge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Wifi,
  RefreshCw,
  ShieldAlert,
  CheckCircle2,
  Server,
  Plus,
  Trash2,
  FolderOpen,
  Laptop,
  Save,
  Cloud,
  CloudDownload,
  Upload,
  Database,
  Eye,
  EyeOff,
} from "lucide-react";

interface SyncCenterProps {
  currentUser?: SystemUser | null;
  status: WorkstationStatus;
}

export const SyncCenter: React.FC<SyncCenterProps> = ({ currentUser, status }) => {
  const [loading, setLoading] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Hostinger Shared Cloud Config States
  const [cloudEnabled, setCloudEnabled] = useState(true);
  const [cloudUrl, setCloudUrl] = useState("");
  const [cloudToken, setCloudToken] = useState("");
  const [showCloudToken, setShowCloudToken] = useState(false);
  const [cloudAutoMinutes, setCloudAutoMinutes] = useState(5);
  const [cloudLastSynced, setCloudLastSynced] = useState<string | null>(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudFeedback, setCloudFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    getCloudSyncSettings()
      .then((cfg) => {
        setCloudEnabled(cfg.cloud_sync_enabled);
        setCloudUrl(cfg.cloud_api_url || "");
        setCloudToken(cfg.cloud_api_token || "");
        setCloudAutoMinutes(cfg.cloud_auto_sync_minutes || 5);
        setCloudLastSynced(cfg.cloud_last_synced_at);
      })
      .catch(() => {});
  }, []);

  // Network Multi-Station Setup States
  const [networkConfig, setNetworkConfig] = useState<NetworkStationConfig | null>(null);
  const [stationRole, setStationRole] = useState<"MASTER" | "CLIENT">("MASTER");
  const [masterDbPath, setMasterDbPath] = useState("");
  const [netFeedback, setNetFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSavingNet, setIsSavingNet] = useState(false);
  const [isPc2Blocked, setIsPc2Blocked] = useState<boolean>(false);

  const toggleBlockPc2 = async () => {
    const nextState = !isPc2Blocked;
    setIsPc2Blocked(nextState);
    try {
      await setTerminalBlockedStatus(
        "POS-02",
        nextState,
        nextState ? "PC-2 database access revoked by Admin" : "",
        currentUser?.user_id || ""
      );
      setNetFeedback({
        type: nextState ? "error" : "success",
        text: nextState
          ? "Station 2 (PC-2 Counter Terminal) has been BLOCKED in SQLite database. PC-2 sales, billing, and transactions are now completely locked."
          : "Station 2 (PC-2 Counter Terminal) has been UNBLOCKED and normal counter operations are restored.",
      });
      fetchNetworkConfig();
    } catch (err: any) {
      console.error("Failed to update terminal block state:", err);
      setNetFeedback({
        type: "error",
        text: `Failed to update terminal access in database: ${err?.message || err}`,
      });
    }
  };

  const fetchNetworkConfig = async () => {
    try {
      const cfg = await getNetworkStationConfig();
      setNetworkConfig(cfg);
      setStationRole(cfg.station_role === "CLIENT" ? "CLIENT" : "MASTER");
      setMasterDbPath(cfg.master_db_path || `\\\\${cfg.local_ip}\\AmeerPerfumes\\ameer_pos.db`);
      if (typeof cfg.is_pc2_blocked === "boolean") {
        setIsPc2Blocked(cfg.is_pc2_blocked);
      }
    } catch (e) {
      console.error("Failed to load network station config:", e);
    }
  };

  useEffect(() => {
    fetchNetworkConfig();
    const interval = setInterval(fetchNetworkConfig, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleTestNetworkDb = async () => {
    setNetFeedback(null);
    try {
      const res = await testNetworkDbConnection(masterDbPath);
      setNetFeedback({ type: "success", text: res });
    } catch (err: any) {
      setNetFeedback({
        type: "error",
        text: typeof err === "string" ? err : err.message || "Failed to reach database at specified path",
      });
    }
  };

  const handleSaveNetworkStation = async () => {
    setNetFeedback(null);
    setIsSavingNet(true);
    try {
      await saveNetworkStationConfig(
        stationRole,
        stationRole === "MASTER" ? "Master Server" : "Counter Terminal",
        masterDbPath
      );
      setNetFeedback({
        type: "success",
        text: `Configuration saved! This station is set to ${stationRole}. Live shared database connected.`,
      });
      await fetchNetworkConfig();
    } catch (err: any) {
      setNetFeedback({
        type: "error",
        text: typeof err === "string" ? err : err.message || "Failed to save station configuration",
      });
    } finally {
      setIsSavingNet(false);
    }
  };

  const handleOpenFolder = async () => {
    try {
      await openDatabaseFolder();
    } catch (e: any) {
      alert("Failed to open folder: " + e);
    }
  };

  const loadSyncData = async () => {
    // Sync telemetry
  };

  const handleTriggerSync = async () => {
    setLoading(true);
    setSyncFeedback(null);
    try {
      const peerNode = status.stationId === "POS-01" ? "POS-02" : "POS-01";
      const res = await triggerLanReplication(status.stationId, peerNode);
      setSyncFeedback(res.message);
      await loadSyncData();
    } catch (err: any) {
      setSyncFeedback(typeof err === "string" ? err : err.message || "LAN Sync failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateOutboxEvent = async () => {
    setLoading(true);
    try {
      const payload = JSON.stringify({
        simulation: true,
        entity: "SALES_INVOICE",
        sample_invoice: `SIM-${Date.now()}`,
        amount_paisa: 500000,
        timestamp: new Date().toISOString(),
      });
      await enqueueSyncEvent(
        status.stationId,
        "SALES_INVOICE",
        `sim_${Date.now()}`,
        "INSERT",
        payload
      );
      setSyncFeedback("Simulated operational sales event successfully enqueued into sync outbox.");
      await loadSyncData();
    } catch (err: any) {
      setSyncFeedback("Failed to enqueue simulation event.");
    } finally {
      setLoading(false);
    }
  };

  const handleClearJournal = async () => {
    if (!confirm("Are you sure you want to clear all simulation sync journals? Real systems can replicate cleanly from a fresh outbox.")) return;
    setLoading(true);
    try {
      await clearSyncJournal();
      setSyncFeedback("Sync outbox and inbox journals cleared successfully. Ready for real workstation replication.");
      await loadSyncData();
    } catch (err: any) {
      setSyncFeedback("Failed to clear sync journal: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const persistCloudSettings = async () => {
    const saved = await saveCloudSyncSettings({
      cloudSyncEnabled: cloudEnabled,
      cloudApiUrl: cloudUrl.trim(),
      cloudApiToken: cloudToken.trim(),
      cloudAutoSyncMinutes: Number(cloudAutoMinutes) || 5,
    });
    setCloudUrl(saved.cloud_api_url);
    setCloudToken(saved.cloud_api_token);
    setCloudAutoMinutes(saved.cloud_auto_sync_minutes);
    setCloudLastSynced(saved.cloud_last_synced_at);
    return saved;
  };

  const handleSaveAndTestCloud = async () => {
    setCloudBusy(true);
    setCloudFeedback(null);
    try {
      await persistCloudSettings();
      const statusRes = await testCloudConnection();
      setCloudFeedback({
        type: statusRes.is_online ? "success" : "error",
        text: statusRes.message,
      });
    } catch (err: any) {
      setCloudFeedback({ type: "error", text: String(err) });
    } finally {
      setCloudBusy(false);
    }
  };

  const handleTriggerCloudSync = async () => {
    setLoading(true);
    setCloudBusy(true);
    setSyncFeedback(null);
    setCloudFeedback(null);
    try {
      await persistCloudSettings();
      const res = await triggerCloudSync("MANUAL_BIDIRECTIONAL");
      setCloudFeedback({ type: "success", text: res.message });
      setSyncFeedback(`Cloud Sync: ${res.message}`);
      const updated = await getCloudSyncSettings();
      setCloudLastSynced(updated.cloud_last_synced_at);
      await loadSyncData();
    } catch (err: any) {
      const msg = String(err);
      setCloudFeedback({ type: "error", text: msg });
      setSyncFeedback(`Cloud Sync Error: ${msg}`);
    } finally {
      setLoading(false);
      setCloudBusy(false);
    }
  };

  const handleFullCloudSnapshot = async () => {
    setLoading(true);
    setCloudBusy(true);
    setCloudFeedback(null);
    try {
      await persistCloudSettings();
      const res = await triggerFullCloudSnapshotSync();
      setCloudFeedback({ type: "success", text: res.message });
      const updated = await getCloudSyncSettings();
      setCloudLastSynced(updated.cloud_last_synced_at);
      await loadSyncData();
    } catch (err: any) {
      setCloudFeedback({ type: "error", text: String(err) });
    } finally {
      setLoading(false);
      setCloudBusy(false);
    }
  };

  const handleUploadCloudBackup = async () => {
    setCloudBusy(true);
    setCloudFeedback(null);
    try {
      await persistCloudSettings();
      const res = await uploadCloudBackup();
      setCloudFeedback({
        type: "success",
        text: `${res.message} File: ${res.filename} (${(res.file_size_bytes / 1024).toFixed(1)} KB)`,
      });
    } catch (err: any) {
      setCloudFeedback({ type: "error", text: String(err) });
    } finally {
      setCloudBusy(false);
    }
  };

  return (
    <div className="flex-1 p-6 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col gap-6 select-none">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold font-serif text-slate-900 dark:text-slate-100 tracking-wide">
              Offline P2P LAN & Cloud Synchronization Center
            </h1>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Fault-tolerant bidirectional peer-to-peer event replication across terminals & Hostinger Cloud Database sync
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearJournal}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 border-rose-500/40 hover:bg-rose-500/10 cursor-pointer"
            title="Clear simulation/fake sync outbox and inbox records"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Sync Journal</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSimulateOutboxEvent}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 border-amber-500/40 hover:bg-amber-500/10"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Enqueue Test Event</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleTriggerCloudSync}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-300 border-blue-500/50 hover:bg-blue-500/10 font-bold bg-blue-500/5 cursor-pointer shadow-xs"
            title="Download from Cloud and Push local sales to Hostinger Cloud Database"
          >
            <Cloud className={`w-3.5 h-3.5 text-blue-600 dark:text-blue-400 ${loading ? "animate-spin" : ""}`} />
            <span>Trigger Cloud Sync (Download & Upload)</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleTriggerSync}
            disabled={loading}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1.5 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Trigger P2P Mesh Sync</span>
          </Button>
        </div>
      </div>

      {syncFeedback && (
        <div className="bg-white dark:bg-slate-900 border border-amber-500/30 p-3.5 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{syncFeedback}</span>
        </div>
      )}

      {/* Cloud Database Synchronization (Hostinger Shared MySQL + Owner Web Dashboard) */}
      <div className="bg-white dark:bg-slate-900 border border-blue-500/30 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Cloud className="w-5 h-5 text-blue-500 shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Hostinger Cloud MySQL &amp; Live Owner Dashboard Sync
              </h2>
              <p className="text-[11px] text-slate-500">
                Subdomain-isolated HTTPS sync to your Hostinger Business Plan MySQL database. Local POS billing works 100% offline first.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSaveAndTestCloud}
              disabled={cloudBusy || loading}
              className="flex items-center gap-1.5 text-xs cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save &amp; Test</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleTriggerCloudSync}
              disabled={cloudBusy || loading}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5 text-xs shadow-xs cursor-pointer"
            >
              <CloudDownload className={`w-4 h-4 ${cloudBusy ? "animate-spin" : ""}`} />
              <span>Sync Now</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleFullCloudSnapshot}
              disabled={cloudBusy || loading}
              className="border border-blue-500/40 text-blue-700 dark:text-blue-300 flex items-center gap-1.5 text-xs cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Sync All Shop Data</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleUploadCloudBackup}
              disabled={cloudBusy || loading}
              className="flex items-center gap-1.5 text-xs cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Upload .db Backup</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs select-text">
          <div className="md:col-span-5">
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Hostinger Subdomain URL (e.g. https://pos.yourdomain.com)
            </label>
            <input
              type="url"
              value={cloudUrl}
              onChange={(e) => setCloudUrl(e.target.value)}
              placeholder="https://pos.yourdomain.com"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs"
            />
          </div>

          <div className="md:col-span-4">
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Cloud API Bearer Token (from config.php)
            </label>
            <div className="relative flex items-center">
              <input
                type={showCloudToken ? "text" : "password"}
                value={cloudToken}
                onChange={(e) => setCloudToken(e.target.value)}
                placeholder="Paste api_token from Hostinger config.php"
                className="w-full px-3 py-2 pr-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowCloudToken((v) => !v)}
                className="absolute right-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                title={showCloudToken ? "Hide Token" : "Show Token"}
              >
                {showCloudToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="md:col-span-3 flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Auto Sync (Min)
              </label>
              <input
                type="number"
                min={1}
                max={120}
                value={cloudAutoMinutes}
                onChange={(e) => setCloudAutoMinutes(Math.max(1, Math.min(120, Number(e.target.value) || 5)))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs"
              />
            </div>
            <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 cursor-pointer">
              <input
                type="checkbox"
                checked={cloudEnabled}
                onChange={(e) => setCloudEnabled(e.target.checked)}
              />
              <span className="font-semibold text-[11px]">Auto</span>
            </label>
          </div>
        </div>

        {cloudFeedback && (
          <div
            className={`p-3 rounded-xl text-xs border flex items-center gap-2 ${
              cloudFeedback.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500/40 text-emerald-800 dark:text-emerald-300"
                : "bg-red-50 dark:bg-red-950/30 border-red-500/40 text-red-800 dark:text-red-300"
            }`}
          >
            {cloudFeedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 shrink-0" />
            )}
            <span>{cloudFeedback.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
            <div className="text-slate-500 text-[11px]">Cloud Endpoint Status</div>
            <div className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">
              {cloudUrl.trim() ? cloudUrl.trim() : "Not Configured Yet"}
            </div>
            <div className={`text-[10px] mt-1 flex items-center gap-1 ${cloudUrl.trim() && cloudToken.trim() ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
              <CheckCircle2 className="w-3 h-3" />
              <span>{cloudUrl.trim() && cloudToken.trim() ? "Hostinger Credentials Saved" : "Enter Subdomain URL & Token"}</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
            <div className="text-slate-500 text-[11px]">Outbox Queue &amp; Schedule</div>
            <div className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-1">
              Auto every {cloudAutoMinutes} min ({cloudEnabled ? "ON" : "PAUSED"})
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Live Outbox Pending Events: <strong>{status.outboxPendingCount}</strong>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
            <div className="text-slate-500 text-[11px]">Last Successful Cloud Sync</div>
            <div className="font-mono font-bold text-emerald-700 dark:text-emerald-400 mt-1 truncate">
              {cloudLastSynced ? new Date(cloudLastSynced).toLocaleString() : "Never synced yet"}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">SQLite Offline-First Always Protected</div>
          </div>
        </div>
      </div>

      {/* Multi-PC Hotspot & LAN Real-Time Link (Offline Multi-Station Setup) */}
      <div className="bg-white dark:bg-slate-900 border-2 border-amber-500/40 rounded-2xl p-5 shadow-md flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Wifi className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Multi-PC Hotspot & LAN Real-Time Link (Offline Multi-Station Sync)
              </h2>
              <p className="text-[11px] text-slate-500">
                Connect multiple POS stations over mobile hotspot or local Wi-Fi router with zero internet required. All sales, stocks, and updates sync live in real-time.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-500">Current Station:</span>
            <Badge
              variant={stationRole === "MASTER" ? "gold" : networkConfig?.is_connected_to_master ? "success" : "warning"}
              className="text-xs font-mono font-bold"
            >
              {stationRole === "MASTER"
                ? `MASTER SERVER (${networkConfig?.local_ip || "127.0.0.1"})`
                : networkConfig?.is_connected_to_master
                ? "CONNECTED TO MASTER"
                : "OFFLINE / UNREACHABLE"}
            </Badge>
          </div>
        </div>

        {netFeedback && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
              netFeedback.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                : "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
            }`}
          >
            <span>{netFeedback.text}</span>
            <button onClick={() => setNetFeedback(null)} className="font-bold underline ml-3 cursor-pointer">
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Station Mode Selection */}
          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                1. Select Station Role
              </span>
              <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                Active: {networkConfig?.station_role === "MASTER" ? "Master Server (PC-1)" : "Secondary Terminal (PC-2)"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStationRole("MASTER")}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  stationRole === "MASTER"
                    ? "bg-amber-500/15 border-amber-500 text-amber-900 dark:text-amber-200 font-bold shadow-xs"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold">Master Server (PC-1)</span>
                </div>
                <p className="text-[10px] opacity-75 mt-1 font-normal">
                  Primary computer hosting the live master SQLite database
                </p>
              </button>

              <button
                type="button"
                onClick={() => setStationRole("CLIENT")}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  stationRole === "CLIENT"
                    ? "bg-amber-500/15 border-amber-500 text-amber-900 dark:text-amber-200 font-bold shadow-xs"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-bold">Secondary Terminal (PC-2)</span>
                </div>
                <p className="text-[10px] opacity-75 mt-1 font-normal">
                  Counter terminal connected to Master PC over LAN / Hotspot
                </p>
              </button>
            </div>

            {stationRole === "MASTER" ? (
              <div className="space-y-2 text-xs pt-1">
                <div>
                  <span className="text-slate-500 font-mono">This PC Hotspot/Wi-Fi IP: </span>
                  <span className="font-bold font-mono text-amber-600 dark:text-amber-400">
                    {networkConfig?.local_ip || "127.0.0.1"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-mono">LAN Share Path: </span>
                  <span className="font-mono text-[11px] bg-slate-200 dark:bg-slate-900 px-2 py-0.5 rounded select-all font-bold">
                    \\{networkConfig?.local_ip || "127.0.0.1"}\AmeerPerfumes\ameer_pos.db
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSaveNetworkStation}
                    disabled={isSavingNet}
                    className="text-xs gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer shadow-sm"
                    title="Save this computer configuration as Master Server"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSavingNet ? "Saving..." : "Save Configuration (Master Server)"}</span>
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={async () => {
                      try {
                        const msg = await enableWindowsLanSharing();
                        setNetFeedback({ type: "success", text: msg });
                      } catch (err: any) {
                        setNetFeedback({ type: "error", text: String(err) });
                      }
                    }}
                    className="text-xs gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold cursor-pointer shadow-sm"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>⚡ 1-Click Auto Configure Windows Sharing & Firewall</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenFolder}
                    className="text-xs gap-1.5 cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Open Folder</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs pt-1">
                <div>
                  <label className="block text-slate-500 font-mono mb-1">
                    Enter Master PC Database Path (UNC or Mapped Drive):
                  </label>
                  <input
                    type="text"
                    value={masterDbPath}
                    onChange={(e) => setMasterDbPath(e.target.value)}
                    placeholder="\\192.168.43.15\AmeerPerfumes\ameer_pos.db"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono text-xs text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleTestNetworkDb}
                    className="text-xs gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Test LAN Connection</span>
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSaveNetworkStation}
                    disabled={isSavingNet}
                    className="text-xs gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer shadow-sm"
                    title="Save this configuration and connect to Master PC"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSavingNet ? "Saving..." : "Save Configuration & Connect Station"}</span>
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* 3-Step Simple Setup Instructions */}
          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3 text-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              2. Quick Setup Guide (3 Simple Steps)
            </span>

            <div className="space-y-2 text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
              <div className="flex items-start gap-2">
                <span className="bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold px-1.5 py-0.2 rounded font-mono">1</span>
                <span>Connect both laptops to the same Mobile Hotspot or Wi-Fi router (No active internet data package needed).</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold px-1.5 py-0.2 rounded font-mono">2</span>
                <span><strong>On PC-1 (Master Server):</strong> Keep role as "Master Server" and click <strong>"⚡ 1-Click Auto Configure Windows Sharing & Firewall"</strong> to authorize folder sharing.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold px-1.5 py-0.2 rounded font-mono">3</span>
                <span><strong>On PC-2 (Counter Terminal):</strong> Select "Secondary Terminal (PC-2)", enter the Master path shown on PC-1, and click "Save & Connect".</span>
              </div>
              <div className="pt-1 text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Live Real-Time Sync: Any sale, return, or stock change on either PC appears instantly on both laptops with zero button clicks!</span>
              </div>
            </div>
          </div>
        </div>

        {/* Station Live Connection Monitor (Where PC-1 shows connected stations) */}
        <div className="bg-slate-100/70 dark:bg-slate-950/80 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Server className="w-4 h-4 text-amber-500" />
              <span>Live Station Network Status & Connected Terminals</span>
            </span>
            <Badge variant="success" className="text-[10px] font-mono">
              Live WAL Database Link Active
            </Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-100">Station 1: PC-1 (Master Server)</div>
                  <div className="text-[10px] text-slate-500 font-mono">IP: {networkConfig?.local_ip || "10.75.221.6"} • Host Mode</div>
                </div>
              </div>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                ONLINE (HOST)
              </span>
            </div>

            <div className={`p-2.5 rounded-lg bg-white dark:bg-slate-900 border ${isPc2Blocked ? "border-rose-300 dark:border-rose-900/60 bg-rose-50/20" : "border-slate-200 dark:border-slate-800"} flex flex-col sm:flex-row sm:items-center justify-between gap-2`}>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isPc2Blocked ? "bg-rose-500" : "bg-emerald-500 animate-pulse"}`}></span>
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Station 2: PC-2 (Counter Terminal)</span>
                    {isPc2Blocked && (
                      <span className="text-[10px] font-bold text-rose-600 bg-rose-500/10 px-1.5 py-0.2 rounded border border-rose-500/30">
                        ACCESS BLOCKED
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {isPc2Blocked
                      ? "Security Restriction Active: PC-2 database access revoked by Admin"
                      : `Target: \\\\${networkConfig?.local_ip || "10.75.221.6"}\\AmeerPerfumes`}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isPc2Blocked ? "text-rose-600 dark:text-rose-400 bg-rose-500/10" : "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"}`}>
                  {isPc2Blocked ? "BLOCKED" : "CONNECTED & SYNCED"}
                </span>

                <button
                  type="button"
                  onClick={toggleBlockPc2}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                    isPc2Blocked
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                      : "bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
                  }`}
                  title={isPc2Blocked ? "Click to unblock and permit PC-2 access" : "Click to block PC-2 terminal from syncing"}
                >
                  {isPc2Blocked ? "✓ Unblock PC-2" : "⛔ Block PC-2"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
