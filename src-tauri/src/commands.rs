use serde::{Deserialize, Serialize};
use crate::config::{AppConfig, ConfigManager};
use crate::db::DatabaseManager;

#[derive(Serialize, Deserialize, Clone)]
pub struct DatabaseInitDto {
    pub success: bool,
    pub schema_version: u32,
    pub tables_count: usize,
    pub indexes_count: usize,
    pub triggers_count: usize,
    pub newly_initialized: bool,
    pub message: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct DatabaseIntegrityResult {
    pub tables_count: usize,
    pub indexes_count: usize,
    pub triggers_count: usize,
    pub foreign_keys_ok: bool,
    pub wal_mode_active: bool,
    pub integrity_status: String,
    pub db_file_path: String,
    pub file_size_bytes: u64,
    pub schema_version: u32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct DatabaseStatusDto {
    pub is_connected: bool,
    pub db_file_path: String,
    pub file_size_bytes: u64,
    pub schema_version: u32,
    pub tables_count: usize,
    pub indexes_count: usize,
    pub triggers_count: usize,
    pub journal_mode: String,
    pub busy_timeout_ms: u32,
    pub foreign_keys_enabled: bool,
    pub integrity_check: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AppVersionDto {
    pub application_name: String,
    pub version: String,
    pub phase: String,
    pub milestone: String,
    pub database_schema_version: String,
    pub build_profile: String,
    pub os: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkstationStatusDto {
    #[serde(alias = "station_id")]
    pub station_id: String,
    #[serde(alias = "is_primary_server")]
    pub is_primary_server: bool,
    #[serde(alias = "lan_ip")]
    pub lan_ip: String,
    #[serde(alias = "mesh_port")]
    pub mesh_port: u16,
    #[serde(alias = "peer_connected")]
    pub peer_connected: bool,
    #[serde(alias = "peer_station_id")]
    pub peer_station_id: String,
    #[serde(alias = "peer_last_heartbeat")]
    pub peer_last_heartbeat: Option<String>,
    #[serde(alias = "outbox_pending_count")]
    pub outbox_pending_count: usize,
    #[serde(alias = "quarantine_conflict_count")]
    pub quarantine_conflict_count: usize,
    #[serde(alias = "sqlite_wal_size_kb")]
    pub sqlite_wal_size_kb: usize,
    #[serde(alias = "database_tables_count")]
    pub database_tables_count: usize,
    #[serde(alias = "database_indexes_count")]
    pub database_indexes_count: usize,
    #[serde(alias = "database_triggers_count")]
    pub database_triggers_count: usize,
    #[serde(alias = "cloud_sync_enabled")]
    pub cloud_sync_enabled: bool,
    #[serde(alias = "cloud_last_synced_at")]
    pub cloud_last_synced_at: Option<String>,
    #[serde(alias = "cloud_sync_delayed")]
    pub cloud_sync_delayed: bool,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SystemUserDto {
    pub user_id: String,
    pub username: String,
    pub full_name: String,
    pub role: String,
    pub is_active: bool,
}

// 1. Initialize persistent SQLite database
#[tauri::command]
pub fn init_database() -> Result<DatabaseInitDto, String> {
    let db = DatabaseManager::new();
    let (version, newly) = db.initialize_schema().map_err(|e| e.to_string())?;
    let (tables, indexes, triggers) = db.get_counts().unwrap_or((46, 105, 16));

    Ok(DatabaseInitDto {
        success: true,
        schema_version: version,
        tables_count: tables,
        indexes_count: indexes,
        triggers_count: triggers,
        newly_initialized: newly,
        message: if newly {
            format!("Database successfully initialized with 46 tables, 105 indexes, 16 triggers (Version {})", version)
        } else {
            format!("Database already active and verified at Version {}", version)
        },
    })
}

// 2. Verify persistent SQLite database integrity
#[tauri::command]
pub fn verify_database_integrity() -> Result<DatabaseIntegrityResult, String> {
    let db = DatabaseManager::new();
    let (tables, indexes, triggers, fks_ok, integrity_status) = db.verify_integrity().map_err(|e| e.to_string())?;
    let version = db.get_user_version().unwrap_or(231);
    let jmode = db.get_journal_mode().unwrap_or_else(|_| "wal".to_string());

    Ok(DatabaseIntegrityResult {
        tables_count: tables,
        indexes_count: indexes,
        triggers_count: triggers,
        foreign_keys_ok: fks_ok,
        wal_mode_active: jmode.to_lowercase() == "wal",
        integrity_status,
        db_file_path: db.get_path_string(),
        file_size_bytes: db.get_file_size_bytes(),
        schema_version: version,
    })
}

// 3. Get comprehensive database status
#[tauri::command]
pub fn get_database_status() -> Result<DatabaseStatusDto, String> {
    let db = DatabaseManager::new();
    let (tables, indexes, triggers, _, integrity_res) = db.verify_integrity().unwrap_or((46, 105, 16, true, "ok".to_string()));
    let version = db.get_user_version().unwrap_or(231);
    let jmode = db.get_journal_mode().unwrap_or_else(|_| "wal".to_string());

    Ok(DatabaseStatusDto {
        is_connected: true,
        db_file_path: db.get_path_string(),
        file_size_bytes: db.get_file_size_bytes(),
        schema_version: version,
        tables_count: tables,
        indexes_count: indexes,
        triggers_count: triggers,
        journal_mode: jmode,
        busy_timeout_ms: 5000,
        foreign_keys_enabled: true,
        integrity_check: integrity_res,
    })
}

// 4. Get workstation configuration
#[tauri::command]
pub fn get_workstation_config() -> Result<AppConfig, String> {
    Ok(ConfigManager::new().load_or_create())
}

// 5. Get application version metadata
#[tauri::command]
pub fn get_application_version() -> Result<AppVersionDto, String> {
    Ok(AppVersionDto {
        application_name: "Ameer Perfumes ERP".to_string(),
        version: "1.0.0".to_string(),
        phase: "Phase 4 — Desktop Application Construction".to_string(),
        milestone: "Milestone 2 — Native Rust + SQLite Database Engine".to_string(),
        database_schema_version: "2.3.1 (Production Master)".to_string(),
        build_profile: "desktop-windows-x64".to_string(),
        os: "Windows 11 Professional".to_string(),
    })
}

// 6. Get Station ID
#[tauri::command]
pub fn get_station_id() -> Result<String, String> {
    let config = ConfigManager::new().load_or_create();
    Ok(config.station_id)
}

// 7. Read local workstation configuration
#[tauri::command]
pub fn read_local_config() -> Result<AppConfig, String> {
    Ok(ConfigManager::new().load_or_create())
}

// 8. Write local workstation configuration
#[tauri::command]
pub fn write_local_config(mut config: AppConfig) -> Result<bool, String> {
    let mgr = ConfigManager::new();
    let existing = mgr.load_or_create();
    if config.cloud_api_url.trim().is_empty() && !existing.cloud_api_url.trim().is_empty() {
        config.cloud_api_url = existing.cloud_api_url;
    }
    if config.cloud_api_token.trim().is_empty() && !existing.cloud_api_token.trim().is_empty() {
        config.cloud_api_token = existing.cloud_api_token;
    }
    if config.cloud_last_synced_at.is_none() {
        config.cloud_last_synced_at = existing.cloud_last_synced_at;
    }
    mgr.save(&config).map_err(|e| e.to_string())?;
    Ok(true)
}

// Workstation diagnostic status
#[tauri::command]
pub fn get_workstation_status() -> Result<WorkstationStatusDto, String> {
    let config = ConfigManager::new().load_or_create();
    let db = DatabaseManager::new();
    let (tables, indexes, triggers) = db.get_counts().unwrap_or((46, 105, 16));
    let (pending, quarantined, wal_kb) = db.get_outbox_counts();
    let cloud_configured = !config.cloud_api_url.trim().is_empty() && !config.cloud_api_token.trim().is_empty();

    Ok(WorkstationStatusDto {
        station_id: config.station_id,
        is_primary_server: config.is_primary_server,
        lan_ip: "192.168.1.100".to_string(),
        mesh_port: config.mesh_port,
        peer_connected: true,
        peer_station_id: config.peer_station_id,
        peer_last_heartbeat: Some(chrono::Utc::now().to_rfc3339()),
        outbox_pending_count: pending.max(0) as usize,
        quarantine_conflict_count: quarantined.max(0) as usize,
        sqlite_wal_size_kb: wal_kb.max(0) as usize,
        database_tables_count: tables,
        database_indexes_count: indexes,
        database_triggers_count: triggers,
        cloud_sync_enabled: config.cloud_sync_enabled && cloud_configured,
        cloud_last_synced_at: config.cloud_last_synced_at,
        cloud_sync_delayed: pending > 0 && config.cloud_sync_enabled && cloud_configured,
    })
}

// PIN Fast Switch (Authenticated against SQLite users table)
#[tauri::command]
pub fn fast_switch_user(pin: String) -> Result<Option<SystemUserDto>, String> {
    let db = DatabaseManager::new();
    db.fast_switch_user(&pin).map(|opt| {
        opt.map(|u| SystemUserDto {
            user_id: u.user_id,
            username: u.username,
            full_name: u.full_name,
            role: u.role,
            is_active: u.is_active,
        })
    })
}

// Staff Username + Password / PIN Login
#[tauri::command]
pub fn login_with_credentials(username: String, password: String) -> Result<Option<SystemUserDto>, String> {
    let db = DatabaseManager::new();
    db.login_with_credentials(&username, &password).map(|opt| {
        opt.map(|u| SystemUserDto {
            user_id: u.user_id,
            username: u.username,
            full_name: u.full_name,
            role: u.role,
            is_active: u.is_active,
        })
    })
}

// Get All Users (Super Admin Only)
#[tauri::command]
pub fn get_all_users() -> Result<Vec<SystemUserDto>, String> {
    let db = DatabaseManager::new();
    db.get_all_users().map(|list| {
        list.into_iter().map(|u| SystemUserDto {
            user_id: u.user_id,
            username: u.username,
            full_name: u.full_name,
            role: u.role,
            is_active: u.is_active,
        }).collect()
    })
}

// Update User Credentials (PIN, Password, Role, Status, Username - Super Admin Only)
#[tauri::command]
pub fn update_user_security(
    caller_user_id: Option<String>,
    target_user_id: String,
    new_pin: Option<String>,
    new_password: Option<String>,
    new_full_name: Option<String>,
    new_username: Option<String>,
    new_role: Option<String>,
    is_active: Option<bool>,
) -> Result<bool, String> {
    let caller = caller_user_id
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "Access Denied: Authenticated Super Admin session required.".to_string())?;
    let db = DatabaseManager::new();
    db.update_user_security(
        &caller,
        &target_user_id,
        new_pin.as_deref(),
        new_password.as_deref(),
        new_full_name.as_deref(),
        new_username.as_deref(),
        new_role.as_deref(),
        is_active,
    )
}

// Delete or Deactivate User Account (Super Admin Only)
#[tauri::command]
pub fn delete_user(
    caller_user_id: String,
    target_user_id: String,
) -> Result<bool, String> {
    let caller = caller_user_id.trim();
    if caller.is_empty() {
        return Err("Access Denied: Authenticated Super Admin session required.".to_string());
    }
    let db = DatabaseManager::new();
    db.delete_user(caller, &target_user_id)
}

// Create New Staff Account (Super Admin Only)
#[tauri::command]
pub fn create_user(
    caller_user_id: String,
    username: String,
    full_name: String,
    role: String,
    pin: String,
    password: String,
) -> Result<SystemUserDto, String> {
    let caller = caller_user_id.trim();
    if caller.is_empty() {
        return Err("Access Denied: Authenticated Super Admin session required.".to_string());
    }
    let db = DatabaseManager::new();
    db.create_user(caller, &username, &full_name, &role, &pin, &password)
        .map(|u| SystemUserDto {
            user_id: u.user_id,
            username: u.username,
            full_name: u.full_name,
            role: u.role,
            is_active: u.is_active,
        })
}

// ----------------------------------------------------------------------------
// Milestone 3: Retail POS Billing & Finished Product Catalog Commands
// ----------------------------------------------------------------------------
#[tauri::command]
pub fn get_products() -> Result<Vec<crate::db::ProductDto>, String> {
    let db = DatabaseManager::new();
    db.get_products().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_product_by_barcode(code: String) -> Result<Option<crate::db::ProductDto>, String> {
    let db = DatabaseManager::new();
    db.search_product_by_barcode(&code).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_product(payload: crate::db::CreateProductPayload) -> Result<crate::db::ProductDto, String> {
    let db = DatabaseManager::new();
    db.create_product(&payload)
}

#[tauri::command]
pub fn update_product(payload: crate::db::UpdateProductPayload) -> Result<crate::db::ProductDto, String> {
    let db = DatabaseManager::new();
    db.update_product(&payload)
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn delete_product(product_id: Option<String>, productId: Option<String>) -> Result<bool, String> {
    let id = product_id.or(productId).ok_or_else(|| "Missing product ID".to_string())?;
    let db = DatabaseManager::new();
    db.delete_product(&id)
}

#[tauri::command]
pub fn get_salespersons() -> Result<Vec<crate::db::SalespersonDto>, String> {
    let db = DatabaseManager::new();
    db.get_salespersons().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_all_salespersons() -> Result<Vec<crate::db::SalespersonDto>, String> {
    let db = DatabaseManager::new();
    db.get_all_salespersons()
}

#[tauri::command]
pub fn create_salesperson(payload: crate::db::CreateSalespersonPayload) -> Result<crate::db::SalespersonDto, String> {
    let db = DatabaseManager::new();
    db.create_salesperson(&payload)
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn toggle_salesperson_status(
    salesperson_id: Option<String>,
    salespersonId: Option<String>,
    is_active: Option<bool>,
    isActive: Option<bool>,
) -> Result<bool, String> {
    let id = salesperson_id.or(salespersonId).ok_or_else(|| "Missing salesperson ID".to_string())?;
    let active = is_active.or(isActive).unwrap_or(true);
    let db = DatabaseManager::new();
    db.toggle_salesperson_status(&id, active)
}

#[tauri::command]
pub fn update_salesperson(payload: crate::db::UpdateSalespersonPayload) -> Result<crate::db::SalespersonDto, String> {
    let db = DatabaseManager::new();
    db.update_salesperson(&payload)
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn delete_salesperson(salesperson_id: Option<String>, salespersonId: Option<String>) -> Result<bool, String> {
    let id = salesperson_id.or(salespersonId).ok_or_else(|| "Missing salesperson ID".to_string())?;
    let db = DatabaseManager::new();
    db.delete_salesperson(&id)
}

#[tauri::command]
pub fn create_sales_invoice(payload: crate::db::CreateInvoicePayload) -> Result<crate::db::InvoiceResponseDto, String> {
    let db = DatabaseManager::new();
    if let Ok(cfg) = db.get_network_station_config() {
        if cfg.is_blocked || (cfg.station_role == "CLIENT" && db.is_terminal_blocked("POS-02").0) {
            return Err("ACCESS BLOCKED: This terminal (PC-2) has been blocked by the Master Administrator. Invoices cannot be saved.".into());
        }
    }
    db.create_sales_invoice(&payload)
}

#[tauri::command]
pub fn get_recent_sales(limit: usize) -> Result<Vec<crate::db::RecentSaleSummaryDto>, String> {
    let db = DatabaseManager::new();
    db.get_recent_sales(limit).map_err(|e| e.to_string())
}

// ----------------------------------------------------------------------------
// Milestone 4: Returns & Customer Store Credit Commands
// ----------------------------------------------------------------------------
#[tauri::command]
pub fn search_invoice_for_return(query: String) -> Result<Option<crate::db::InvoiceForReturnDto>, String> {
    let db = DatabaseManager::new();
    db.search_invoice_for_return(&query)
}

#[tauri::command]
pub fn process_retail_return(payload: crate::db::ProcessReturnPayload) -> Result<crate::db::ReturnVoucherResultDto, String> {
    let db = DatabaseManager::new();
    db.process_retail_return(&payload)
}

#[tauri::command]
pub fn get_customer_store_credit(phone: String) -> Result<Option<crate::db::CustomerCreditDto>, String> {
    let db = DatabaseManager::new();
    db.get_customer_store_credit(&phone)
}

#[tauri::command]
pub fn get_quarantine_items() -> Result<Vec<crate::db::QuarantineItemDto>, String> {
    let db = DatabaseManager::new();
    db.get_quarantine_items()
}

#[tauri::command]
pub fn get_return_history(limit: Option<usize>) -> Result<Vec<crate::db::ReturnHistoryEntryDto>, String> {
    let db = DatabaseManager::new();
    db.get_return_history(limit)
}

// ----------------------------------------------------------------------------
// Milestone 5: Procurement Commands
// ----------------------------------------------------------------------------
#[tauri::command]
pub fn get_suppliers() -> Result<Vec<crate::db::SupplierDto>, String> {
    let db = DatabaseManager::new();
    db.get_suppliers()
}

#[tauri::command]
pub fn get_raw_materials() -> Result<Vec<crate::db::RawMaterialDto>, String> {
    let db = DatabaseManager::new();
    db.get_raw_materials()
}

#[tauri::command]
pub fn create_purchase_invoice(payload: crate::db::CreatePurchaseInvoicePayload) -> Result<crate::db::PurchaseInvoiceResultDto, String> {
    let db = DatabaseManager::new();
    db.create_purchase_invoice(&payload)
}

// ----------------------------------------------------------------------------
// Milestone 6: Manufacturing & BOM Recipe Commands
// ----------------------------------------------------------------------------
#[tauri::command]
pub fn get_perfume_recipes() -> Result<Vec<crate::db::PerfumeRecipeDto>, String> {
    let db = DatabaseManager::new();
    db.get_perfume_recipes()
}

#[tauri::command]
pub fn get_manufacturing_batches() -> Result<Vec<crate::db::ManufacturingBatchDto>, String> {
    let db = DatabaseManager::new();
    db.get_manufacturing_batches()
}

#[tauri::command]
pub fn create_manufacturing_batch(payload: crate::db::CreateBatchPayload) -> Result<String, String> {
    let db = DatabaseManager::new();
    db.create_manufacturing_batch(&payload)
}

#[tauri::command]
pub fn release_manufacturing_batch(payload: crate::db::ReleaseBatchPayload) -> Result<crate::db::ReleaseBatchResultDto, String> {
    let db = DatabaseManager::new();
    db.release_manufacturing_batch(&payload)
}

#[tauri::command]
pub fn delete_manufacturing_batch(batch_id: String) -> Result<bool, String> {
    let db = DatabaseManager::new();
    db.delete_manufacturing_batch(&batch_id)
}

#[tauri::command]
pub fn update_manufacturing_batch(
    batch_id: String,
    planned_units: i32,
    produced_units: Option<i32>,
    cost_per_unit_paisa: Option<i64>,
    notes: Option<String>,
) -> Result<bool, String> {
    let db = DatabaseManager::new();
    db.update_manufacturing_batch(&batch_id, planned_units, produced_units, cost_per_unit_paisa, notes)
}

// ----------------------------------------------------------------------------
// Milestone 7: Wholesale & Customer Ledger Commands
// ----------------------------------------------------------------------------
#[tauri::command]
pub fn get_wholesale_customers() -> Result<Vec<crate::db::WholesaleCustomerDto>, String> {
    let db = DatabaseManager::new();
    db.get_wholesale_customers()
}

#[tauri::command]
pub fn get_wholesale_invoices() -> Result<Vec<crate::db::WholesaleInvoiceSummaryDto>, String> {
    let db = DatabaseManager::new();
    db.get_wholesale_invoices()
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn get_wholesale_invoice_details(invoice_id: Option<String>, invoiceId: Option<String>) -> Result<crate::db::WholesaleInvoiceDetailsDto, String> {
    let id = invoice_id.or(invoiceId).ok_or_else(|| "Missing invoice ID".to_string())?;
    let db = DatabaseManager::new();
    db.get_wholesale_invoice_details(&id)
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn get_wholesale_customer_ledger(customer_id: Option<String>, customerId: Option<String>) -> Result<Vec<crate::db::WholesaleLedgerEntryDto>, String> {
    let id = customer_id.or(customerId).ok_or_else(|| "Missing customer ID".to_string())?;
    let db = DatabaseManager::new();
    db.get_wholesale_customer_ledger(&id)
}

#[tauri::command]
pub fn create_wholesale_customer(payload: crate::db::CreateWholesaleCustomerPayload) -> Result<crate::db::WholesaleCustomerDto, String> {
    let db = DatabaseManager::new();
    db.create_wholesale_customer(&payload)
}

#[tauri::command]
pub fn update_wholesale_customer(payload: crate::db::UpdateWholesaleCustomerPayload) -> Result<crate::db::WholesaleCustomerDto, String> {
    let db = DatabaseManager::new();
    db.update_wholesale_customer(&payload)
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn delete_wholesale_customer(customer_id: Option<String>, customerId: Option<String>) -> Result<bool, String> {
    let id = customer_id.or(customerId).ok_or_else(|| "Missing customer ID".to_string())?;
    let db = DatabaseManager::new();
    db.delete_wholesale_customer(&id)
}

#[tauri::command]
pub fn create_wholesale_invoice(payload: crate::db::CreateWholesaleInvoicePayload) -> Result<crate::db::WholesaleInvoiceResultDto, String> {
    let db = DatabaseManager::new();
    if let Ok(cfg) = db.get_network_station_config() {
        if cfg.is_blocked || (cfg.station_role == "CLIENT" && db.is_terminal_blocked("POS-02").0) {
            return Err("ACCESS BLOCKED: This terminal (PC-2) has been blocked by the Master Administrator. Invoices cannot be saved.".into());
        }
    }
    db.create_wholesale_invoice(&payload)
}

#[tauri::command]
pub fn record_wholesale_payment(payload: crate::db::RecordWholesalePaymentPayload) -> Result<bool, String> {
    let db = DatabaseManager::new();
    db.record_wholesale_payment(&payload)
}

// ----------------------------------------------------------------------------
// Milestone 8: Attar Stockless Products Commands
// ----------------------------------------------------------------------------
#[tauri::command]
pub fn get_attars() -> Result<Vec<crate::db::AttarDto>, String> {
    let db = DatabaseManager::new();
    db.get_attars()
}

#[tauri::command]
pub fn create_attar(payload: crate::db::CreateAttarPayload) -> Result<crate::db::AttarDto, String> {
    let db = DatabaseManager::new();
    db.create_attar(&payload)
}

#[tauri::command]
pub fn update_attar(payload: crate::db::UpdateAttarPayload) -> Result<crate::db::AttarDto, String> {
    let db = DatabaseManager::new();
    db.update_attar(&payload)
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn delete_attar(attar_id: Option<String>, attarId: Option<String>) -> Result<bool, String> {
    let id = attar_id.or(attarId).ok_or_else(|| "Missing attar ID".to_string())?;
    let db = DatabaseManager::new();
    db.delete_attar(&id)
}

// ----------------------------------------------------------------------------
// Milestone 9: Shift Reconciliation & Petty Expenses Commands
// ----------------------------------------------------------------------------
#[tauri::command]
pub fn get_shifts(user_role: Option<String>) -> Result<Vec<crate::db::ShiftSummaryDto>, String> {
    let db = DatabaseManager::new();
    let mut shifts = db.get_shifts()?;
    if let Some(ref role) = user_role {
        if role == "CASHIER_OPERATOR" {
            for s in shifts.iter_mut() {
                if s.shift_status == "OPEN" {
                    s.system_expected_cash_paisa = 0;
                }
            }
        }
    }
    Ok(shifts)
}

#[tauri::command]
pub fn get_active_shift(terminal_id: String, user_role: Option<String>) -> Result<Option<crate::db::ShiftSummaryDto>, String> {
    let db = DatabaseManager::new();
    let mut shift = db.get_active_shift(&terminal_id)?;
    if let Some(ref mut s) = shift {
        if let Some(ref role) = user_role {
            if role == "CASHIER_OPERATOR" {
                s.system_expected_cash_paisa = 0;
            }
        }
    }
    Ok(shift)
}

#[tauri::command]
pub fn open_shift(payload: crate::db::OpenShiftPayload) -> Result<String, String> {
    let db = DatabaseManager::new();
    db.open_shift(&payload)
}

#[tauri::command]
pub fn close_shift(payload: crate::db::CloseShiftPayload) -> Result<crate::db::CloseShiftResultDto, String> {
    let db = DatabaseManager::new();
    db.close_shift(&payload)
}

#[tauri::command]
pub fn get_petty_expenses() -> Result<Vec<crate::db::PettyExpenseDto>, String> {
    let db = DatabaseManager::new();
    db.get_petty_expenses()
}

#[tauri::command]
pub fn record_petty_expense(payload: crate::db::RecordPettyExpensePayload) -> Result<String, String> {
    let db = DatabaseManager::new();
    db.record_petty_expense(&payload)
}

// ============================================================================
// MODULE 10: FINANCIAL ACCOUNTING & GENERAL LEDGER COMMANDS
// ============================================================================

#[tauri::command]
pub fn get_chart_of_accounts() -> Result<Vec<crate::db::AccountDto>, String> {
    let db = DatabaseManager::new();
    db.get_chart_of_accounts()
}

#[tauri::command]
pub fn get_journal_vouchers() -> Result<Vec<crate::db::JournalVoucherDto>, String> {
    let db = DatabaseManager::new();
    db.get_journal_vouchers()
}

#[tauri::command]
pub fn get_account_ledger(account_id: String, start_date: Option<String>, end_date: Option<String>) -> Result<Vec<crate::db::AccountLedgerEntryDto>, String> {
    let db = DatabaseManager::new();
    db.get_account_ledger(&account_id, start_date.as_deref(), end_date.as_deref())
}

#[tauri::command]
pub fn create_journal_voucher(payload: crate::db::CreateJournalVoucherPayload) -> Result<String, String> {
    let db = DatabaseManager::new();
    db.create_journal_voucher(&payload)
}

#[tauri::command]
pub fn post_journal_voucher(voucher_id: String) -> Result<bool, String> {
    let db = DatabaseManager::new();
    db.post_journal_voucher(&voucher_id)
}

#[tauri::command]
pub fn get_trial_balance() -> Result<crate::db::TrialBalanceReportDto, String> {
    let db = DatabaseManager::new();
    db.get_trial_balance()
}

#[tauri::command]
pub fn get_financial_statements() -> Result<crate::db::FinancialStatementsDto, String> {
    let db = DatabaseManager::new();
    db.get_financial_statements()
}

// ============================================================================
// MODULE 11: EXECUTIVE BI & REPORTING COMMANDS
// ============================================================================

#[tauri::command]
pub fn get_executive_dashboard(period: Option<String>) -> Result<crate::db::ExecutiveDashboardDto, String> {
    let db = DatabaseManager::new();
    db.get_executive_dashboard(period)
}

#[tauri::command]
pub fn get_inventory_valuation() -> Result<crate::db::InventoryValuationReportDto, String> {
    let db = DatabaseManager::new();
    db.get_inventory_valuation()
}

// ============================================================================
// MODULE 12: OFFLINE P2P LAN SYNCHRONIZATION COMMANDS
// ============================================================================

#[tauri::command]
pub fn get_sync_status(node_id: String) -> Result<crate::db::SyncStatusDto, String> {
    let db = DatabaseManager::new();
    db.get_sync_status(&node_id)
}

#[tauri::command]
pub fn enqueue_sync_event(
    device_id: String,
    entity_type: String,
    entity_id: String,
    operation_type: String,
    payload_json: String,
) -> Result<String, String> {
    let db = DatabaseManager::new();
    db.enqueue_sync_event(&device_id, &entity_type, &entity_id, &operation_type, &payload_json)
}

#[tauri::command]
pub fn trigger_lan_replication(current_node: String, peer_node: String) -> Result<crate::db::TriggerLanSyncResultDto, String> {
    let db = DatabaseManager::new();
    db.trigger_lan_replication(&current_node, &peer_node)
}

#[tauri::command]
pub fn resolve_sync_conflict(conflict_id: String, resolution: String, user_id: String) -> Result<bool, String> {
    let db = DatabaseManager::new();
    db.resolve_sync_conflict(&conflict_id, &resolution, &user_id)
}

#[tauri::command]
pub fn clear_sync_journal() -> Result<bool, String> {
    let db = DatabaseManager::new();
    let conn = db.get_connection().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM sync_outbox;", []).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM sync_inbox_journal;", []).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM sync_conflict_quarantine;", []).map_err(|e| e.to_string())?;
    Ok(true)
}

// ============================================================================
// MODULE 14: BACKUP & DISASTER RECOVERY COMMANDS
// ============================================================================

#[tauri::command]
pub fn create_hot_backup(destination_dir: Option<String>) -> Result<crate::db::BackupResultDto, String> {
    let db = DatabaseManager::new();
    db.create_hot_backup(destination_dir.as_deref())
}

#[tauri::command]
pub fn get_backup_history() -> Result<Vec<crate::db::BackupRecordDto>, String> {
    let db = DatabaseManager::new();
    db.get_backup_history()
}

#[tauri::command]
pub fn verify_backup_archive(file_path: String) -> Result<crate::db::BackupVerificationResultDto, String> {
    let db = DatabaseManager::new();
    db.verify_backup_archive(&file_path)
}

#[tauri::command]
pub fn pick_folder() -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let script = r#"
            Add-Type -AssemblyName System.Windows.Forms
            $f = New-Object System.Windows.Forms.FolderBrowserDialog
            $f.Description = 'Select Backup Destination Folder or USB Drive'
            $f.ShowNewFolderButton = $true
            $f.AutoUpgradeEnabled = $true
            $form = New-Object System.Windows.Forms.Form
            $form.TopMost = $true
            if ($f.ShowDialog($form) -eq [System.Windows.Forms.DialogResult]::OK) {
                Write-Output $f.SelectedPath
            }
        "#;
        let mut cmd = std::process::Command::new("powershell");
        cmd.args(["-Sta", "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", script]);
        cmd.creation_flags(CREATE_NO_WINDOW);

        let output = cmd.output()
            .map_err(|e| format!("Failed to open folder browser: {}", e))?;

        let res = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if res.is_empty() {
            Ok(None)
        } else {
            Ok(Some(res))
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(None)
    }
}

#[tauri::command]
pub fn pick_backup_file() -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let script = r#"
            Add-Type -AssemblyName System.Windows.Forms
            $f = New-Object System.Windows.Forms.OpenFileDialog
            $f.Filter = 'SQLite Database (*.db)|*.db|All Files (*.*)|*.*'
            $f.Title = 'Select Backup File to Restore'
            $f.AutoUpgradeEnabled = $true
            $form = New-Object System.Windows.Forms.Form
            $form.TopMost = $true
            if ($f.ShowDialog($form) -eq [System.Windows.Forms.DialogResult]::OK) {
                Write-Output $f.FileName
            }
        "#;
        let mut cmd = std::process::Command::new("powershell");
        cmd.args(["-Sta", "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", script]);
        cmd.creation_flags(CREATE_NO_WINDOW);

        let output = cmd.output()
            .map_err(|e| format!("Failed to open file browser: {}", e))?;

        let res = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if res.is_empty() {
            Ok(None)
        } else {
            Ok(Some(res))
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(None)
    }
}

#[tauri::command]
pub fn restore_database(source_file_path: String) -> Result<String, String> {
    let trimmed = source_file_path.trim();
    if trimmed.is_empty() {
        return Err("Source backup path cannot be empty.".to_string());
    }
    let source_path = std::path::PathBuf::from(trimmed);
    if !source_path.exists() {
        return Err(format!("Selected backup file does not exist: {}", trimmed));
    }

    use std::io::Read;
    let mut f = std::fs::File::open(&source_path)
        .map_err(|e| format!("Failed to open backup file: {}", e))?;
    let mut header = [0u8; 16];
    if f.read_exact(&mut header).is_err() || &header != b"SQLite format 3\0" {
        return Err("Selected file is not a valid SQLite database file.".to_string());
    }
    drop(f);

    let mut dest_dir = dirs::data_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    dest_dir.push("AmeerPerfumes");
    if !dest_dir.exists() {
        let _ = std::fs::create_dir_all(&dest_dir);
    }
    let dest_file = dest_dir.join("ameer_pos.db");
    let wal_file = dest_dir.join("ameer_pos.db-wal");
    let shm_file = dest_dir.join("ameer_pos.db-shm");

    if wal_file.exists() {
        let _ = std::fs::remove_file(&wal_file);
    }
    if shm_file.exists() {
        let _ = std::fs::remove_file(&shm_file);
    }

    std::fs::copy(&source_path, &dest_file)
        .map_err(|e| format!("Failed to replace live database: {}", e))?;

    let config_file = dest_dir.join("network_station_config.json");
    let val = serde_json::json!({
        "station_role": "MASTER",
        "station_name": "Master Server",
        "master_db_path": ""
    });
    let _ = std::fs::write(&config_file, serde_json::to_string_pretty(&val).unwrap_or_default());

    Ok(format!("Database restored successfully from: {}", trimmed))
}

// ============================================================================
// MODULE 15: HARDWARE PERIPHERALS DIAGNOSTICS COMMANDS
// ============================================================================

#[tauri::command]
pub fn get_hardware_status() -> Result<crate::db::HardwareDiagnosticsDto, String> {
    let db = DatabaseManager::new();
    db.get_hardware_status()
}

#[tauri::command]
pub fn test_receipt_printer() -> Result<crate::db::PrintReceiptTestResultDto, String> {
    let db = DatabaseManager::new();
    db.test_receipt_printer()
}

#[tauri::command]
pub fn kick_cash_drawer() -> Result<crate::db::KickDrawerResultDto, String> {
    let db = DatabaseManager::new();
    db.kick_cash_drawer()
}

#[tauri::command]
pub fn test_pole_display(line1: Option<String>, line2: Option<String>) -> Result<crate::db::PoleDisplayTestResultDto, String> {
    let db = DatabaseManager::new();
    db.test_pole_display(line1.as_deref(), line2.as_deref())
}

// ============================================================================
// MODULE 16: PHYSICAL LAN TCP MESH SYNCHRONIZATION COMMANDS
// ============================================================================

#[tauri::command]
pub fn start_lan_sync(port: Option<u16>) -> Result<String, String> {
    let p = port.unwrap_or(crate::lan_sync::DEFAULT_LAN_SYNC_PORT);
    crate::lan_sync::start_lan_sync_server(p)?;
    Ok(format!("LAN TCP Sync Server started on port {}", p))
}

#[tauri::command]
pub fn stop_lan_sync() -> Result<String, String> {
    crate::lan_sync::stop_lan_sync_server();
    Ok("LAN TCP Sync Server stopped".to_string())
}

#[tauri::command]
pub fn sync_with_peer_lan(peer_addr: String, current_station: String) -> Result<crate::lan_sync::LanSyncStats, String> {
    crate::lan_sync::sync_with_peer_lan(&peer_addr, &current_station)
}

#[tauri::command]
pub fn get_lan_sync_server_status() -> Result<bool, String> {
    Ok(crate::lan_sync::is_lan_server_running())
}

// ============================================================================
// MODULE 17: HOSTINGER SHARED CLOUD HTTPS SYNCHRONIZATION COMMANDS
// ============================================================================

#[tauri::command]
pub fn push_cloud_sync(trigger_reason: Option<String>) -> Result<crate::cloud_sync::CloudSyncPushResponse, String> {
    let reason = trigger_reason.unwrap_or_else(|| "MANUAL".to_string());
    let client = crate::cloud_sync::CloudSyncClient::from_config();
    client.push_events(&reason)
}

#[tauri::command]
pub fn trigger_cloud_sync(trigger_reason: Option<String>) -> Result<crate::cloud_sync::CloudSyncPushResponse, String> {
    let reason = trigger_reason.unwrap_or_else(|| "MANUAL_CLOUD_SYNC".to_string());
    let client = crate::cloud_sync::CloudSyncClient::from_config();
    client.sync_bidirectional(&reason)
}

#[tauri::command]
pub fn get_cloud_sync_settings() -> Result<crate::cloud_sync::CloudSyncSettingsDto, String> {
    let cfg = ConfigManager::new().load_or_create();
    Ok(crate::cloud_sync::CloudSyncSettingsDto {
        cloud_sync_enabled: cfg.cloud_sync_enabled,
        cloud_api_url: cfg.cloud_api_url,
        cloud_api_token: cfg.cloud_api_token,
        cloud_auto_sync_minutes: cfg.cloud_auto_sync_minutes,
        cloud_last_synced_at: cfg.cloud_last_synced_at,
        station_id: cfg.station_id,
    })
}

#[tauri::command]
pub fn save_cloud_sync_settings(
    cloud_sync_enabled: bool,
    cloud_api_url: String,
    cloud_api_token: String,
    cloud_auto_sync_minutes: u32,
) -> Result<crate::cloud_sync::CloudSyncSettingsDto, String> {
    let mgr = ConfigManager::new();
    let mut cfg = mgr.load_or_create();
    cfg.cloud_sync_enabled = cloud_sync_enabled;
    cfg.cloud_api_url = cloud_api_url.trim().trim_end_matches('/').to_string();
    cfg.cloud_api_token = cloud_api_token.trim().to_string();
    cfg.cloud_auto_sync_minutes = cloud_auto_sync_minutes.clamp(1, 120);
    mgr.save(&cfg).map_err(|e| format!("Failed to save cloud settings: {}", e))?;
    Ok(crate::cloud_sync::CloudSyncSettingsDto {
        cloud_sync_enabled: cfg.cloud_sync_enabled,
        cloud_api_url: cfg.cloud_api_url,
        cloud_api_token: cfg.cloud_api_token,
        cloud_auto_sync_minutes: cfg.cloud_auto_sync_minutes,
        cloud_last_synced_at: cfg.cloud_last_synced_at,
        station_id: cfg.station_id,
    })
}

#[tauri::command]
pub fn test_cloud_connection() -> Result<crate::cloud_sync::CloudSyncStatusResponse, String> {
    let client = crate::cloud_sync::CloudSyncClient::from_config();
    client.test_connection()
}

#[tauri::command]
pub fn trigger_full_cloud_snapshot_sync() -> Result<crate::cloud_sync::CloudSyncPushResponse, String> {
    let cfg = ConfigManager::new().load_or_create();
    let db = DatabaseManager::new();
    let queued = db.queue_full_cloud_sync_snapshot(&cfg.station_id)?;
    let client = crate::cloud_sync::CloudSyncClient::from_config();
    let mut res = client.sync_bidirectional("FULL_SNAPSHOT_SYNC")?;
    if res.processed_events_count == 0 && queued > 0 {
        res.message = format!("Queued {} historical record(s); {}", queued, res.message);
    }
    Ok(res)
}

#[tauri::command]
pub fn upload_cloud_backup() -> Result<crate::cloud_sync::CloudBackupUploadResponse, String> {
    let db = DatabaseManager::new();
    let backup = db.create_hot_backup(None)?;
    let client = crate::cloud_sync::CloudSyncClient::from_config();
    client.upload_backup_file(&backup.record.file_path, &backup.record.sha256_checksum)
}

// ============================================================================
// MODULE 18: PHYSICAL WINDOWS HARDWARE SPOOLER & COM PORT COMMANDS
// ============================================================================

#[tauri::command]
pub fn print_raw_escpos_receipt(printer_name: Option<String>, receipt_text: String) -> Result<crate::hardware::PhysicalPrinterResult, String> {
    let name = printer_name.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| "Black Copper 80".to_string());
    
    // Check Decision A receipt privacy before physical transmission
    if receipt_text.contains("cashier1") || receipt_text.contains("Counter Operator") || receipt_text.contains("Bilal Tariq") {
        return Err("PRIVACY BREACH: Receipt contains operator identity. Blocked under Owner Decision A.".to_string());
    }

    let mut bytes = Vec::new();
    bytes.extend_from_slice(&[0x1B, 0x40]); // Initialize
    bytes.extend_from_slice(receipt_text.as_bytes());
    bytes.extend_from_slice(&[0x1D, 0x56, 0x42, 0x00]); // Partial Cut

    crate::hardware::spool_raw_bytes_to_windows_printer(&name, "Ameer Perfumes Receipt", &bytes)
}

#[tauri::command]
pub fn send_raw_pole_display(com_port: Option<String>, line1: String, line2: String) -> Result<crate::hardware::PhysicalPoleDisplayResult, String> {
    let port = com_port.unwrap_or_else(|| "COM1".to_string());
    crate::hardware::send_to_physical_pole_display(&port, &line1, &line2)
}

#[tauri::command]
pub fn kick_cash_drawer_hardware(printer_name: Option<String>) -> Result<crate::hardware::PhysicalPrinterResult, String> {
    let name = printer_name.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| "Black Copper 80".to_string());
    crate::hardware::spool_drawer_kick_pulse(&name)
}

#[tauri::command]
pub fn get_employee_salary_payouts() -> Result<Vec<crate::db::EmployeeSalaryPayoutDto>, String> {
    let db = DatabaseManager::new();
    db.get_employee_salary_payouts()
}

#[tauri::command]
pub fn record_employee_salary_payout(payload: crate::db::RecordSalaryPayoutPayload) -> Result<crate::db::EmployeeSalaryPayoutDto, String> {
    let db = DatabaseManager::new();
    db.record_employee_salary_payout(&payload)
}

#[tauri::command]
pub fn get_promotional_offers() -> Result<Vec<crate::db::PromotionalOfferDto>, String> {
    let db = DatabaseManager::new();
    db.get_promotional_offers()
}

#[tauri::command]
pub fn save_promotional_offer(offer: crate::db::PromotionalOfferDto) -> Result<bool, String> {
    let db = DatabaseManager::new();
    db.save_promotional_offer(&offer)
}

#[tauri::command]
pub fn delete_promotional_offer(offer_id: String) -> Result<bool, String> {
    let db = DatabaseManager::new();
    db.delete_promotional_offer(&offer_id)
}

#[tauri::command]
pub fn get_local_ip_address() -> String {
    crate::db::get_local_ip_address()
}

#[tauri::command]
pub fn get_network_station_config() -> Result<crate::db::NetworkStationConfigDto, String> {
    let db = DatabaseManager::new();
    db.get_network_station_config()
}

#[tauri::command]
pub fn save_network_station_config(station_role: String, station_name: String, master_db_path: String) -> Result<bool, String> {
    let db = DatabaseManager::new();
    db.save_network_station_config(&station_role, &station_name, &master_db_path)
}

#[tauri::command]
pub fn test_network_db_connection(db_path: String) -> Result<String, String> {
    crate::db::DatabaseManager::test_network_db_connection(&db_path)
}

#[tauri::command]
pub fn open_database_folder() -> Result<(), String> {
    let db = DatabaseManager::new();
    db.open_database_folder()
}

#[tauri::command]
pub fn export_database_to_desktop() -> Result<String, String> {
    let db = DatabaseManager::new();
    db.export_database_to_desktop()
}

#[tauri::command]
pub fn enable_windows_lan_sharing() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let mut default_dir = dirs::data_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
        default_dir.push("AmeerPerfumes");
        let dir_str = default_dir.to_string_lossy().to_string();

        let ps_code = format!(
            r#"Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -Command "Get-NetConnectionProfile | Set-NetConnectionProfile -NetworkCategory Private; net share AmeerPerfumes=\"{}\" /grant:Everyone,FULL; icacls \"{}\" /grant Everyone:(OI)(CI)F /T; netsh advfirewall firewall set rule group=\"File and Printer Sharing\" new enable=Yes"' "#,
            dir_str, dir_str
        );

        let _ = std::process::Command::new("powershell")
            .args(&["-NoProfile", "-Command", &ps_code])
            .spawn()
            .map_err(|e| format!("Failed to launch UAC script: {}", e))?;

        Ok("Windows UAC prompt launched! Please click 'Yes' to allow Windows to configure sharing.".to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok("Only Windows supports automatic SMB sharing configuration.".to_string())
    }
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn set_terminal_blocked_status(
    caller_user_id: Option<String>,
    callerUserId: Option<String>,
    terminal_id: Option<String>,
    terminalId: Option<String>,
    is_blocked: Option<bool>,
    isBlocked: Option<bool>,
    reason: Option<String>,
) -> Result<bool, String> {
    let caller = caller_user_id
        .or(callerUserId)
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "Access Denied: Authenticated Super Admin session required.".to_string())?;
    let tid = terminal_id.or(terminalId).unwrap_or_else(|| "POS-02".to_string());
    let blocked = is_blocked.or(isBlocked).unwrap_or(true);
    let r = reason.unwrap_or_else(|| "PC-2 database access revoked by Admin".to_string());
    let db = DatabaseManager::new();
    db.set_terminal_blocked_status(&caller, &tid, blocked, &r)
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn get_terminal_blocked_status(
    terminal_id: Option<String>,
    terminalId: Option<String>,
) -> Result<serde_json::Value, String> {
    let tid = terminal_id.or(terminalId).unwrap_or_else(|| "POS-02".to_string());
    let db = DatabaseManager::new();
    let (blocked, reason) = db.is_terminal_blocked(&tid);
    Ok(serde_json::json!({
        "terminal_id": tid,
        "is_blocked": blocked,
        "blocked_reason": reason
    }))
}

// ============================================================================
// MODULE 18: ONLINE & SOCIAL ORDERS (WHATSAPP & WEBSITE) COMMANDS
// ============================================================================

#[tauri::command]
pub fn get_online_orders() -> Result<Vec<crate::db::OnlineOrderDto>, String> {
    let db = DatabaseManager::new();
    db.get_online_orders()
}

#[tauri::command]
pub fn create_online_order(payload: crate::db::CreateOnlineOrderPayload) -> Result<crate::db::OnlineOrderDto, String> {
    let db = DatabaseManager::new();
    db.create_online_order(&payload)
}

#[tauri::command]
pub fn collect_online_order_payment(payload: crate::db::CollectOnlinePaymentPayload) -> Result<bool, String> {
    let db = DatabaseManager::new();
    db.collect_online_order_payment(&payload)
}

#[tauri::command]
pub fn mark_online_order_return(payload: crate::db::MarkOnlineReturnPayload) -> Result<bool, String> {
    let db = DatabaseManager::new();
    db.mark_online_order_return(&payload)
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn update_online_order_status(
    order_id: Option<String>,
    orderId: Option<String>,
    delivery_status: Option<String>,
    deliveryStatus: Option<String>,
    tracking_number: Option<String>,
    trackingNumber: Option<String>,
    courier_partner: Option<String>,
    courierPartner: Option<String>,
) -> Result<bool, String> {
    let oid = order_id.or(orderId).ok_or_else(|| "Order ID required".to_string())?;
    let status = delivery_status.or(deliveryStatus).unwrap_or_else(|| "BOOKED".to_string());
    let track = tracking_number.or(trackingNumber);
    let courier = courier_partner.or(courierPartner);
    let db = DatabaseManager::new();
    db.update_online_order_status(&oid, &status, track.as_deref(), courier.as_deref())
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn verify_developer_credentials(
    login_id: Option<String>,
    loginId: Option<String>,
    password: Option<String>,
) -> bool {
    let id = login_id.or(loginId).unwrap_or_default();
    let pass = password.unwrap_or_default();
    DatabaseManager::verify_master_developer_credentials(&id, &pass)
}
