import { WorkstationStatus, SystemUser } from "@/types/system";
import {
  DatabaseInitResult,
  DatabaseIntegrityResult,
  DatabaseStatus,
  AppVersionInfo,
  WorkstationAppConfig,
  FinishedProduct,
  OnlineOrder,
  CreateOnlineOrderPayload,
  CollectOnlinePaymentPayload,
  MarkOnlineReturnPayload,
} from "@/types/database";
import { PromotionalOfferDto } from "@/types/offers";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: Record<string, unknown>;
  }
}

export const isTauriEnvironment = (): boolean => {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.__TAURI_INTERNALS__ ||
    (window as any).__TAURI__ ||
    (window as any).isTauri ||
    (window as any).__TAURI_IPC__
  );
};

// Fallback System State for Browser Dev Harness
const fallbackStatus: WorkstationStatus = {
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
};

const fallbackConfig: WorkstationAppConfig = {
  store_name: "Ameer Perfumes",
  tagline: "Artisanal Perfumery & Pure Concentrated Oils",
  address: "Shop #4, Luxury Perfume Galleria, Main Boulevard",
  city: "Lahore, Pakistan",
  phone: "+92 42 3578 9000",
  ntn: "7849201-4",
  currency_symbol: "Rs.",
  receipt_privacy_enforced: true,
  station_id: "POS-01",
  is_primary_server: true,
  mesh_port: 7878,
  peer_station_id: "POS-02",
};

const fallbackUsers: SystemUser[] = [
  {
    user_id: "usr_admin",
    username: "admin",
    full_name: "Muhammad Adnan",
    role: "SUPER_ADMIN",
    is_active: true,
  },
  {
    user_id: "usr_mgr",
    username: "manager",
    full_name: "Tariq Mahmood",
    role: "SHOP_MANAGER",
    is_active: true,
  },
  {
    user_id: "usr_cashier1",
    username: "cashier1",
    full_name: "Counter Operator 1",
    role: "CASHIER_OPERATOR",
    is_active: true,
  },
  {
    user_id: "usr_owner",
    username: "owner",
    full_name: "Ameer Hamza",
    role: "OWNER",
    is_active: true,
  },
];

// Helper to invoke Tauri API safely with real SQLite persistence
async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>, fallback?: T): Promise<T> {
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<T>(cmd, args);
    } catch (err: any) {
      console.error(`[Tauri SQLite IPC Error] Command '${cmd}' failed:`, err);
      // In production Tauri desktop runtime, NEVER silently mask errors with fake fallback data!
      // Expose the genuine error so database integrity and issues are visible.
      const errorMsg = typeof err === "string" ? err : err?.message || JSON.stringify(err);
      throw new Error(errorMsg);
    }
  }
  if (fallback !== undefined) {
    return fallback;
  }
  throw new Error(`Command ${cmd} is not available outside Tauri runtime`);
}

// 1. Initialize Database
export async function initDatabase(): Promise<DatabaseInitResult> {
  return safeInvoke<DatabaseInitResult>("init_database", undefined, {
    success: true,
    schema_version: 231,
    tables_count: 46,
    indexes_count: 105,
    triggers_count: 16,
    newly_initialized: false,
    message: "Database verified with 46 tables, 105 indexes, 16 triggers (Version 231)",
  });
}

// 2. Verify Database Integrity
export async function verifyDatabaseIntegrity(): Promise<DatabaseIntegrityResult> {
  return safeInvoke<DatabaseIntegrityResult>("verify_database_integrity", undefined, {
    tables_count: 46,
    indexes_count: 105,
    triggers_count: 16,
    foreign_keys_ok: true,
    wal_mode_active: true,
    integrity_status: "ok",
    db_file_path: "%APPDATA%\\AmeerPerfumes\\ameer_pos.db",
    file_size_bytes: 524288,
    schema_version: 231,
  });
}

// 3. Get Database Status
export async function getDatabaseStatus(): Promise<DatabaseStatus> {
  return safeInvoke<DatabaseStatus>("get_database_status", undefined, {
    is_connected: true,
    db_file_path: "%APPDATA%\\AmeerPerfumes\\ameer_pos.db",
    file_size_bytes: 524288,
    schema_version: 231,
    tables_count: 46,
    indexes_count: 105,
    triggers_count: 16,
    journal_mode: "wal",
    busy_timeout_ms: 5000,
    foreign_keys_enabled: true,
    integrity_check: "ok",
  });
}

// 4. Get Workstation Configuration
export async function getWorkstationConfig(): Promise<WorkstationAppConfig> {
  return safeInvoke<WorkstationAppConfig>("get_workstation_config", undefined, fallbackConfig);
}

// 5. Get Application Version Metadata
export async function getApplicationVersion(): Promise<AppVersionInfo> {
  return safeInvoke<AppVersionInfo>("get_application_version", undefined, {
    application_name: "Ameer Perfumes ERP",
    version: "1.0.0",
    phase: "Phase 4 — Desktop Application Construction",
    milestone: "Milestone 2 — Native Rust + SQLite Database Engine",
    database_schema_version: "2.3.1 (Production Master)",
    build_profile: "desktop-windows-x64",
    os: "Windows 11 Professional",
  });
}

// 6. Get Station ID
export async function getStationId(): Promise<string> {
  return safeInvoke<string>("get_station_id", undefined, "POS-01");
}

// 7. Read Local Configuration
export async function readLocalConfig(): Promise<WorkstationAppConfig> {
  return safeInvoke<WorkstationAppConfig>("read_local_config", undefined, fallbackConfig);
}

// 8. Write Local Configuration
export async function writeLocalConfig(config: WorkstationAppConfig): Promise<boolean> {
  return safeInvoke<boolean>("write_local_config", { config }, true);
}

// Diagnostics & Auth
export async function getWorkstationStatus(): Promise<WorkstationStatus> {
  const raw = await safeInvoke<any>("get_workstation_status", undefined, fallbackStatus);
  if (!raw) return fallbackStatus;
  return {
    stationId: raw.stationId || raw.station_id || fallbackStatus.stationId || "POS-01",
    isPrimaryServer: raw.isPrimaryServer ?? raw.is_primary_server ?? fallbackStatus.isPrimaryServer,
    lanIp: raw.lanIp || raw.lan_ip || fallbackStatus.lanIp,
    meshPort: raw.meshPort || raw.mesh_port || fallbackStatus.meshPort,
    peerConnected: raw.peerConnected ?? raw.peer_connected ?? fallbackStatus.peerConnected,
    peerStationId: raw.peerStationId || raw.peer_station_id || fallbackStatus.peerStationId,
    peerLastHeartbeat: raw.peerLastHeartbeat || raw.peer_last_heartbeat || fallbackStatus.peerLastHeartbeat,
    outboxPendingCount: raw.outboxPendingCount ?? raw.outbox_pending_count ?? fallbackStatus.outboxPendingCount,
    quarantineConflictCount: raw.quarantineConflictCount ?? raw.quarantine_conflict_count ?? fallbackStatus.quarantineConflictCount,
    sqliteWalSizeKb: raw.sqliteWalSizeKb ?? raw.sqlite_wal_size_kb ?? fallbackStatus.sqliteWalSizeKb,
    databaseTablesCount: raw.databaseTablesCount ?? raw.database_tables_count ?? fallbackStatus.databaseTablesCount,
    databaseIndexesCount: raw.databaseIndexesCount ?? raw.database_indexes_count ?? fallbackStatus.databaseIndexesCount,
    cloudSyncEnabled: raw.cloudSyncEnabled ?? raw.cloud_sync_enabled ?? fallbackStatus.cloudSyncEnabled,
    cloudLastSyncedAt: raw.cloudLastSyncedAt || raw.cloud_last_synced_at || fallbackStatus.cloudLastSyncedAt,
    cloudSyncDelayed: raw.cloudSyncDelayed ?? raw.cloud_sync_delayed ?? fallbackStatus.cloudSyncDelayed,
  };
}

export async function fastSwitchUser(pin: string): Promise<SystemUser | null> {
  const browserFallback =
    pin === "1111" ? fallbackUsers[0] :
    pin === "2222" ? fallbackUsers[1] :
    pin === "3333" ? fallbackUsers[2] :
    pin === "4444" ? fallbackUsers[3] : null;
  return safeInvoke<SystemUser | null>("fast_switch_user", { pin }, browserFallback);
}

export async function loginWithCredentials(username: string, password: string): Promise<SystemUser | null> {
  const browserFallback = fallbackUsers.find(
    (u) => u.username.toLowerCase() === username.trim().toLowerCase()
  ) || null;
  return safeInvoke<SystemUser | null>(
    "login_with_credentials",
    { username, password },
    browserFallback
  );
}

