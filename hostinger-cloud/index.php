<?php
declare(strict_types=1);

/**
 * Ameer Perfumes ERP — Real-Time Hostinger Cloud Owner Command Center
 *
 * Deployed strictly on a separate subdomain + separate MySQL database so any
 * existing system on your main domain stays 100% isolated.
 *
 * Features:
 * - Zero-refresh SSE (Server-Sent Events) + 2.5s lightweight cursor fallback
 * - Multi-Branch / Multi-Terminal Live Telemetry (POS-01, POS-02, etc.)
 * - Dedicated WhatsApp & Website Orders split with parsed items & COD tracking
 * - Full Shop A-Z: Retail POS, Wholesale & Parties Udar, Inventory (Perfumes & Attars),
 *   Returns, Expenses, Salaries, Cash Shifts, Hot Backups Vault
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
    ameer_ensure_cloud_schema_upgrades($pdo);
    ameer_ensure_default_web_owner($pdo, $cfg);
} catch (Throwable $e) {
    ameer_render_setup_notice(
        'Database Connection or Schema Pending',
        'Could not initialize cloud tables yet (' . $e->getMessage() . '). Verify config.php credentials and confirm mysql_schema.sql has been imported.'
    );
}

$flashSuccess = null;
$flashError = null;
$action = (string)($_GET['action'] ?? '');

// Handle Logout
if ($action === 'logout') {
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

$period = strtolower(trim((string)($_GET['period'] ?? 'today')));
if (!in_array($period, ['today', 'weekly', 'monthly', 'yearly', 'all'], true)) {
    $period = 'today';
}
$branchFilter = trim((string)($_GET['branch'] ?? 'ALL'));
if ($branchFilter === '') {
    $branchFilter = 'ALL';
}

// ----------------------------------------------------------------------------
// Real-Time Endpoints (SSE Stream + Cursor Check + Live Snapshot JSON)
// ----------------------------------------------------------------------------
if ($action === 'live_cursor' || $action === 'live_data' || $action === 'live_stream') {
    if (!$loggedUser) {
        session_write_close();
        if ($action === 'live_stream') {
            header('Content-Type: text/event-stream; charset=utf-8');
            header('Cache-Control: no-cache, no-store, must-revalidate');
            echo "event: auth_required\ndata: {\"authenticated\":false}\n\n";
            @flush();
            exit;
        }
        ameer_json_response(['ok' => false, 'authenticated' => false, 'error' => 'Session expired'], 401);
    }

    // Release PHP session lock immediately so parallel navigation/requests never block
    session_write_close();

    if ($action === 'live_cursor') {
        $cur = ameer_get_live_cursor($pdo);
        $cur['ok'] = true;
        $cur['authenticated'] = true;
        $cur['serverTimePkt'] = date('Y-m-d H:i:s');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        ameer_json_response($cur);
    }

    if ($action === 'live_data') {
        $snap = ameer_build_live_dashboard_snapshot($pdo, $period, $branchFilter);
        header('Cache-Control: no-cache, no-store, must-revalidate');
        ameer_json_response([
            'ok' => true,
            'authenticated' => true,
            'snapshot' => $snap,
        ]);
    }

    // SSE real-time stream (cycles cleanly every 20s so shared Apache/LiteSpeed workers stay healthy)
    @set_time_limit(30);
    ignore_user_abort(false);
    while (ob_get_level() > 0) {
        @ob_end_clean();
    }
    header('Content-Type: text/event-stream; charset=utf-8');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('Connection: keep-alive');
    header('X-Accel-Buffering: no');

    $emitEvent = static function (string $ev, array $payload): void {
        echo "event: {$ev}\n";
        echo 'data: ' . json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n\n";
        @flush();
    };

    $initial = ameer_build_live_dashboard_snapshot($pdo, $period, $branchFilter);
    $lastSig = (string)$initial['stateSignature'];
    $emitEvent('snapshot', $initial);

    $deadline = microtime(true) + 20.0;
    $ticks = 0;
    while (microtime(true) < $deadline) {
        if (connection_aborted()) {
            break;
        }
        $cur = ameer_get_live_cursor($pdo);
        if ((string)$cur['signature'] !== $lastSig) {
            $fresh = ameer_build_live_dashboard_snapshot($pdo, $period, $branchFilter);
            $lastSig = (string)$fresh['stateSignature'];
            $emitEvent('snapshot', $fresh);
        } elseif ($ticks > 0 && ($ticks % 4) === 0) {
            echo ": keepalive " . date('H:i:s') . "\n\n";
            @flush();
        }
        $ticks++;
        usleep(500000);
    }

    $emitEvent('reconnect', ['reason' => 'cycle']);
    exit;
}

// Handle authenticated actions (backup download + password change)
if ($loggedUser && $action === 'download_backup') {
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
        body { margin:0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: radial-gradient(circle at top, #172033 0%, #090d16 72%); color:#f8fafc; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; }
        .login-box { width:100%; max-width:430px; background:rgba(15,23,42,0.94); border:1px solid #293548; border-radius:20px; padding:32px; box-shadow:0 24px 65px rgba(0,0,0,0.65); }
        .brand-pill { display:inline-flex; align-items:center; gap:7px; padding:4px 11px; border-radius:999px; font-size:11px; font-weight:800; letter-spacing:0.06em; color:#facc15; background:rgba(212,175,55,0.12); border:1px solid rgba(212,175,55,0.35); margin-bottom:14px; }
        .dot { width:7px; height:7px; border-radius:999px; background:#22c55e; box-shadow:0 0 8px #22c55e; }
        h1 { margin:0 0 6px; font-size:24px; font-weight:800; letter-spacing:-0.02em; }
        .sub { margin:0 0 24px; font-size:13px; color:#94a3b8; line-height:1.5; }
        label { display:block; font-size:12px; font-weight:600; color:#cbd5e1; margin-bottom:6px; }
        input { width:100%; padding:11px 13px; border-radius:10px; border:1px solid #334155; background:#0b1220; color:#f8fafc; font-size:14px; margin-bottom:16px; outline:none; transition:border-color 0.15s; }
        input:focus { border-color:#d4af37; }
        button { width:100%; padding:12px; border:none; border-radius:10px; background:linear-gradient(135deg,#e5c158,#c6971c); color:#0b0f17; font-size:14px; font-weight:800; cursor:pointer; }
        button:hover { filter:brightness(1.06); }
        .err { background:rgba(239,68,68,0.14); border:1px solid rgba(239,68,68,0.45); color:#fecaca; padding:10px 12px; border-radius:10px; font-size:13px; margin-bottom:16px; }
        .foot { margin-top:22px; text-align:center; font-size:12px; color:#64748b; }
    </style>
</head>
<body>
    <form class="login-box" method="post" action="index.php">
        <div class="brand-pill"><span class="dot"></span> AMEER PERFUMES • LIVE CLOUD</div>
        <h1>Owner Command Center</h1>
        <p class="sub">Zero-refresh real-time telemetry across branches, POS bills, WhatsApp &amp; Website orders, wholesale, inventory &amp; cloud backups.</p>
        <?php if ($flashError): ?>
            <div class="err"><?= ameer_h($flashError) ?></div>
        <?php endif; ?>
        <input type="hidden" name="form_action" value="login" />
        <input type="hidden" name="csrf_token" value="<?= ameer_h($_SESSION['csrf_token']) ?>" />
        <label for="username">Owner Username</label>
        <input id="username" name="username" type="text" autocomplete="username" required autofocus />
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required />
        <button type="submit">Enter Live Command Center</button>
        <div class="foot">Global Tech • 0329 9969277</div>
    </form>
</body>
</html>
<?php
    exit;
endif;

// Authenticated initial snapshot bootstrap (SSE takes over live immediately after page load)
$initialSnapshot = ameer_build_live_dashboard_snapshot($pdo, $period, $branchFilter);
$jsonFlags = JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Ameer Perfumes — Live Owner Command Center</title>
    <style>
        :root {
            --bg: #080c14;
            --bg-elev: #0f1623;
            --panel: #131c2e;
            --panel-2: #0d1422;
            --border: #233049;
            --border-soft: #1b2539;
            --text: #f1f5f9;
            --muted: #94a3b8;
            --dim: #64748b;
            --gold: #e5c158;
            --gold-deep: #b88918;
            --emerald: #10b981;
            --sky: #38bdf8;
            --violet: #a78bfa;
            --amber: #f59e0b;
            --rose: #f43f5e;
            --wa: #25d366;
        }
        * { box-sizing: border-box; }
        html, body { margin:0; padding:0; background: radial-gradient(ellipse at top right, #131f38 0%, #080c14 55%); color:var(--text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; min-height:100vh; }
        a { color: inherit; text-decoration: none; }
        .wrap { max-width: 1520px; margin: 0 auto; padding: 14px 18px 46px; }

        /* Sticky Top Command Bar */
        .topbar { position: sticky; top: 0; z-index: 40; backdrop-filter: blur(14px); background: rgba(8, 12, 20, 0.88); border-bottom: 1px solid var(--border); }
        .topbar-inner { max-width: 1520px; margin: 0 auto; padding: 11px 18px; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
        .brand { display:flex; align-items:center; gap:11px; }
        .logo-badge { width:40px; height:40px; border-radius:12px; background: linear-gradient(135deg, #f3d574, #a8790f); color:#090d16; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:17px; box-shadow:0 6px 22px rgba(212,175,55,0.28); flex-shrink:0; }
        .brand-title { font-size:16px; font-weight:800; letter-spacing:-0.01em; color:#f8fafc; }
        .brand-sub { font-size:11px; color:var(--muted); display:flex; align-items:center; gap:8px; flex-wrap:wrap; }

        .controls { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .live-pill { display:inline-flex; align-items:center; gap:7px; padding:6px 12px; border-radius:999px; font-size:11px; font-weight:800; letter-spacing:0.04em; background:rgba(16,185,129,0.12); color:#6ee7b7; border:1px solid rgba(16,185,129,0.38); }
        .live-pill.polling { background:rgba(245,158,11,0.14); color:#fcd34d; border-color:rgba(245,158,11,0.38); }
        .live-pill.offline { background:rgba(244,63,94,0.14); color:#fda4af; border-color:rgba(244,63,94,0.38); }
        .pulse-dot { width:8px; height:8px; border-radius:999px; background:#22c55e; box-shadow:0 0 0 0 rgba(34,197,94,0.7); animation: pulse 1.6s infinite; }
        .live-pill.polling .pulse-dot { background:#f59e0b; box-shadow:0 0 0 0 rgba(245,158,11,0.7); }
        .live-pill.offline .pulse-dot { background:#f43f5e; animation: none; }
        @keyframes pulse { 0% { box-shadow:0 0 0 0 rgba(34,197,94,0.75); } 70% { box-shadow:0 0 0 8px rgba(34,197,94,0); } 100% { box-shadow:0 0 0 0 rgba(34,197,94,0); } }

        select.ctl, button.ctl { background:var(--panel); color:var(--text); border:1px solid var(--border); border-radius:10px; padding:7px 11px; font-size:12px; font-weight:600; cursor:pointer; outline:none; transition:border-color 0.15s, background 0.15s; }
        select.ctl:hover, button.ctl:hover { border-color:var(--gold); }
        button.ctl.active { background:rgba(229,193,88,0.15); border-color:var(--gold); color:#fde68a; }
        .btn-logout { background:rgba(244,63,94,0.12); color:#fda4af; border:1px solid rgba(244,63,94,0.35); border-radius:10px; padding:7px 12px; font-size:12px; font-weight:700; }
        .btn-logout:hover { background:rgba(244,63,94,0.22); }

        .banner { padding:10px 14px; border-radius:12px; font-size:13px; margin:12px 0; display:flex; align-items:center; justify-content:space-between; gap:10px; }
        .banner.warn { background:rgba(245,158,11,0.13); border:1px solid rgba(245,158,11,0.4); color:#fde68a; }
        .banner.ok { background:rgba(16,185,129,0.13); border:1px solid rgba(16,185,129,0.4); color:#a7f3d0; }
        .banner.err { background:rgba(244,63,94,0.13); border:1px solid rgba(244,63,94,0.4); color:#fecdd3; }

        /* Branch Telemetry Strip */
        .sec-head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin:16px 0 9px; flex-wrap:wrap; }
        .sec-title { font-size:12px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:var(--muted); display:flex; align-items:center; gap:7px; }
        .branch-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(255px, 1fr)); gap:11px; margin-bottom:16px; }
        .branch-card { background:linear-gradient(160deg, rgba(21,31,51,0.95), rgba(13,20,34,0.98)); border:1px solid var(--border); border-radius:14px; padding:12px 14px; cursor:pointer; transition:transform 0.12s, border-color 0.15s, box-shadow 0.15s; text-align:left; }
        .branch-card:hover { border-color:rgba(229,193,88,0.55); transform:translateY(-1px); }
        .branch-card.selected { border-color:var(--gold); box-shadow:0 0 0 1px rgba(229,193,88,0.4), 0 10px 26px rgba(212,175,55,0.12); }
        .br-top { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:6px; }
        .br-name { font-size:13.5px; font-weight:800; color:#f8fafc; }
        .br-id { font-size:11px; color:var(--gold); font-weight:700; }
        .br-status { font-size:10px; font-weight:800; padding:3px 8px; border-radius:999px; display:inline-flex; align-items:center; gap:5px; }
        .br-status.on { background:rgba(16,185,129,0.16); color:#6ee7b7; border:1px solid rgba(16,185,129,0.35); }
        .br-status.off { background:rgba(100,116,139,0.18); color:#cbd5e1; border:1px solid rgba(100,116,139,0.35); }
        .br-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-top:8px; padding-top:8px; border-top:1px solid var(--border-soft); font-size:11px; }
        .br-stat-k { color:var(--dim); font-size:10px; }
        .br-stat-v { color:#e2e8f0; font-weight:700; margin-top:1px; }

        /* Hero KPI Grid */
        .kpi-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(225px, 1fr)); gap:11px; margin-bottom:18px; }
        .kpi { background:linear-gradient(175deg, var(--panel), var(--panel-2)); border:1px solid var(--border); border-radius:15px; padding:14px 15px; position:relative; overflow:hidden; }
        .kpi::after { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg, transparent, rgba(229,193,88,0.45), transparent); opacity:0.6; }
        .kpi.accent-gold { border-color:rgba(229,193,88,0.4); }
        .kpi.accent-wa { border-color:rgba(37,211,102,0.38); }
        .kpi.accent-web { border-color:rgba(56,189,248,0.38); }
        .kpi-lbl { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--muted); display:flex; align-items:center; justify-content:space-between; }
        .kpi-val { font-size:22px; font-weight:900; letter-spacing:-0.02em; margin:6px 0 4px; color:#f8fafc; font-variant-numeric:tabular-nums; }
        .kpi-val.emerald { color:#34d399; }
        .kpi-val.gold { color:#fde047; }
        .kpi-val.sky { color:#38bdf8; }
        .kpi-val.wa { color:#4ade80; }
        .kpi-val.amber { color:#fbbf24; }
        .kpi-val.rose { color:#fb7185; }
        .kpi-sub { font-size:11.5px; color:var(--muted); line-height:1.45; }

        /* Tabs + Search */
        .tabs-bar { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-bottom:14px; background:var(--panel-2); border:1px solid var(--border); padding:8px 10px; border-radius:14px; }
        .tabs { display:flex; gap:6px; flex-wrap:wrap; }
        .tab-btn { background:transparent; color:var(--muted); border:1px solid transparent; border-radius:10px; padding:7px 12px; font-size:12.5px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:all 0.15s; }
        .tab-btn:hover { color:#f8fafc; background:rgba(255,255,255,0.04); }
        .tab-btn.active { background:linear-gradient(135deg, rgba(229,193,88,0.22), rgba(184,137,24,0.16)); color:#fde68a; border-color:rgba(229,193,88,0.5); }
        .tab-cnt { font-size:10.5px; padding:1px 6px; border-radius:999px; background:rgba(255,255,255,0.08); color:#cbd5e1; }
        .search-box { display:flex; align-items:center; background:#090e1a; border:1px solid var(--border); border-radius:10px; padding:0 10px; min-width:240px; flex:1; max-width:340px; }
        .search-box input { width:100%; background:transparent; border:none; color:var(--text); padding:8px 6px; font-size:12.5px; outline:none; }

        /* Panels & Split Layout */
        .grid-2 { display:grid; grid-template-columns: 1.35fr 1fr; gap:14px; }
        @media (max-width: 1050px) { .grid-2 { grid-template-columns: 1fr; } }
        .panel { background:var(--panel); border:1px solid var(--border); border-radius:15px; overflow:hidden; margin-bottom:14px; }
        .panel-head { padding:12px 16px; border-bottom:1px solid var(--border-soft); display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; background:rgba(8,12,20,0.35); }
        .panel-title { font-size:13.5px; font-weight:800; color:#f8fafc; display:flex; align-items:center; gap:8px; }
        .panel-body { padding:14px 16px; }

        /* Sub-filter pills */
        .pills { display:flex; gap:6px; flex-wrap:wrap; padding:10px 16px; border-bottom:1px solid var(--border-soft); background:rgba(8,12,20,0.22); }
        .pill { border:1px solid var(--border); background:var(--panel-2); color:var(--muted); padding:5px 11px; border-radius:999px; font-size:11.5px; font-weight:700; cursor:pointer; }
        .pill.active { background:rgba(229,193,88,0.18); border-color:var(--gold); color:#fde68a; }

        /* Tables */
        .tbl-wrap { overflow-x:auto; max-height:540px; overflow-y:auto; }
        table { width:100%; border-collapse:collapse; font-size:12.5px; }
        th { position:sticky; top:0; z-index:2; background:#0d1524; text-align:left; font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:var(--muted); padding:10px 13px; border-bottom:1px solid var(--border); white-space:nowrap; }
        td { padding:10px 13px; border-bottom:1px solid var(--border-soft); color:#e2e8f0; vertical-align:top; }
        tr:hover td { background:rgba(255,255,255,0.02); }
        .row-new td { animation: rowFlash 3.2s ease-out; }
        @keyframes rowFlash { 0% { background: rgba(229,193,88,0.24); } 100% { background: transparent; } }
        .num { font-variant-numeric:tabular-nums; text-align:right; font-weight:700; white-space:nowrap; }

        /* Badges & Chips */
        .badge { display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:999px; font-size:10.5px; font-weight:800; letter-spacing:0.03em; white-space:nowrap; }
        .b-pos { background:rgba(16,185,129,0.15); color:#6ee7b7; border:1px solid rgba(16,185,129,0.3); }
        .b-wa { background:rgba(37,211,102,0.16); color:#4ade80; border:1px solid rgba(37,211,102,0.35); }
        .b-web { background:rgba(56,189,248,0.16); color:#7dd3fc; border:1px solid rgba(56,189,248,0.35); }
        .b-ws { background:rgba(167,139,250,0.16); color:#c4b5fd; border:1px solid rgba(167,139,250,0.35); }
        .b-warn { background:rgba(245,158,11,0.16); color:#fcd34d; border:1px solid rgba(245,158,11,0.35); }
        .b-bad { background:rgba(244,63,94,0.16); color:#fda4af; border:1px solid rgba(244,63,94,0.35); }
        .b-gold { background:rgba(229,193,88,0.16); color:#fde68a; border:1px solid rgba(229,193,88,0.35); }
        .b-mut { background:rgba(148,163,184,0.12); color:#cbd5e1; border:1px solid rgba(148,163,184,0.28); }
        .item-chip { display:inline-block; background:#0b1220; border:1px solid #26344f; border-radius:7px; padding:2px 7px; font-size:11px; margin:2px 4px 2px 0; color:#cbd5e1; }

        /* Visual Bars */
        .bar-item { margin-bottom:12px; }
        .bar-row { display:flex; justify-content:space-between; font-size:12px; margin-bottom:5px; font-weight:600; }
        .bar-track { height:8px; background:#0a101d; border-radius:999px; overflow:hidden; border:1px solid var(--border-soft); }
        .bar-fill { height:100%; border-radius:999px; transition:width 0.4s ease; }

        /* Live Activity Feed */
        .feed-list { max-height:460px; overflow-y:auto; }
        .feed-row { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; padding:10px 15px; border-bottom:1px solid var(--border-soft); }
        .feed-row:last-child { border-bottom:none; }
        .feed-title { font-size:12.5px; font-weight:700; color:#f1f5f9; }
        .feed-meta { font-size:11px; color:var(--muted); margin-top:3px; }
        .feed-amt { font-size:13px; font-weight:800; white-space:nowrap; font-variant-numeric:tabular-nums; }

        /* Settings Form & Buttons */
        .btn-gold { background:linear-gradient(135deg, #e5c158, #b88918); color:#090d16; border:none; border-radius:9px; padding:8px 14px; font-size:12.5px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:6px; }
        .btn-dl { background:rgba(16,185,129,0.14); color:#6ee7b7; border:1px solid rgba(16,185,129,0.35); border-radius:8px; padding:5px 10px; font-size:11.5px; font-weight:700; display:inline-block; }
        .form-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:12px; }
        .inp { width:100%; padding:9px 11px; border-radius:9px; border:1px solid var(--border); background:#090f1c; color:var(--text); font-size:13px; outline:none; }
        .inp:focus { border-color:var(--gold); }

        /* Real-time Toast Stack */
        #toastStack { position:fixed; right:18px; bottom:18px; z-index:99; display:flex; flex-direction:column; gap:8px; max-width:360px; pointer-events:none; }
        .toast { background:rgba(13,20,34,0.96); border:1px solid var(--gold); border-left:4px solid #22c55e; border-radius:12px; padding:11px 14px; box-shadow:0 14px 36px rgba(0,0,0,0.65); animation:slideUp 0.25s ease-out; pointer-events:auto; }
        .toast-h { font-size:11px; font-weight:800; color:#6ee7b7; text-transform:uppercase; letter-spacing:0.05em; }
        .toast-b { font-size:12.5px; font-weight:700; color:#f8fafc; margin-top:3px; }
        @keyframes slideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }

        .foot { margin-top:26px; text-align:center; font-size:11.5px; color:var(--dim); border-top:1px solid var(--border-soft); padding-top:14px; }
        .empty { padding:28px; text-align:center; color:var(--dim); font-size:13px; }
        .hidden { display:none !important; }
    </style>
</head>
<body>
    <header class="topbar">
        <div class="topbar-inner">
            <div class="brand">
                <div class="logo-badge">AP</div>
                <div>
                    <div class="brand-title">Ameer Perfumes — Live Executive Command Center</div>
                    <div class="brand-sub">
                        <span id="topServerClock">PKT --:--:--</span>
                        <span>•</span>
                        <span>Sync Cursor <strong id="topCursor">#0</strong></span>
                        <span>•</span>
                        <span id="topActiveScope">Scope: All Branches</span>
                    </div>
                </div>
            </div>
            <div class="controls">
                <div id="liveBadge" class="live-pill">
                    <span class="pulse-dot"></span>
                    <span id="liveBadgeText">LIVE STREAMING</span>
                </div>
                <select id="periodSelect" class="ctl" aria-label="Period Filter">
                    <option value="today">Today (PKT)</option>
                    <option value="weekly">Last 7 Days</option>
                    <option value="monthly">This Month</option>
                    <option value="yearly">This Year</option>
                    <option value="all">All Synced History</option>
                </select>
                <select id="branchSelect" class="ctl" aria-label="Branch Filter">
                    <option value="ALL">All Branches</option>
                </select>
                <button id="soundBtn" type="button" class="ctl" title="Toggle new-order audio chime">Sound: Off</button>
                <span style="font-size:12px;color:var(--muted);padding:0 4px;">
                    <?= ameer_h($loggedUser['full_name']) ?>
                </span>
                <a class="btn-logout" href="index.php?action=logout">Sign Out</a>
            </div>
        </div>
    </header>

    <main class="wrap">
        <?php if ($defaultPwdActive): ?>
            <div class="banner warn">
                <span>Security Notice: Default Owner Cloud password is still active. Change it under the <strong>Branches, Shifts &amp; Vault</strong> tab.</span>
            </div>
        <?php endif; ?>
        <?php if ($flashSuccess): ?>
            <div class="banner ok"><span><?= ameer_h($flashSuccess) ?></span></div>
        <?php endif; ?>
        <?php if ($flashError): ?>
            <div class="banner err"><span><?= ameer_h($flashError) ?></span></div>
        <?php endif; ?>

        <!-- Branches & Live Terminal Telemetry -->
        <div class="sec-head">
            <div class="sec-title">Live Branches &amp; Shop Terminals Telemetry (Click any branch to filter)</div>
            <button id="clearBranchBtn" type="button" class="ctl hidden">Show All Branches</button>
        </div>
        <div id="branchesStrip" class="branch-grid"></div>

        <!-- A-to-Z Executive KPIs -->
        <div id="kpiGrid" class="kpi-grid"></div>

        <!-- Navigation Tabs + Instant Search -->
        <div class="tabs-bar">
            <div class="tabs" id="mainTabs">
                <button type="button" class="tab-btn active" data-tab="overview">Overview &amp; Live Feed</button>
                <button type="button" class="tab-btn" data-tab="online">WhatsApp &amp; Website <span class="tab-cnt" id="cntOnline">0</span></button>
                <button type="button" class="tab-btn" data-tab="retail">POS Retail Sales <span class="tab-cnt" id="cntRetail">0</span></button>
                <button type="button" class="tab-btn" data-tab="wholesale">Wholesale &amp; Udar <span class="tab-cnt" id="cntWholesale">0</span></button>
                <button type="button" class="tab-btn" data-tab="inventory">Perfumes &amp; Attars <span class="tab-cnt" id="cntInventory">0</span></button>
                <button type="button" class="tab-btn" data-tab="finance">Returns, Expenses &amp; Salaries <span class="tab-cnt" id="cntFinance">0</span></button>
                <button type="button" class="tab-btn" data-tab="vault">Branches, Shifts &amp; Backups</button>
            </div>
            <div class="search-box">
                <input id="globalSearch" type="search" placeholder="Instant search invoice, phone, customer, perfume, branch..." />
            </div>
        </div>

        <!-- TAB 1: OVERVIEW & REAL-TIME FEED -->
        <section id="tab-overview" class="tab-view">
            <div class="grid-2">
                <div class="panel">
                    <div class="panel-head">
                        <div class="panel-title">Real-Time Shop Transaction Feed <span class="badge b-pos">AUTO-UPDATING</span></div>
                        <span style="font-size:11.5px;color:var(--muted)" id="feedSubtitle">Latest physical counter &amp; online activity</span>
                    </div>
                    <div id="liveFeedList" class="feed-list"></div>
                </div>
                <div>
                    <div class="panel">
                        <div class="panel-head">
                            <div class="panel-title">Channel &amp; Category Performance</div>
                        </div>
                        <div class="panel-body" id="channelBars"></div>
                    </div>
                    <div class="panel">
                        <div class="panel-head">
                            <div class="panel-title">Treasury Wallets &amp; Inventory Snapshot</div>
                        </div>
                        <div class="panel-body" id="treasuryBars"></div>
                    </div>
                </div>
            </div>
        </section>

        <!-- TAB 2: WHATSAPP & WEBSITE ORDERS -->
        <section id="tab-online" class="tab-view hidden">
            <div class="panel">
                <div class="panel-head">
                    <div class="panel-title">WhatsApp &amp; Website Online Orders Command Ledger</div>
                    <div id="onlineSplitBadges" style="display:flex;gap:8px;flex-wrap:wrap;"></div>
                </div>
                <div class="pills" id="onlineSubPills">
                    <button type="button" class="pill active" data-filter="ALL">All Orders</button>
                    <button type="button" class="pill" data-filter="WHATSAPP">WhatsApp</button>
                    <button type="button" class="pill" data-filter="WEBSITE">Website</button>
                    <button type="button" class="pill" data-filter="PENDING_COD">Pending COD</button>
                    <button type="button" class="pill" data-filter="SETTLED">Settled / Paid</button>
                    <button type="button" class="pill" data-filter="RETURNED">Returns / RTO</button>
                </div>
                <div class="tbl-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Order # &amp; Date</th>
                                <th>Channel &amp; Branch</th>
                                <th>Customer &amp; City</th>
                                <th>Ordered Perfumes / Attars / Testers</th>
                                <th>Courier &amp; Tracking</th>
                                <th class="num">Gross / Disc</th>
                                <th class="num">Advance Paid</th>
                                <th class="num">Pending COD</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody id="onlineTableBody"></tbody>
                    </table>
                </div>
            </div>
        </section>

        <!-- TAB 3: RETAIL POS SALES -->
        <section id="tab-retail" class="tab-view hidden">
            <div class="panel">
                <div class="panel-head">
                    <div class="panel-title">Physical Counter POS Sales Ledger</div>
                    <div id="retailSummaryText" style="font-size:12px;color:var(--muted)"></div>
                </div>
                <div class="tbl-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Invoice #</th>
                                <th>Branch &amp; Date</th>
                                <th>Customer</th>
                                <th>Products Sold</th>
                                <th>Salesperson &amp; Method</th>
                                <th class="num">Units</th>
                                <th class="num">Gross</th>
                                <th class="num">Discount</th>
                                <th class="num">Net Payable</th>
                            </tr>
                        </thead>
                        <tbody id="retailTableBody"></tbody>
                    </table>
                </div>
            </div>
        </section>

        <!-- TAB 4: WHOLESALE & PARTIES UDAR -->
        <section id="tab-wholesale" class="tab-view hidden">
            <div class="grid-2">
                <div class="panel">
                    <div class="panel-head">
                        <div class="panel-title">Wholesale Parties &amp; Outstanding Udar</div>
                        <span id="wsTotalUdarBadge" class="badge b-warn">Rs. 0</span>
                    </div>
                    <div class="tbl-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Business / Party</th>
                                    <th>Contact &amp; City</th>
                                    <th class="num">Current Udar</th>
                                    <th class="num">Credit Limit</th>
                                </tr>
                            </thead>
                            <tbody id="wsPartiesBody"></tbody>
                        </table>
                    </div>
                </div>
                <div class="panel">
                    <div class="panel-head">
                        <div class="panel-title">Wholesale Invoices (Period)</div>
                    </div>
                    <div class="tbl-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Invoice &amp; Party</th>
                                    <th>Branch &amp; Date</th>
                                    <th class="num">Gross / Disc</th>
                                    <th class="num">Net / Paid</th>
                                    <th class="num">Due Balance</th>
                                </tr>
                            </thead>
                            <tbody id="wsInvoicesBody"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </section>

        <!-- TAB 5: PERFUMES & ATTARS INVENTORY -->
        <section id="tab-inventory" class="tab-view hidden">
            <div class="pills" id="invSubPills" style="margin-bottom:12px;border-radius:12px;border:1px solid var(--border);">
                <button type="button" class="pill active" data-filter="PERFUMES">Finished Perfumes</button>
                <button type="button" class="pill" data-filter="LOW_STOCK">Low / Out of Stock</button>
                <button type="button" class="pill" data-filter="ATTARS">Bulk Attars &amp; Oils</button>
            </div>
            <div class="panel" id="invPerfumesPanel">
                <div class="panel-head">
                    <div class="panel-title">Finished Perfume Stock &amp; Valuation</div>
                    <div id="invValSummary" style="font-size:12px;color:var(--muted)"></div>
                </div>
                <div class="tbl-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>SKU</th>
                                <th>Fragrance &amp; Brand</th>
                                <th>Size / Category</th>
                                <th class="num">Stock Units</th>
                                <th class="num">Batch Cost</th>
                                <th class="num">Retail Price</th>
                                <th class="num">Stock Retail Val</th>
                            </tr>
                        </thead>
                        <tbody id="perfumesBody"></tbody>
                    </table>
                </div>
            </div>
            <div class="panel hidden" id="invAttarsPanel">
                <div class="panel-head">
                    <div class="panel-title">Pure Attar &amp; Oil Catalog (Per Tola)</div>
                </div>
                <div class="tbl-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>SKU</th>
                                <th>Attar Name</th>
                                <th>Origin</th>
                                <th class="num">Cost / Tola</th>
                                <th class="num">Retail / Tola</th>
                                <th class="num">Wholesale / Tola</th>
                            </tr>
                        </thead>
                        <tbody id="attarsBody"></tbody>
                    </table>
                </div>
            </div>
        </section>

        <!-- TAB 6: RETURNS, EXPENSES & SALARIES -->
        <section id="tab-finance" class="tab-view hidden">
            <div class="panel">
                <div class="panel-head"><div class="panel-title">POS Return Vouchers</div></div>
                <div class="tbl-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Voucher #</th>
                                <th>Type &amp; Condition</th>
                                <th>Branch &amp; Date</th>
                                <th>Settlement</th>
                                <th class="num">Refund Amount</th>
                            </tr>
                        </thead>
                        <tbody id="returnsBody"></tbody>
                    </table>
                </div>
            </div>
            <div class="grid-2">
                <div class="panel">
                    <div class="panel-head"><div class="panel-title">Petty Operating Expenses</div></div>
                    <div class="tbl-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Category &amp; Payee</th>
                                    <th>Branch &amp; Date</th>
                                    <th>Description</th>
                                    <th class="num">Amount</th>
                                </tr>
                            </thead>
                            <tbody id="expensesBody"></tbody>
                        </table>
                    </div>
                </div>
                <div class="panel">
                    <div class="panel-head"><div class="panel-title">Staff Salaries &amp; Daily Wages</div></div>
                    <div class="tbl-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Employee &amp; Role</th>
                                    <th>Type &amp; Method</th>
                                    <th>Branch &amp; Date</th>
                                    <th class="num">Amount</th>
                                </tr>
                            </thead>
                            <tbody id="salariesBody"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </section>

        <!-- TAB 7: BRANCHES, SHIFTS, CLOUD BACKUPS & SECURITY -->
        <section id="tab-vault" class="tab-view hidden">
            <div class="grid-2">
                <div class="panel">
                    <div class="panel-head"><div class="panel-title">Cash Register Shifts &amp; Reconciliation</div></div>
                    <div class="tbl-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Branch</th>
                                    <th>Opened / Closed</th>
                                    <th>Status</th>
                                    <th class="num">Float</th>
                                    <th class="num">Expected Cash</th>
                                    <th class="num">Counted Cash</th>
                                </tr>
                            </thead>
                            <tbody id="shiftsBody"></tbody>
                        </table>
                    </div>
                </div>
                <div class="panel">
                    <div class="panel-head"><div class="panel-title">Hot Cloud SQLite Database Backups</div></div>
                    <div class="tbl-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Snapshot File</th>
                                    <th>Branch &amp; Time</th>
                                    <th class="num">Size</th>
                                    <th>Download</th>
                                </tr>
                            </thead>
                            <tbody id="backupsBody"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div class="panel">
                <div class="panel-head">
                    <div class="panel-title">Owner Web Portal Security Credentials</div>
                </div>
                <div class="panel-body">
                    <form method="post" action="index.php?period=<?= ameer_h($period) ?>&amp;branch=<?= ameer_h($branchFilter) ?>">
                        <input type="hidden" name="form_action" value="change_password" />
                        <input type="hidden" name="csrf_token" value="<?= ameer_h($_SESSION['csrf_token']) ?>" />
                        <div class="form-grid">
                            <div>
                                <label style="display:block;font-size:11.5px;color:var(--muted);margin-bottom:5px;">New Username</label>
                                <input class="inp" type="text" name="new_username" value="<?= ameer_h($loggedUser['username']) ?>" required />
                            </div>
                            <div>
                                <label style="display:block;font-size:11.5px;color:var(--muted);margin-bottom:5px;">Current Password</label>
                                <input class="inp" type="password" name="current_password" required />
                            </div>
                            <div>
                                <label style="display:block;font-size:11.5px;color:var(--muted);margin-bottom:5px;">New Password (min 8 chars)</label>
                                <input class="inp" type="password" name="new_password" minlength="8" required />
                            </div>
                            <div style="display:flex;align-items:flex-end;">
                                <button type="submit" class="btn-gold">Update Cloud Credentials</button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </section>

        <div class="foot">
            Ameer Perfumes ERP — Real-Time Executive Cloud Monitor • Engineered by Global Tech • 0329 9969277
        </div>
    </main>

    <div id="toastStack"></div>

    <script>
    (function () {
        'use strict';

        var state = {
            snap: <?= json_encode($initialSnapshot, $jsonFlags) ?>,
            period: <?= json_encode($period, $jsonFlags) ?>,
            branch: <?= json_encode($branchFilter, $jsonFlags) ?>,
            activeTab: 'overview',
            onlineFilter: 'ALL',
            invFilter: 'PERFUMES',
            search: '',
            soundOn: false,
            eventSource: null,
            reconnectTimer: null,
            prevCursor: 0,
            prevFeedTopTs: '',
            freshHighlightUntil: 0,
            cursorTimer: null
        };

        state.prevCursor = Number(state.snap && state.snap.syncCursor || 0);
        if (state.snap && Array.isArray(state.snap.liveFeed) && state.snap.liveFeed.length) {
            state.prevFeedTopTs = String(state.snap.liveFeed[0].ts || '') + '|' + String(state.snap.liveFeed[0].title || '');
        }

        function esc(v) {
            return String(v == null ? '' : v)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function pkr(paisa) {
            var n = Number(paisa || 0);
            var sign = n < 0 ? '-' : '';
            var rupees = Math.round(Math.abs(n) / 100);
            return sign + 'Rs. ' + rupees.toLocaleString('en-US');
        }

        function fmtTs(ts) {
            if (!ts) return '—';
            var s = String(ts).replace('T', ' ').slice(0, 19);
            return s;
        }

        function fmtBytes(b) {
            var n = Number(b || 0);
            if (n >= 1048576) return (n / 1048576).toFixed(2) + ' MB';
            if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
            return n + ' B';
        }

        function matchQuery(text) {
            if (!state.search) return true;
            return String(text || '').toLowerCase().indexOf(state.search) !== -1;
        }

        function playChime() {
            if (!state.soundOn) return;
            try {
                var Ctx = window.AudioContext || window.webkitAudioContext;
                if (!Ctx) return;
                var ctx = new Ctx();
                var osc = ctx.createOscillator();
                var gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.14);
                gain.gain.setValueAtTime(0.08, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.36);
            } catch (e) {}
        }

        function showToast(title, body) {
            var stack = document.getElementById('toastStack');
            if (!stack) return;
            var el = document.createElement('div');
            el.className = 'toast';
            el.innerHTML = '<div class="toast-h">' + esc(title) + '</div><div class="toast-b">' + esc(body) + '</div>';
            stack.prepend(el);
            setTimeout(function () {
                if (el.parentNode) el.parentNode.removeChild(el);
            }, 6500);
        }

        function setConnectionStatus(mode, label) {
            var pill = document.getElementById('liveBadge');
            var txt = document.getElementById('liveBadgeText');
            if (!pill || !txt) return;
            pill.className = 'live-pill' + (mode ? ' ' + mode : '');
            txt.textContent = label;
        }

        function setPeriodAndBranchControls(snap) {
            var pSel = document.getElementById('periodSelect');
            if (pSel && pSel.value !== state.period) pSel.value = state.period;

            var bSel = document.getElementById('branchSelect');
            if (bSel && Array.isArray(snap.branches)) {
                var curVal = state.branch || 'ALL';
                var opts = '<option value="ALL">All Branches (' + snap.branches.length + ')</option>';
                snap.branches.forEach(function (b) {
                    opts += '<option value="' + esc(b.terminal_id) + '">' + esc(b.terminal_id + ' — ' + b.branch_name) + '</option>';
                });
                bSel.innerHTML = opts;
                bSel.value = curVal;
            }

            var clearBtn = document.getElementById('clearBranchBtn');
            if (clearBtn) {
                clearBtn.classList.toggle('hidden', state.branch === 'ALL');
            }
            var scopeLbl = document.getElementById('topActiveScope');
            if (scopeLbl) {
                scopeLbl.textContent = 'Scope: ' + (state.branch === 'ALL' ? 'All Branches' : state.branch);
            }
            var clk = document.getElementById('topServerClock');
            if (clk) clk.textContent = 'PKT ' + (snap.serverTimePkt || '--');
            var curEl = document.getElementById('topCursor');
            if (curEl) curEl.textContent = '#' + (snap.syncCursor || 0);
        }

        function renderBranches(snap) {
            var root = document.getElementById('branchesStrip');
            if (!root) return;
            var branches = Array.isArray(snap.branches) ? snap.branches : [];
            if (!branches.length) {
                root.innerHTML = '<div class="panel" style="padding:14px;color:var(--muted);">Waiting for first branch POS heartbeat or sync event...</div>';
                return;
            }
            root.innerHTML = branches.map(function (b) {
                var isSel = state.branch === b.terminal_id;
                var live = !!b.is_live_online;
                var shiftTxt = b.open_shift_cash_paisa != null ? pkr(b.open_shift_cash_paisa) : 'Closed';
                return '<button type="button" class="branch-card ' + (isSel ? 'selected' : '') + '" data-branch="' + esc(b.terminal_id) + '">'
                    + '<div class="br-top">'
                    + '<div><div class="br-name">' + esc(b.branch_name) + '</div><div class="br-id">' + esc(b.terminal_id) + ' • ' + esc(b.station_role || 'COUNTER') + '</div></div>'
                    + '<span class="br-status ' + (live ? 'on' : 'off') + '">' + (live ? '● ONLINE LIVE' : '○ OFFLINE') + '</span>'
                    + '</div>'
                    + '<div style="font-size:10.5px;color:var(--dim);">Heartbeat: ' + esc(fmtTs(b.last_heartbeat_at || b.last_sync_at)) + (b.lan_ip ? ' • ' + esc(b.lan_ip) : '') + '</div>'
                    + '<div class="br-stats">'
                    + '<div><div class="br-stat-k">POS Sales (' + esc(b.retail_count) + ')</div><div class="br-stat-v">' + esc(pkr(b.retail_net_paisa)) + '</div></div>'
                    + '<div><div class="br-stat-k">Online (' + esc(b.online_count) + ')</div><div class="br-stat-v">' + esc(pkr(b.online_net_paisa)) + '</div></div>'
                    + '<div><div class="br-stat-k">Shift Cash</div><div class="br-stat-v">' + esc(shiftTxt) + '</div></div>'
                    + '</div>'
                    + '</button>';
            }).join('');
        }

        function renderKpis(snap) {
            var k = snap.kpis || {};
            var cards = [
                {
                    cls: 'accent-gold', valCls: 'gold',
                    lbl: 'Total Gross Sales',
                    val: pkr(k.totalGrossSalesPaisa),
                    sub: 'POS: ' + pkr(k.retailGrossPaisa) + ' | Online: ' + pkr(k.onlineGrossPaisa) + ' | W.Sale: ' + pkr(k.wholesaleGrossPaisa)
                },
                {
                    cls: 'accent-gold', valCls: 'emerald',
                    lbl: 'Net Realized Cash',
                    val: pkr(k.totalNetRealizedPaisa),
                    sub: 'Cash ' + pkr(k.cashReceiptsPaisa) + ' • EP ' + pkr(k.easypaisaReceiptsPaisa) + ' • JC ' + pkr(k.jazzcashReceiptsPaisa)
                },
                {
                    cls: 'accent-wa', valCls: 'wa',
                    lbl: 'WhatsApp Orders (' + Number(k.waOrdersCount || 0) + ')',
                    val: pkr(k.waGrossPaisa),
                    sub: 'Realized: ' + pkr(k.waRealizedPaisa) + ' | Pending COD: ' + pkr(k.waPendingCodPaisa) + ' (' + Number(k.waPendingCount || 0) + ')'
                },
                {
                    cls: 'accent-web', valCls: 'sky',
                    lbl: 'Website Orders (' + Number(k.webOrdersCount || 0) + ')',
                    val: pkr(k.webGrossPaisa),
                    sub: 'Realized: ' + pkr(k.webRealizedPaisa) + ' | Pending COD: ' + pkr(k.webPendingCodPaisa) + ' (' + Number(k.webPendingCount || 0) + ')'
                },
                {
                    cls: '', valCls: 'amber',
                    lbl: 'Pending COD Receivable',
                    val: pkr(k.onlinePendingCodPaisa),
                    sub: Number(k.onlinePendingCodCount || 0) + ' open shipment(s) awaiting courier / staff cash'
                },
                {
                    cls: '', valCls: 'amber',
                    lbl: 'Wholesale Udar (Total)',
                    val: pkr(k.wholesaleTotalLedgerUdarPaisa),
                    sub: 'Period Billed: ' + pkr(k.wholesaleBilledPaisa) + ' | Paid: ' + pkr(k.wholesalePaidPaisa)
                },
                {
                    cls: '', valCls: 'rose',
                    lbl: 'Discounts & Returns',
                    val: pkr(Number(k.totalDiscountsPaisa || 0) + Number(k.totalReturnsPaisa || 0)),
                    sub: 'Discounts: ' + pkr(k.totalDiscountsPaisa) + ' (' + Number(k.totalDiscountedCount || 0) + ') • Returns: ' + pkr(k.totalReturnsPaisa)
                },
                {
                    cls: '', valCls: 'rose',
                    lbl: 'Expenses & Salaries',
                    val: pkr(Number(k.pettyExpensesPaisa || 0) + Number(k.salariesPaisa || 0)),
                    sub: 'Petty: ' + pkr(k.pettyExpensesPaisa) + ' (' + Number(k.expensesCount || 0) + ') • Salaries: ' + pkr(k.salariesPaisa)
                },
                {
                    cls: 'accent-gold', valCls: Number(k.netOperatingMarginPaisa || 0) >= 0 ? 'emerald' : 'rose',
                    lbl: 'Net Operating Margin',
                    val: pkr(k.netOperatingMarginPaisa),
                    sub: 'Gross Profit (Retail): ' + pkr(k.grossProfitPaisa) + ' • Est Net: ' + pkr(k.estNetProfitPaisa)
                },
                {
                    cls: '', valCls: '',
                    lbl: 'Warehouse Stock Valuation',
                    val: pkr(k.fgRetailValPaisa),
                    sub: Number(k.totalBottlesStock || 0).toLocaleString('en-US') + ' bottles • Cost ' + pkr(k.fgCostValPaisa) + ' • Low: ' + Number(k.lowStockCount || 0)
                }
            ];

            document.getElementById('kpiGrid').innerHTML = cards.map(function (c) {
                return '<div class="kpi ' + c.cls + '">'
                    + '<div class="kpi-lbl"><span>' + esc(c.lbl) + '</span></div>'
                    + '<div class="kpi-val ' + c.valCls + '">' + esc(c.val) + '</div>'
                    + '<div class="kpi-sub">' + esc(c.sub) + '</div>'
                    + '</div>';
            }).join('');
        }

        function renderOverview(snap) {
            var k = snap.kpis || {};
            var feed = Array.isArray(snap.liveFeed) ? snap.liveFeed : [];
            var isFlash = Date.now() < state.freshHighlightUntil;
            var filteredFeed = feed.filter(function (f) {
                return matchQuery(f.title + ' ' + f.meta + ' ' + f.terminal + ' ' + f.badge);
            });
            document.getElementById('liveFeedList').innerHTML = filteredFeed.length
                ? filteredFeed.map(function (f, idx) {
                    var bCls = 'b-pos';
                    if (f.kind === 'WA_ORDER') bCls = 'b-wa';
                    else if (f.kind === 'WEB_ORDER') bCls = 'b-web';
                    else if (f.kind === 'WHOLESALE') bCls = 'b-ws';
                    else if (f.kind === 'EXPENSE' || f.kind === 'SALARY') bCls = 'b-bad';
                    return '<div class="feed-row ' + (isFlash && idx < 2 ? 'row-new' : '') + '">'
                        + '<div>'
                        + '<div class="feed-title"><span class="badge ' + bCls + '">' + esc(f.badge) + '</span> <span class="badge b-gold">' + esc(f.terminal) + '</span> ' + esc(f.title) + '</div>'
                        + '<div class="feed-meta">' + esc(f.meta) + ' • ' + esc(fmtTs(f.ts)) + '</div>'
                        + '</div>'
                        + '<div class="feed-amt" style="color:' + (f.positive ? '#34d399' : '#fb7185') + '">' + esc(pkr(f.amount_paisa)) + '</div>'
                        + '</div>';
                }).join('')
                : '<div class="empty">No transactions synced yet for the selected period / branch.</div>';

            var totalCh = Math.max(1, Number(k.retailGrossPaisa || 0) + Number(k.waGrossPaisa || 0) + Number(k.webGrossPaisa || 0) + Number(k.wholesaleGrossPaisa || 0));
            var chRows = [
                { name: 'Retail Physical POS (' + Number(k.retailInvoicesCount || 0) + ')', val: Number(k.retailGrossPaisa || 0), color: '#10b981' },
                { name: 'WhatsApp Commerce (' + Number(k.waOrdersCount || 0) + ')', val: Number(k.waGrossPaisa || 0), color: '#25d366' },
                { name: 'Website Storefront (' + Number(k.webOrdersCount || 0) + ')', val: Number(k.webGrossPaisa || 0), color: '#38bdf8' },
                { name: 'Wholesale B2B (' + Number(k.wholesaleInvoicesCount || 0) + ')', val: Number(k.wholesaleGrossPaisa || 0), color: '#a78bfa' }
            ];
            var catTotal = Math.max(1, Number(k.perfumeSalesPaisa || 0) + Number(k.attarSalesPaisa || 0) + Number(k.testerSalesPaisa || 0));
            var catRows = [
                { name: 'POS Perfumes', val: Number(k.perfumeSalesPaisa || 0), color: '#e5c158' },
                { name: 'POS Attars / Oils', val: Number(k.attarSalesPaisa || 0), color: '#f59e0b' },
                { name: 'POS Testers / Samples', val: Number(k.testerSalesPaisa || 0), color: '#c084fc' }
            ];

            document.getElementById('channelBars').innerHTML = chRows.concat(catRows).map(function (r, idx) {
                var denom = idx < 4 ? totalCh : catTotal;
                var pct = Math.min(100, Math.round((r.val / denom) * 100));
                return '<div class="bar-item">'
                    + '<div class="bar-row"><span>' + esc(r.name) + '</span><span>' + esc(pkr(r.val)) + '</span></div>'
                    + '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:' + r.color + ';"></div></div>'
                    + '</div>';
            }).join('');

            var payTotal = Math.max(1, Number(k.cashReceiptsPaisa || 0) + Number(k.easypaisaReceiptsPaisa || 0) + Number(k.jazzcashReceiptsPaisa || 0));
            var payRows = [
                { name: 'Physical Cash Drawer', val: Number(k.cashReceiptsPaisa || 0), color: '#22c55e' },
                { name: 'EasyPaisa Account', val: Number(k.easypaisaReceiptsPaisa || 0), color: '#14b8a6' },
                { name: 'JazzCash Account', val: Number(k.jazzcashReceiptsPaisa || 0), color: '#fb7185' }
            ];
            document.getElementById('treasuryBars').innerHTML = payRows.map(function (r) {
                var pct = Math.min(100, Math.round((r.val / payTotal) * 100));
                return '<div class="bar-item">'
                    + '<div class="bar-row"><span>' + esc(r.name) + '</span><span>' + esc(pkr(r.val)) + '</span></div>'
                    + '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:' + r.color + ';"></div></div>'
                    + '</div>';
            }).join('') + '<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border-soft);font-size:12px;color:var(--muted);display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;">'
                + '<span>SKUs: <strong style="color:#f8fafc">' + Number(k.productsCount || 0) + '</strong> Perfumes + <strong style="color:#f8fafc">' + Number(k.attarsCount || 0) + '</strong> Attars</span>'
                + '<span>Low Stock: <strong style="color:#fbbf24">' + Number(k.lowStockCount || 0) + '</strong> • Out: <strong style="color:#fb7185">' + Number(k.outOfStockCount || 0) + '</strong></span>'
                + '</div>';
        }

        function renderOnlineOrders(snap) {
            var k = snap.kpis || {};
            var orders = Array.isArray(snap.onlineOrders) ? snap.onlineOrders : [];
            document.getElementById('cntOnline').textContent = String(orders.length);
            document.getElementById('onlineSplitBadges').innerHTML =
                '<span class="badge b-wa">WhatsApp: ' + Number(k.waOrdersCount || 0) + ' • ' + esc(pkr(k.waGrossPaisa)) + '</span>'
                + '<span class="badge b-web">Website: ' + Number(k.webOrdersCount || 0) + ' • ' + esc(pkr(k.webGrossPaisa)) + '</span>';

            var filtered = orders.filter(function (o) {
                var ch = String(o.channel || '').toUpperCase();
                var ds = String(o.delivery_status || '').toUpperCase();
                var ps = String(o.payment_status || '').toUpperCase();
                var isWa = ch.indexOf('WHATSAPP') !== -1 || ch === 'WA';
                if (state.onlineFilter === 'WHATSAPP' && !isWa) return false;
                if (state.onlineFilter === 'WEBSITE' && isWa) return false;
                if (state.onlineFilter === 'PENDING_COD' && !(Number(o.cod_balance_paisa || 0) > 0 && ps !== 'RETURNED' && ds !== 'CANCELLED' && ds !== 'RETURNED_RTO')) return false;
                if (state.onlineFilter === 'SETTLED' && ps !== 'PAID') return false;
                if (state.onlineFilter === 'RETURNED' && !(ps === 'RETURNED' || ds.indexOf('RETURN') !== -1)) return false;
                var itemsTxt = (Array.isArray(o.parsed_items) ? o.parsed_items.map(function (i) { return i.name || ''; }).join(' ') : '');
                return matchQuery(o.order_number + ' ' + o.customer_name + ' ' + o.customer_phone + ' ' + o.city + ' ' + o.tracking_number + ' ' + itemsTxt + ' ' + (o.terminal_id || ''));
            });

            var body = document.getElementById('onlineTableBody');
            body.innerHTML = filtered.length ? filtered.map(function (o) {
                var ch = String(o.channel || 'WHATSAPP').toUpperCase();
                var isWa = ch.indexOf('WHATSAPP') !== -1 || ch === 'WA';
                var items = Array.isArray(o.parsed_items) ? o.parsed_items : [];
                var itemsHtml = items.length ? items.map(function (it) {
                    var qty = Number(it.quantity || 1);
                    var nm = it.name || it.product_name || 'Item';
                    var rq = Number(it.returned_quantity || 0);
                    return '<span class="item-chip">' + esc(nm) + ' x' + qty + (rq > 0 ? ' (Ret ' + rq + ')' : '') + '</span>';
                }).join('') : '<span style="color:var(--dim)">—</span>';

                var ps = String(o.payment_status || '');
                var ds = String(o.delivery_status || '');
                var psCls = ps === 'PAID' ? 'b-pos' : (ps === 'RETURNED' ? 'b-bad' : 'b-warn');
                var dsCls = ds === 'DELIVERED' ? 'b-pos' : (ds.indexOf('RETURN') !== -1 || ds === 'CANCELLED' ? 'b-bad' : 'b-mut');

                return '<tr>'
                    + '<td><strong>' + esc(o.order_number) + '</strong><div style="font-size:11px;color:var(--dim)">' + esc(fmtTs(o.created_at)) + '</div></td>'
                    + '<td><span class="badge ' + (isWa ? 'b-wa' : 'b-web') + '">' + (isWa ? 'WHATSAPP' : 'WEBSITE') + '</span>'
                    + '<div style="margin-top:4px"><span class="badge b-gold">' + esc(o.terminal_id || 'POS-01') + '</span></div></td>'
                    + '<td><strong>' + esc(o.customer_name || 'Walk-In Online') + '</strong><div style="font-size:11px;color:var(--muted)">' + esc(o.customer_phone) + ' • ' + esc(o.city || 'PK') + '</div></td>'
                    + '<td style="max-width:290px;">' + itemsHtml + '</td>'
                    + '<td>' + esc(o.courier_partner || '—') + '<div style="font-size:11px;color:var(--dim)">' + esc(o.tracking_number || o.payment_custodian || 'No tracking') + '</div></td>'
                    + '<td class="num">' + esc(pkr(o.total_amount_paisa)) + (Number(o.discount_paisa || 0) > 0 ? '<div style="font-size:10.5px;color:#fb7185">Disc ' + esc(pkr(o.discount_paisa)) + '</div>' : '') + '</td>'
                    + '<td class="num" style="color:#34d399">' + esc(pkr(o.advance_paid_paisa)) + '</td>'
                    + '<td class="num" style="color:#fbbf24">' + esc(pkr(o.cod_balance_paisa)) + '</td>'
                    + '<td><span class="badge ' + psCls + '">' + esc(ps) + '</span> <span class="badge ' + dsCls + '" style="margin-top:3px">' + esc(ds) + '</span></td>'
                    + '</tr>';
            }).join('') : '<tr><td colspan="9" class="empty">No online orders match the current filter.</td></tr>';
        }

        function renderRetail(snap) {
            var sales = Array.isArray(snap.recentSales) ? snap.recentSales : [];
            var k = snap.kpis || {};
            document.getElementById('cntRetail').textContent = String(sales.length);
            document.getElementById('retailSummaryText').textContent =
                'Invoices: ' + Number(k.retailInvoicesCount || 0) + ' • Units: ' + Number(k.retailUnits || 0) + ' • Net After Returns: ' + pkr(k.retailNetPaisa);

            var filtered = sales.filter(function (s) {
                return matchQuery(s.invoice_number + ' ' + s.customer_phone + ' ' + s.items_summary + ' ' + s.payment_method + ' ' + s.terminal_id + ' ' + (s.salesperson_name || ''));
            });
            document.getElementById('retailTableBody').innerHTML = filtered.length ? filtered.map(function (s) {
                var disc = Number(s.item_discount_paisa || 0) + Number(s.special_discount_paisa || 0);
                return '<tr>'
                    + '<td><strong>' + esc(s.invoice_number) + '</strong><div style="font-size:10.5px;color:var(--dim)">' + esc(s.order_source || 'WALK_IN') + '</div></td>'
                    + '<td><span class="badge b-gold">' + esc(s.terminal_id) + '</span><div style="font-size:11px;color:var(--dim);margin-top:3px">' + esc(fmtTs(s.invoice_date)) + '</div></td>'
                    + '<td>' + esc(s.customer_phone || 'Walk-in') + '</td>'
                    + '<td style="max-width:260px">' + esc(s.items_summary || '—') + '</td>'
                    + '<td>' + esc(s.salesperson_name || 'Staff') + '<div style="font-size:11px;color:var(--sky)">' + esc(s.payment_method) + '</div></td>'
                    + '<td class="num">' + esc(s.total_units || 1) + '</td>'
                    + '<td class="num">' + esc(pkr(s.gross_total_paisa)) + '</td>'
                    + '<td class="num" style="color:#fb7185">' + (disc > 0 ? '-' + esc(pkr(disc)) : 'Rs. 0') + '</td>'
                    + '<td class="num" style="color:#34d399">' + esc(pkr(s.net_payable_paisa)) + '</td>'
                    + '</tr>';
            }).join('') : '<tr><td colspan="9" class="empty">No retail POS sales match filter.</td></tr>';
        }

        function renderWholesale(snap) {
            var parties = Array.isArray(snap.wholesaleParties) ? snap.wholesaleParties : [];
            var invs = Array.isArray(snap.wholesaleInvoices) ? snap.wholesaleInvoices : [];
            var k = snap.kpis || {};
            document.getElementById('cntWholesale').textContent = String(invs.length);
            document.getElementById('wsTotalUdarBadge').textContent = 'Total Udar: ' + pkr(k.wholesaleTotalLedgerUdarPaisa);

            var fParties = parties.filter(function (p) {
                return matchQuery(p.business_name + ' ' + p.contact_person + ' ' + p.phone + ' ' + p.city);
            });
            document.getElementById('wsPartiesBody').innerHTML = fParties.length ? fParties.map(function (p) {
                return '<tr>'
                    + '<td><strong>' + esc(p.business_name) + '</strong><div style="font-size:11px;color:var(--dim)">' + esc(p.contact_person || '') + '</div></td>'
                    + '<td>' + esc(p.phone || '—') + '<div style="font-size:11px;color:var(--dim)">' + esc(p.city || '') + '</div></td>'
                    + '<td class="num" style="color:' + (Number(p.current_balance_paisa || 0) > 0 ? '#fbbf24' : '#34d399') + '">' + esc(pkr(p.current_balance_paisa)) + '</td>'
                    + '<td class="num">' + esc(pkr(p.credit_limit_paisa)) + '</td>'
                    + '</tr>';
            }).join('') : '<tr><td colspan="4" class="empty">No wholesale parties synced.</td></tr>';

            var fInvs = invs.filter(function (w) {
                return matchQuery(w.invoice_number + ' ' + w.customer_name + ' ' + (w.terminal_id || ''));
            });
            document.getElementById('wsInvoicesBody').innerHTML = fInvs.length ? fInvs.map(function (w) {
                return '<tr>'
                    + '<td><strong>' + esc(w.invoice_number) + '</strong><div style="font-size:11px;color:var(--muted)">' + esc(w.customer_name) + '</div></td>'
                    + '<td><span class="badge b-gold">' + esc(w.terminal_id || 'POS-01') + '</span><div style="font-size:11px;color:var(--dim);margin-top:3px">' + esc(fmtTs(w.invoice_date)) + '</div></td>'
                    + '<td class="num">' + esc(pkr(w.subtotal_paisa)) + '<div style="font-size:10.5px;color:#fb7185">Disc ' + esc(pkr(w.discount_paisa)) + '</div></td>'
                    + '<td class="num">' + esc(pkr(w.net_total_paisa)) + '<div style="font-size:10.5px;color:#34d399">Paid ' + esc(pkr(w.amount_paid_paisa)) + '</div></td>'
                    + '<td class="num" style="color:' + (Number(w.balance_due_paisa || 0) > 0 ? '#fbbf24' : '#34d399') + '">' + esc(pkr(w.balance_due_paisa)) + '</td>'
                    + '</tr>';
            }).join('') : '<tr><td colspan="5" class="empty">No wholesale invoices in selected period.</td></tr>';
        }

        function renderInventory(snap) {
            var prods = Array.isArray(snap.products) ? snap.products : [];
            var attars = Array.isArray(snap.attars) ? snap.attars : [];
            var k = snap.kpis || {};
            document.getElementById('cntInventory').textContent = String(prods.length + attars.length);
            document.getElementById('invValSummary').textContent =
                Number(k.totalBottlesStock || 0).toLocaleString('en-US') + ' bottles • Cost Valuation: ' + pkr(k.fgCostValPaisa) + ' • Retail Valuation: ' + pkr(k.fgRetailValPaisa);

            var showAttars = state.invFilter === 'ATTARS';
            document.getElementById('invPerfumesPanel').classList.toggle('hidden', showAttars);
            document.getElementById('invAttarsPanel').classList.toggle('hidden', !showAttars);

            var fProds = prods.filter(function (p) {
                var stk = Number(p.current_stock_units || 0);
                var thr = Number(p.reorder_threshold_units || 5);
                if (state.invFilter === 'LOW_STOCK' && stk > thr) return false;
                return matchQuery(p.sku + ' ' + p.name + ' ' + (p.brand || '') + ' ' + (p.category || ''));
            });
            document.getElementById('perfumesBody').innerHTML = fProds.length ? fProds.map(function (p) {
                var stk = Number(p.current_stock_units || 0);
                var thr = Number(p.reorder_threshold_units || 5);
                var sCls = stk <= 0 ? 'b-bad' : (stk <= thr ? 'b-warn' : 'b-pos');
                var retVal = stk * Number(p.retail_price_paisa || 0);
                return '<tr>'
                    + '<td><code>' + esc(p.sku) + '</code></td>'
                    + '<td><strong>' + esc(p.name) + '</strong><div style="font-size:11px;color:var(--dim)">' + esc(p.brand || 'Ameer Signature') + '</div></td>'
                    + '<td>' + esc(p.size_ml) + ' ml • ' + esc(p.category) + '</td>'
                    + '<td class="num"><span class="badge ' + sCls + '">' + stk + ' units</span></td>'
                    + '<td class="num">' + esc(pkr(p.latest_batch_cost_paisa)) + '</td>'
                    + '<td class="num" style="color:#fde68a">' + esc(pkr(p.retail_price_paisa)) + '</td>'
                    + '<td class="num" style="color:#34d399">' + esc(pkr(retVal)) + '</td>'
                    + '</tr>';
            }).join('') : '<tr><td colspan="7" class="empty">No matching finished perfumes.</td></tr>';

            var fAttars = attars.filter(function (a) {
                return matchQuery(a.sku + ' ' + a.name + ' ' + (a.origin_country || ''));
            });
            document.getElementById('attarsBody').innerHTML = fAttars.length ? fAttars.map(function (a) {
                return '<tr>'
                    + '<td><code>' + esc(a.sku) + '</code></td>'
                    + '<td><strong>' + esc(a.name) + '</strong></td>'
                    + '<td>' + esc(a.origin_country || '—') + '</td>'
                    + '<td class="num">' + esc(pkr(a.cost_per_tola_paisa)) + '</td>'
                    + '<td class="num" style="color:#fde68a">' + esc(pkr(a.selling_price_per_tola_paisa)) + '</td>'
                    + '<td class="num" style="color:#c4b5fd">' + esc(pkr(a.wholesale_price_per_tola_paisa)) + '</td>'
                    + '</tr>';
            }).join('') : '<tr><td colspan="6" class="empty">No attar items synced yet.</td></tr>';
        }

        function renderFinance(snap) {
            var rets = Array.isArray(snap.returns) ? snap.returns : [];
            var exps = Array.isArray(snap.expenses) ? snap.expenses : [];
            var sals = Array.isArray(snap.salaries) ? snap.salaries : [];
            document.getElementById('cntFinance').textContent = String(rets.length + exps.length + sals.length);

            document.getElementById('returnsBody').innerHTML = rets.filter(function (r) {
                return matchQuery(r.return_voucher_number + ' ' + r.return_type + ' ' + r.condition_status + ' ' + (r.terminal_id || ''));
            }).length ? rets.filter(function (r) {
                return matchQuery(r.return_voucher_number + ' ' + r.return_type + ' ' + r.condition_status + ' ' + (r.terminal_id || ''));
            }).map(function (r) {
                return '<tr>'
                    + '<td><strong>' + esc(r.return_voucher_number) + '</strong></td>'
                    + '<td><span class="badge b-bad">' + esc(r.return_type) + '</span> <span class="badge b-mut">' + esc(r.condition_status) + '</span></td>'
                    + '<td><span class="badge b-gold">' + esc(r.terminal_id || 'POS-01') + '</span> <span style="font-size:11px;color:var(--dim)">' + esc(fmtTs(r.return_date)) + '</span></td>'
                    + '<td>' + esc(r.refund_settlement_method) + '</td>'
                    + '<td class="num" style="color:#fb7185">-' + esc(pkr(r.total_refund_amount_paisa)) + '</td>'
                    + '</tr>';
            }).join('') : '<tr><td colspan="5" class="empty">No return vouchers in period.</td></tr>';

            var fExps = exps.filter(function (e) {
                return matchQuery(e.category + ' ' + (e.recipient_payee || '') + ' ' + (e.description || '') + ' ' + (e.terminal_id || ''));
            });
            document.getElementById('expensesBody').innerHTML = fExps.length ? fExps.map(function (e) {
                return '<tr>'
                    + '<td><strong>' + esc(e.category) + '</strong><div style="font-size:11px;color:var(--dim)">' + esc(e.recipient_payee || '—') + '</div></td>'
                    + '<td><span class="badge b-gold">' + esc(e.terminal_id || 'POS-01') + '</span><div style="font-size:11px;color:var(--dim);margin-top:3px">' + esc(fmtTs(e.expense_date)) + '</div></td>'
                    + '<td>' + esc(e.description || '—') + '</td>'
                    + '<td class="num" style="color:#fb7185">-' + esc(pkr(e.amount_paisa)) + '</td>'
                    + '</tr>';
            }).join('') : '<tr><td colspan="4" class="empty">No petty expenses in period.</td></tr>';

            var fSals = sals.filter(function (s) {
                return matchQuery(s.employee_name + ' ' + (s.employee_role || '') + ' ' + s.payout_type + ' ' + (s.terminal_id || ''));
            });
            document.getElementById('salariesBody').innerHTML = fSals.length ? fSals.map(function (s) {
                return '<tr>'
                    + '<td><strong>' + esc(s.employee_name) + '</strong><div style="font-size:11px;color:var(--dim)">' + esc(s.employee_role || '') + '</div></td>'
                    + '<td><span class="badge b-ws">' + esc(s.payout_type) + '</span> <span style="font-size:11px;color:var(--sky)">' + esc(s.payment_method) + '</span></td>'
                    + '<td><span class="badge b-gold">' + esc(s.terminal_id || 'POS-01') + '</span><div style="font-size:11px;color:var(--dim);margin-top:3px">' + esc(fmtTs(s.payout_date)) + '</div></td>'
                    + '<td class="num" style="color:#fb7185">-' + esc(pkr(s.amount_paisa)) + '</td>'
                    + '</tr>';
            }).join('') : '<tr><td colspan="4" class="empty">No salary payouts in period.</td></tr>';
        }

        function renderVault(snap) {
            var shifts = Array.isArray(snap.shifts) ? snap.shifts : [];
            var backups = Array.isArray(snap.backups) ? snap.backups : [];

            document.getElementById('shiftsBody').innerHTML = shifts.length ? shifts.map(function (sh) {
                var st = String(sh.shift_status || 'CLOSED');
                return '<tr>'
                    + '<td><span class="badge b-gold">' + esc(sh.terminal_id) + '</span></td>'
                    + '<td><div>' + esc(fmtTs(sh.opened_at)) + '</div><div style="font-size:11px;color:var(--dim)">' + esc(fmtTs(sh.closed_at)) + '</div></td>'
                    + '<td><span class="badge ' + (st === 'OPEN' ? 'b-pos' : 'b-mut') + '">' + esc(st) + '</span></td>'
                    + '<td class="num">' + esc(pkr(sh.opening_cash_float_paisa)) + '</td>'
                    + '<td class="num" style="color:#fde68a">' + esc(pkr(sh.system_expected_cash_paisa)) + '</td>'
                    + '<td class="num">' + (sh.actual_counted_cash_paisa != null ? esc(pkr(sh.actual_counted_cash_paisa)) : '—') + '</td>'
                    + '</tr>';
            }).join('') : '<tr><td colspan="6" class="empty">No cash shifts synced yet.</td></tr>';

            document.getElementById('backupsBody').innerHTML = backups.length ? backups.map(function (bk) {
                return '<tr>'
                    + '<td><strong>' + esc(bk.filename) + '</strong><div style="font-size:10.5px;color:var(--dim);font-family:monospace">' + esc(String(bk.sha256_checksum || '').slice(0, 18)) + '...</div></td>'
                    + '<td><span class="badge b-gold">' + esc(bk.terminal_id) + '</span><div style="font-size:11px;color:var(--dim);margin-top:3px">' + esc(fmtTs(bk.created_at)) + '</div></td>'
                    + '<td class="num">' + esc(fmtBytes(bk.file_size_bytes)) + '</td>'
                    + '<td><a class="btn-dl" href="index.php?action=download_backup&amp;id=' + encodeURIComponent(bk.backup_id) + '">Download .db</a></td>'
                    + '</tr>';
            }).join('') : '<tr><td colspan="4" class="empty">No hot SQLite backups uploaded yet.</td></tr>';
        }

        function renderAll(snap) {
            state.snap = snap;
            setPeriodAndBranchControls(snap);
            renderBranches(snap);
            renderKpis(snap);
            renderOverview(snap);
            renderOnlineOrders(snap);
            renderRetail(snap);
            renderWholesale(snap);
            renderInventory(snap);
            renderFinance(snap);
            renderVault(snap);
        }

        function handleIncomingSnapshot(nextSnap, fromLiveUpdate) {
            if (!nextSnap) return;
            var newCursor = Number(nextSnap.syncCursor || 0);
            var feed0 = Array.isArray(nextSnap.liveFeed) && nextSnap.liveFeed.length ? nextSnap.liveFeed[0] : null;
            var newTopKey = feed0 ? (String(feed0.ts || '') + '|' + String(feed0.title || '')) : '';

            if (fromLiveUpdate && newCursor > state.prevCursor && feed0 && newTopKey !== state.prevFeedTopTs) {
                state.freshHighlightUntil = Date.now() + 4000;
                showToast(
                    (feed0.terminal || 'POS') + ' • ' + (feed0.badge || 'LIVE UPDATE'),
                    feed0.title + ' (' + pkr(feed0.amount_paisa) + ')'
                );
                playChime();
            }
            state.prevCursor = newCursor;
            state.prevFeedTopTs = newTopKey;
            renderAll(nextSnap);
        }

        function fetchFullSnapshot(fromLiveUpdate) {
            var url = 'index.php?action=live_data&period=' + encodeURIComponent(state.period) + '&branch=' + encodeURIComponent(state.branch);
            fetch(url, { credentials: 'same-origin' })
                .then(function (res) {
                    if (res.status === 401) { window.location.reload(); return null; }
                    return res.json();
                })
                .then(function (data) {
                    if (data && data.ok && data.snapshot) {
                        handleIncomingSnapshot(data.snapshot, !!fromLiveUpdate);
                    }
                })
                .catch(function () {});
        }

        function connectLiveStream() {
            if (state.reconnectTimer) {
                clearTimeout(state.reconnectTimer);
                state.reconnectTimer = null;
            }
            if (state.eventSource) {
                try { state.eventSource.close(); } catch (e) {}
                state.eventSource = null;
            }
            if (typeof window.EventSource !== 'function') {
                setConnectionStatus('polling', 'LIVE POLLING (2.5s)');
                return;
            }
            var streamUrl = 'index.php?action=live_stream&period=' + encodeURIComponent(state.period) + '&branch=' + encodeURIComponent(state.branch);
            var es = new EventSource(streamUrl);
            state.eventSource = es;

            es.onopen = function () {
                setConnectionStatus('', 'LIVE STREAMING');
            };
            es.addEventListener('snapshot', function (ev) {
                setConnectionStatus('', 'LIVE STREAMING');
                try {
                    var snap = JSON.parse(ev.data);
                    var isLiveChange = state.snap && snap.stateSignature !== state.snap.stateSignature;
                    handleIncomingSnapshot(snap, !!isLiveChange);
                } catch (e) {}
            });
            es.addEventListener('auth_required', function () {
                es.close();
                window.location.reload();
            });
            es.addEventListener('reconnect', function () {
                try { es.close(); } catch (e) {}
                state.reconnectTimer = setTimeout(connectLiveStream, 250);
            });
            es.onerror = function () {
                try { es.close(); } catch (e) {}
                setConnectionStatus('polling', 'RECONNECTING...');
                state.reconnectTimer = setTimeout(connectLiveStream, 2200);
            };
        }

        function startCursorSafetyPoll() {
            if (state.cursorTimer) clearInterval(state.cursorTimer);
            state.cursorTimer = setInterval(function () {
                fetch('index.php?action=live_cursor', { credentials: 'same-origin' })
                    .then(function (res) {
                        if (res.status === 401) { window.location.reload(); return null; }
                        return res.json();
                    })
                    .then(function (cur) {
                        if (!cur || !cur.ok) return;
                        if (!state.snap || cur.signature !== state.snap.stateSignature) {
                            fetchFullSnapshot(true);
                        }
                    })
                    .catch(function () {});
            }, 2500);
        }

        // Event Bindings
        document.getElementById('mainTabs').addEventListener('click', function (ev) {
            var btn = ev.target.closest('.tab-btn');
            if (!btn) return;
            state.activeTab = btn.getAttribute('data-tab');
            document.querySelectorAll('#mainTabs .tab-btn').forEach(function (b) {
                b.classList.toggle('active', b === btn);
            });
            document.querySelectorAll('.tab-view').forEach(function (v) {
                v.classList.toggle('hidden', v.id !== 'tab-' + state.activeTab);
            });
        });

        document.getElementById('onlineSubPills').addEventListener('click', function (ev) {
            var pill = ev.target.closest('.pill');
            if (!pill) return;
            state.onlineFilter = pill.getAttribute('data-filter');
            document.querySelectorAll('#onlineSubPills .pill').forEach(function (p) {
                p.classList.toggle('active', p === pill);
            });
            renderOnlineOrders(state.snap);
        });

        document.getElementById('invSubPills').addEventListener('click', function (ev) {
            var pill = ev.target.closest('.pill');
            if (!pill) return;
            state.invFilter = pill.getAttribute('data-filter');
            document.querySelectorAll('#invSubPills .pill').forEach(function (p) {
                p.classList.toggle('active', p === pill);
            });
            renderInventory(state.snap);
        });

        document.getElementById('branchesStrip').addEventListener('click', function (ev) {
            var card = ev.target.closest('.branch-card');
            if (!card) return;
            var tid = card.getAttribute('data-branch');
            state.branch = (state.branch === tid) ? 'ALL' : tid;
            fetchFullSnapshot(false);
            connectLiveStream();
        });

        document.getElementById('clearBranchBtn').addEventListener('click', function () {
            state.branch = 'ALL';
            fetchFullSnapshot(false);
            connectLiveStream();
        });

        document.getElementById('periodSelect').addEventListener('change', function (ev) {
            state.period = ev.target.value || 'today';
            fetchFullSnapshot(false);
            connectLiveStream();
        });

        document.getElementById('branchSelect').addEventListener('change', function (ev) {
            state.branch = ev.target.value || 'ALL';
            fetchFullSnapshot(false);
            connectLiveStream();
        });

        document.getElementById('globalSearch').addEventListener('input', function (ev) {
            state.search = String(ev.target.value || '').trim().toLowerCase();
            renderOverview(state.snap);
            renderOnlineOrders(state.snap);
            renderRetail(state.snap);
            renderWholesale(state.snap);
            renderInventory(state.snap);
            renderFinance(state.snap);
        });

        document.getElementById('soundBtn').addEventListener('click', function (ev) {
            state.soundOn = !state.soundOn;
            ev.target.textContent = state.soundOn ? 'Sound: On' : 'Sound: Off';
            ev.target.classList.toggle('active', state.soundOn);
            if (state.soundOn) playChime();
        });

        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) {
                fetchFullSnapshot(true);
                connectLiveStream();
            }
        });

        // Initial render + Zero-Refresh SSE + 2.5s fallback cursor watcher
        renderAll(state.snap);
        connectLiveStream();
        startCursorSafetyPoll();
    })();
    </script>
</body>
</html>
