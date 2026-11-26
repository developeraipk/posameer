<?php
declare(strict_types=1);

/**
 * Shared PDO database, security, and timezone helpers for Hostinger Cloud API & Web Dashboard.
 */

function ameer_load_config(): array
{
    $cfgPath = __DIR__ . '/config.php';
    if (!file_exists($cfgPath)) {
        return ['__missing_config' => true];
    }
    $cfg = require $cfgPath;
    if (!is_array($cfg)) {
        return ['__missing_config' => true];
    }
    date_default_timezone_set($cfg['timezone'] ?? 'Asia/Karachi');
    return $cfg;
}

function ameer_get_pdo(array $cfg): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $host = $cfg['db_host'] ?? '127.0.0.1';
    $port = (int)($cfg['db_port'] ?? 3306);
    $db   = $cfg['db_name'] ?? '';
    $user = $cfg['db_user'] ?? '';
    $pass = $cfg['db_pass'] ?? '';

    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $host, $port, $db);
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $pdo->exec("SET time_zone = '+05:00'");
    return $pdo;
}

function ameer_ensure_default_web_owner(PDO $pdo, array $cfg): void
{
    $count = (int)$pdo->query("SELECT COUNT(*) FROM cloud_web_users WHERE is_active = 1")->fetchColumn();
    if ($count === 0) {
        $username = trim((string)($cfg['default_owner_username'] ?? 'owner'));
        $password = (string)($cfg['default_owner_password'] ?? 'AmeerOwner@2026');
        $fullName = trim((string)($cfg['default_owner_name'] ?? 'Ameer Perfumes Owner'));
        $hash = password_hash($password, PASSWORD_DEFAULT);

        $stmt = $pdo->prepare(
            "INSERT IGNORE INTO cloud_web_users (user_id, username, password_hash, full_name, role, is_active)
             VALUES ('web_owner_1', ?, ?, ?, 'OWNER', 1)"
        );
        $stmt->execute([$username, $hash, $fullName]);
    }
}

function ameer_extract_bearer_token(): string
{
    $auth = $_SERVER['HTTP_AUTHORIZATION']
        ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
        ?? $_SERVER['HTTP_X_AMEER_CLOUD_TOKEN']
        ?? '';

    if ($auth === '' && function_exists('getallheaders')) {
        $headers = getallheaders();
        foreach ($headers as $k => $v) {
            $lk = strtolower((string)$k);
            if ($lk === 'authorization' || $lk === 'x-ameer-cloud-token') {
                $auth = (string)$v;
                break;
            }
        }
    }

    if (stripos($auth, 'Bearer ') === 0) {
        return trim(substr($auth, 7));
    }
    return trim($auth);
}

function ameer_json_response(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function ameer_pkr(int $paisa): string
{
    $sign = $paisa < 0 ? '-' : '';
    $abs = abs($paisa);
    return $sign . 'Rs. ' . number_format($abs / 100, 0, '.', ',');
}

function ameer_period_where(string $col, string $period): string
{
    // Normalize ISO8601 / 'YYYY-MM-DD HH:MM:SS' strings in PKT (+05:00) using SQL date prefix or converted UTC timestamp
    $dateExpr = "DATE(CASE
        WHEN {$col} LIKE '%T%Z' OR {$col} LIKE '%+00:00%' THEN CONVERT_TZ(STR_TO_DATE(SUBSTR(REPLACE({$col}, 'T', ' '), 1, 19), '%Y-%m-%d %H:%i:%s'), '+00:00', '+05:00')
        ELSE SUBSTR(REPLACE({$col}, 'T', ' '), 1, 19)
    END)";

    switch ($period) {
        case 'weekly':
            return "{$dateExpr} >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)";
        case 'monthly':
            return "DATE_FORMAT({$dateExpr}, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')";
        case 'yearly':
            return "YEAR({$dateExpr}) = YEAR(CURDATE())";
        case 'all':
            return "1=1";
        case 'today':
        default:
            return "{$dateExpr} = CURDATE()";
    }
}