export async function getAllUsers(): Promise<SystemUser[]> {
  return safeInvoke<SystemUser[]>("get_all_users", undefined, fallbackUsers);
}

export async function createUser(payload: {
  caller_user_id: string;
  username: string;
  full_name: string;
  role: string;
  pin: string;
  password?: string;
}): Promise<SystemUser> {
  const simulated: SystemUser = {
    user_id: `usr_${Date.now()}`,
    username: payload.username,
    full_name: payload.full_name,
    role: payload.role as any,
    is_active: true,
  };
  return safeInvoke<SystemUser>(
    "create_user",
    {
      callerUserId: payload.caller_user_id,
      username: payload.username,
      fullName: payload.full_name,
      role: payload.role,
      pin: payload.pin,
      password: payload.password || payload.pin,
    },
    simulated
  );
}

export async function updateUserSecurity(payload: {
  caller_user_id: string;
  target_user_id: string;
  new_pin?: string;
  new_password?: string;
  new_full_name?: string;
  new_username?: string;
  new_role?: string;
  is_active?: boolean;
}): Promise<boolean> {
  return safeInvoke<boolean>("update_user_security", {
    callerUserId: payload.caller_user_id,
    targetUserId: payload.target_user_id,
    newPin: payload.new_pin,
    newPassword: payload.new_password,
    newFullName: payload.new_full_name,
    newUsername: payload.new_username,
    newRole: payload.new_role,
    isActive: payload.is_active,
  }, true);
}

export async function deleteUser(callerUserId: string, targetUserId: string): Promise<boolean> {
  return safeInvoke<boolean>("delete_user", {
    callerUserId,
    targetUserId,
  }, true);
}

export async function createStaffUser(payload: {
  caller_user_id: string;
  username: string;
  full_name: string;
  role: string;
  pin: string;
  password: string;
}): Promise<SystemUser> {
  return safeInvoke<SystemUser>("create_user", {
    callerUserId: payload.caller_user_id,
    username: payload.username,
    fullName: payload.full_name,
    role: payload.role,
    pin: payload.pin,
    password: payload.password,
  }, {
    user_id: `usr_${Date.now()}`,
    username: payload.username,
    full_name: payload.full_name,
    role: payload.role as any,
    is_active: true,
  });
}

// ----------------------------------------------------------------------------
// Milestone 3: Finished Products Catalog & Retail POS Billing
// ----------------------------------------------------------------------------
const fallbackProducts: FinishedProduct[] = [];

const fallbackSalespersons: { salesperson_id: string; employee_code: string; full_name: string; phone: string; is_active: boolean }[] = [];

export async function getProducts(): Promise<FinishedProduct[]> {
  return safeInvoke<FinishedProduct[]>("get_products", undefined, fallbackProducts);
}

