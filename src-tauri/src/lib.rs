pub mod db;
pub mod config;
pub mod commands;
pub mod lan_sync;
pub mod cloud_sync;
pub mod crypto;
pub mod hardware;

#[cfg(windows)]
fn ensure_black_copper_default_printer() {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let ps_script = r#"
        $printers = Get-CimInstance Win32_Printer
        $copper = $printers | Where-Object { $_.Name -like "*Copper*" -or $_.Name -like "*POS*80*" -or $_.Name -like "*80mm*" -or $_.Name -like "*Thermal*" } | Select-Object -First 1
        if ($copper -and -not $copper.Default) {
            (New-Object -ComObject WScript.Network).SetDefaultPrinter($copper.Name)
        }
    "#;

    let _ = std::process::Command::new("powershell")
        .args(&["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", ps_script])
        .creation_flags(CREATE_NO_WINDOW)
        .spawn();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(windows)]
    {
        ensure_black_copper_default_printer();
    }

    // Initialize SQLite 46-table schema on startup
    let db = db::DatabaseManager::new();
    if let Err(e) = db.initialize_schema() {
        eprintln!("SQLite Database Initialization status: {}", e);
    }

    // Background Hostinger Cloud auto-sync & offline retry daemon (non-blocking)
    std::thread::spawn(|| {
        std::thread::sleep(std::time::Duration::from_secs(10));
        let mut secs_elapsed: u64 = 0;
        loop {
            let cfg = config::ConfigManager::new().load_or_create();
            let interval_secs = (cfg.cloud_auto_sync_minutes.clamp(1, 120) as u64) * 60;
            if cfg.cloud_sync_enabled
                && !cfg.cloud_api_url.trim().is_empty()
                && !cfg.cloud_api_token.trim().is_empty()
            {
                let (pending, _, _) = db::DatabaseManager::new().get_outbox_counts();
                if secs_elapsed == 0 || secs_elapsed % interval_secs == 0 {
                    let client = cloud_sync::CloudSyncClient::from_config();
                    if let Err(e) = client.sync_bidirectional("AUTO_BACKGROUND_SYNC") {
                        eprintln!("Cloud background sync notice: {}", e);
                    }
                    let _ = client.send_heartbeat();
                } else if pending > 0 {
                    let client = cloud_sync::CloudSyncClient::from_config();
                    if let Err(e) = client.push_events("AUTO_RETRY_PENDING") {
                        eprintln!("Cloud pending retry notice: {}", e);
                    }
                    let _ = client.send_heartbeat();
                } else {
                    let _ = cloud_sync::CloudSyncClient::from_config().send_heartbeat();
                }
            }
            std::thread::sleep(std::time::Duration::from_secs(30));
            secs_elapsed = secs_elapsed.saturating_add(30);
        }
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::init_database,
            commands::verify_database_integrity,
            commands::get_database_status,
            commands::get_workstation_config,
            commands::get_application_version,
            commands::get_station_id,
            commands::read_local_config,
            commands::write_local_config,
            commands::get_workstation_status,
            commands::fast_switch_user,
            commands::login_with_credentials,
            commands::get_all_users,
            commands::update_user_security,
            commands::create_user,
            commands::delete_user,
            commands::get_products,
            commands::search_product_by_barcode,
            commands::create_product,
            commands::update_product,
            commands::delete_product,
            commands::get_salespersons,
            commands::get_all_salespersons,
            commands::create_salesperson,
            commands::update_salesperson,
            commands::delete_salesperson,
            commands::toggle_salesperson_status,
            commands::create_sales_invoice,
            commands::get_recent_sales,
            commands::search_invoice_for_return,
            commands::process_retail_return,
            commands::get_customer_store_credit,
            commands::get_quarantine_items,
            commands::get_return_history,
            commands::get_suppliers,
            commands::get_raw_materials,
            commands::create_purchase_invoice,
            commands::get_perfume_recipes,
            commands::get_manufacturing_batches,
            commands::create_manufacturing_batch,
            commands::release_manufacturing_batch,
            commands::delete_manufacturing_batch,
            commands::update_manufacturing_batch,
            commands::get_wholesale_customers,
            commands::create_wholesale_customer,
            commands::update_wholesale_customer,
            commands::delete_wholesale_customer,
            commands::get_wholesale_invoices,
            commands::get_wholesale_invoice_details,
            commands::get_wholesale_customer_ledger,
            commands::create_wholesale_invoice,
            commands::record_wholesale_payment,
            commands::get_attars,
            commands::create_attar,
            commands::update_attar,
            commands::delete_attar,
            commands::get_shifts,
            commands::get_active_shift,
            commands::open_shift,
            commands::close_shift,
            commands::get_petty_expenses,
            commands::record_petty_expense,
            commands::get_chart_of_accounts,
            commands::get_journal_vouchers,
            commands::get_account_ledger,
            commands::create_journal_voucher,
            commands::post_journal_voucher,
            commands::get_trial_balance,
            commands::get_financial_statements,
            commands::get_executive_dashboard,
            commands::get_inventory_valuation,
            commands::get_sync_status,
            commands::enqueue_sync_event,
            commands::trigger_lan_replication,
            commands::resolve_sync_conflict,
            commands::clear_sync_journal,
            commands::create_hot_backup,
            commands::get_backup_history,
            commands::verify_backup_archive,
            commands::pick_folder,
            commands::pick_backup_file,
            commands::restore_database,
            commands::get_hardware_status,
            commands::test_receipt_printer,
            commands::kick_cash_drawer,
            commands::test_pole_display,
            commands::start_lan_sync,
            commands::stop_lan_sync,
            commands::sync_with_peer_lan,
            commands::get_lan_sync_server_status,
            commands::push_cloud_sync,
            commands::trigger_cloud_sync,
            commands::get_cloud_sync_settings,
            commands::save_cloud_sync_settings,
            commands::test_cloud_connection,
            commands::trigger_full_cloud_snapshot_sync,
            commands::upload_cloud_backup,
            commands::print_raw_escpos_receipt,
            commands::send_raw_pole_display,
            commands::kick_cash_drawer_hardware,
            commands::get_employee_salary_payouts,
            commands::record_employee_salary_payout,
            commands::get_promotional_offers,
            commands::save_promotional_offer,
            commands::delete_promotional_offer,
            commands::get_local_ip_address,
            commands::get_network_station_config,
            commands::save_network_station_config,
            commands::test_network_db_connection,
            commands::open_database_folder,
            commands::export_database_to_desktop,
            commands::enable_windows_lan_sharing,
            commands::set_terminal_blocked_status,
            commands::get_terminal_blocked_status,
            commands::get_online_orders,
            commands::create_online_order,
            commands::collect_online_order_payment,
            commands::mark_online_order_return,
            commands::update_online_order_status,
            commands::verify_developer_credentials
        ])
        .run(tauri::generate_context!())
        .expect("error while running Ameer Perfumes ERP desktop application");
}
