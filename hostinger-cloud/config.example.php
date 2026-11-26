<?php
/**
 * Ameer Perfumes ERP — Hostinger Cloud Sync & Web Dashboard Configuration
 *
 * SETUP:
 * 1. Copy this file to `config.php` in the same folder on Hostinger.
 * 2. Fill in your NEW, DEDICATED Hostinger MySQL database credentials.
 * 3. Generate a strong random API token (used in Desktop App -> Sync Center).
 * 4. Change the default Owner Web Dashboard login after first sign-in.
 */

return [
    // Dedicated Hostinger MySQL / MariaDB connection (keep separate from any existing website DB!)
    'db_host' => 'localhost',
    'db_port' => 3306,
    'db_name' => 'CHANGE_ME_AMEER_DB_NAME',
    'db_user' => 'CHANGE_ME_AMEER_DB_USER',
    'db_pass' => 'CHANGE_ME_AMEER_DB_PASS',

    // Secret Bearer Token shared between Desktop POS Terminals and this Hostinger API
    // Generate a 32+ character random string and paste the exact same value in Sync Center on POS PCs
    'api_token' => 'CHANGE_ME_GENERATE_STRONG_RANDOM_TOKEN_HERE',

    // Initial Web Dashboard Owner Account (auto-seeded if cloud_web_users table is empty; change password in dashboard)
    'default_owner_username' => 'owner',
    'default_owner_password' => 'AmeerOwner@2026',
    'default_owner_name' => 'Ameer Perfumes Owner',

    // Protected directory for uploaded SQLite hot backup snapshots (relative to this folder)
    'backup_dir' => __DIR__ . '/backups',

    // Timezone for reporting filters
    'timezone' => 'Asia/Karachi',
];