export async function createProduct(
  payload: import("@/types/database").CreateProductPayload
): Promise<FinishedProduct> {
  const browserFallback: FinishedProduct = {
    product_id: `FP-${payload.sku.replace(/\s+/g, "-").toUpperCase()}`,
    sku: payload.sku,
    barcode: payload.barcode || `896400010${Math.floor(1000 + Math.random() * 9000)}`,
    name: payload.name,
    brand: payload.brand || "Ameer Perfumes",
    size_ml: payload.size_ml,
    category: payload.category,
    current_stock_units: payload.initial_stock_units,
    retail_price_paisa: payload.retail_price_paisa,
    wholesale_price_paisa: payload.wholesale_price_paisa,
    latest_batch_cost_paisa: payload.unit_cost_paisa,
    reorder_threshold_units: payload.reorder_threshold_units,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  return safeInvoke<FinishedProduct>("create_product", { payload }, browserFallback);
}

export async function updateProduct(
  payload: import("@/types/database").UpdateProductPayload
): Promise<FinishedProduct> {
  return safeInvoke<FinishedProduct>("update_product", { payload });
}

export async function deleteProduct(productId: string): Promise<boolean> {
  return safeInvoke<boolean>("delete_product", { productId, product_id: productId }, true);
}

export async function searchProductByBarcode(code: string): Promise<FinishedProduct | null> {
  const cleanCode = code.trim().toLowerCase();
  const browserFallback = fallbackProducts.find(
    (p) => p.barcode?.toLowerCase() === cleanCode || p.sku.toLowerCase() === cleanCode
  ) || null;
  return safeInvoke<FinishedProduct | null>("search_product_by_barcode", { code }, browserFallback);
}

export async function getSalespersons(): Promise<{
  salesperson_id: string;
  employee_code: string;
  full_name: string;
  phone: string;
  is_active: boolean;
}[]> {
  return safeInvoke("get_salespersons", undefined, fallbackSalespersons);
}

export async function getAllSalespersons(): Promise<{
  salesperson_id: string;
  employee_code: string;
  full_name: string;
  phone: string;
  is_active: boolean;
}[]> {
  return safeInvoke("get_all_salespersons", undefined, fallbackSalespersons);
}

export async function createSalesperson(
  payload: import("@/types/database").CreateSalespersonPayload
): Promise<any> {
  return safeInvoke("create_salesperson", { payload }, {
    salesperson_id: `sp_${Date.now()}`,
    ...payload,
    is_active: true,
  });
}

export async function toggleSalespersonStatus(
  salespersonId: string,
  isActive: boolean
): Promise<boolean> {
  return safeInvoke("toggle_salesperson_status", {
    salespersonId,
    salesperson_id: salespersonId,
    isActive,
    is_active: isActive,
  }, true);
}

export async function updateSalesperson(
  payload: import("@/types/database").UpdateSalespersonPayload
): Promise<any> {
  const cleanPayload = {
    salesperson_id: payload.salesperson_id,
    employee_code: payload.employee_code,
    full_name: payload.full_name,
    phone: payload.phone,
  };
  return safeInvoke("update_salesperson", { payload: cleanPayload }, cleanPayload);
}

export async function deleteSalesperson(salespersonId: string): Promise<boolean> {
  return safeInvoke("delete_salesperson", { salespersonId, salesperson_id: salespersonId }, true);
}

export async function createSalesInvoice(
  payload: import("@/types/database").CreateSalesInvoiceDto
): Promise<import("@/types/database").SalesInvoiceResult> {
  // Construct an explicit, strictly typed payload for Rust backend to guarantee zero missing/duplicate fields
  const sanitizedPayload = {
    customer_phone: payload.customer_phone || (payload as any).customerPhone || "0300-0000000",
    salesperson_id: payload.salesperson_id || (payload as any).salespersonId || "sp_01",
    cashier_user_id: payload.cashier_user_id || (payload as any).cashierUserId || "usr_cashier1",
    terminal_id: payload.terminal_id || (payload as any).terminalId || "POS-01",
    order_source: payload.order_source || (payload as any).orderSource || "WALK_IN",
    items: (payload.items || []).map((i: any) => ({
      product_id: i.product_id || i.productId || "",
      product_name: i.product_name || i.productName || "",
      quantity: Number(i.quantity) || 1,
      size_ml: Number(i.size_ml ?? i.sizeMl ?? 100),
      unit_cost_paisa: Number(i.unit_cost_paisa ?? i.unitCostPaisa ?? 0),
      unit_selling_price_paisa: Number(i.unit_selling_price_paisa ?? i.unitSellingPricePaisa ?? 0),
      discount_amount_paisa: Number(i.discount_amount_paisa ?? i.discountAmountPaisa ?? 0),
      line_total_paisa: Number(i.line_total_paisa ?? i.lineTotalPaisa ?? 0),
      item_type: i.item_type || i.itemType || "PERFUME",
      attar_id: i.attar_id || i.attarId || null,
      measurement_unit: i.measurement_unit || i.measurementUnit || "BOTTLE",
      density_grams_per_ml: Number(i.density_grams_per_ml ?? i.densityGramsPerMl ?? 1000),
    })),
    payments: (payload.payments || []).map((p: any) => ({
      payment_method: p.payment_method || p.paymentMethod || "CASH",
      amount_paisa: Number(p.amount_paisa ?? p.amountPaisa ?? p.tender_amount_paisa ?? p.tenderAmountPaisa ?? 0),
      reference_code: p.reference_code || p.referenceCode || p.reference_number || p.referenceNumber || null,
      is_cash_drawer_tender: Boolean(p.is_cash_drawer_tender ?? ((p.payment_method || p.paymentMethod || "CASH") === "CASH")),
    })),
    gross_total_paisa: Number(payload.gross_total_paisa ?? (payload as any).grossTotalPaisa ?? 0),
    item_discount_paisa: Number(payload.item_discount_paisa ?? (payload as any).itemDiscountPaisa ?? 0),
    special_discount_paisa: Number(payload.special_discount_paisa ?? (payload as any).specialDiscountPaisa ?? 0),
    net_payable_paisa: Number(payload.net_payable_paisa ?? (payload as any).netPayablePaisa ?? 0),
  };

  const defaultResp: import("@/types/database").SalesInvoiceResult = {
    success: true,
    invoice_id: `inv_sim_${Date.now()}`,
    invoice_number: `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-0001`,
    invoice_date: new Date().toISOString(),
    terminal_id: sanitizedPayload.terminal_id,
    gross_total_paisa: sanitizedPayload.gross_total_paisa,
    discount_paisa: sanitizedPayload.item_discount_paisa + sanitizedPayload.special_discount_paisa,
    net_payable_paisa: sanitizedPayload.net_payable_paisa,
    change_due_paisa: 0,
    items_count: sanitizedPayload.items.length,
    receipt_privacy_enforced: true,
    store_name: "Ameer Perfumes",
    store_phone: "WhatsApp: 03100988522",
    store_address: "Main Branch Sports Complex Bannu",
    ntn: "7849201-4",
    items: (sanitizedPayload.items || []).map((i: any) => ({
      product_name: i.product_name,
      size_ml: i.size_ml,
      quantity: i.quantity,
      unit_price_paisa: i.unit_selling_price_paisa,
      line_total_paisa: i.line_total_paisa,
    })),
  };

  return safeInvoke("create_sales_invoice", { payload: sanitizedPayload }, defaultResp);
}

export async function getRecentSales(
  limit: number = 50
): Promise<import("@/types/database").RecentSaleSummary[]> {
  return safeInvoke<import("@/types/database").RecentSaleSummary[]>(
    "get_recent_sales",
    { limit },
    []
  );
}

// ----------------------------------------------------------------------------
// Milestone 4: Returns & Customer Credits IPC Bridge
// ----------------------------------------------------------------------------
export async function searchInvoiceForReturn(
  query: string
): Promise<import("@/types/database").InvoiceForReturn | null> {
  const browserFallback: import("@/types/database").InvoiceForReturn | null =
    query.trim().length >= 4
      ? {
          invoice_id: "inv_sim_mock",
          invoice_number: query.includes("INV") ? query : "INV-20261110-0001",
          invoice_date: new Date().toISOString(),
          customer_phone: "0300-1122334",
          terminal_id: "POS-01",
          net_payable_paisa: 3700000,
          is_voided: false,
          items: [
            {
              invoice_item_id: "item_sim_1",
              product_id: "FP-OUD-ROYAL-50",
              product_name: "Oud Royal Eau de Parfum 50ml",
              size_ml: 50,
              quantity_purchased: 2,
              quantity_already_returned: 0,
              quantity_available_to_return: 2,
              unit_price_paisa: 1850000,
              unit_cost_paisa: 750000,
              line_total_paisa: 3700000,
            },
          ],
        }
      : null;
  return safeInvoke("search_invoice_for_return", { query }, browserFallback);
}

export async function processRetailReturn(
  payload: import("@/types/database").ProcessReturnPayload
): Promise<import("@/types/database").ReturnVoucherResult> {
  const fallbackTotal = payload.items.reduce((sum, i) => sum + i.quantity_returned * 1850000, 0);
  const fallbackRes: import("@/types/database").ReturnVoucherResult = {
    success: true,
    return_id: `ret_sim_${Date.now()}`,
    return_voucher_number: `RET-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-0001`,
    return_date: new Date().toISOString(),
    total_refund_amount_paisa: fallbackTotal,
    refund_settlement_method: payload.refund_settlement_method,
    condition_status: payload.items[0]?.condition_status || "UNDAMAGED_NORMAL",
    items_returned_count: payload.items.length,
    store_credit_issued_paisa: payload.refund_settlement_method === "CUSTOMER_CREDIT" ? fallbackTotal : 0,
    customer_phone: "0300-1122334",
    message: "Return processed successfully.",
  };
  return safeInvoke("process_retail_return", { payload }, fallbackRes);
}

export async function getCustomerStoreCredit(
  phone: string
): Promise<import("@/types/database").CustomerCreditInfo | null> {
  return safeInvoke("get_customer_store_credit", { phone }, {
    customer_phone: phone,
    customer_name: "Valued Patron",
    current_credit_balance_paisa: 500000, // 5,000 PKR mock balance
    last_updated_at: new Date().toISOString(),
  });
}

export async function getQuarantineItems(): Promise<import("@/types/database").QuarantineItem[]> {
  return safeInvoke("get_quarantine_items", undefined, []);
}

export async function getReturnHistory(
  limit: number = 100
): Promise<import("@/types/database").ReturnHistoryEntry[]> {
  return safeInvoke("get_return_history", { limit }, []);
}

// ----------------------------------------------------------------------------
// Milestone 5: Procurement IPC Bridge
// ----------------------------------------------------------------------------
const fallbackSuppliers: import("@/types/database").Supplier[] = [];

const fallbackRawMaterials: import("@/types/database").RawMaterial[] = [];

export async function getSuppliers(): Promise<import("@/types/database").Supplier[]> {
  return safeInvoke("get_suppliers", undefined, fallbackSuppliers);
}

export async function getRawMaterials(): Promise<import("@/types/database").RawMaterial[]> {
  return safeInvoke("get_raw_materials", undefined, fallbackRawMaterials);
}

export async function createPurchaseInvoice(
  payload: import("@/types/database").CreatePurchaseInvoicePayload
): Promise<import("@/types/database").PurchaseInvoiceResult> {
  const total = payload.lines.reduce((sum, l) => sum + l.line_total_paisa, 0);
  const fallbackRes: import("@/types/database").PurchaseInvoiceResult = {
    success: true,
    invoice_id: `pur_sim_${Date.now()}`,
    invoice_number: payload.invoice_number,
    total_amount_paisa: total,
    paid_amount_paisa: payload.paid_amount_paisa,
    balance_due_paisa: total - payload.paid_amount_paisa,
    payment_status: payload.paid_amount_paisa >= total ? "PAID" : "PARTIALLY_PAID",
    items_count: payload.lines.length,
    message: "Purchase invoice recorded and stock successfully received.",
  };
  return safeInvoke("create_purchase_invoice", { payload }, fallbackRes);
}

// ----------------------------------------------------------------------------
// Milestone 6: Manufacturing & BOM Recipe IPC Functions
// ----------------------------------------------------------------------------
const fallbackRecipes: import("@/types/database").PerfumeRecipe[] = [];

const fallbackBatches: import("@/types/database").ManufacturingBatch[] = [];

export async function getPerfumeRecipes(): Promise<import("@/types/database").PerfumeRecipe[]> {
  return safeInvoke("get_perfume_recipes", undefined, fallbackRecipes);
}

export async function getManufacturingBatches(): Promise<import("@/types/database").ManufacturingBatch[]> {
  return safeInvoke("get_manufacturing_batches", undefined, fallbackBatches);
}

export async function createManufacturingBatch(
  payload: import("@/types/database").CreateBatchPayload
): Promise<string> {
  const recipeIdVal = payload.recipe_id || (payload as any).recipeId || "";
  const batchNumVal = (payload.batch_number || (payload as any).batchNumber || `B-${Date.now()}`).trim().toUpperCase();
  const plannedVal = Number(payload.planned_units || (payload as any).plannedUnits || 100);
  const prodDateVal = payload.production_date || (payload as any).productionDate || new Date().toISOString().slice(0, 10);
  const userVal = payload.created_by_user_id || (payload as any).createdByUserId || "usr_admin";
  const costUnitVal = payload.cost_per_unit_paisa !== undefined && payload.cost_per_unit_paisa !== null ? Number(payload.cost_per_unit_paisa) : ((payload as any).costPerUnitPaisa !== undefined && (payload as any).costPerUnitPaisa !== null ? Number((payload as any).costPerUnitPaisa) : null);
  const totalCostVal = payload.total_cost_paisa !== undefined && payload.total_cost_paisa !== null ? Number(payload.total_cost_paisa) : ((payload as any).totalCostPaisa !== undefined && (payload as any).totalCostPaisa !== null ? Number((payload as any).totalCostPaisa) : null);
  const sizeVal = payload.size_ml !== undefined && payload.size_ml !== null ? Number(payload.size_ml) : ((payload as any).sizeMl !== undefined && (payload as any).sizeMl !== null ? Number((payload as any).sizeMl) : null);
  const retailVal = payload.retail_price_paisa !== undefined && payload.retail_price_paisa !== null ? Number(payload.retail_price_paisa) : ((payload as any).retailPricePaisa !== undefined && (payload as any).retailPricePaisa !== null ? Number((payload as any).retailPricePaisa) : null);
  const wholesaleVal = payload.wholesale_price_paisa !== undefined && payload.wholesale_price_paisa !== null ? Number(payload.wholesale_price_paisa) : ((payload as any).wholesalePricePaisa !== undefined && (payload as any).wholesalePricePaisa !== null ? Number((payload as any).wholesalePricePaisa) : null);

  const sanitized = {
    recipe_id: recipeIdVal,
    batch_number: batchNumVal,
    planned_units: plannedVal,
    production_date: prodDateVal,
    created_by_user_id: userVal,
    notes: payload.notes || null,
    category: payload.category || null,
    cost_per_unit_paisa: costUnitVal,
    total_cost_paisa: totalCostVal,
    size_ml: sizeVal,
    retail_price_paisa: retailVal,
    wholesale_price_paisa: wholesaleVal,
  };
  return safeInvoke("create_manufacturing_batch", { payload: sanitized }, `mb_${sanitized.batch_number}`);
}

export async function releaseManufacturingBatch(
  payload: import("@/types/database").ReleaseBatchPayload
): Promise<import("@/types/database").ReleaseBatchResult> {
  const batchIdVal = payload.batch_id || (payload as any).batchId || "";
  const producedVal = Number(payload.produced_units || (payload as any).producedUnits || 0);
  const authUserVal = payload.authorized_by_user_id || (payload as any).authorizedByUserId || "usr_admin";

  const sanitized = {
    batch_id: batchIdVal,
    produced_units: producedVal,
    authorized_by_user_id: authUserVal,
    notes: payload.notes || null,
  };

  const fallbackRes: import("@/types/database").ReleaseBatchResult = {
    success: true,
    batch_id: batchIdVal,
    batch_number: "B-2026-001",
    planned_units: 100,
    produced_units: producedVal,
    evaporation_loss_units: Math.max(0, 100 - producedVal),
    total_batch_cost_paisa: 75000000,
    cost_per_unit_paisa: producedVal > 0 ? Math.round(75000000 / producedVal) : 750000,
    message: `Batch successfully completed. ${producedVal} saleable units produced.`,
  };
  return safeInvoke("release_manufacturing_batch", { payload: sanitized }, fallbackRes);
}

export async function deleteManufacturingBatch(batchId: string): Promise<boolean> {
  return safeInvoke("delete_manufacturing_batch", { batchId }, true);
}

export async function updateManufacturingBatch(
  batchId: string,
  plannedUnits: number,
  costPerUnitPaisa?: number | null,
  notes?: string | null,
  producedUnits?: number | null
): Promise<boolean> {
  return safeInvoke(
    "update_manufacturing_batch",
    {
      batchId,
      batch_id: batchId,
      plannedUnits: Number(plannedUnits),
      planned_units: Number(plannedUnits),
      producedUnits: producedUnits !== undefined && producedUnits !== null ? Number(producedUnits) : null,
      produced_units: producedUnits !== undefined && producedUnits !== null ? Number(producedUnits) : null,
      costPerUnitPaisa: costPerUnitPaisa ? Number(costPerUnitPaisa) : null,
      cost_per_unit_paisa: costPerUnitPaisa ? Number(costPerUnitPaisa) : null,
      notes: notes || null,
    },
    true
  );
}

// ----------------------------------------------------------------------------
// Milestone 7: Wholesale & Customer Ledger IPC Functions
// ----------------------------------------------------------------------------
const fallbackWholesaleCustomers: import("@/types/database").WholesaleCustomer[] = [];

export async function getWholesaleCustomers(): Promise<import("@/types/database").WholesaleCustomer[]> {
  return safeInvoke("get_wholesale_customers", undefined, fallbackWholesaleCustomers);
}

export async function getWholesaleInvoices(): Promise<import("@/types/database").WholesaleInvoiceSummary[]> {
  return safeInvoke("get_wholesale_invoices", undefined, []);
}

export async function getWholesaleInvoiceDetails(
  invoiceId: string
): Promise<import("@/types/database").WholesaleInvoiceDetails | null> {
  return safeInvoke("get_wholesale_invoice_details", { invoiceId, invoice_id: invoiceId }, null);
}

export async function getWholesaleCustomerLedger(
  customerId: string
): Promise<import("@/types/database").WholesaleLedgerEntry[]> {
  return safeInvoke("get_wholesale_customer_ledger", { customerId }, []);
}

export async function createWholesaleCustomer(
  payload: import("@/types/database").CreateWholesaleCustomerPayload
): Promise<import("@/types/database").WholesaleCustomer> {
  return safeInvoke("create_wholesale_customer", { payload }, {
    customer_id: `WC-${payload.city.slice(0, 3).toUpperCase()}-999`,
    business_name: payload.business_name,
    contact_person: payload.contact_person,
    phone: payload.phone,
    city: payload.city,
    credit_limit_paisa: payload.credit_limit_paisa,
    current_balance_paisa: payload.initial_balance_paisa || 0,
    is_active: true,
  });
}

export async function updateWholesaleCustomer(
  payload: import("@/types/database").UpdateWholesaleCustomerPayload
): Promise<import("@/types/database").WholesaleCustomer> {
  return safeInvoke("update_wholesale_customer", { payload, ...payload }, {
    customer_id: payload.customer_id,
    business_name: payload.business_name,
    contact_person: payload.contact_person,
    phone: payload.phone,
    city: payload.city,
    credit_limit_paisa: payload.credit_limit_paisa,
    current_balance_paisa: 0,
    is_active: true,
  });
}

export async function deleteWholesaleCustomer(customerId: string): Promise<boolean> {
  return safeInvoke("delete_wholesale_customer", { customerId, customer_id: customerId }, true);
}

export async function createWholesaleInvoice(
  payload: import("@/types/database").CreateWholesaleInvoicePayload
): Promise<import("@/types/database").WholesaleInvoiceResult> {
  const subtotal = payload.items.reduce((s, it) => s + it.quantity * it.agreed_wholesale_price_paisa, 0);
  const net = subtotal - payload.discount_paisa;
  const bal = net - payload.paid_amount_paisa;
  const fallbackRes: import("@/types/database").WholesaleInvoiceResult = {
    success: true,
    wholesale_invoice_id: `wi_sim_${Date.now()}`,
    invoice_number: payload.invoice_number,
    subtotal_paisa: subtotal,
    discount_paisa: payload.discount_paisa,
    net_total_paisa: net,
    paid_amount_paisa: payload.paid_amount_paisa,
    balance_due_paisa: bal,
    payment_status: bal === 0 ? "PAID" : payload.paid_amount_paisa > 0 ? "PARTIALLY_PAID" : "UNPAID",
    message: `Wholesale invoice ${payload.invoice_number} processed successfully.`,
  };
  return safeInvoke("create_wholesale_invoice", { payload }, fallbackRes);
}

export async function recordWholesalePayment(
  payload: import("@/types/database").RecordWholesalePaymentPayload
): Promise<boolean> {
  return safeInvoke("record_wholesale_payment", { payload }, true);
}

// ----------------------------------------------------------------------------
// Milestone 8: Attar Stockless Products IPC Functions
// ----------------------------------------------------------------------------
const fallbackAttars: import("@/types/database").AttarProduct[] = [];

export async function getAttars(): Promise<import("@/types/database").AttarProduct[]> {
  return safeInvoke("get_attars", undefined, fallbackAttars);
}

export async function createAttar(
  payload: import("@/types/database").CreateAttarPayload
): Promise<import("@/types/database").AttarProduct> {
  const density = payload.density_grams_per_ml || 1050;
  const browserFallback: import("@/types/database").AttarProduct = {
    attar_id: `attar_${Date.now()}`,
    sku: payload.sku,
    name: payload.name,
    origin_country: payload.origin_country,
    density_grams_per_ml: density,
    cost_per_tola_paisa: payload.cost_per_tola_paisa,
    selling_price_per_tola_paisa: payload.selling_price_per_tola_paisa,
    cost_per_half_tola_paisa: Math.round(payload.cost_per_tola_paisa / 2),
    selling_price_half_tola_paisa: Math.round(payload.selling_price_per_tola_paisa * 0.55),
    cost_per_quarter_tola_paisa: Math.round(payload.cost_per_tola_paisa / 4),
    selling_price_quarter_tola_paisa: Math.round(payload.selling_price_per_tola_paisa * 0.30),
    cost_per_ml_paisa: Math.round(payload.cost_per_tola_paisa / 12),
    selling_price_per_ml_paisa: Math.round((payload.selling_price_per_tola_paisa / 12) * 1.15),
    cost_per_gram_paisa: Math.round(payload.cost_per_tola_paisa / 11),
    selling_price_per_gram_paisa: Math.round((payload.selling_price_per_tola_paisa / 11.66) * 1.15),
    cost_per_bottle_paisa: payload.cost_per_tola_paisa,
    selling_price_bottle_paisa: payload.selling_price_per_tola_paisa,
    is_active: true,
  };
  return safeInvoke("create_attar", { payload }, browserFallback);
}

export async function updateAttar(
  payload: import("@/types/database").UpdateAttarPayload
): Promise<import("@/types/database").AttarProduct> {
  const density = payload.density_grams_per_ml || 1050;
  const browserFallback: import("@/types/database").AttarProduct = {
    attar_id: payload.attar_id,
    sku: payload.sku,
    name: payload.name,
    origin_country: payload.origin_country || "Pure Artisan",
    density_grams_per_ml: density,
    cost_per_tola_paisa: payload.cost_per_tola_paisa,
    selling_price_per_tola_paisa: payload.selling_price_per_tola_paisa,
    cost_per_half_tola_paisa: payload.cost_per_half_tola_paisa || Math.round(payload.cost_per_tola_paisa / 2),
    selling_price_half_tola_paisa: payload.selling_price_half_tola_paisa || Math.round(payload.selling_price_per_tola_paisa * 0.55),
    cost_per_quarter_tola_paisa: payload.cost_per_quarter_tola_paisa || Math.round(payload.cost_per_tola_paisa / 4),
    selling_price_quarter_tola_paisa: payload.selling_price_quarter_tola_paisa || Math.round(payload.selling_price_per_tola_paisa * 0.30),
    cost_per_ml_paisa: payload.cost_per_ml_paisa || Math.round(payload.cost_per_tola_paisa / 12),
    selling_price_per_ml_paisa: payload.selling_price_per_ml_paisa || Math.round((payload.selling_price_per_tola_paisa / 12) * 1.15),
    cost_per_gram_paisa: Math.round(payload.cost_per_tola_paisa / 11),
    selling_price_per_gram_paisa: Math.round((payload.selling_price_per_tola_paisa / 11.66) * 1.15),
    cost_per_bottle_paisa: payload.cost_per_tola_paisa,
    selling_price_bottle_paisa: payload.selling_price_per_tola_paisa,
    is_active: true,
  };
  return safeInvoke("update_attar", { payload }, browserFallback);
}

export async function deleteAttar(attarId: string): Promise<boolean> {
  return safeInvoke<boolean>("delete_attar", { attarId, attar_id: attarId }, true);
}

// ----------------------------------------------------------------------------
// Milestone 9: Shift Reconciliation & Petty Expenses IPC Functions
// ----------------------------------------------------------------------------
export async function getShifts(userRole?: string): Promise<import("@/types/database").ShiftSummary[]> {
  return safeInvoke("get_shifts", { userRole }, []);
}

export async function getActiveShift(terminalId: string, userRole?: string): Promise<import("@/types/database").ShiftSummary | null> {
  return safeInvoke("get_active_shift", { terminalId, userRole }, null);
}

export async function openShift(
  payload: import("@/types/database").OpenShiftPayload
): Promise<string> {
  return safeInvoke("open_shift", { payload }, `shift_${payload.terminal_id}_sim`);
}

export async function closeShift(
  payload: import("@/types/database").CloseShiftPayload
): Promise<import("@/types/database").CloseShiftResult> {
  const counted = payload.counted_denominations.calculated_total_paisa || 0;
  const fallbackRes: import("@/types/database").CloseShiftResult = {
    success: true,
    shift_id: payload.shift_id,
    system_expected_cash_paisa: counted,
    actual_counted_cash_paisa: counted,
    variance_paisa: 0,
    variance_status: "MATCHED",
    message: "Shift closed and reconciled.",
  };
  return safeInvoke("close_shift", { payload }, fallbackRes);
}

export async function getPettyExpenses(): Promise<import("@/types/database").PettyExpense[]> {
  return safeInvoke("get_petty_expenses", undefined, []);
}

export async function recordPettyExpense(
  payload: import("@/types/database").RecordPettyExpensePayload
): Promise<string> {
  return safeInvoke("record_petty_expense", { payload }, `exp_${Date.now()}`);
}

export async function getEmployeeSalaryPayouts(): Promise<import("@/types/database").EmployeeSalaryPayout[]> {
  return safeInvoke("get_employee_salary_payouts", undefined, []);
}

export async function recordEmployeeSalaryPayout(
  payload: import("@/types/database").RecordSalaryPayoutPayload
): Promise<import("@/types/database").EmployeeSalaryPayout> {
  const sanitized = {
    employee_id: payload.employee_id,
    employee_name: payload.employee_name,
    employee_role: payload.employee_role || "Sales Staff",
    payout_type: payload.payout_type,
    amount_paisa: Number(payload.amount_paisa),
    payment_method: payload.payment_method,
    disbursed_by_user_id: payload.disbursed_by_user_id,
    disbursed_by_name: payload.disbursed_by_name,
    notes: payload.notes || null,
    payout_date: payload.payout_date || new Date().toISOString(),
  };
  const fallbackRes: import("@/types/database").EmployeeSalaryPayout = {
    payout_id: `PAY-${Date.now().toString().slice(-6)}`,
    employee_id: payload.employee_id,
    employee_name: payload.employee_name,
    employee_role: payload.employee_role || "Sales Staff",
    payout_type: payload.payout_type,
    amount_paisa: Number(payload.amount_paisa),
    payment_method: payload.payment_method,
    disbursed_by_user_id: payload.disbursed_by_user_id,
    disbursed_by_name: payload.disbursed_by_name,
    notes: payload.notes || null,
    payout_date: payload.payout_date || new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
  return safeInvoke("record_employee_salary_payout", { payload: sanitized }, fallbackRes);
}

// ----------------------------------------------------------------------------
// Milestone 10: Financial Accounting & General Ledger IPC Functions
// ----------------------------------------------------------------------------
export async function getChartOfAccounts(): Promise<import("@/types/database").Account[]> {
  return safeInvoke("get_chart_of_accounts", undefined, []);
}

export async function getJournalVouchers(): Promise<import("@/types/database").JournalVoucher[]> {
  return safeInvoke("get_journal_vouchers", undefined, []);
}

export async function getAccountLedger(
  accountId: string,
  startDate?: string,
  endDate?: string
): Promise<import("@/types/database").AccountLedgerEntry[]> {
  return safeInvoke("get_account_ledger", { accountId, startDate, endDate }, []);
}

export async function createJournalVoucher(
  payload: import("@/types/database").CreateJournalVoucherPayload
): Promise<string> {
  return safeInvoke("create_journal_voucher", { payload }, `jv_${Date.now()}`);
}

export async function postJournalVoucher(voucherId: string): Promise<boolean> {
  return safeInvoke("post_journal_voucher", { voucherId }, true);
}

export async function getTrialBalance(): Promise<import("@/types/database").TrialBalanceReport> {
  const fallbackTB: import("@/types/database").TrialBalanceReport = {
    items: [],
    grand_total_debit_paisa: 0,
    grand_total_credit_paisa: 0,
    is_balanced: true,
    generated_at: new Date().toISOString(),
  };
  return safeInvoke("get_trial_balance", undefined, fallbackTB);
}

export async function getFinancialStatements(): Promise<import("@/types/database").FinancialStatements> {
  const fallbackFS: import("@/types/database").FinancialStatements = {
    income_statement: {
      revenue_items: [],
      total_gross_revenue_paisa: 0,
      returns_allowances_paisa: 0,
      discounts_given_paisa: 0,
      net_revenue_paisa: 0,
      cogs_items: [],
      total_cogs_paisa: 0,
      gross_profit_paisa: 0,
      expense_items: [],
      total_operating_expenses_paisa: 0,
      net_profit_loss_paisa: 0,
      generated_at: new Date().toISOString(),
    },
    balance_sheet: {
      current_assets: [],
      non_current_assets: [],
      total_assets_paisa: 0,
      current_liabilities: [],
      total_liabilities_paisa: 0,
      equity_items: [],
      period_net_profit_loss_paisa: 0,
      total_equity_paisa: 0,
      total_liabilities_and_equity_paisa: 0,
      is_balanced: true,
      variance_paisa: 0,
      generated_at: new Date().toISOString(),
    },
  };
  return safeInvoke("get_financial_statements", undefined, fallbackFS);
}

// ----------------------------------------------------------------------------
// Milestone 11: Executive BI & Reports IPC Functions
// ----------------------------------------------------------------------------
export async function getExecutiveDashboard(
  period?: "today" | "weekly" | "monthly" | "yearly"
): Promise<import("@/types/database").ExecutiveDashboard> {
  const fallbackDash: import("@/types/database").ExecutiveDashboard = {
    today_gross_sales_paisa: 0,
    today_orders_count: 0,
    today_attar_sales_paisa: 0,
    today_perfume_sales_paisa: 0,
    today_perfume_ret_units: 0,
    today_attar_ret_units: 0,
    today_tester_ret_units: 0,
    today_perfume_refunds_paisa: 0,
    today_attar_refunds_paisa: 0,
    today_tester_refunds_paisa: 0,
    total_online_pending_paisa: 0,
    online_pending_orders_count: 0,
    total_online_collected_paisa: 0,
    today_perfume_discount_paisa: 0,
    today_perfume_discount_units: 0,
    today_attar_discount_paisa: 0,
    today_attar_discount_units: 0,
    today_tester_discount_paisa: 0,
    today_tester_discount_units: 0,
    today_perfume_gross_paisa: 0,
    today_attar_gross_paisa: 0,
    today_tester_gross_paisa: 0,
    all_time_cash_drawer_paisa: 0,
    all_time_easypaisa_paisa: 0,
    all_time_jazzcash_paisa: 0,
    mtd_gross_revenue_paisa: 0,
    mtd_net_profit_paisa: 0,
    total_inventory_valuation_paisa: 0,
    finished_goods_valuation_paisa: 0,
    raw_materials_valuation_paisa: 0,
    total_wholesale_receivables_paisa: 0,
    cash_in_drawer_paisa: 0,
    store_credit_liability_paisa: 0,
    hourly_sales: [],
    top_selling_products: [],
    recent_activity: [],
    most_returned_products: [],
  };
  return safeInvoke("get_executive_dashboard", { period }, fallbackDash);
}

export async function getInventoryValuation(): Promise<import("@/types/database").InventoryValuationReport> {
  const fallbackInv: import("@/types/database").InventoryValuationReport = {
    total_cost_valuation_paisa: 0,
    total_retail_valuation_paisa: 0,
    raw_materials: [],
    finished_goods: [],
    generated_at: new Date().toISOString(),
  };
  return safeInvoke("get_inventory_valuation", undefined, fallbackInv);
}

// ----------------------------------------------------------------------------
// Milestone 12: Offline LAN P2P Synchronization IPC Functions
// ----------------------------------------------------------------------------
export async function getSyncStatus(nodeId: string): Promise<import("@/types/database").SyncStatus> {
  const fallbackStatus: import("@/types/database").SyncStatus = {
    node_id: nodeId,
    peer_node_id: nodeId === "POS-01" ? "POS-02" : "POS-01",
    peer_online: true,
    outbox_pending_count: 0,
    outbox_synced_count: 0,
    inbox_applied_count: 0,
    quarantine_conflict_count: 0,
    watermarks: [],
    recent_outbox: [],
    recent_inbox: [],
    quarantined_conflicts: [],
  };
  return safeInvoke("get_sync_status", { nodeId }, fallbackStatus);
}

export async function enqueueSyncEvent(
  deviceId: string,
  entityType: string,
  entityId: string,
  operationType: string,
  payloadJson: string
): Promise<string> {
  return safeInvoke("enqueue_sync_event", { deviceId, entityType, entityId, operationType, payloadJson }, `ev_${Date.now()}`);
}

export async function triggerLanReplication(
  currentNode: string,
  peerNode: string
): Promise<import("@/types/database").TriggerLanSyncResult> {
  const fallbackRes: import("@/types/database").TriggerLanSyncResult = {
    success: true,
    replicated_events_count: 0,
    applied_events_count: 0,
    conflicts_detected_count: 0,
    message: `P2P sync executed between ${currentNode} and ${peerNode}`,
  };
  return safeInvoke("trigger_lan_replication", { currentNode, peerNode }, fallbackRes);
}

export async function resolveSyncConflict(
  conflictId: string,
  resolution: string,
  userId: string
): Promise<boolean> {
  return safeInvoke("resolve_sync_conflict", { conflictId, resolution, userId }, true);
}

export async function clearSyncJournal(): Promise<boolean> {
  return safeInvoke("clear_sync_journal", {}, true);
}

// ----------------------------------------------------------------------------
// Milestone 14: Hot Backup & Disaster Recovery IPC Functions
// ----------------------------------------------------------------------------
export async function createHotBackup(
  destinationDir?: string
): Promise<import("@/types/database").BackupResult> {
  const fallbackRes: import("@/types/database").BackupResult = {
    success: true,
    record: {
      backup_id: `bak_${Date.now()}`,
      filename: `ameer_pos_backup_${new Date().toISOString().replace(/[-:T]/g, "_").slice(0, 15)}.db`,
      file_path: "C:\\Users\\Default\\AppData\\Roaming\\AmeerPerfumes\\backups\\ameer_pos_backup.db",
      size_bytes: 524288,
      sha256_checksum: "VERIFIED",
      tables_count: 46,
      indexes_count: 105,
      triggers_count: 16,
      is_verified: true,
      created_at: new Date().toISOString(),
    },
    message: "Hot atomic backup created and verified: 46 tables, 105 indexes, 16 triggers integrity PASSED.",
  };
  return safeInvoke("create_hot_backup", { destinationDir }, fallbackRes);
}

export async function getBackupHistory(): Promise<import("@/types/database").BackupRecord[]> {
  return safeInvoke("get_backup_history", undefined, []);
}

export async function verifyBackupArchive(
  filePath: string
): Promise<import("@/types/database").BackupVerificationResult> {
  const fallbackRes: import("@/types/database").BackupVerificationResult = {
    is_valid: true,
    tables_count: 46,
    indexes_count: 105,
    triggers_count: 16,
    integrity_status: "ok",
    message: "Backup archive verified: Integrity OK, 46 tables, 105 indexes, 16 triggers.",
  };
  return safeInvoke("verify_backup_archive", { filePath }, fallbackRes);
}

export async function pickFolder(): Promise<string | null> {
  return safeInvoke<string | null>("pick_folder", {}, null);
}

export async function pickBackupFile(): Promise<string | null> {
  return safeInvoke<string | null>("pick_backup_file", {}, null);
}

export async function restoreDatabase(sourceFilePath: string): Promise<string> {
  return safeInvoke<string>("restore_database", { sourceFilePath }, "Database restored successfully.");
}

// ----------------------------------------------------------------------------
// Milestone 15: Hardware Peripherals Diagnostics IPC Functions
// ----------------------------------------------------------------------------

export async function getHardwareStatus(): Promise<import("@/types/database").HardwareDiagnosticsDto> {
  const fallback: import("@/types/database").HardwareDiagnosticsDto = {
    printer: {
      device_name: "EPSON TM-T88VI (Thermal 80mm)",
      interface_type: "USB",
      paper_width_mm: 80,
      status: "ONLINE",
      test_print_success: true,
      privacy_enforced: true,
    },
    drawer: {
      connected_via_printer: true,
      pulse_pin: 0,
      pulse_on_time_ms: 25,
      pulse_off_time_ms: 250,
      last_kick_at: new Date().toISOString(),
    },
    scanner: {
      mode: "USB_HID_KEYBOARD_WEDGE",
      prefix: "",
      suffix: "Enter",
      last_scanned_barcode: "89640001001",
    },
    display: {
      port: "COM1 / USB_VFD",
      baud_rate: 9600,
      columns: 20,
      rows: 2,
      last_message: "AMEER PERFUMES",
    },
    overall_healthy: true,
  };
  return safeInvoke("get_hardware_status", undefined, fallback);
}

export async function testReceiptPrinter(): Promise<import("@/types/database").PrintReceiptTestResult> {
  const fallback: import("@/types/database").PrintReceiptTestResult = {
    success: true,
    bytes_spooled: 642,
    privacy_verified: true,
    receipt_preview_text: `================================================
                 AMEER PERFUMES                 
          Haute Parfumerie & Pure Oud           
     Shop #4, Luxury Arcade, Commercial Area    
             Tel: +92 300 1234567               
================================================
Date: 2026-11-11 13:10:00       Station: POS-01 
Receipt: INV-2026-00014                         
[Decision A: Cashier/Salesperson Name Excluded] 
------------------------------------------------
Item                          Qty  Price   Total
------------------------------------------------
Royal Oud Royale (100ml)        1 15,000  15,000
Imperial Rose (50ml)            1  8,500   8,500
------------------------------------------------
Subtotal:                              23,500.00
Net Payable:                           23,500.00
Cash Tendered:                         25,000.00
Change Due:                             1,500.00
================================================
   Thank you for experiencing Ameer Perfumes    
            Pure Essence of Luxury              
================================================`,
    message: "ESC/POS 80mm thermal test receipt generated. Owner Decision A Privacy verified.",
  };
  return safeInvoke("test_receipt_printer", undefined, fallback);
}

export async function kickCashDrawer(): Promise<import("@/types/database").KickDrawerResult> {
  const fallback: import("@/types/database").KickDrawerResult = {
    success: true,
    pulse_command_hex: "1B 70 00 19 FA",
    message: "ESC/POS 24V Drawer Kick Pulse transmitted (ESC p 0 25 250).",
  };
  return safeInvoke("kick_cash_drawer", undefined, fallback);
}

export async function testPoleDisplay(
  line1?: string,
  line2?: string
): Promise<import("@/types/database").PoleDisplayTestResult> {
  const fallback: import("@/types/database").PoleDisplayTestResult = {
    success: true,
    line1_rendered: (line1 || "AMEER PERFUMES").padEnd(20).slice(0, 20),
    line2_rendered: (line2 || "Total: PKR 23,500.00").padEnd(20).slice(0, 20),
    message: "2x20 VFD Customer pole display command spooled successfully.",
  };
  return safeInvoke("test_pole_display", { line1, line2 }, fallback);
}

export interface LanSyncStats {
  success: boolean;
  events_sent: number;
  events_received: number;
  peer_station_id: string;
  message: string;
}

export async function startLanSync(port?: number): Promise<string> {
  return safeInvoke("start_lan_sync", { port }, `LAN TCP Sync Server started on port ${port || 7878} (Dev Fallback)`);
}

export async function stopLanSync(): Promise<string> {
  return safeInvoke("stop_lan_sync", undefined, "LAN TCP Sync Server stopped (Dev Fallback)");
}

export async function syncWithPeerLan(peerAddr: string, currentStation: string): Promise<LanSyncStats> {
  const fallback: LanSyncStats = {
    success: true,
    events_sent: 0,
    events_received: 0,
    peer_station_id: currentStation === "POS-01" ? "POS-02" : "POS-01",
    message: "Simulated LAN sync success in browser dev mode.",
  };
  return safeInvoke("sync_with_peer_lan", { peerAddr, currentStation }, fallback);
}

export async function getLanSyncServerStatus(): Promise<boolean> {
  return safeInvoke("get_lan_sync_server_status", undefined, true);
}

export interface CloudSyncPushResult {
  success: boolean;
  terminal_id: string;
  processed_events_count: number;
  acknowledged_watermark: number;
  server_timestamp: string;
  message: string;
}

export async function pushCloudSync(triggerReason?: string): Promise<CloudSyncPushResult> {
  const fallback: CloudSyncPushResult = {
    success: true,
    terminal_id: "POS-01",
    processed_events_count: 0,
    acknowledged_watermark: 0,
    server_timestamp: new Date().toISOString(),
    message: "Cloud sync simulated in dev mode.",
  };
  return safeInvoke("push_cloud_sync", { triggerReason }, fallback);
}

export async function triggerCloudSync(triggerReason?: string): Promise<CloudSyncPushResult> {
  const fallback: CloudSyncPushResult = {
    success: true,
    terminal_id: "POS-01",
    processed_events_count: 0,
    acknowledged_watermark: 0,
    server_timestamp: new Date().toISOString(),
    message: "Cloud database synchronization verified. All local records queued & synchronized.",
  };
  return safeInvoke("trigger_cloud_sync", { triggerReason }, fallback);
}

export interface CloudSyncSettings {
  cloud_sync_enabled: boolean;
  cloud_api_url: string;
  cloud_api_token: string;
  cloud_auto_sync_minutes: number;
  cloud_last_synced_at: string | null;
  station_id: string;
}

export interface CloudSyncStatusResult {
  cloud_service: string;
  database: string;
  total_events_archived: number;
  sync_cadence: string;
  is_online: boolean;
  message: string;
  server_timestamp: string;
}

export interface CloudBackupUploadResult {
  success: boolean;
  backup_id: string;
  filename: string;
  file_size_bytes: number;
  sha256_checksum: string;
  server_timestamp: string;
  message: string;
}

export async function getCloudSyncSettings(): Promise<CloudSyncSettings> {
  return safeInvoke("get_cloud_sync_settings", undefined, {
    cloud_sync_enabled: true,
    cloud_api_url: "",
    cloud_api_token: "",
    cloud_auto_sync_minutes: 5,
    cloud_last_synced_at: null,
    station_id: "POS-01",
  });
}

export async function saveCloudSyncSettings(params: {
  cloudSyncEnabled: boolean;
  cloudApiUrl: string;
  cloudApiToken: string;
  cloudAutoSyncMinutes: number;
}): Promise<CloudSyncSettings> {
  return safeInvoke("save_cloud_sync_settings", params, {
    cloud_sync_enabled: params.cloudSyncEnabled,
    cloud_api_url: params.cloudApiUrl,
    cloud_api_token: params.cloudApiToken,
    cloud_auto_sync_minutes: params.cloudAutoSyncMinutes,
    cloud_last_synced_at: null,
    station_id: "POS-01",
  });
}

export async function testCloudConnection(): Promise<CloudSyncStatusResult> {
  return safeInvoke("test_cloud_connection", undefined, {
    cloud_service: "Hostinger Shared MySQL + PHP",
    database: "MySQL",
    total_events_archived: 0,
    sync_cadence: "Auto",
    is_online: false,
    message: "Configure Hostinger URL and Bearer token inside Desktop EXE.",
    server_timestamp: new Date().toISOString(),
  });
}

export async function triggerFullCloudSnapshotSync(): Promise<CloudSyncPushResult> {
  return safeInvoke("trigger_full_cloud_snapshot_sync", undefined, {
    success: true,
    terminal_id: "POS-01",
    processed_events_count: 0,
    acknowledged_watermark: 0,
    server_timestamp: new Date().toISOString(),
    message: "Full shop cloud snapshot upload queued.",
  });
}

export async function uploadCloudBackup(): Promise<CloudBackupUploadResult> {
  return safeInvoke("upload_cloud_backup", undefined, {
    success: true,
    backup_id: "bkp_dev",
    filename: "ameer_pos_backup.db",
    file_size_bytes: 0,
    sha256_checksum: "",
    server_timestamp: new Date().toISOString(),
    message: "Cloud SQLite backup upload ready inside Desktop EXE.",
  });
}

export interface PhysicalPrinterResult {
  success: boolean;
  printer_name: string;
  bytes_written: number;
  is_hardware_attached: boolean;
  message: string;
}

export interface PhysicalPoleDisplayResult {
  success: boolean;
  port_name: string;
  bytes_written: number;
  is_hardware_attached: boolean;
  message: string;
}

export async function printRawEscposReceipt(receiptText: string, printerName?: string): Promise<PhysicalPrinterResult> {
  const fallback: PhysicalPrinterResult = {
    success: true,
    printer_name: printerName || "POS-80-Thermal",
    bytes_written: receiptText.length + 6,
    is_hardware_attached: false,
    message: "Spool simulated in browser dev mode.",
  };
  return safeInvoke("print_raw_escpos_receipt", { receiptText, printerName }, fallback);
}

export async function sendRawPoleDisplay(line1: string, line2: string, comPort?: string): Promise<PhysicalPoleDisplayResult> {
  const fallback: PhysicalPoleDisplayResult = {
    success: true,
    port_name: comPort || "COM1",
    bytes_written: 43,
    is_hardware_attached: false,
    message: "Pole display transmission simulated in browser dev mode.",
  };
  return safeInvoke("send_raw_pole_display", { line1, line2, comPort }, fallback);
}

export async function kickCashDrawerHardware(printerName?: string): Promise<PhysicalPrinterResult> {
  const fallback: PhysicalPrinterResult = {
    success: true,
    printer_name: printerName || "POS-80-Thermal",
    bytes_written: 5,
    is_hardware_attached: false,
    message: "Drawer kick simulated in browser dev mode.",
  };
  return safeInvoke("kick_cash_drawer_hardware", { printerName }, fallback);
}

export async function getPromotionalOffers(): Promise<PromotionalOfferDto[]> {
  return safeInvoke<PromotionalOfferDto[]>("get_promotional_offers", {}, []);
}

export async function savePromotionalOffer(offer: PromotionalOfferDto): Promise<boolean> {
  return safeInvoke<boolean>("save_promotional_offer", { offer }, true);
}

export async function deletePromotionalOffer(offerId: string): Promise<boolean> {
  return safeInvoke<boolean>("delete_promotional_offer", { offerId }, true);
}

export interface NetworkStationConfig {
  station_role: string;
  station_name: string;
  master_db_path: string;
  current_active_db_path: string;
  local_ip: string;
  is_connected_to_master: boolean;
  message: string;
  is_blocked?: boolean;
  is_pc2_blocked?: boolean;
  blocked_reason?: string;
}

export async function getLocalIpAddress(): Promise<string> {
  return safeInvoke<string>("get_local_ip_address", {}, "127.0.0.1");
}

export async function getNetworkStationConfig(): Promise<NetworkStationConfig> {
  const fallback: NetworkStationConfig = {
    station_role: "MASTER",
    station_name: "Station-01 (Main Server)",
    master_db_path: "\\\\192.168.1.100\\AmeerPerfumes\\ameer_pos.db",
    current_active_db_path: "C:\\Users\\Default\\AppData\\Roaming\\AmeerPerfumes\\ameer_pos.db",
    local_ip: "192.168.1.100",
    is_connected_to_master: true,
    message: "Master Station Active",
    is_blocked: false,
    is_pc2_blocked: false,
    blocked_reason: "",
  };
  return safeInvoke<NetworkStationConfig>("get_network_station_config", {}, fallback);
}

export async function saveNetworkStationConfig(
  stationRole: string,
  stationName: string,
  masterDbPath: string
): Promise<boolean> {
  return safeInvoke<boolean>(
    "save_network_station_config",
    { stationRole, stationName, masterDbPath },
    true
  );
}

export async function testNetworkDbConnection(dbPath: string): Promise<string> {
  return safeInvoke<string>("test_network_db_connection", { dbPath }, "Simulation: Connection OK");
}

export async function openDatabaseFolder(): Promise<void> {
  return safeInvoke<void>("open_database_folder", {}, undefined);
}

export async function exportDatabaseToDesktop(): Promise<string> {
  return safeInvoke<string>("export_database_to_desktop", {}, "C:\\Users\\Default\\Desktop\\Ameer_Perfumes_Backup.db");
}

export async function enableWindowsLanSharing(): Promise<string> {
  return safeInvoke<string>("enable_windows_lan_sharing", {}, "Windows sharing authorization requested.");
}

export async function setTerminalBlockedStatus(
  terminalId: string,
  isBlocked: boolean,
  reason?: string,
  callerUserId?: string
): Promise<boolean> {
  return safeInvoke<boolean>(
    "set_terminal_blocked_status",
    {
      caller_user_id: callerUserId || "",
      callerUserId: callerUserId || "",
      terminal_id: terminalId,
      terminalId,
      is_blocked: isBlocked,
      isBlocked,
      reason,
    },
    isBlocked
  );
}

export async function getTerminalBlockedStatus(
  terminalId?: string
): Promise<{ terminal_id: string; is_blocked: boolean; blocked_reason: string }> {
  return safeInvoke<{ terminal_id: string; is_blocked: boolean; blocked_reason: string }>(
    "get_terminal_blocked_status",
    { terminal_id: terminalId, terminalId },
    { terminal_id: terminalId || "POS-02", is_blocked: false, blocked_reason: "" }
  );
}

// ============================================================================
// MODULE 18: ONLINE & SOCIAL ORDERS (WHATSAPP & WEBSITE) IPC BRIDGE
// ============================================================================
const fallbackOnlineOrdersKey = "ameer_online_orders_store";

function getFallbackOnlineOrders(): OnlineOrder[] {
  try {
    const raw = localStorage.getItem(fallbackOnlineOrdersKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFallbackOnlineOrders(orders: OnlineOrder[]): void {
  try {
    localStorage.setItem(fallbackOnlineOrdersKey, JSON.stringify(orders));
  } catch (e) {
    console.error("Failed to persist fallback online orders:", e);
  }
}

export async function getOnlineOrders(): Promise<OnlineOrder[]> {
  if (isTauriEnvironment()) {
    try {
      const res = await safeInvoke<OnlineOrder[]>("get_online_orders");
      if (Array.isArray(res)) {
        saveFallbackOnlineOrders(res);
        return res;
      }
    } catch (e) {
      console.warn("get_online_orders IPC call failed, falling back to cached local storage:", e);
    }
  }
  return getFallbackOnlineOrders();
}

export async function createOnlineOrder(
  payload: CreateOnlineOrderPayload
): Promise<OnlineOrder> {
  const now = new Date();
  const dateStr = now.toISOString().replace("T", " ").substring(0, 19);
  const prefix = payload.channel === "WHATSAPP" ? "WA" : "WEB";
  const datePart =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0");
  const fallbackOrders = getFallbackOnlineOrders();
  const orderNum = `${prefix}-${datePart}-${String(fallbackOrders.length + 1).padStart(4, "0")}`;

  const fallbackOrder: OnlineOrder = {
    order_id: `ord_onl_${Date.now()}`,
    order_number: orderNum,
    channel: payload.channel,
    customer_name: payload.customer_name,
    customer_phone: payload.customer_phone,
    shipping_address: payload.shipping_address,
    city: payload.city,
    items_json: payload.items_json,
    subtotal_paisa: payload.subtotal_paisa,
    delivery_charges_paisa: payload.delivery_charges_paisa,
    discount_paisa: payload.discount_paisa,
    total_amount_paisa: payload.total_amount_paisa,
    advance_paid_paisa: payload.advance_paid_paisa,
    cod_balance_paisa: payload.cod_balance_paisa,
    payment_status:
      payload.cod_balance_paisa <= 0
        ? "PAID"
        : payload.advance_paid_paisa > 0
        ? "PARTIAL"
        : "PENDING",
    payment_custodian:
      payload.cod_balance_paisa <= 0 ? "SETTLED" : payload.payment_custodian,
    courier_partner: payload.courier_partner,
    tracking_number: payload.tracking_number || "",
    delivery_status: "BOOKED",
    collected_by: payload.advance_paid_paisa > 0 ? payload.created_by_user_id : "",
    collected_at: payload.advance_paid_paisa > 0 ? dateStr : null,
    collection_method: payload.advance_paid_paisa > 0 ? "ADVANCE" : null,
    notes: payload.notes || null,
    created_at: dateStr,
    created_by_user_id: payload.created_by_user_id,
  };

  const res = await safeInvoke<OnlineOrder>("create_online_order", { payload }, fallbackOrder);
  fallbackOrders.unshift(res);
  saveFallbackOnlineOrders(fallbackOrders);
  return res;
}

export async function collectOnlineOrderPayment(
  payload: CollectOnlinePaymentPayload
): Promise<boolean> {
  const fallbackOrders = getFallbackOnlineOrders();
  const idx = fallbackOrders.findIndex((o) => o.order_id === payload.order_id);
  if (idx !== -1) {
    const o = fallbackOrders[idx];
    const newAdvance = o.advance_paid_paisa + payload.amount_paid_paisa;
    const newCod = Math.max(0, o.cod_balance_paisa - payload.amount_paid_paisa);
    o.advance_paid_paisa = newAdvance;
    o.cod_balance_paisa = newCod;
    o.payment_status = newCod === 0 ? "PAID" : "PARTIAL";
    o.payment_custodian = newCod === 0 ? "SETTLED" : "COURIER";
    o.collected_by = payload.collected_by;
    o.collected_at = new Date().toISOString().replace("T", " ").substring(0, 19);
    o.collection_method = payload.payment_method;
    o.collection_reference = payload.reference_number || null;
    saveFallbackOnlineOrders(fallbackOrders);
  }

  return safeInvoke<boolean>("collect_online_order_payment", { payload }, true);
}

export async function markOnlineOrderReturn(
  payload: MarkOnlineReturnPayload
): Promise<boolean> {
  const fallbackOrders = getFallbackOnlineOrders();
  const idx = fallbackOrders.findIndex((o) => o.order_id === payload.order_id);
  if (idx !== -1) {
    const o = fallbackOrders[idx];
    o.delivery_status = "RETURNED_RTO";
    o.payment_status = "RETURNED";
    o.payment_custodian = "RETURNED";
    o.cod_balance_paisa = 0;
    o.return_reason = payload.return_reason;
    saveFallbackOnlineOrders(fallbackOrders);
  }

  return safeInvoke<boolean>("mark_online_order_return", { payload }, true);
}

export async function updateOnlineOrderStatus(
  orderId: string,
  deliveryStatus: string,
  trackingNumber?: string,
  courierPartner?: string
): Promise<boolean> {
  const fallbackOrders = getFallbackOnlineOrders();
  const idx = fallbackOrders.findIndex((o) => o.order_id === orderId);
  if (idx !== -1) {
    fallbackOrders[idx].delivery_status = deliveryStatus as any;
    if (trackingNumber) fallbackOrders[idx].tracking_number = trackingNumber;
    if (courierPartner) fallbackOrders[idx].courier_partner = courierPartner;
    saveFallbackOnlineOrders(fallbackOrders);
  }

  return safeInvoke<boolean>(
    "update_online_order_status",
    {
      order_id: orderId,
      orderId,
      delivery_status: deliveryStatus,
      deliveryStatus,
      tracking_number: trackingNumber,
      trackingNumber,
      courier_partner: courierPartner,
      courierPartner,
    },
    true
  );
}


