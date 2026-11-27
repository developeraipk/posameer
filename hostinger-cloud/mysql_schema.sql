-- ============================================================================
-- Ameer Perfumes ERP — Hostinger Shared Cloud MySQL / MariaDB Schema
-- Compatible with MySQL 8.0+ / MariaDB 10.4+ (Hostinger Business Shared Plan)
-- Import this file once inside Hostinger phpMyAdmin into your NEW database.
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+05:00';

CREATE TABLE IF NOT EXISTS cloud_terminal_nodes (
    terminal_id VARCHAR(32) PRIMARY KEY,
    branch_name VARCHAR(160) NOT NULL DEFAULT '',
    station_role VARCHAR(32) NOT NULL DEFAULT 'PRIMARY_SERVER',
    lan_ip VARCHAR(64) NOT NULL DEFAULT '',
    last_heartbeat_at DATETIME NOT NULL,
    last_sync_at DATETIME NULL,
    app_version VARCHAR(32) NOT NULL DEFAULT '4.4.8',
    is_online TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cloud_sync_watermarks (
    source_terminal_id VARCHAR(32) NOT NULL,
    target_node_id VARCHAR(32) NOT NULL DEFAULT 'HOSTINGER_MYSQL',
    last_replicated_sequence BIGINT NOT NULL DEFAULT 0,
    last_sync_timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (source_terminal_id, target_node_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cloud_sync_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_id VARCHAR(128) NOT NULL UNIQUE,
    origin_terminal_id VARCHAR(32) NOT NULL,
    origin_sequence_number BIGINT NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(128) NOT NULL,
    operation_type VARCHAR(16) NOT NULL,
    payload_json LONGTEXT NOT NULL,
    created_at VARCHAR(64) NOT NULL,
    received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_terminal_seq (origin_terminal_id, origin_sequence_number),
    KEY idx_entity (entity_type, entity_id),
    KEY idx_received (received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cloud_finished_products (
    product_id VARCHAR(64) PRIMARY KEY,
    sku VARCHAR(64) NOT NULL,
    barcode VARCHAR(64) NULL,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(128) NOT NULL DEFAULT 'Ameer Perfumes',
    size_ml INT NOT NULL DEFAULT 0,
    category VARCHAR(64) NOT NULL DEFAULT 'UNISEX',
    current_stock_units INT NOT NULL DEFAULT 0,
    retail_price_paisa BIGINT NOT NULL DEFAULT 0,
    wholesale_price_paisa BIGINT NOT NULL DEFAULT 0,
    latest_batch_cost_paisa BIGINT NOT NULL DEFAULT 0,
    reorder_threshold_units INT NOT NULL DEFAULT 5,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    updated_at VARCHAR(64) NOT NULL DEFAULT '',
    synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_fp_active_stock (is_active, current_stock_units)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cloud_attar_products (
    attar_id VARCHAR(64) PRIMARY KEY,
    sku VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    origin_country VARCHAR(128) NOT NULL DEFAULT '',
    cost_per_tola_paisa BIGINT NOT NULL DEFAULT 0,
    selling_price_per_tola_paisa BIGINT NOT NULL DEFAULT 0,
    wholesale_price_per_tola_paisa BIGINT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    updated_at VARCHAR(64) NOT NULL DEFAULT '',
    synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cloud_sales_invoices (
    invoice_id VARCHAR(64) PRIMARY KEY,
    invoice_number VARCHAR(64) NOT NULL,
    terminal_id VARCHAR(32) NOT NULL DEFAULT 'POS-01',
    order_source VARCHAR(32) NOT NULL DEFAULT 'WALK_IN',
    customer_phone VARCHAR(64) NOT NULL DEFAULT '',
    gross_total_paisa BIGINT NOT NULL DEFAULT 0,
    item_discount_paisa BIGINT NOT NULL DEFAULT 0,
    special_discount_paisa BIGINT NOT NULL DEFAULT 0,
    net_payable_paisa BIGINT NOT NULL DEFAULT 0,
    total_cost_paisa BIGINT NOT NULL DEFAULT 0,
    perfume_sales_paisa BIGINT NOT NULL DEFAULT 0,
    attar_sales_paisa BIGINT NOT NULL DEFAULT 0,
    tester_sales_paisa BIGINT NOT NULL DEFAULT 0,
    payment_method VARCHAR(64) NOT NULL DEFAULT 'CASH',
    items_summary TEXT NULL,
    salesperson_name VARCHAR(128) NOT NULL DEFAULT '',
    total_units INT NOT NULL DEFAULT 0,
    invoice_date VARCHAR(64) NOT NULL,
    is_voided TINYINT(1) NOT NULL DEFAULT 0,
    synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_si_date (invoice_date),
    KEY idx_si_terminal (terminal_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cloud_return_vouchers (
    return_id VARCHAR(64) PRIMARY KEY,
    return_voucher_number VARCHAR(64) NOT NULL,
    original_sales_invoice_id VARCHAR(64) NULL,
    invoice_type VARCHAR(32) NOT NULL DEFAULT 'RETAIL',
    return_type VARCHAR(32) NOT NULL DEFAULT 'FULL_REFUND',
    condition_status VARCHAR(32) NOT NULL DEFAULT 'UNDAMAGED_NORMAL',
    total_refund_amount_paisa BIGINT NOT NULL DEFAULT 0,
    refund_settlement_method VARCHAR(64) NOT NULL DEFAULT 'CASH',
    terminal_id VARCHAR(32) NOT NULL DEFAULT 'POS-01',
    return_date VARCHAR(64) NOT NULL,
    synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_rv_date (return_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cloud_online_orders (
    order_id VARCHAR(64) PRIMARY KEY,
    order_number VARCHAR(64) NOT NULL,
    channel VARCHAR(32) NOT NULL DEFAULT 'WHATSAPP',
    customer_name VARCHAR(255) NOT NULL DEFAULT '',
    customer_phone VARCHAR(64) NOT NULL DEFAULT '',
    city VARCHAR(128) NOT NULL DEFAULT '',
    items_json LONGTEXT NULL,
    subtotal_paisa BIGINT NOT NULL DEFAULT 0,
    delivery_charges_paisa BIGINT NOT NULL DEFAULT 0,
    discount_paisa BIGINT NOT NULL DEFAULT 0,
    total_amount_paisa BIGINT NOT NULL DEFAULT 0,
    advance_paid_paisa BIGINT NOT NULL DEFAULT 0,
    cod_balance_paisa BIGINT NOT NULL DEFAULT 0,
    payment_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    payment_custodian VARCHAR(64) NOT NULL DEFAULT 'COURIER',
    courier_partner VARCHAR(64) NOT NULL DEFAULT '',
    tracking_number VARCHAR(128) NOT NULL DEFAULT '',
    delivery_status VARCHAR(32) NOT NULL DEFAULT 'BOOKED',
    refund_amount_paisa BIGINT NOT NULL DEFAULT 0,
    deduction_amount_paisa BIGINT NOT NULL DEFAULT 0,
    terminal_id VARCHAR(32) NOT NULL DEFAULT 'POS-01',
    collected_at VARCHAR(64) NULL,
    collection_method VARCHAR(64) NULL,
    return_reason TEXT NULL,
    notes TEXT NULL,
    created_at VARCHAR(64) NOT NULL,
    synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_oo_created (created_at),
    KEY idx_oo_channel (channel),
    KEY idx_oo_terminal (terminal_id),
    KEY idx_oo_status (delivery_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cloud_wholesale_customers (
    customer_id VARCHAR(64) PRIMARY KEY,
    business_name VARCHAR(255) NOT NULL DEFAULT '',
    contact_person VARCHAR(255) NOT NULL DEFAULT '',
    phone VARCHAR(64) NOT NULL DEFAULT '',
    city VARCHAR(128) NOT NULL DEFAULT '',
    current_balance_paisa BIGINT NOT NULL DEFAULT 0,
    credit_limit_paisa BIGINT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    updated_at VARCHAR(64) NOT NULL DEFAULT '',
    synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cloud_wholesale_invoices (
    wholesale_invoice_id VARCHAR(64) PRIMARY KEY,
    invoice_number VARCHAR(64) NOT NULL,
    customer_id VARCHAR(64) NOT NULL,
    customer_name VARCHAR(255) NOT NULL DEFAULT '',
    subtotal_paisa BIGINT NOT NULL DEFAULT 0,
    discount_paisa BIGINT NOT NULL DEFAULT 0,
    net_total_paisa BIGINT NOT NULL DEFAULT 0,
    amount_paid_paisa BIGINT NOT NULL DEFAULT 0,
    balance_due_paisa BIGINT NOT NULL DEFAULT 0,
    payment_status VARCHAR(32) NOT NULL DEFAULT 'UNPAID',
    invoice_date VARCHAR(64) NOT NULL,
    terminal_id VARCHAR(32) NOT NULL DEFAULT 'POS-01',
    is_voided TINYINT(1) NOT NULL DEFAULT 0,
    synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_wi_date (invoice_date),
    KEY idx_wi_terminal (terminal_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cloud_petty_expenses (
    expense_id VARCHAR(64) PRIMARY KEY,
    category VARCHAR(64) NOT NULL DEFAULT 'OTHER',
    expense_date VARCHAR(64) NOT NULL,
    amount_paisa BIGINT NOT NULL DEFAULT 0,
    description TEXT NULL,
    recipient_payee VARCHAR(255) NOT NULL DEFAULT '',
    authorized_by_name VARCHAR(255) NULL,
    terminal_id VARCHAR(32) NOT NULL DEFAULT 'POS-01',
    synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_pe_date (expense_date),
    KEY idx_pe_terminal (terminal_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cloud_employee_salaries (
    payout_id VARCHAR(64) PRIMARY KEY,
    employee_name VARCHAR(255) NOT NULL DEFAULT '',
    employee_role VARCHAR(64) NOT NULL DEFAULT 'SALES_STAFF',
    payout_type VARCHAR(64) NOT NULL DEFAULT 'MONTHLY_SALARY',
    amount_paisa BIGINT NOT NULL DEFAULT 0,
    payment_method VARCHAR(32) NOT NULL DEFAULT 'CASH',
    payout_date VARCHAR(64) NOT NULL,
    notes TEXT NULL,
    terminal_id VARCHAR(32) NOT NULL DEFAULT 'POS-01',
    synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_sal_date (payout_date),
    KEY idx_sal_terminal (terminal_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cloud_cash_shifts (
    shift_id VARCHAR(64) PRIMARY KEY,
    terminal_id VARCHAR(32) NOT NULL DEFAULT 'POS-01',
    opened_at VARCHAR(64) NOT NULL,
    closed_at VARCHAR(64) NULL,
    opening_cash_float_paisa BIGINT NOT NULL DEFAULT 0,
    system_expected_cash_paisa BIGINT NOT NULL DEFAULT 0,
    actual_counted_cash_paisa BIGINT NULL,
    shift_status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_cs_opened (opened_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cloud_backups (
    backup_id VARCHAR(64) PRIMARY KEY,
    terminal_id VARCHAR(32) NOT NULL DEFAULT 'POS-01',
    filename VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    sha256_checksum VARCHAR(128) NOT NULL DEFAULT '',
    stored_path VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cloud_web_users (
    user_id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(128) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'OWNER',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO cloud_terminal_nodes (terminal_id, station_role, last_heartbeat_at, is_online)
VALUES
    ('POS-01', 'PRIMARY_SERVER', NOW(), 1),
    ('POS-02', 'CLIENT_PEER', NOW(), 0);

