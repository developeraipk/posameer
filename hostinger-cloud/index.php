<?php
declare(strict_types=1);

/**
 * Ameer Perfumes ERP — Live Hostinger Cloud Owner Web Dashboard
 *
 * Deployed strictly on a separate subdomain + separate MySQL database so any
 * existing system on your main domain stays 100% isolated.
 *
 * Official Software House Branding: Global Tech • 0329 9969277
 */

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: same-origin');

require_once __DIR__ . '/db.php';

// Strictly isolate session cookie to this subdomain + path
ini_set('session.use_strict_mode', '1');
$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || ((int)($_SERVER['SERVER_PORT'] ?? 80) === 443);
session_name('AMEER_ERP_OWNER_SESS');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => $isHttps,
    'httponly' => true,
    'samesite' => 'Lax',
]);
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(24));
}

function ameer_h(mixed $v): string
{
    return htmlspecialchars((string)$v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function ameer_render_setup_notice(string $title, string $detail): void
{
    ?>
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Ameer Perfumes Cloud — Setup Required</title>
        <style>
            body { margin:0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background:#0b0f17; color:#e2e8f0; display:flex; align-items:center; justify-content:center; min-height:100vh; padding:24px; }
            .card { max-width:620px; width:100%; background:#111827; border:1px solid #334155; border-radius:16px; padding:28px; box-shadow:0 20px 50px rgba(0,0,0,0.5); }
            .badge { display:inline-block; background:rgba(212,175,55,0.15); color:#facc15; border:1px solid rgba(212,175,55,0.4); font-size:12px; font-weight:700; padding:4px 10px; border-radius:999px; margin-bottom:14px; }
            h1 { margin:0 0 10px; font-size:22px; color:#f8fafc; }
            p { color:#94a3b8; line-height:1.6; font-size:14px; }
            code { background:#1e293b; color:#fde047; padding:2px 6px; border-radius:6px; font-size:13px; }
            ol { color:#cbd5e1; font-size:14px; line-height:1.7; padding-left:20px; }
            .foot { margin-top:20px; padding-top:14px; border-top:1px solid #1e293b; font-size:12px; color:#64748b; }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="badge">HOSTINGER SUBDOMAIN ISOLATION</div>
            <h1><?= ameer_h($title) ?></h1>
            <p><?= ameer_h($detail) ?></p>
            <ol>
                <li>In Hostinger hPanel, create a <strong>NEW MySQL Database</strong> specifically for Ameer Perfumes (never reuse your main site's DB).</li>
                <li>Open <strong>phpMyAdmin</strong> for that new database and import <code>mysql_schema.sql</code>.</li>
                <li>Copy <code>config.example.php</code> to <code>config.php</code> in this subdomain folder and fill in the DB credentials + a strong random <code>api_token</code>.</li>
                <li>Refresh this page to log in as Owner.</li>
            </ol>
            <div class="foot">Global Tech • 0329 9969277 — Ameer Perfumes ERP Cloud Monitor</div>
        </div>
    </body>
    </html>
    <?php
    exit;
}

$cfg = ameer_load_config();
if (!empty($cfg['__missing_config'])) {
    ameer_render_setup_notice(
        'Configuration File Missing (config.php)',
        'Please copy config.example.php to config.php in your Hostinger subdomain folder before accessing the Owner Dashboard.'
    );
}

$dbNameCfg = (string)($cfg['db_name'] ?? '');
$apiTokCfg = (string)($cfg['api_token'] ?? '');
if (str_starts_with($dbNameCfg, 'CHANGE_ME_') || str_starts_with($apiTokCfg, 'CHANGE_ME_')) {
    ameer_render_setup_notice(
        'Complete Your config.php Setup',
        'Placeholder values (CHANGE_ME_...) are still active in config.php. Update database credentials and generate a secret api_token.'
    );
}

try {
    $pdo = ameer_get_pdo($cfg);
    ameer_ensure_default_web_owner($pdo, $cfg);
} catch (Throwable $e) {
    ameer_render_setup_notice(
        'Database Connection or Schema Pending',
        'Could not initialize cloud tables yet (' . $e->getMessage() . '). Verify config.php credentials and confirm mysql_schema.sql has been imported.'
    );
}

$flashSuccess = null;
$flashError = null;

// Handle Logout
if (isset($_GET['action']) && $_GET['action'] === 'logout') {
    $_SESSION = [];
    session_destroy();
    header('Location: index.php');
    exit;
}

// Handle Login POST
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['form_action'] ?? '') === 'login') {
    $csrf = (string)($_POST['csrf_token'] ?? '');
    if (!hash_equals((string)$_SESSION['csrf_token'], $csrf)) {
        $flashError = 'Security token mismatch. Please refresh and try again.';
    } else {
        $username = trim((string)($_POST['username'] ?? ''));
        $password = (string)($_POST['password'] ?? '');
        $stmt = $pdo->prepare('SELECT user_id, username, password_hash, full_name, role, is_active FROM cloud_web_users WHERE username = ? LIMIT 1');
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if ($user && (int)$user['is_active'] === 1 && password_verify($password, (string)$user['password_hash'])) {
            session_regenerate_id(true);
            $_SESSION['csrf_token'] = bin2hex(random_bytes(24));
            $_SESSION['owner_user'] = [
                'user_id' => $user['user_id'],
                'username' => $user['username'],
                'full_name' => $user['full_name'],
                'role' => $user['role'],
            ];
            header('Location: index.php');
            exit;
        }
        $flashError = 'Invalid username or password.';
    }
}

$loggedUser = $_SESSION['owner_user'] ?? null;

// Handle authenticated actions (backup download + password change)
if ($loggedUser && isset($_GET['action']) && $_GET['action'] === 'download_backup') {
    $backupId = trim((string)($_GET['id'] ?? ''));
    $stmt = $pdo->prepare('SELECT filename, stored_path FROM cloud_backups WHERE backup_id = ? LIMIT 1');
    $stmt->execute([$backupId]);
    $row = $stmt->fetch();
    if ($row) {
        $backupDir = rtrim((string)($cfg['backup_dir'] ?? (__DIR__ . '/backups')), '/\\');
        $fullPath = $backupDir . '/' . basename((string)$row['stored_path']);
        if (is_file($fullPath)) {
            header('Content-Type: application/octet-stream');
            header('Content-Disposition: attachment; filename="' . preg_replace('/[^A-Za-z0-9._-]/', '_', (string)$row['filename']) . '"');
            header('Content-Length: ' . filesize($fullPath));
            readfile($fullPath);
            exit;
        }
    }
    $flashError = 'Requested backup snapshot file could not be found on disk.';
}

if ($loggedUser && $_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['form_action'] ?? '') === 'change_password') {
    $csrf = (string)($_POST['csrf_token'] ?? '');
    if (!hash_equals((string)$_SESSION['csrf_token'], $csrf)) {
        $flashError = 'Security token mismatch.';
    } else {
        $curr = (string)($_POST['current_password'] ?? '');
        $next = (string)($_POST['new_password'] ?? '');
        $newUsername = trim((string)($_POST['new_username'] ?? $loggedUser['username']));

        if (strlen($next) < 8) {
            $flashError = 'New password must be at least 8 characters long.';
        } elseif ($newUsername === '') {
            $flashError = 'Username cannot be empty.';
        } else {
            $stmt = $pdo->prepare('SELECT password_hash FROM cloud_web_users WHERE user_id = ? LIMIT 1');
            $stmt->execute([$loggedUser['user_id']]);
            $row = $stmt->fetch();
            if (!$row || !password_verify($curr, (string)$row['password_hash'])) {
                $flashError = 'Current password is incorrect.';
            } else {
                $newHash = password_hash($next, PASSWORD_DEFAULT);
                $upd = $pdo->prepare('UPDATE cloud_web_users SET username = ?, password_hash = ? WHERE user_id = ?');
                $upd->execute([$newUsername, $newHash, $loggedUser['user_id']]);
                $_SESSION['owner_user']['username'] = $newUsername;
                $loggedUser['username'] = $newUsername;
                $flashSuccess = 'Owner web login credentials updated successfully.';
            }
        }
    }
}

// Check if default password is still active so we warn owner cleanly
$defaultPwdActive = false;
if ($loggedUser) {
    $chk = $pdo->prepare('SELECT password_hash FROM cloud_web_users WHERE user_id = ? LIMIT 1');
    $chk->execute([$loggedUser['user_id']]);
    $hashRow = $chk->fetch();
    $defaultPwd = (string)($cfg['default_owner_password'] ?? 'AmeerOwner@2026');
    if ($hashRow && password_verify($defaultPwd, (string)$hashRow['password_hash'])) {
        $defaultPwdActive = true;
    }
}

// Render Login View if unauthenticated
if (!$loggedUser):
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Ameer Perfumes — Owner Cloud Login</title>
    <style>
        * { box-sizing: border-box; }
        body { margin:0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: radial-gradient(circle at top, #172033 0%, #0b0f17 70%); color:#f8fafc; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; }
        .login-box { width:100%; max-width:420px; background:rgba(17,24,39,0.94); border:1px solid #293548; border-radius:18px; padding:30px; box-shadow:0 24px 60px rgba(0,0,0,0.55); }
        .brand-pill { display:inline-block; padding:4px 10px; border-radius:999px; font-size:11px; font-weight:700; letter-spacing:0.06em; color:#facc15; background:rgba(212,175,55,0.12); border:1px solid rgba(212,175,55,0.35); margin-bottom:12px; }
        h1 { margin:0 0 6px; font-size:22px; font-weight:700; }
        .sub { margin:0 0 22px; font-size:13px; color:#94a3b8; }
        label { display:block; font-size:12px; font-weight:600; color:#cbd5e1; margin-bottom:6px; }
        input { width:100%; padding:11px 13px; border-radius:10px; border:1px solid #334155; background:#0f172a; color:#f8fafc; font-size:14px; margin-bottom:15px; outline:none; }
        input:focus { border-color:#d4af37; }
        button { width:100%; padding:12px; border:none; border-radius:10px; background:linear-gradient(135deg,#d4af37,#b48811); color:#0b0f17; font-size:14px; font-weight:800; cursor:pointer; }
        button:hover { filter:brightness(1.05); }
        .err { background:rgba(239,68,68,0.14); border:1px solid rgba(239,68,68,0.45); color:#fecaca; padding:10px 12px; border-radius:10px; font-size:13px; margin-bottom:16px; }
        .foot { margin-top:20px; text-align:center; font-size:12px; color:#64748b; }
    </style>
</head>
<body>
    <form class="login-box" method="post" action="index.php">
        <div class="brand-pill">AMEER PERFUMES • CLOUD DASHBOARD</div>
        <h1>Owner Live Monitor</h1>
        <p class="sub">Real-time shop sales, online COD, stock &amp; profit reports synced from your POS terminals.</p>
        <?php if ($flashError): ?>
            <div class="err"><?= ameer_h($flashError) ?></div>
        <?php endif; ?>
        <input type="hidden" name="form_action" value="login" />
        <input type="hidden" name="csrf_token" value="<?= ameer_h($_SESSION['csrf_token']) ?>" />
        <label for="username">Owner Username</label>
        <input id="username" name="username" type="text" autocomplete="username" required autofocus />
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required />
        <button type="submit">Sign In to Cloud Dashboard</button>
        <div class="foot">Global Tech • 0329 9969277</div>
    </form>
</body>
</html>
<?php
    exit;
endif;

// ----------------------------------------------------------------------------
// Authenticated Dashboard Data Queries
// ----------------------------------------------------------------------------
$period = strtolower(trim((string)($_GET['period'] ?? 'today')));
if (!in_array($period, ['today', 'weekly', 'monthly', 'yearly', 'all'], true)) {
    $period = 'today';
}

$periodLabels = [
    'today' => 'Today (PKT)',
    'weekly' => 'Last 7 Days',
    'monthly' => 'This Month',
    'yearly' => 'This Year',
    'all' => 'All Synced History',
];

$wSales = ameer_period_where('invoice_date', $period);
$wRet   = ameer_period_where('return_date', $period);
$wExp   = ameer_period_where('expense_date', $period);
$wSal   = ameer_period_where('payout_date', $period);

$salesAgg = $pdo->query(
    "SELECT
        COALESCE(SUM(gross_total_paisa), 0) AS gross_sales_paisa,
        COALESCE(SUM(item_discount_paisa + special_discount_paisa), 0) AS discounts_paisa,
        COALESCE(SUM(net_payable_paisa), 0) AS net_collected_paisa,
        COALESCE(SUM(total_cost_paisa), 0) AS cogs_paisa,
        COALESCE(SUM(perfume_sales_paisa), 0) AS perfume_sales_paisa,
        COALESCE(SUM(attar_sales_paisa), 0) AS attar_sales_paisa,
        COALESCE(SUM(tester_sales_paisa), 0) AS tester_sales_paisa,
        COUNT(*) AS invoice_count
     FROM cloud_sales_invoices
     WHERE is_voided = 0 AND {$wSales}"
)->fetch() ?: [];

$refundPaisa = (int)$pdo->query("SELECT COALESCE(SUM(total_refund_amount_paisa), 0) FROM cloud_return_vouchers WHERE {$wRet}")->fetchColumn();
$expensePaisa = (int)$pdo->query("SELECT COALESCE(SUM(amount_paisa), 0) FROM cloud_petty_expenses WHERE {$wExp}")->fetchColumn();
$salaryPaisa = (int)$pdo->query("SELECT COALESCE(SUM(amount_paisa), 0) FROM cloud_employee_salaries WHERE {$wSal}")->fetchColumn();

$grossSales = (int)($salesAgg['gross_sales_paisa'] ?? 0);
$discounts = (int)($salesAgg['discounts_paisa'] ?? 0);
$collected = (int)($salesAgg['net_collected_paisa'] ?? 0);
$cogs = (int)($salesAgg['cogs_paisa'] ?? 0);
$netSales = $collected - $refundPaisa;
$grossProfit = $netSales - $cogs;
$netProfit = $grossProfit - $expensePaisa - $salaryPaisa;
$invoiceCount = (int)($salesAgg['invoice_count'] ?? 0);

$receivablePaisa = (int)$pdo->query("SELECT COALESCE(SUM(GREATEST(current_balance_paisa, 0)), 0) FROM cloud_wholesale_customers WHERE is_active = 1")->fetchColumn();
$codPendingPaisa = (int)$pdo->query("SELECT COALESCE(SUM(cod_balance_paisa), 0) FROM cloud_online_orders WHERE delivery_status NOT IN ('DELIVERED', 'RETURNED', 'CANCELLED')")->fetchColumn();
$codPendingCount = (int)$pdo->query("SELECT COUNT(*) FROM cloud_online_orders WHERE delivery_status NOT IN ('DELIVERED', 'RETURNED', 'CANCELLED')")->fetchColumn();
$fgValuePaisa = (int)$pdo->query("SELECT COALESCE(SUM(current_stock_units * latest_batch_cost_paisa), 0) FROM cloud_finished_products WHERE is_active = 1 AND current_stock_units > 0")->fetchColumn();
$lowStockCount = (int)$pdo->query("SELECT COUNT(*) FROM cloud_finished_products WHERE is_active = 1 AND current_stock_units <= reorder_threshold_units")->fetchColumn();
$totalEventsCount = (int)$pdo->query("SELECT COUNT(*) FROM cloud_sync_events")->fetchColumn();

$terminals = $pdo->query("SELECT terminal_id, station_role, last_heartbeat_at, last_sync_at, app_version, is_online FROM cloud_terminal_nodes ORDER BY terminal_id")->fetchAll();
$recentSales = $pdo->query("SELECT invoice_number, terminal_id, order_source, payment_method, total_units, net_payable_paisa, total_cost_paisa, invoice_date, items_summary FROM cloud_sales_invoices WHERE is_voided = 0 ORDER BY invoice_date DESC LIMIT 20")->fetchAll();
$recentOnline = $pdo->query("SELECT order_number, channel, customer_name, customer_phone, city, courier_partner, tracking_number, delivery_status, payment_status, total_amount_paisa, cod_balance_paisa, created_at FROM cloud_online_orders ORDER BY created_at DESC LIMIT 15")->fetchAll();
$wholesaleParties = $pdo->query("SELECT business_name, contact_person, phone, city, current_balance_paisa, credit_limit_paisa FROM cloud_wholesale_customers WHERE is_active = 1 AND current_balance_paisa > 0 ORDER BY current_balance_paisa DESC LIMIT 15")->fetchAll();
$lowStockProducts = $pdo->query("SELECT sku, name, size_ml, current_stock_units, reorder_threshold_units, retail_price_paisa FROM cloud_finished_products WHERE is_active = 1 AND current_stock_units <= reorder_threshold_units ORDER BY current_stock_units ASC LIMIT 20")->fetchAll();
$recentExpenses = $pdo->query("SELECT category, recipient_payee, description, amount_paisa, expense_date FROM cloud_petty_expenses ORDER BY expense_date DESC LIMIT 15")->fetchAll();
$recentBackups = $pdo->query("SELECT backup_id, terminal_id, filename, file_size_bytes, sha256_checksum, created_at FROM cloud_backups ORDER BY created_at DESC LIMIT 12")->fetchAll();
$recentShifts = $pdo->query("SELECT shift_id, terminal_id, opened_at, closed_at, opening_cash_float_paisa, system_expected_cash_paisa, actual_counted_cash_paisa, shift_status FROM cloud_cash_shifts ORDER BY opened_at DESC LIMIT 8")->fetchAll();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Ameer Perfumes — Owner Cloud Dashboard</title>
    <style>
        :root {
            --bg: #0b0f17;
            --card: #111827;
            --card2: #0f172a;
            --border: #243044;
            --text: #f1f5f9;
            --muted: #94a3b8;
            --gold: #d4af37;
            --green: #10b981;
            --red: #ef4444;
            --amber: #f59e0b;
            --blue: #3b82f6;
        }
        * { box-sizing: border-box; }
        body { margin:0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background:var(--bg); color:var(--text); font-size:14px; line-height:1.5; }
        a { color:var(--gold); text-decoration:none; }
        .wrap { max-width: 1360px; margin: 0 auto; padding: 18px 18px 40px; }
        .topbar { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:14px; padding:16px 20px; background:var(--card); border:1px solid var(--border); border-radius:16px; margin-bottom:18px; }
        .title-row h1 { margin:0; font-size:20px; font-weight:800; color:#fff; }
        .title-row .meta { font-size:12px; color:var(--muted); margin-top:3px; }
        .pills { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
        .pill { padding:7px 12px; border-radius:9px; font-size:12px; font-weight:700; border:1px solid var(--border); background:var(--card2); color:var(--muted); }
        .pill.active { background:var(--gold); color:#0b0f17; border-color:var(--gold); }
        .pill-danger { background:rgba(239,68,68,0.12); color:#fca5a5; border-color:rgba(239,68,68,0.35); }
        .banner-warn { background:rgba(245,158,11,0.13); border:1px solid rgba(245,158,11,0.45); color:#fde68a; padding:12px 16px; border-radius:12px; margin-bottom:16px; font-size:13px; }
        .banner-ok { background:rgba(16,185,129,0.13); border:1px solid rgba(16,185,129,0.45); color:#a7f3d0; padding:12px 16px; border-radius:12px; margin-bottom:16px; font-size:13px; }
        .banner-err { background:rgba(239,68,68,0.13); border:1px solid rgba(239,68,68,0.45); color:#fecaca; padding:12px 16px; border-radius:12px; margin-bottom:16px; font-size:13px; }
        .terminals { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:18px; }
        .term-chip { display:flex; align-items:center; gap:9px; background:var(--card); border:1px solid var(--border); border-radius:12px; padding:10px 14px; font-size:12px; }
        .dot { width:9px; height:9px; border-radius:50%; background:var(--green); display:inline-block; }
        .dot.off { background:#64748b; }
        .kpi-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:14px; margin-bottom:20px; }
        .kpi { background:var(--card); border:1px solid var(--border); border-radius:14px; padding:16px 18px; }
        .kpi .label { font-size:11px; text-transform:uppercase; letter-spacing:0.06em; color:var(--muted); font-weight:700; }
        .kpi .val { font-size:24px; font-weight:800; margin-top:6px; color:#fff; }
        .kpi .val.gold { color:var(--gold); }
        .kpi .val.green { color:#34d399; }
        .kpi .val.red { color:#f87171; }
        .kpi .sub { font-size:12px; color:var(--muted); margin-top:4px; }
        .two-col { display:grid; grid-template-columns: repeat(auto-fit, minmax(460px, 1fr)); gap:16px; margin-bottom:18px; }
        @media (max-width: 600px) {
            .two-col { grid-template-columns: 1fr; }
        }
        .panel { background:var(--card); border:1px solid var(--border); border-radius:14px; padding:16px 18px; margin-bottom:18px; }
        .panel h2 { margin:0 0 12px; font-size:15px; font-weight:800; color:#fff; display:flex; justify-content:space-between; align-items:center; }
        .panel h2 span { font-size:12px; font-weight:600; color:var(--muted); }
        .table-wrap { overflow-x:auto; }
        table { width:100%; border-collapse:collapse; font-size:12.5px; }
        th { text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:var(--muted); padding:8px 10px; border-bottom:1px solid var(--border); white-space:nowrap; }
        td { padding:9px 10px; border-bottom:1px solid #1b2436; vertical-align:top; }
        tr:last-child td { border-bottom:none; }
        .tag { display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:700; background:#1e293b; color:#cbd5e1; }
        .tag.green { background:rgba(16,185,129,0.16); color:#6ee7b7; }
        .tag.amber { background:rgba(245,158,11,0.16); color:#fcd34d; }
        .tag.red { background:rgba(239,68,68,0.16); color:#fca5a5; }
        .num { text-align:right; font-variant-numeric: tabular-nums; white-space:nowrap; }
        .sec-form { display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px; align-items:end; }
        .sec-form label { display:block; font-size:11px; color:var(--muted); margin-bottom:4px; }
        .sec-form input { width:100%; padding:9px 11px; border-radius:8px; border:1px solid #334155; background:var(--card2); color:#fff; }
        .btn-gold { padding:10px 16px; border:none; border-radius:8px; background:var(--gold); color:#0b0f17; font-weight:800; cursor:pointer; }
        .foot { text-align:center; font-size:12px; color:#64748b; margin-top:24px; }
    </style>
</head>
<body>
<div class="wrap">
    <div class="topbar">
        <div class="title-row">
            <h1>Ameer Perfumes — Live Owner Cloud Dashboard</h1>
            <div class="meta">
                Signed in as <strong><?= ameer_h($loggedUser['full_name']) ?></strong> (<?= ameer_h($loggedUser['username']) ?>)
                • Filter: <strong><?= ameer_h($periodLabels[$period]) ?></strong>
                • Synced Events: <strong><?= number_format($totalEventsCount) ?></strong>
            </div>
        </div>
        <div class="pills">
            <?php foreach ($periodLabels as $key => $lbl): ?>
                <a class="pill <?= $period === $key ? 'active' : '' ?>" href="?period=<?= ameer_h($key) ?>"><?= ameer_h($lbl) ?></a>
            <?php endforeach; ?>
            <a class="pill" href="?period=<?= ameer_h($period) ?>">Refresh</a>
            <a class="pill pill-danger" href="?action=logout">Logout</a>
        </div>
    </div>

    <?php if ($defaultPwdActive): ?>
        <div class="banner-warn">
            <strong>Security Reminder:</strong> You are still using the initial Owner password. Please update your password in the <strong>Owner Web Login Security</strong> box at the bottom of this page.
        </div>
    <?php endif; ?>
    <?php if ($flashSuccess): ?><div class="banner-ok"><?= ameer_h($flashSuccess) ?></div><?php endif; ?>
    <?php if ($flashError): ?><div class="banner-err"><?= ameer_h($flashError) ?></div><?php endif; ?>

    <div class="terminals">
        <?php foreach ($terminals as $t): ?>
            <div class="term-chip">
                <span class="dot <?= ((int)$t['is_online'] === 1 && !empty($t['last_sync_at'])) ? '' : 'off' ?>"></span>
                <div>
                    <strong><?= ameer_h($t['terminal_id']) ?></strong> (<?= ameer_h($t['station_role']) ?>)<br />
                    <span style="color:var(--muted);">
                        Last Sync: <?= ameer_h($t['last_sync_at'] ?: 'Never yet') ?> • v<?= ameer_h($t['app_version']) ?>
                    </span>
                </div>
            </div>
        <?php endforeach; ?>
    </div>

    <div class="kpi-grid">
        <div class="kpi">
            <div class="label">Gross Retail Sales</div>
            <div class="val"><?= ameer_h(ameer_pkr($grossSales)) ?></div>
            <div class="sub"><?= number_format($invoiceCount) ?> Retail Invoices</div>
        </div>
        <div class="kpi">
            <div class="label">Discounts &amp; Returns</div>
            <div class="val red">-<?= ameer_h(ameer_pkr($discounts + $refundPaisa)) ?></div>
            <div class="sub">Disc: <?= ameer_h(ameer_pkr($discounts)) ?> • Ret: <?= ameer_h(ameer_pkr($refundPaisa)) ?></div>
        </div>
        <div class="kpi">
            <div class="label">Net Retail Sales</div>
            <div class="val gold"><?= ameer_h(ameer_pkr($netSales)) ?></div>
            <div class="sub">
                Perfume: <?= ameer_h(ameer_pkr((int)($salesAgg['perfume_sales_paisa'] ?? 0))) ?> •
                Attar: <?= ameer_h(ameer_pkr((int)($salesAgg['attar_sales_paisa'] ?? 0))) ?>
            </div>
        </div>
        <div class="kpi">
            <div class="label">Est. Gross Profit</div>
            <div class="val green"><?= ameer_h(ameer_pkr($grossProfit)) ?></div>
            <div class="sub">COGS: <?= ameer_h(ameer_pkr($cogs)) ?></div>
        </div>
        <div class="kpi">
            <div class="label">Expenses &amp; Salaries</div>
            <div class="val"><?= ameer_h(ameer_pkr($expensePaisa + $salaryPaisa)) ?></div>
            <div class="sub">Petty: <?= ameer_h(ameer_pkr($expensePaisa)) ?> • Staff: <?= ameer_h(ameer_pkr($salaryPaisa)) ?></div>
        </div>
        <div class="kpi">
            <div class="label">Est. Net Profit</div>
            <div class="val <?= $netProfit >= 0 ? 'green' : 'red' ?>"><?= ameer_h(ameer_pkr($netProfit)) ?></div>
            <div class="sub">After COGS, Expenses &amp; Salaries</div>
        </div>
        <div class="kpi">
            <div class="label">Wholesale Receivables</div>
            <div class="val"><?= ameer_h(ameer_pkr($receivablePaisa)) ?></div>
            <div class="sub">Online COD Pending: <?= ameer_h(ameer_pkr($codPendingPaisa)) ?> (<?= $codPendingCount ?>)</div>
        </div>
        <div class="kpi">
            <div class="label">FG Stock Valuation</div>
            <div class="val"><?= ameer_h(ameer_pkr($fgValuePaisa)) ?></div>
            <div class="sub">Low Stock Alerts: <strong style="color:#fcd34d;"><?= $lowStockCount ?> SKU(s)</strong></div>
        </div>
    </div>

    <div class="two-col">
        <div class="panel">
            <h2>Recent Retail Sales <span>Latest 20 synced bills</span></h2>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>Invoice</th><th>Date</th><th>Method</th><th class="num">Units</th><th class="num">Net Total</th></tr>
                    </thead>
                    <tbody>
                    <?php if (!$recentSales): ?>
                        <tr><td colspan="5" style="color:var(--muted);">No synced sales invoices yet. Click "Sync All Shop Data" in Desktop Sync Center.</td></tr>
                    <?php else: foreach ($recentSales as $s): ?>
                        <tr>
                            <td>
                                <strong><?= ameer_h($s['invoice_number']) ?></strong><br />
                                <span style="font-size:11px;color:var(--muted);"><?= ameer_h($s['items_summary'] ?: $s['order_source']) ?></span>
                            </td>
                            <td><?= ameer_h(substr((string)$s['invoice_date'], 0, 16)) ?></td>
                            <td><span class="tag"><?= ameer_h($s['payment_method']) ?></span></td>
                            <td class="num"><?= (int)$s['total_units'] ?></td>
                            <td class="num"><strong><?= ameer_h(ameer_pkr((int)$s['net_payable_paisa'])) ?></strong></td>
                        </tr>
                    <?php endforeach; endif; ?>
                    </tbody>
                </table>
            </div>
        </div>

        <div class="panel">
            <h2>Online &amp; COD Orders <span>Latest 15 orders</span></h2>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>Order</th><th>Customer / City</th><th>Status</th><th class="num">Total</th><th class="num">COD Due</th></tr>
                    </thead>
                    <tbody>
                    <?php if (!$recentOnline): ?>
                        <tr><td colspan="5" style="color:var(--muted);">No online orders synced yet.</td></tr>
                    <?php else: foreach ($recentOnline as $o):
                        $st = strtoupper((string)$o['delivery_status']);
                        $tagCls = ($st === 'DELIVERED') ? 'green' : (($st === 'RETURNED' || $st === 'CANCELLED') ? 'red' : 'amber');
                    ?>
                        <tr>
                            <td>
                                <strong><?= ameer_h($o['order_number']) ?></strong><br />
                                <span style="font-size:11px;color:var(--muted);"><?= ameer_h($o['channel']) ?> • <?= ameer_h($o['courier_partner'] ?: 'No courier') ?></span>
                            </td>
                            <td><?= ameer_h($o['customer_name']) ?><br /><span style="font-size:11px;color:var(--muted);"><?= ameer_h($o['city']) ?> • <?= ameer_h($o['customer_phone']) ?></span></td>
                            <td><span class="tag <?= $tagCls ?>"><?= ameer_h($st) ?></span></td>
                            <td class="num"><?= ameer_h(ameer_pkr((int)$o['total_amount_paisa'])) ?></td>
                            <td class="num"><?= ameer_h(ameer_pkr((int)$o['cod_balance_paisa'])) ?></td>
                        </tr>
                    <?php endforeach; endif; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <div class="two-col">
        <div class="panel">
            <h2>Low Stock Products <span>At or below reorder threshold</span></h2>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>Product</th><th>SKU</th><th class="num">In Stock</th><th class="num">Threshold</th><th class="num">Retail Price</th></tr>
                    </thead>
                    <tbody>
                    <?php if (!$lowStockProducts): ?>
                        <tr><td colspan="5" style="color:var(--muted);">No low stock alerts right now.</td></tr>
                    <?php else: foreach ($lowStockProducts as $p): ?>
                        <tr>
                            <td><strong><?= ameer_h($p['name']) ?></strong> (<?= (int)$p['size_ml'] ?> ml)</td>
                            <td><?= ameer_h($p['sku']) ?></td>
                            <td class="num"><span class="tag red"><?= (int)$p['current_stock_units'] ?></span></td>
                            <td class="num"><?= (int)$p['reorder_threshold_units'] ?></td>
                            <td class="num"><?= ameer_h(ameer_pkr((int)$p['retail_price_paisa'])) ?></td>
                        </tr>
                    <?php endforeach; endif; ?>
                    </tbody>
                </table>
            </div>
        </div>

        <div class="panel">
            <h2>Wholesale Party Receivables <span>Active balances due</span></h2>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>Business Party</th><th>City / Phone</th><th class="num">Balance Due</th><th class="num">Credit Limit</th></tr>
                    </thead>
                    <tbody>
                    <?php if (!$wholesaleParties): ?>
                        <tr><td colspan="4" style="color:var(--muted);">No outstanding wholesale receivables synced.</td></tr>
                    <?php else: foreach ($wholesaleParties as $w): ?>
                        <tr>
                            <td><strong><?= ameer_h($w['business_name']) ?></strong><br /><span style="font-size:11px;color:var(--muted);"><?= ameer_h($w['contact_person']) ?></span></td>
                            <td><?= ameer_h($w['city']) ?> • <?= ameer_h($w['phone']) ?></td>
                            <td class="num"><strong style="color:#fcd34d;"><?= ameer_h(ameer_pkr((int)$w['current_balance_paisa'])) ?></strong></td>
                            <td class="num"><?= ameer_h(ameer_pkr((int)$w['credit_limit_paisa'])) ?></td>
                        </tr>
                    <?php endforeach; endif; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <div class="two-col">
        <div class="panel">
            <h2>Recent Petty Expenses <span>Latest 15 entries</span></h2>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>Date</th><th>Category</th><th>Payee / Note</th><th class="num">Amount</th></tr>
                    </thead>
                    <tbody>
                    <?php if (!$recentExpenses): ?>
                        <tr><td colspan="4" style="color:var(--muted);">No expenses synced yet.</td></tr>
                    <?php else: foreach ($recentExpenses as $e): ?>
                        <tr>
                            <td><?= ameer_h(substr((string)$e['expense_date'], 0, 16)) ?></td>
                            <td><span class="tag"><?= ameer_h($e['category']) ?></span></td>
                            <td><?= ameer_h($e['recipient_payee']) ?> <?= $e['description'] ? '— ' . ameer_h($e['description']) : '' ?></td>
                            <td class="num"><?= ameer_h(ameer_pkr((int)$e['amount_paisa'])) ?></td>
                        </tr>
                    <?php endforeach; endif; ?>
                    </tbody>
                </table>
            </div>
        </div>

        <div class="panel">
            <h2>Cash Shifts &amp; Cloud SQLite Backups <span>Protected .db vault</span></h2>
            <div class="table-wrap" style="margin-bottom:14px;">
                <table>
                    <thead>
                        <tr><th>Backup File</th><th>Station</th><th class="num">Size</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                    <?php if (!$recentBackups): ?>
                        <tr><td colspan="4" style="color:var(--muted);">No cloud .db backups uploaded yet.</td></tr>
                    <?php else: foreach ($recentBackups as $b): ?>
                        <tr>
                            <td><strong><?= ameer_h($b['filename']) ?></strong><br /><span style="font-size:11px;color:var(--muted);"><?= ameer_h($b['created_at']) ?></span></td>
                            <td><?= ameer_h($b['terminal_id']) ?></td>
                            <td class="num"><?= number_format((int)$b['file_size_bytes'] / 1024, 1) ?> KB</td>
                            <td><a class="tag green" href="?action=download_backup&id=<?= urlencode((string)$b['backup_id']) ?>">Download .db</a></td>
                        </tr>
                    <?php endforeach; endif; ?>
                    </tbody>
                </table>
            </div>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>Shift Terminal</th><th>Opened</th><th>Status</th><th class="num">Expected Cash</th></tr>
                    </thead>
                    <tbody>
                    <?php if (!$recentShifts): ?>
                        <tr><td colspan="4" style="color:var(--muted);">No cash shifts synced yet.</td></tr>
                    <?php else: foreach ($recentShifts as $sh): ?>
                        <tr>
                            <td><?= ameer_h($sh['terminal_id']) ?></td>
                            <td><?= ameer_h(substr((string)$sh['opened_at'], 0, 16)) ?></td>
                            <td><span class="tag <?= $sh['shift_status'] === 'OPEN' ? 'amber' : 'green' ?>"><?= ameer_h($sh['shift_status']) ?></span></td>
                            <td class="num"><?= ameer_h(ameer_pkr((int)$sh['system_expected_cash_paisa'])) ?></td>
                        </tr>
                    <?php endforeach; endif; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <div class="panel">
        <h2>Owner Web Login Security <span>Change dashboard username or password</span></h2>
        <form class="sec-form" method="post" action="index.php?period=<?= ameer_h($period) ?>">
            <input type="hidden" name="form_action" value="change_password" />
            <input type="hidden" name="csrf_token" value="<?= ameer_h($_SESSION['csrf_token']) ?>" />
            <div>
                <label for="new_username">Owner Username</label>
                <input id="new_username" name="new_username" type="text" value="<?= ameer_h($loggedUser['username']) ?>" required />
            </div>
            <div>
                <label for="current_password">Current Password</label>
                <input id="current_password" name="current_password" type="password" required />
            </div>
            <div>
                <label for="new_password">New Password (min 8 chars)</label>
                <input id="new_password" name="new_password" type="password" minlength="8" required />
            </div>
            <div>
                <button class="btn-gold" type="submit">Update Web Login</button>
            </div>
        </form>
    </div>

    <div class="foot">Global Tech • 0329 9969277 — Ameer Perfumes ERP Cloud Monitor</div>
</div>
</body>
</html>

