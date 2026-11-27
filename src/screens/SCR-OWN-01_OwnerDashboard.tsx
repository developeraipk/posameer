import React, { useState, useEffect } from "react";
import { SystemUser, WorkstationStatus } from "@/types/system";
import { ExecutiveDashboard } from "@/types/database";
import { getExecutiveDashboard } from "@/lib/tauri-bridge";
import { formatLocalTime } from "@/lib/date-utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  PieChart,
  TrendingUp,
  Package,
  ShieldCheck,
  RefreshCw,
  Droplet,
  Activity,
  Flame,
  Landmark,
  Banknote,
  Globe,
  Smartphone,
  Store,
  Users,
  Percent,
  RotateCcw,
  Calendar,
  Wallet,
  FlaskConical,
  Truck,
  Briefcase,
} from "lucide-react";

interface OwnerDashboardProps {
  currentUser?: SystemUser | null;
  status: WorkstationStatus;
}

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({ status: _status }) => {
  const [dashboard, setDashboard] = useState<ExecutiveDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<"today" | "weekly" | "monthly" | "yearly">("today");
  const [discountPage, setDiscountPage] = useState(1);

  const fetchDashboard = async (period: "today" | "weekly" | "monthly" | "yearly" = selectedPeriod, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getExecutiveDashboard(period);
      setDashboard(data);
    } catch (err) {
      if (!silent) console.error("Failed to load executive dashboard:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard(selectedPeriod, false);
    const liveTimer = window.setInterval(() => {
      fetchDashboard(selectedPeriod, true);
    }, 4000);
    return () => window.clearInterval(liveTimer);
  }, [selectedPeriod]);

  useEffect(() => {
    const handleGlobalRefresh = () => {
      fetchDashboard(selectedPeriod);
    };
    window.addEventListener("app:refresh-data", handleGlobalRefresh);
    return () => window.removeEventListener("app:refresh-data", handleGlobalRefresh);
  }, [selectedPeriod]);

  const formatPaisa = (paisa: number) => {
    return Math.round(paisa / 100).toLocaleString("en-PK");
  };

  const periodLabelMap = {
    today: "Today's",
    weekly: "This Week's",
    monthly: "This Month's",
    yearly: "This Year's",
  };

  return (
    <div className="flex-1 p-6 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col gap-6 select-none">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <img
              src="/logo-square.png"
              alt="Ameer Perfumes"
              className="w-8 h-8 rounded-lg object-cover shadow-xs border border-amber-500/30 shrink-0"
            />
            <h1 className="text-xl font-bold font-serif text-slate-900 dark:text-slate-100 tracking-wide">
              Executive Command & Owner Dashboard
            </h1>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Real-time business intelligence, sales velocity, double-entry financial margins & multi-terminal telemetry
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Timeframe Filter Dropdown */}
          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl gap-2 shadow-xs">
            <Calendar className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-xs font-semibold text-slate-500">Period:</span>
            <select
              value={selectedPeriod}
              onChange={(e) => {
                const p = e.target.value as "today" | "weekly" | "monthly" | "yearly";
                setSelectedPeriod(p);
                fetchDashboard(p);
              }}
              className="bg-transparent text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer pr-1"
            >
              <option value="today" className="dark:bg-slate-900">Today (Real-time)</option>
              <option value="weekly" className="dark:bg-slate-900">Weekly (Last 7 Days)</option>
              <option value="monthly" className="dark:bg-slate-900">Monthly (MTD)</option>
              <option value="yearly" className="dark:bg-slate-900">Yearly (YTD)</option>
            </select>
          </div>



          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold tracking-wide select-none"
            title="Auto-syncing live every 4 seconds without clicking Refresh"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            LIVE AUTO-SYNC
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchDashboard(selectedPeriod)}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh Intelligence</span>
          </Button>
        </div>
      </div>

      {dashboard && (
        <div className="flex flex-col gap-6">
          {/* Top KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Net Sales Revenue */}
            <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {periodLabelMap[selectedPeriod]} Net Sales
                </span>
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
                  Rs. {formatPaisa(dashboard.today_net_sales_paisa ?? dashboard.today_gross_sales_paisa)}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex flex-col gap-0.5 font-mono">
                  <span>Gross: Rs. {formatPaisa(dashboard.today_gross_sales_paisa)}</span>
                  <span className="text-slate-400">{dashboard.today_orders_count} orders completed</span>
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/60 flex flex-col gap-1 text-[10px] font-mono">
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Package className="w-3 h-3 text-slate-400" /> Perfumes Gross:
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-200">
                      Rs. {formatPaisa(dashboard.today_perfume_gross_paisa ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Droplet className="w-3 h-3 text-amber-500" /> Attars Gross:
                    </span>
                    <span className="font-semibold text-amber-700 dark:text-amber-400">
                      Rs. {formatPaisa(dashboard.today_attar_gross_paisa ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <FlaskConical className="w-3 h-3 text-purple-500" /> Testers Gross:
                    </span>
                    <span className="font-semibold text-purple-700 dark:text-purple-400">
                      Rs. {formatPaisa(dashboard.today_tester_gross_paisa ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Discounts Given */}
            <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {periodLabelMap[selectedPeriod]} Discounts
                </span>
                <div className="p-2 bg-rose-500/10 rounded-lg text-rose-600 dark:text-rose-400">
                  <Percent className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400">
                  Rs. {formatPaisa(dashboard.today_discount_paisa ?? 0)}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex flex-col gap-0.5 font-mono">
                  <span>{dashboard.today_discount_orders_count ?? 0} discounted orders</span>
                  <span className="text-slate-400">Cut from net margin</span>
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/60 flex flex-col gap-1 text-[10px] font-mono">
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Package className="w-3 h-3 text-slate-400" /> Perfumes:
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-200">
                      Rs. {formatPaisa(dashboard.today_perfume_discount_paisa ?? 0)}{" "}
                      <span className="text-[9px] text-slate-500 font-normal">
                        ({dashboard.today_perfume_discount_units ?? 0}u)
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Droplet className="w-3 h-3 text-amber-500" /> Attars:
                    </span>
                    <span className="font-semibold text-amber-700 dark:text-amber-400">
                      Rs. {formatPaisa(dashboard.today_attar_discount_paisa ?? 0)}{" "}
                      <span className="text-[9px] text-amber-600/80 dark:text-amber-400/80 font-normal">
                        ({dashboard.today_attar_discount_units ?? 0}u)
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <FlaskConical className="w-3 h-3 text-purple-500" /> Testers:
                    </span>
                    <span className="font-semibold text-purple-700 dark:text-purple-400">
                      Rs. {formatPaisa(dashboard.today_tester_discount_paisa ?? 0)}{" "}
                      <span className="text-[9px] text-purple-600/80 dark:text-purple-400/80 font-normal">
                        ({dashboard.today_tester_discount_units ?? 0}u)
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Returns & Refunds Deducted */}
            <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {periodLabelMap[selectedPeriod]} Returns
                </span>
                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
                  <RotateCcw className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xl font-bold font-mono text-amber-700 dark:text-amber-400">
                  -Rs. {formatPaisa(dashboard.today_refunds_paisa ?? 0)}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex flex-col gap-0.5 font-mono">
                  <span>{dashboard.today_returns_count ?? 0} returns recorded (POS & Online)</span>
                  <span className="text-slate-400">Deducted from sales</span>
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/60 flex flex-col gap-1 text-[10px] font-mono">
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Package className="w-3 h-3 text-slate-400" /> Perfumes:
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-200">
                      Rs. {formatPaisa(dashboard.today_perfume_refunds_paisa ?? 0)}{" "}
                      <span className="text-[9px] text-slate-500 font-normal">
                        ({dashboard.today_perfume_ret_units ?? 0} units)
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Droplet className="w-3 h-3 text-amber-500" /> Attars:
                    </span>
                    <span className="font-semibold text-amber-700 dark:text-amber-400">
                      Rs. {formatPaisa(dashboard.today_attar_refunds_paisa ?? 0)}{" "}
                      <span className="text-[9px] text-amber-600/80 dark:text-amber-400/80 font-normal">
                        ({dashboard.today_attar_ret_units ?? 0} units)
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <FlaskConical className="w-3 h-3 text-purple-500" /> Testers:
                    </span>
                    <span className="font-semibold text-purple-700 dark:text-purple-400">
                      Rs. {formatPaisa(dashboard.today_tester_refunds_paisa ?? 0)}{" "}
                      <span className="text-[9px] text-purple-600/80 dark:text-purple-400/80 font-normal">
                        ({dashboard.today_tester_ret_units ?? 0} units)
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Perfume vs Attar Revenue Split */}
            <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Category Split</span>
                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
                  <PieChart className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1 text-[11px]">
                    <Package className="w-3 h-3 text-slate-400" /> Perfumes:
                  </span>
                  <div className="text-right">
                    <div>
                      <span className="font-mono text-slate-900 dark:text-slate-200 font-bold text-xs">
                        Rs. {formatPaisa(dashboard.today_perfume_sales_paisa)}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono ml-1.5">
                        ({dashboard.today_perfume_units_count ?? dashboard.today_perfume_orders_count ?? 0} units)
                      </span>
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono">
                      Gross: Rs. {formatPaisa(dashboard.today_perfume_gross_paisa ?? 0)}
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1 text-[11px]">
                    <Droplet className="w-3 h-3 text-amber-500" /> Attars:
                  </span>
                  <div className="text-right">
                    <div>
                      <span className="font-mono text-amber-700 dark:text-amber-400 font-bold text-xs">
                        Rs. {formatPaisa(dashboard.today_attar_sales_paisa)}
                      </span>
                      <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80 font-mono ml-1.5">
                        ({dashboard.today_attar_units_count ?? dashboard.today_attar_orders_count ?? 0} units)
                      </span>
                    </div>
                    <div className="text-[9px] text-amber-600/70 dark:text-amber-400/70 font-mono">
                      Gross: Rs. {formatPaisa(dashboard.today_attar_gross_paisa ?? 0)}
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1 text-[11px]">
                    <FlaskConical className="w-3 h-3 text-purple-500" /> Testers:
                  </span>
                  <div className="text-right">
                    <div>
                      <span className="font-mono text-purple-700 dark:text-purple-400 font-bold text-xs">
                        Rs. {formatPaisa(dashboard.today_tester_sales_paisa || 0)}
                      </span>
                      <span className="text-[10px] text-purple-600/80 dark:text-purple-400/80 font-mono ml-1.5">
                        ({dashboard.today_tester_samples_count ?? 0} units)
                      </span>
                    </div>
                    <div className="text-[9px] text-purple-600/70 dark:text-purple-400/70 font-mono">
                      Gross: Rs. {formatPaisa(dashboard.today_tester_gross_paisa ?? 0)}
                    </div>
                  </div>
                </div>
                <span className="text-[9px] text-slate-400 font-mono mt-0.5">Net of discounts & returns</span>
              </div>
            </div>

          </div>

          {/* Sales Channels Performance & Order Telemetry (Shop vs WhatsApp vs Website) */}
          <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Sales Channels Telemetry & Online vs Shop Breakdown</span>
                    <Badge variant="gold" className="text-[10px] py-0 font-mono">
                      CHANNELS INTELLIGENCE
                    </Badge>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Live revenue, order count, and percentage share across Shop Walk-in, WhatsApp Direct, Website E-Store, and Wholesale B2B
                  </p>
                </div>
              </div>
              <span className="text-xs text-slate-500 font-mono">{periodLabelMap[selectedPeriod] || "Current Period"} Live Inflow</span>
            </div>

            {(() => {
              const channels = [
                { key: "SHOP", label: "Shop Walk-In", icon: Store, color: "text-amber-500 bg-amber-500/10", border: "border-amber-500/20" },
                { key: "WHATSAPP", label: "WhatsApp Orders", icon: Smartphone, color: "text-emerald-500 bg-emerald-500/10", border: "border-emerald-500/20" },
                { key: "WEBSITE", label: "Website E-Store", icon: Globe, color: "text-blue-500 bg-blue-500/10", border: "border-blue-500/20" },
                { key: "WHOLESALE", label: "Wholesale (B2B)", icon: Briefcase, color: "text-indigo-500 bg-indigo-500/10", border: "border-indigo-500/20" },
              ];

              const dataWithMetrics = channels.map((c) => {
                const matches = (dashboard.channel_breakdown || []).filter((item) => {
                  const ch = (item.channel || "").toUpperCase();
                  if (c.key === "SHOP") return ch === "SHOP" || ch === "WALK_IN" || ch === "STORE" || ch === "COUNTER";
                  if (c.key === "WHATSAPP") return ch === "WHATSAPP" || ch === "WA";
                  if (c.key === "WEBSITE") return ch === "WEBSITE" || ch === "WEB" || ch === "ONLINE";
                  if (c.key === "WHOLESALE") return ch === "WHOLESALE" || ch === "WS" || ch === "B2B";
                  return ch === c.key;
                });
                const orderCount = matches.reduce((sum, m) => sum + m.order_count, 0);
                const revPaisa = matches.reduce((sum, m) => sum + m.revenue_paisa, 0);
                const totalUnits = matches.reduce((sum, m) => sum + (m.total_units || 0), 0);
                return {
                  ...c,
                  orderCount,
                  revPaisa,
                  totalUnits,
                };
              });

              const totalChannelRevPaisa = dataWithMetrics.reduce((sum, item) => sum + item.revPaisa, 0);
              const totalChannelOrders = dataWithMetrics.reduce((sum, item) => sum + item.orderCount, 0);
              const totalChannelUnits = dataWithMetrics.reduce((sum, item) => sum + item.totalUnits, 0);

              // Find top channel by revenue
              const topRevChannel = [...dataWithMetrics].sort((a, b) => b.revPaisa - a.revPaisa)[0] || dataWithMetrics[0];
              const topOrderChannel = [...dataWithMetrics].sort((a, b) => b.orderCount - a.orderCount)[0] || dataWithMetrics[0];

              return (
                <div className="space-y-4">
                  {/* Top Performer Highlight Banner */}
                  <div className="bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-blue-500/10 border border-amber-500/30 rounded-xl p-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                        🏆
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <span>Highest Revenue Channel:</span>
                          <span className="text-amber-700 dark:text-amber-400 font-extrabold underline decoration-amber-500">
                            {topRevChannel.revPaisa > 0 ? topRevChannel.label : "Awaiting Sales"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                          {topRevChannel.revPaisa > 0 ? (
                            <>
                              Generates <strong>Rs. {formatPaisa(topRevChannel.revPaisa)}</strong> (
                              {totalChannelRevPaisa > 0 ? ((topRevChannel.revPaisa / totalChannelRevPaisa) * 100).toFixed(1) : 0}% of all revenue) across {topRevChannel.orderCount} order{topRevChannel.orderCount === 1 ? "" : "s"} ({topRevChannel.totalUnits} unit{topRevChannel.totalUnits === 1 ? "" : "s"}).
                            </>
                          ) : (
                            "Start ringing up orders from POS, WhatsApp, Website, or Wholesale to see live ranking."
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 font-mono text-[11px] bg-white/80 dark:bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase">Top Volume</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {topOrderChannel.orderCount > 0 ? `${topOrderChannel.orderCount} Orders (${topOrderChannel.totalUnits} units)` : "0 Orders"}
                        </span>
                      </div>
                      <div className="h-5 w-px bg-slate-300 dark:bg-slate-700" />
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase">Total Inflow</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          Rs. {formatPaisa(totalChannelRevPaisa)} ({totalChannelOrders} ord • {totalChannelUnits} units)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 4 Channel Telemetry Cards (Shop, WhatsApp, Website, Wholesale) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {dataWithMetrics.map((c) => {
                      const Icon = c.icon;
                      const sharePct = totalChannelRevPaisa > 0 ? ((c.revPaisa / totalChannelRevPaisa) * 100).toFixed(1) : "0.0";
                      const isLeader = topRevChannel.revPaisa > 0 && c.key === topRevChannel.key;

                      return (
                        <div
                          key={c.key}
                          className={`p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border ${c.border} flex flex-col justify-between relative overflow-hidden transition-all hover:shadow-xs`}
                        >
                          {isLeader && (
                            <div className="absolute top-0 right-0 bg-amber-500 text-slate-950 text-[9px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider">
                              #1 Leader
                            </div>
                          )}
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{c.label}</span>
                            <div className={`p-1.5 rounded-lg ${c.color}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                          </div>
                          <div>
                            <div className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100">
                              Rs. {formatPaisa(c.revPaisa)}
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono mt-1 pt-1.5 border-t border-slate-200/50 dark:border-slate-800/50">
                              <span>
                                {c.orderCount} order{c.orderCount === 1 ? "" : "s"} ({c.totalUnits} unit{c.totalUnits === 1 ? "" : "s"})
                              </span>
                              <span className="font-semibold text-amber-600 dark:text-amber-400">{sharePct}% share</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Treasury, Digital Wallets & Payment Settlement Breakdown */}
          <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Treasury Liquidity & Settlement Accounts Breakdown</span>
                    <Badge variant="gold" className="text-[10px] py-0 font-mono">
                      PAYMENT RECONCILIATION
                    </Badge>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Real-time split of collected revenue across Cash Drawer, EasyPaisa, JazzCash, and Net Available Treasury
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl gap-2 shadow-xs">
                  <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="text-[11px] font-semibold text-slate-500">Filter:</span>
                  <select
                    value={selectedPeriod}
                    onChange={(e) => {
                      const p = e.target.value as "today" | "weekly" | "monthly" | "yearly";
                      setSelectedPeriod(p);
                      fetchDashboard(p);
                    }}
                    className="bg-transparent text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="today" className="dark:bg-slate-900">Today (Real-time)</option>
                    <option value="weekly" className="dark:bg-slate-900">Weekly (Last 7 Days)</option>
                    <option value="monthly" className="dark:bg-slate-900">Monthly (MTD)</option>
                    <option value="yearly" className="dark:bg-slate-900">Yearly (YTD)</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono bg-purple-50 dark:bg-purple-950/30 px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-900/50">
                  <span className="text-slate-600 dark:text-slate-400">Total Wallets:</span>
                  <span className="font-bold text-purple-700 dark:text-purple-300">
                    Rs. {formatPaisa((dashboard.total_easypaisa_received_paisa ?? 0) + (dashboard.total_jazzcash_received_paisa ?? 0))}
                  </span>
                </div>
              </div>
            </div>

            {(() => {
              const cashInTill = typeof dashboard.total_cash_received_paisa === 'number'
                ? dashboard.total_cash_received_paisa
                : (dashboard.cash_in_drawer_paisa ?? 0);
              const easyPaisa = dashboard.total_easypaisa_received_paisa ?? 0;
              const jazzCash = dashboard.total_jazzcash_received_paisa ?? 0;
              const totalWallets = easyPaisa + jazzCash;
              const totalExpenses = dashboard.total_shop_expenses_paisa ?? 0;
              const totalSalaries = dashboard.total_salary_paid_paisa ?? 0;
              const totalGrossLiquidity = typeof dashboard.total_gross_liquidity_paisa === 'number'
                ? dashboard.total_gross_liquidity_paisa
                : (cashInTill + totalWallets);
              const netAvailableTreasury = typeof dashboard.net_available_treasury_paisa === 'number'
                ? dashboard.net_available_treasury_paisa
                : Math.max(0, totalGrossLiquidity - totalExpenses - totalSalaries);

              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  {/* 1. Physical Cash in Drawer */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-emerald-500/20 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Cash in Till / Drawer</span>
                      <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <Banknote className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <div className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400">
                        Rs. {formatPaisa(cashInTill)}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono block mt-1">Physical counter cash</span>
                    </div>
                  </div>

                  {/* 2. EasyPaisa Wallet */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-emerald-500/20 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">EasyPaisa Account</span>
                      <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <Smartphone className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <div className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400">
                        Rs. {formatPaisa(easyPaisa)}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono block mt-1">Direct EasyPaisa wallet</span>
                    </div>
                  </div>

                  {/* 3. JazzCash Wallet */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-orange-500/20 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">JazzCash Account</span>
                      <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
                        <Smartphone className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <div className="text-lg font-bold font-mono text-orange-600 dark:text-orange-400">
                        Rs. {formatPaisa(jazzCash)}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono block mt-1">Direct JazzCash wallet</span>
                    </div>
                  </div>

                  {/* 4. Total Digital Wallets (EasyPaisa + JazzCash) */}
                  <div className="p-4 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-500/30 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-purple-900 dark:text-purple-200">Total Wallets</span>
                      <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                        <Wallet className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <div className="text-lg font-bold font-mono text-purple-700 dark:text-purple-300">
                        Rs. {formatPaisa(totalWallets)}
                      </div>
                      <span className="text-[10px] text-purple-600/80 font-mono block mt-1">JazzCash + EasyPaisa</span>
                    </div>
                  </div>

                  {/* 5. Net Available Treasury (Gross Funds - Salaries - Operating Expenses) */}
                  <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-blue-900 dark:text-blue-200">Net Available Treasury</span>
                      <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-700 dark:text-blue-300">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <div className={`text-lg font-bold font-mono ${netAvailableTreasury >= 0 ? "text-blue-700 dark:text-blue-300" : "text-rose-600 dark:text-rose-400"}`}>
                        Rs. {formatPaisa(netAvailableTreasury)}
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block mt-1">Less staff salaries & operating expenses</span>
                    </div>
                  </div>
                </div>

                {/* Treasury Balance Sheet: Receivables, Operating Expenses & Salaries */}
                <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Wholesale Receivables (Pending Credit) */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-amber-500/20 flex flex-col justify-between shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-semibold">Wholesale Receivables (Credit)</span>
                  <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-lg font-bold font-mono text-amber-700 dark:text-amber-400">
                    Rs. {formatPaisa(dashboard.total_wholesale_receivables_paisa)}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono block mt-1">Uncollected credit from wholesale clients</span>
                </div>
              </div>

              {/* 2. Online Receivables (Pending COD / Custodians) */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-blue-500/20 flex flex-col justify-between shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-semibold">Online Receivables (Pending COD)</span>
                  <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400">
                    <Truck className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400">
                    Rs. {formatPaisa(dashboard.total_online_pending_paisa ?? 0)}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono block mt-1">
                    {dashboard.online_pending_orders_count ?? 0} orders pending with riders & staff
                  </span>
                </div>
              </div>

              {/* 3. Shop Overheads (Operating Expenses) */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-rose-500/20 flex flex-col justify-between shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-semibold">Operating Expenses</span>
                  <div className="p-1.5 bg-rose-500/10 rounded-lg text-rose-600 dark:text-rose-400">
                    <Percent className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400">
                    -Rs. {formatPaisa(dashboard.total_shop_expenses_paisa ?? 0)}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono block mt-1">Store overheads & daily petty expenses</span>
                </div>
              </div>

              {/* 4. Employee Salaries Paid */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-indigo-500/20 flex flex-col justify-between shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-semibold">Employee Salaries Paid</span>
                  <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-400">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-lg font-bold font-mono text-indigo-700 dark:text-indigo-300">
                    -Rs. {formatPaisa(dashboard.total_salary_paid_paisa ?? 0)}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono block mt-1">Wages, daily payouts & staff allowances</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>

          {/* Floor Sales Staff Performance Matrix */}
          <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-500" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200">
                    Floor Sales Staff Performance & Attributed Revenue
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Real-time tracking of units/bottles sold and gross sales achieved per employee ({periodLabelMap[selectedPeriod]})
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl gap-2 shadow-xs">
                  <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="text-[11px] font-semibold text-slate-500">Period:</span>
                  <select
                    value={selectedPeriod}
                    onChange={(e) => {
                      const p = e.target.value as "today" | "weekly" | "monthly" | "yearly";
                      setSelectedPeriod(p);
                      fetchDashboard(p);
                    }}
                    className="bg-transparent text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="today" className="dark:bg-slate-900">Today</option>
                    <option value="weekly" className="dark:bg-slate-900">Weekly (Last 7 Days)</option>
                    <option value="monthly" className="dark:bg-slate-900">Monthly (MTD)</option>
                    <option value="yearly" className="dark:bg-slate-900">Yearly (YTD)</option>
                  </select>
                </div>
                <Badge variant="gold" className="text-[10px] font-mono">
                  COMMISSION TELEMETRY
                </Badge>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-mono text-[11px] uppercase border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Staff Member</th>
                    <th className="px-4 py-2.5 font-semibold">Employee Code</th>
                    <th className="px-4 py-2.5 font-semibold text-center">Orders Closed</th>
                    <th className="px-4 py-2.5 font-semibold text-center">Bottles / Units Sold</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Total Revenue (Rs.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {(!dashboard.employee_performance || dashboard.employee_performance.length === 0) ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                        No employee sales activity recorded yet.
                      </td>
                    </tr>
                  ) : (
                    dashboard.employee_performance.map((emp) => (
                      <tr
                        key={emp.salesperson_id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors"
                      >
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center text-[10px] font-bold">
                            {emp.full_name.charAt(0)}
                          </div>
                          <span>{emp.full_name}</span>
                        </td>
                        <td className="px-4 py-3 font-mono font-medium text-slate-600 dark:text-slate-400">
                          {emp.employee_code}
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-semibold">
                          {emp.order_count}
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-amber-600 dark:text-amber-400">
                          {emp.total_units} units
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          Rs. {formatPaisa(emp.total_revenue_paisa)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Discounts & Promotional Allowances Audit Log */}
          <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Percent className="w-5 h-5 text-rose-500" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Discounts & Promotional Allowances Audit Log</span>
                    <Badge variant="danger" className="text-[10px] py-0 font-mono">
                      DISCOUNT AUDIT
                    </Badge>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Order-by-order audit of customer discounts, original gross amount, discount amount, net collected, and cashier attribution
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl gap-2 shadow-xs">
                  <Calendar className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span className="text-[11px] font-semibold text-slate-500">Period:</span>
                  <select
                    value={selectedPeriod}
                    onChange={(e) => {
                      const p = e.target.value as "today" | "weekly" | "monthly" | "yearly";
                      setSelectedPeriod(p);
                      fetchDashboard(p);
                    }}
                    className="bg-transparent text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="today" className="dark:bg-slate-900">Today</option>
                    <option value="weekly" className="dark:bg-slate-900">Weekly (Last 7 Days)</option>
                    <option value="monthly" className="dark:bg-slate-900">Monthly (MTD)</option>
                    <option value="yearly" className="dark:bg-slate-900">Yearly (YTD)</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono bg-rose-50 dark:bg-rose-950/30 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50">
                  <span className="text-slate-600 dark:text-slate-400">Total Deducted ({periodLabelMap[selectedPeriod]}):</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    -Rs. {formatPaisa(dashboard.today_discount_paisa ?? 0)}
                  </span>
                </div>
              </div>
            </div>

            {(() => {
              const discountPageSize = 10;
              const allDiscounts = dashboard.discount_history || [];
              const totalDiscountItems = allDiscounts.length;
              const totalDiscountPages = Math.max(1, Math.ceil(totalDiscountItems / discountPageSize));
              const safePage = Math.min(discountPage, totalDiscountPages);
              const paginatedDiscounts = allDiscounts.slice((safePage - 1) * discountPageSize, safePage * discountPageSize);

              return (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold bg-slate-50/50 dark:bg-slate-950/50">
                          <th className="py-2.5 px-3">Invoice #</th>
                          <th className="py-2.5 px-3">Time</th>
                          <th className="py-2.5 px-3">Sales Staff / Employee</th>
                          <th className="py-2.5 px-3">Customer</th>
                          <th className="py-2.5 px-3 text-right">Gross Total</th>
                          <th className="py-2.5 px-3 text-right">Discount Given</th>
                          <th className="py-2.5 px-3 text-right">Net Billed</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                        {paginatedDiscounts.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-2.5 px-3 font-bold text-amber-700 dark:text-amber-400">{row.invoice_number}</td>
                            <td className="py-2.5 px-3 text-slate-500 text-[11px]">{formatLocalTime(row.invoice_date)}</td>
                            <td className="py-2.5 px-3 font-sans text-slate-800 dark:text-slate-200 font-medium">{row.salesperson_name || row.cashier_name}</td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 text-[11px]">{row.customer_phone || "Walk-In"}</td>
                            <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">Rs. {formatPaisa(row.gross_total_paisa)}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-rose-600 dark:text-rose-400">-Rs. {formatPaisa(row.discount_paisa)}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">Rs. {formatPaisa(row.net_payable_paisa)}</td>
                          </tr>
                        ))}
                        {totalDiscountItems === 0 && (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-xs text-slate-500 font-sans">
                              No discounted orders recorded today. All counter sales settled at standard list price.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls (Latest 10 per page) */}
                  {totalDiscountItems > discountPageSize && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 font-sans">
                      <div>
                        Showing <span className="font-bold font-mono text-slate-900 dark:text-slate-100">{(safePage - 1) * discountPageSize + 1}</span> to{" "}
                        <span className="font-bold font-mono text-slate-900 dark:text-slate-100">{Math.min(safePage * discountPageSize, totalDiscountItems)}</span> of{" "}
                        <span className="font-bold font-mono text-slate-900 dark:text-slate-100">{totalDiscountItems}</span> entries
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={safePage <= 1}
                          onClick={() => setDiscountPage((p) => Math.max(1, p - 1))}
                          className="h-8 px-3 text-xs"
                        >
                          Previous
                        </Button>
                        <span className="px-2 font-mono text-xs font-semibold">
                          Page {safePage} of {totalDiscountPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={safePage >= totalDiscountPages}
                          onClick={() => setDiscountPage((p) => Math.min(totalDiscountPages, p + 1))}
                          className="h-8 px-3 text-xs"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* Visual Analytics & Velocity Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top 5 Best-Selling Products */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200">
                    Top Performing Products ({periodLabelMap[selectedPeriod]})
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl gap-2 shadow-xs">
                    <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="text-[11px] font-semibold text-slate-500">Period:</span>
                    <select
                      value={selectedPeriod}
                      onChange={(e) => {
                        const p = e.target.value as "today" | "weekly" | "monthly" | "yearly";
                        setSelectedPeriod(p);
                        fetchDashboard(p);
                      }}
                      className="bg-transparent text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer pr-1"
                    >
                      <option value="today" className="dark:bg-slate-900">Today</option>
                      <option value="weekly" className="dark:bg-slate-900">Weekly (Last 7 Days)</option>
                      <option value="monthly" className="dark:bg-slate-900">Monthly (MTD)</option>
                      <option value="yearly" className="dark:bg-slate-900">Yearly (YTD)</option>
                    </select>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">By Total Revenue</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {dashboard.top_selling_products.map((prod, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center font-bold font-mono text-xs text-amber-700 dark:text-amber-400 shadow-xs">
                        #{idx + 1}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-200">{prod.name}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                          <Badge variant={prod.item_type === "PERFUME" ? "gold" : "warning"} className="py-0 text-[9px]">
                            {prod.item_type}
                          </Badge>
                          <span>Sold: {prod.quantity_sold} {prod.item_type === "PERFUME" ? "units" : "g"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-bold font-mono text-emerald-700 dark:text-emerald-400">
                        Rs. {formatPaisa(prod.revenue_paisa)}
                      </div>
                    </div>
                  </div>
                ))}
                {dashboard.top_selling_products.length === 0 && (
                  <div className="py-10 text-center text-xs text-slate-500">
                    No sales data recorded yet.
                  </div>
                )}
              </div>
            </div>

            {/* Recent Live Operations Feed */}
            <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200">Operational Activity Stream</h3>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">LIVE FEED</span>
              </div>

              <div className="flex flex-col gap-2.5">
                {dashboard.recent_activity.map((act, idx) => (
                  <div key={idx} className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 dark:text-slate-200">{act.title}</span>
                      {act.amount_paisa && (
                        <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                          Rs. {formatPaisa(act.amount_paisa)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>{act.subtitle}</span>
                      <span className="font-mono">{formatLocalTime(act.timestamp)}</span>
                    </div>
                  </div>
                ))}
                {dashboard.recent_activity.length === 0 && (
                  <div className="py-10 text-center text-xs text-slate-500">
                    No recent activity.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Product Returns & Quarantine Insights Section */}
          <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Most Returned Fragrances & Damage Loss Analysis</span>
                    <Badge variant="warning" className="text-[10px] py-0 font-mono">
                      RETURN AUDIT
                    </Badge>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Fragrances returned most frequently, breakdown of damaged vs restocked stock, and net refund deductions
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl gap-2 shadow-xs font-sans">
                  <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="text-[11px] font-semibold text-slate-500">Period:</span>
                  <select
                    value={selectedPeriod}
                    onChange={(e) => {
                      const p = e.target.value as "today" | "weekly" | "monthly" | "yearly";
                      setSelectedPeriod(p);
                      fetchDashboard(p);
                    }}
                    className="bg-transparent text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="today" className="dark:bg-slate-900">Today</option>
                    <option value="weekly" className="dark:bg-slate-900">Weekly (Last 7 Days)</option>
                    <option value="monthly" className="dark:bg-slate-900">Monthly (MTD)</option>
                    <option value="yearly" className="dark:bg-slate-900">Yearly (YTD)</option>
                  </select>
                </div>
                <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-900/50">
                  <span className="text-slate-600 dark:text-slate-400">{periodLabelMap[selectedPeriod]} Refunds:</span>
                  <span className="font-bold text-amber-700 dark:text-amber-400">
                    -Rs. {formatPaisa(dashboard.today_refunds_paisa ?? 0)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/30 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50">
                  <span className="text-slate-600 dark:text-slate-400">MTD Total:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    -Rs. {formatPaisa(dashboard.mtd_refunds_paisa ?? 0)}
                  </span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold bg-slate-50/50 dark:bg-slate-950/50 font-mono text-[11px] uppercase">
                    <th className="py-2.5 px-3">Fragrance Product</th>
                    <th className="py-2.5 px-3 text-center">Category</th>
                    <th className="py-2.5 px-3 text-center">Total Units Returned</th>
                    <th className="py-2.5 px-3 text-center">Damaged in Quarantine</th>
                    <th className="py-2.5 px-3 text-center">Restocked to Shelf</th>
                    <th className="py-2.5 px-3 text-right">Total Refund Paid (Rs.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                  {(dashboard.most_returned_products || []).map((ret, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3 font-bold font-sans text-slate-900 dark:text-slate-100">
                        {ret.product_name}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {ret.item_type === "TESTER" ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30">
                            TESTER
                          </span>
                        ) : (
                          <Badge variant={ret.item_type === "PERFUME" ? "gold" : "warning"} className="text-[9px] py-0">
                            {ret.item_type}
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-800 dark:text-slate-200">
                        <div>{ret.total_units_returned} {ret.total_units_returned === 1 ? "unit" : "units"}</div>
                        {ret.return_vouchers_count && ret.return_vouchers_count > 1 ? (
                          <span className="text-[10px] font-normal font-sans text-slate-500 dark:text-slate-400 block">
                            (across {ret.return_vouchers_count} returns)
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {ret.damaged_units > 0 ? (
                          <Badge variant="danger" className="text-[10px] font-bold">
                            {ret.damaged_units} Damaged
                          </Badge>
                        ) : (
                          <span className="text-slate-400 text-[11px]">0</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {ret.restocked_units > 0 ? (
                          <Badge variant="success" className="text-[10px] font-bold">
                            {ret.restocked_units} Restocked
                          </Badge>
                        ) : (
                          <span className="text-slate-400 text-[11px]">0</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-amber-700 dark:text-amber-400">
                        Rs. {formatPaisa(ret.total_refund_paisa)}
                      </td>
                    </tr>
                  ))}
                  {(!dashboard.most_returned_products || dashboard.most_returned_products.length === 0) && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-slate-500 font-sans">
                        No return records logged. Zero customer returns across catalog.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
