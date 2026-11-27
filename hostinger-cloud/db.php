<?php
declare(strict_types=1);

/**
 * Shared PDO database, security, schema upgrade, and live telemetry helpers
 * for Ameer Perfumes Hostinger Cloud API & Web Dashboard.
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

function ameer_ensure_cloud_schema_upgrades(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $done = true;

    try {
        $cols = [];
        $res = $pdo->query(
            "SELECT TABLE_NAME, COLUMN_NAME
             FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()"
        );
        if ($res) {
            foreach ($res->fetchAll() as $r) {
                $cols[$r['TABLE_NAME'] . '.' . $r['COLUMN_NAME']] = true;
            }
        }
        if (empty($cols)) {
            return;
        }

        $alters = [
            'cloud_terminal_nodes.branch_name' => "ALTER TABLE cloud_terminal_nodes ADD COLUMN branch_name VARCHAR(160) NOT NULL DEFAULT '' AFTER terminal_id",
            'cloud_sales_invoices.salesperson_name' => "ALTER TABLE cloud_sales_invoices ADD COLUMN salesperson_name VARCHAR(128) NOT NULL DEFAULT '' AFTER items_summary",
            'cloud_online_orders.terminal_id' => "ALTER TABLE cloud_online_orders ADD COLUMN terminal_id VARCHAR(32) NOT NULL DEFAULT 'POS-01' AFTER deduction_amount_paisa",
            'cloud_online_orders.collected_at' => "ALTER TABLE cloud_online_orders ADD COLUMN collected_at VARCHAR(64) NULL AFTER terminal_id",
            'cloud_online_orders.collection_method' => "ALTER TABLE cloud_online_orders ADD COLUMN collection_method VARCHAR(64) NULL AFTER collected_at",
            'cloud_online_orders.return_reason' => "ALTER TABLE cloud_online_orders ADD COLUMN return_reason TEXT NULL AFTER collection_method",
            'cloud_online_orders.notes' => "ALTER TABLE cloud_online_orders ADD COLUMN notes TEXT NULL AFTER return_reason",
            'cloud_wholesale_invoices.terminal_id' => "ALTER TABLE cloud_wholesale_invoices ADD COLUMN terminal_id VARCHAR(32) NOT NULL DEFAULT 'POS-01' AFTER invoice_date",
            'cloud_petty_expenses.terminal_id' => "ALTER TABLE cloud_petty_expenses ADD COLUMN terminal_id VARCHAR(32) NOT NULL DEFAULT 'POS-01' AFTER authorized_by_name",
            'cloud_employee_salaries.terminal_id' => "ALTER TABLE cloud_employee_salaries ADD COLUMN terminal_id VARCHAR(32) NOT NULL DEFAULT 'POS-01' AFTER notes",
        ];

        foreach ($alters as $key => $sql) {
            if (!isset($cols[$key])) {
                try {
                    $pdo->exec($sql);
                } catch (Throwable $ignored) {
                }
            }
        }
    } catch (Throwable $ignored) {
    }
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
    // Normalize ISO8601 UTC / offset strings or local timestamps cleanly into PKT (+05:00)
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

function ameer_calc_online_realized_paisa(array $o): int
{
    $ds = strtoupper((string)($o['delivery_status'] ?? ''));
    $ps = strtoupper((string)($o['payment_status'] ?? ''));
    if ($ds === 'CANCELLED') {
        return 0;
    }
    $adv = max(0, (int)($o['advance_paid_paisa'] ?? 0));
    $ref = max(0, (int)($o['refund_amount_paisa'] ?? 0));
    $tot = max(0, (int)($o['total_amount_paisa'] ?? 0));
    if (($ps === 'RETURNED' || $ds === 'RETURNED_RTO' || $ds === 'RETURNED') && $ds !== 'PARTIAL_RETURN') {
        return max(0, $adv - $ref);
    }
    if ($ds === 'PARTIAL_RETURN') {
        return max(0, min($tot, $adv - $ref));
    }
    return max(0, $adv - $ref);
}

function ameer_calc_online_pending_cod_paisa(array $o): int
{
    $ds = strtoupper((string)($o['delivery_status'] ?? ''));
    $ps = strtoupper((string)($o['payment_status'] ?? ''));
    if (in_array($ds, ['CANCELLED', 'RETURNED_RTO', 'RETURNED'], true) || in_array($ps, ['RETURNED', 'PAID'], true)) {
        return 0;
    }
    return max(0, (int)($o['cod_balance_paisa'] ?? 0));
}

function ameer_calc_online_return_paisa(array $o): int
{
    $ds = strtoupper((string)($o['delivery_status'] ?? ''));
    $ps = strtoupper((string)($o['payment_status'] ?? ''));
    $ref = max(0, (int)($o['refund_amount_paisa'] ?? 0));
    if ($ref > 0) {
        return $ref;
    }
    $isRet = ($ps === 'RETURNED' || $ds === 'RETURNED_RTO' || $ds === 'RETURNED' || $ds === 'PARTIAL_RETURN');
    if (!$isRet) {
        return 0;
    }
    $ded = max(0, (int)($o['deduction_amount_paisa'] ?? 0));
    if ($ds !== 'PARTIAL_RETURN') {
        $tot = max(0, (int)($o['total_amount_paisa'] ?? 0));
        return max(0, $tot - $ded);
    }
    $items = json_decode((string)($o['items_json'] ?? '[]'), true);
    if (!is_array($items)) {
        return 0;
    }
    $retSum = 0;
    foreach ($items as $it) {
        if (!is_array($it)) {
            continue;
        }
        $rq = (int)($it['returned_quantity'] ?? 0);
        if ($rq > 0 || strtoupper((string)($it['return_status'] ?? '')) === 'RETURNED') {
            $q = max(1, (int)($it['quantity'] ?? 1));
            $unitP = (int)($it['unit_price_paisa'] ?? ((int)($it['line_total_paisa'] ?? 0) / $q));
            $disc = (int)($it['discount_paisa'] ?? 0);
            $effectiveNet = max(0, ($unitP * $q) - $disc);
            $effUnits = $rq > 0 ? min($rq, $q) : $q;
            $retSum += (int)round($effectiveNet * ($effUnits / $q));
        }
    }
    return max(0, $retSum - $ded);
}

function ameer_calc_online_gross_paisa(array $o): int
{
    $items = json_decode((string)($o['items_json'] ?? '[]'), true);
    $deliv = max(0, (int)($o['delivery_charges_paisa'] ?? 0));
    if (is_array($items) && count($items) > 0) {
        $sum = 0;
        foreach ($items as $it) {
            if (!is_array($it)) {
                continue;
            }
            $q = max(1, (int)($it['quantity'] ?? 1));
            $up = (int)($it['unit_price_paisa'] ?? 0);
            $lt = (int)($it['line_total_paisa'] ?? 0);
            $sum += ($up > 0 ? $up * $q : $lt);
        }
        if ($sum > 0) {
            return $sum + $deliv;
        }
    }
    return max(
        0,
        (int)($o['subtotal_paisa'] ?? 0)
            + $deliv
            + (int)($o['refund_amount_paisa'] ?? 0)
            + (int)($o['deduction_amount_paisa'] ?? 0)
    );
}

function ameer_get_live_cursor(PDO $pdo): array
{
    $row = $pdo->query(
        "SELECT COALESCE(MAX(id), 0) AS max_id, COUNT(*) AS cnt FROM cloud_sync_events"
    )->fetch() ?: ['max_id' => 0, 'cnt' => 0];
    $hb = (string)($pdo->query("SELECT COALESCE(MAX(last_heartbeat_at), '') FROM cloud_terminal_nodes")->fetchColumn() ?: '');
    $bk = (int)$pdo->query("SELECT COUNT(*) FROM cloud_backups")->fetchColumn();
    $cursor = (int)$row['max_id'];
    $count = (int)$row['cnt'];
    return [
        'cursor' => $cursor,
        'eventsCount' => $count,
        'backupsCount' => $bk,
        'signature' => "{$cursor}:{$count}:{$bk}:{$hb}",
    ];
}

function ameer_build_live_dashboard_snapshot(PDO $pdo, string $period = 'today', string $branch = 'ALL'): array
{
    $period = strtolower(trim($period));
    if (!in_array($period, ['today', 'weekly', 'monthly', 'yearly', 'all'], true)) {
        $period = 'today';
    }
    $branch = trim($branch);
    $hasBranchFilter = ($branch !== '' && strtoupper($branch) !== 'ALL');

    $branchParamsSales = [];
    $branchSqlSales = '';
    if ($hasBranchFilter) {
        $branchSqlSales = ' AND terminal_id = ?';
        $branchParamsSales[] = $branch;
    }

    $wSales = ameer_period_where('invoice_date', $period);
    $wRet   = ameer_period_where('return_date', $period);
    $wOnl   = ameer_period_where('created_at', $period);
    $wOnlCol = $period === 'all'
        ? '1=1'
        : '(' . ameer_period_where('COALESCE(NULLIF(collected_at, \'\'), created_at)', $period) . ')';
    $wWs    = ameer_period_where('invoice_date', $period);
    $wExp   = ameer_period_where('expense_date', $period);
    $wSal   = ameer_period_where('payout_date', $period);
    $wShift = ameer_period_where('opened_at', $period);

    // 1. Retail POS Aggregate
    $stmt = $pdo->prepare(
        "SELECT
            COALESCE(SUM(gross_total_paisa), 0) AS gross_sales_paisa,
            COALESCE(SUM(item_discount_paisa + special_discount_paisa), 0) AS discounts_paisa,
            COALESCE(SUM(CASE WHEN (item_discount_paisa + special_discount_paisa) > 0 THEN 1 ELSE 0 END), 0) AS discount_count,
            COALESCE(SUM(net_payable_paisa), 0) AS net_collected_paisa,
            COALESCE(SUM(total_cost_paisa), 0) AS cogs_paisa,
            COALESCE(SUM(perfume_sales_paisa), 0) AS perfume_sales_paisa,
            COALESCE(SUM(attar_sales_paisa), 0) AS attar_sales_paisa,
            COALESCE(SUM(tester_sales_paisa), 0) AS tester_sales_paisa,
            COALESCE(SUM(total_units), 0) AS total_units,
            COUNT(*) AS invoice_count
         FROM cloud_sales_invoices
         WHERE is_voided = 0 AND {$wSales}{$branchSqlSales}"
    );
    $stmt->execute($branchParamsSales);
    $salesAgg = $stmt->fetch() ?: [];

    $stmt = $pdo->prepare(
        "SELECT COALESCE(SUM(total_refund_amount_paisa), 0) AS amt, COUNT(*) AS cnt
         FROM cloud_return_vouchers
         WHERE {$wRet}{$branchSqlSales}"
    );
    $stmt->execute($branchParamsSales);
    $retAgg = $stmt->fetch() ?: ['amt' => 0, 'cnt' => 0];

    $retailGrossPaisa = (int)($salesAgg['gross_sales_paisa'] ?? 0);
    $retailDiscountsPaisa = (int)($salesAgg['discounts_paisa'] ?? 0);
    $retailDiscountCount = (int)($salesAgg['discount_count'] ?? 0);
    $retailPayablePaisa = (int)($salesAgg['net_collected_paisa'] ?? 0);
    $retailReturnsPaisa = (int)($retAgg['amt'] ?? 0);
    $retailReturnsCount = (int)($retAgg['cnt'] ?? 0);
    $retailNetPaisa = max(0, $retailPayablePaisa - $retailReturnsPaisa);
    $cogsPaisa = (int)($salesAgg['cogs_paisa'] ?? 0);
    $retailUnits = (int)($salesAgg['total_units'] ?? 0);
    $retailInvoicesCount = (int)($salesAgg['invoice_count'] ?? 0);

    // 2. Online Orders (WhatsApp vs Website)
    $stmt = $pdo->prepare(
        "SELECT order_id, order_number, channel, customer_name, customer_phone, city,
                items_json, subtotal_paisa, delivery_charges_paisa, discount_paisa,
                total_amount_paisa, advance_paid_paisa, cod_balance_paisa, payment_status,
                payment_custodian, courier_partner, tracking_number, delivery_status,
                refund_amount_paisa, deduction_amount_paisa, terminal_id,
                collected_at, collection_method, return_reason, notes, created_at
         FROM cloud_online_orders
         WHERE {$wOnl}{$branchSqlSales}
         ORDER BY created_at DESC"
    );
    $stmt->execute($branchParamsSales);
    $periodOnlineOrders = $stmt->fetchAll();

    $stmt = $pdo->prepare(
        "SELECT channel, total_amount_paisa, advance_paid_paisa, cod_balance_paisa,
                payment_status, delivery_status, refund_amount_paisa, collection_method
         FROM cloud_online_orders
         WHERE delivery_status <> 'CANCELLED' AND {$wOnlCol}{$branchSqlSales}"
    );
    $stmt->execute($branchParamsSales);
    $collectedOnlineRows = $stmt->fetchAll();

    $onlineGrossPaisa = 0;
    $onlineDiscountsPaisa = 0;
    $onlineDiscountCount = 0;
    $onlinePendingCodPaisa = 0;
    $onlinePendingCodCount = 0;
    $onlineReturnsPaisa = 0;
    $onlineReturnsCount = 0;
    $onlineOrdersCount = 0;
    $onlineUnits = 0;

    $waOrdersCount = 0;
    $waGrossPaisa = 0;
    $waPendingCodPaisa = 0;
    $waPendingCount = 0;
    $waReturnsPaisa = 0;
    $webOrdersCount = 0;
    $webGrossPaisa = 0;
    $webPendingCodPaisa = 0;
    $webPendingCount = 0;
    $webReturnsPaisa = 0;

    foreach ($periodOnlineOrders as &$oRef) {
        $ds = strtoupper((string)($oRef['delivery_status'] ?? ''));
        $ps = strtoupper((string)($oRef['payment_status'] ?? ''));
        $ch = strtoupper((string)($oRef['channel'] ?? 'WHATSAPP'));
        $isWa = str_contains($ch, 'WHATSAPP') || $ch === 'WA';

        $parsedItems = json_decode((string)($oRef['items_json'] ?? '[]'), true);
        if (!is_array($parsedItems)) {
            $parsedItems = [];
        }
        $oRef['parsed_items'] = $parsedItems;

        if ($ds === 'CANCELLED') {
            continue;
        }
        $onlineOrdersCount++;

        $gross = ameer_calc_online_gross_paisa($oRef);
        $disc = max(0, (int)($oRef['discount_paisa'] ?? 0));
        $pendCod = ameer_calc_online_pending_cod_paisa($oRef);
        $retVal = ameer_calc_online_return_paisa($oRef);

        $onlineGrossPaisa += $gross;
        $onlineDiscountsPaisa += $disc;
        if ($disc > 0) {
            $onlineDiscountCount++;
        }
        $onlinePendingCodPaisa += $pendCod;
        if ($pendCod > 0) {
            $onlinePendingCodCount++;
        }
        if ($retVal > 0 || $ps === 'RETURNED' || $ds === 'RETURNED_RTO' || $ds === 'RETURNED' || $ds === 'PARTIAL_RETURN') {
            $onlineReturnsPaisa += $retVal;
            $onlineReturnsCount++;
        }

        if ($parsedItems) {
            foreach ($parsedItems as $pit) {
                if (is_array($pit)) {
                    $onlineUnits += max(1, (int)($pit['quantity'] ?? 1));
                }
            }
        } else {
            $onlineUnits += 1;
        }

        if ($isWa) {
            $waOrdersCount++;
            $waGrossPaisa += $gross;
            $waPendingCodPaisa += $pendCod;
            if ($pendCod > 0) {
                $waPendingCount++;
            }
            $waReturnsPaisa += $retVal;
        } else {
            $webOrdersCount++;
            $webGrossPaisa += $gross;
            $webPendingCodPaisa += $pendCod;
            if ($pendCod > 0) {
                $webPendingCount++;
            }
            $webReturnsPaisa += $retVal;
        }
    }
    unset($oRef);

    $onlineRealizedPaisa = 0;
    $waRealizedPaisa = 0;
    $webRealizedPaisa = 0;
    $onlineCashPayPaisa = 0;
    $onlineEpPayPaisa = 0;
    $onlineJcPayPaisa = 0;
    foreach ($collectedOnlineRows as $co) {
        $realized = ameer_calc_online_realized_paisa($co);
        $onlineRealizedPaisa += $realized;
        $ch = strtoupper((string)($co['channel'] ?? 'WHATSAPP'));
        $isWa = str_contains($ch, 'WHATSAPP') || $ch === 'WA';
        if ($isWa) {
            $waRealizedPaisa += $realized;
        } else {
            $webRealizedPaisa += $realized;
        }
        $cm = strtoupper((string)($co['collection_method'] ?? ($isWa ? 'CASH' : 'EASYPAISA')));
        if (str_contains($cm, 'EASY')) {
            $onlineEpPayPaisa += $realized;
        } elseif (str_contains($cm, 'JAZZ')) {
            $onlineJcPayPaisa += $realized;
        } else {
            $onlineCashPayPaisa += $realized;
        }
    }

    // 3. Wholesale B2B Invoices & Receivables
    $stmt = $pdo->prepare(
        "SELECT wholesale_invoice_id, invoice_number, customer_id, customer_name,
                subtotal_paisa, discount_paisa, net_total_paisa, amount_paid_paisa,
                balance_due_paisa, payment_status, invoice_date, terminal_id
         FROM cloud_wholesale_invoices
         WHERE is_voided = 0 AND {$wWs}{$branchSqlSales}
         ORDER BY invoice_date DESC"
    );
    $stmt->execute($branchParamsSales);
    $wholesaleInvoices = $stmt->fetchAll();

    $wholesaleInvoicesCount = count($wholesaleInvoices);
    $wholesaleGrossPaisa = 0;
    $wholesaleDiscountsPaisa = 0;
    $wholesaleDiscountCount = 0;
    $wholesaleBilledPaisa = 0;
    $wholesalePaidPaisa = 0;
    $wholesalePeriodUdarPaisa = 0;

    foreach ($wholesaleInvoices as $w) {
        $sub = (int)($w['subtotal_paisa'] ?? 0);
        $disc = max(0, (int)($w['discount_paisa'] ?? 0));
        $net = (int)($w['net_total_paisa'] ?? 0);
        $paid = (int)($w['amount_paid_paisa'] ?? 0);
        $due = max(0, (int)($w['balance_due_paisa'] ?? 0));
        $wholesaleGrossPaisa += ($sub > 0 ? $sub : ($net + $disc));
        $wholesaleDiscountsPaisa += $disc;
        if ($disc > 0) {
            $wholesaleDiscountCount++;
        }
        $wholesaleBilledPaisa += $net;
        $wholesalePaidPaisa += $paid;
        $wholesalePeriodUdarPaisa += $due;
    }

    $wholesaleTotalLedgerUdarPaisa = (int)$pdo->query(
        "SELECT COALESCE(SUM(GREATEST(current_balance_paisa, 0)), 0) FROM cloud_wholesale_customers WHERE is_active = 1"
    )->fetchColumn();

    // 4. Expenses & Salaries
    $stmt = $pdo->prepare(
        "SELECT expense_id, category, expense_date, amount_paisa, description, recipient_payee, authorized_by_name, terminal_id
         FROM cloud_petty_expenses
         WHERE {$wExp}{$branchSqlSales}
         ORDER BY expense_date DESC"
    );
    $stmt->execute($branchParamsSales);
    $expenses = $stmt->fetchAll();
    $pettyExpensesPaisa = 0;
    foreach ($expenses as $e) {
        $pettyExpensesPaisa += (int)($e['amount_paisa'] ?? 0);
    }

    $stmt = $pdo->prepare(
        "SELECT payout_id, employee_name, employee_role, payout_type, amount_paisa, payment_method, payout_date, notes, terminal_id
         FROM cloud_employee_salaries
         WHERE {$wSal}{$branchSqlSales}
         ORDER BY payout_date DESC"
    );
    $stmt->execute($branchParamsSales);
    $salaries = $stmt->fetchAll();
    $salariesPaisa = 0;
    foreach ($salaries as $sa) {
        $salariesPaisa += (int)($sa['amount_paisa'] ?? 0);
    }

    // 5. Payment Methods Breakdown (Retail POS + Online Realized + Wholesale Paid)
    $stmt = $pdo->prepare(
        "SELECT
            COALESCE(SUM(CASE WHEN UPPER(payment_method) LIKE '%EASY%' THEN net_payable_paisa ELSE 0 END), 0) AS ep,
            COALESCE(SUM(CASE WHEN UPPER(payment_method) LIKE '%JAZZ%' THEN net_payable_paisa ELSE 0 END), 0) AS jc,
            COALESCE(SUM(CASE WHEN UPPER(payment_method) NOT LIKE '%EASY%' AND UPPER(payment_method) NOT LIKE '%JAZZ%' AND UPPER(payment_method) NOT LIKE '%CREDIT%' THEN net_payable_paisa ELSE 0 END), 0) AS cash_other
         FROM cloud_sales_invoices
         WHERE is_voided = 0 AND {$wSales}{$branchSqlSales}"
    );
    $stmt->execute($branchParamsSales);
    $payRetail = $stmt->fetch() ?: ['ep' => 0, 'jc' => 0, 'cash_other' => 0];

    $cashReceiptsPaisa = max(0, (int)$payRetail['cash_other'] + $onlineCashPayPaisa + $wholesalePaidPaisa - $retailReturnsPaisa);
    $easypaisaReceiptsPaisa = max(0, (int)$payRetail['ep'] + $onlineEpPayPaisa);
    $jazzcashReceiptsPaisa = max(0, (int)$payRetail['jc'] + $onlineJcPayPaisa);

    // 6. Combined Headline KPIs
    $totalGrossSalesPaisa = $retailGrossPaisa + $onlineGrossPaisa + $wholesaleGrossPaisa;
    $totalDiscountsPaisa = $retailDiscountsPaisa + $onlineDiscountsPaisa + $wholesaleDiscountsPaisa;
    $totalDiscountedCount = $retailDiscountCount + $onlineDiscountCount + $wholesaleDiscountCount;
    $totalReturnsPaisa = $retailReturnsPaisa + $onlineReturnsPaisa;
    $totalReturnsCount = $retailReturnsCount + $onlineReturnsCount;
    $totalNetRealizedPaisa = max(0, $retailNetPaisa + $wholesalePaidPaisa + $onlineRealizedPaisa);
    $grossProfitPaisa = max(0, $retailNetPaisa - $cogsPaisa);
    $netOperatingMarginPaisa = $totalNetRealizedPaisa - $pettyExpensesPaisa - $salariesPaisa;
    $estNetProfitPaisa = ($retailNetPaisa + $wholesaleBilledPaisa - $cogsPaisa) - $pettyExpensesPaisa - $salariesPaisa;

    // 7. Branches / Terminals Telemetry
    $nodes = $pdo->query(
        "SELECT terminal_id, branch_name, station_role, lan_ip, last_heartbeat_at, last_sync_at, app_version, is_online,
                TIMESTAMPDIFF(SECOND, last_heartbeat_at, NOW()) AS secs_hb,
                TIMESTAMPDIFF(SECOND, last_sync_at, NOW()) AS secs_sync
         FROM cloud_terminal_nodes
         ORDER BY terminal_id ASC"
    )->fetchAll();

    $branchSalesRows = $pdo->query(
        "SELECT terminal_id, COUNT(*) AS cnt, COALESCE(SUM(gross_total_paisa), 0) AS gross, COALESCE(SUM(net_payable_paisa), 0) AS net
         FROM cloud_sales_invoices WHERE is_voided = 0 AND {$wSales} GROUP BY terminal_id"
    )->fetchAll();
    $branchSalesMap = [];
    foreach ($branchSalesRows as $bsr) {
        $branchSalesMap[$bsr['terminal_id']] = $bsr;
    }

    $branchOnlineRows = $pdo->query(
        "SELECT terminal_id, COUNT(*) AS cnt, COALESCE(SUM(total_amount_paisa), 0) AS net
         FROM cloud_online_orders WHERE delivery_status <> 'CANCELLED' AND {$wOnl} GROUP BY terminal_id"
    )->fetchAll();
    $branchOnlineMap = [];
    foreach ($branchOnlineRows as $bor) {
        $branchOnlineMap[$bor['terminal_id']] = $bor;
    }

    $branchWholesaleRows = $pdo->query(
        "SELECT terminal_id, COUNT(*) AS cnt, COALESCE(SUM(subtotal_paisa), 0) AS gross, COALESCE(SUM(amount_paid_paisa), 0) AS paid
         FROM cloud_wholesale_invoices WHERE is_voided = 0 AND {$wWs} GROUP BY terminal_id"
    )->fetchAll();
    $branchWholesaleMap = [];
    foreach ($branchWholesaleRows as $bwr) {
        $branchWholesaleMap[$bwr['terminal_id']] = $bwr;
    }

    $branchExpRows = $pdo->query(
        "SELECT terminal_id, COALESCE(SUM(amount_paisa), 0) AS amt
         FROM cloud_petty_expenses WHERE {$wExp} GROUP BY terminal_id"
    )->fetchAll();
    $branchExpMap = [];
    foreach ($branchExpRows as $ber) {
        $branchExpMap[$ber['terminal_id']] = (int)$ber['amt'];
    }

    $openShiftRows = $pdo->query(
        "SELECT terminal_id, system_expected_cash_paisa, shift_status, opened_at
         FROM cloud_cash_shifts WHERE shift_status = 'OPEN' ORDER BY opened_at DESC"
    )->fetchAll();
    $openShiftMap = [];
    foreach ($openShiftRows as $osr) {
        if (!isset($openShiftMap[$osr['terminal_id']])) {
            $openShiftMap[$osr['terminal_id']] = $osr;
        }
    }

    $branches = [];
    foreach ($nodes as $n) {
        $tid = $n['terminal_id'];
        $secsHb = $n['secs_hb'] !== null ? (int)$n['secs_hb'] : null;
        $secsSync = $n['secs_sync'] !== null ? (int)$n['secs_sync'] : null;
        $isLive = (($secsHb !== null && $secsHb <= 120) || ($secsSync !== null && $secsSync <= 180));
        $bs = $branchSalesMap[$tid] ?? ['cnt' => 0, 'gross' => 0, 'net' => 0];
        $bo = $branchOnlineMap[$tid] ?? ['cnt' => 0, 'net' => 0];
        $bw = $branchWholesaleMap[$tid] ?? ['cnt' => 0, 'gross' => 0, 'paid' => 0];
        $osh = $openShiftMap[$tid] ?? null;

        $branches[] = [
            'terminal_id' => $tid,
            'branch_name' => $n['branch_name'] !== '' ? $n['branch_name'] : ($tid === 'POS-01' ? 'Main Showroom (Primary)' : 'Branch Counter'),
            'station_role' => $n['station_role'],
            'lan_ip' => $n['lan_ip'],
            'app_version' => $n['app_version'],
            'last_heartbeat_at' => $n['last_heartbeat_at'],
            'last_sync_at' => $n['last_sync_at'],
            'is_live_online' => $isLive,
            'retail_count' => (int)$bs['cnt'],
            'retail_gross_paisa' => (int)$bs['gross'],
            'retail_net_paisa' => (int)$bs['net'],
            'online_count' => (int)$bo['cnt'],
            'online_net_paisa' => (int)$bo['net'],
            'wholesale_count' => (int)$bw['cnt'],
            'wholesale_gross_paisa' => (int)$bw['gross'],
            'expenses_paisa' => $branchExpMap[$tid] ?? 0,
            'open_shift_cash_paisa' => $osh ? (int)$osh['system_expected_cash_paisa'] : null,
            'open_shift_status' => $osh ? $osh['shift_status'] : 'CLOSED',
        ];
    }

    // 8. Lists for Detailed Views
    $stmt = $pdo->prepare(
        "SELECT invoice_id, invoice_number, terminal_id, order_source, customer_phone,
                gross_total_paisa, item_discount_paisa, special_discount_paisa,
                net_payable_paisa, total_cost_paisa, payment_method, items_summary,
                salesperson_name, total_units, invoice_date
         FROM cloud_sales_invoices
         WHERE is_voided = 0 AND {$wSales}{$branchSqlSales}
         ORDER BY invoice_date DESC
         LIMIT 60"
    );
    $stmt->execute($branchParamsSales);
    $recentSales = $stmt->fetchAll();

    $stmt = $pdo->prepare(
        "SELECT return_id, return_voucher_number, original_sales_invoice_id, invoice_type,
                return_type, condition_status, total_refund_amount_paisa,
                refund_settlement_method, terminal_id, return_date
         FROM cloud_return_vouchers
         WHERE {$wRet}{$branchSqlSales}
         ORDER BY return_date DESC
         LIMIT 50"
    );
    $stmt->execute($branchParamsSales);
    $returnsList = $stmt->fetchAll();

    $wholesaleParties = $pdo->query(
        "SELECT customer_id, business_name, contact_person, phone, city, current_balance_paisa, credit_limit_paisa
         FROM cloud_wholesale_customers
         WHERE is_active = 1
         ORDER BY current_balance_paisa DESC, business_name ASC"
    )->fetchAll();

    $products = $pdo->query(
        "SELECT product_id, sku, name, brand, size_ml, category, current_stock_units,
                retail_price_paisa, wholesale_price_paisa, latest_batch_cost_paisa, reorder_threshold_units
         FROM cloud_finished_products
         WHERE is_active = 1
         ORDER BY current_stock_units ASC, name ASC
         LIMIT 400"
    )->fetchAll();

    $fgCostValPaisa = 0;
    $fgRetailValPaisa = 0;
    $totalBottlesStock = 0;
    $lowStockCount = 0;
    $outOfStockCount = 0;
    foreach ($products as $p) {
        $stk = max(0, (int)($p['current_stock_units'] ?? 0));
        $thr = (int)($p['reorder_threshold_units'] ?? 5);
        $totalBottlesStock += $stk;
        $fgCostValPaisa += $stk * (int)($p['latest_batch_cost_paisa'] ?? 0);
        $fgRetailValPaisa += $stk * (int)($p['retail_price_paisa'] ?? 0);
        if ($stk <= 0) {
            $outOfStockCount++;
            $lowStockCount++;
        } elseif ($stk <= $thr) {
            $lowStockCount++;
        }
    }

    $attars = $pdo->query(
        "SELECT attar_id, sku, name, origin_country, cost_per_tola_paisa,
                selling_price_per_tola_paisa, wholesale_price_per_tola_paisa
         FROM cloud_attar_products
         WHERE is_active = 1
         ORDER BY name ASC"
    )->fetchAll();

    $stmt = $pdo->prepare(
        "SELECT shift_id, terminal_id, opened_at, closed_at, opening_cash_float_paisa,
                system_expected_cash_paisa, actual_counted_cash_paisa, shift_status
         FROM cloud_cash_shifts
         WHERE " . ($hasBranchFilter ? 'terminal_id = ?' : '1=1') . "
         ORDER BY opened_at DESC
         LIMIT 20"
    );
    $stmt->execute($branchParamsSales);
    $recentShifts = $stmt->fetchAll();

    $backups = $pdo->query(
        "SELECT backup_id, terminal_id, filename, file_size_bytes, sha256_checksum, created_at
         FROM cloud_backups
         ORDER BY created_at DESC
         LIMIT 20"
    )->fetchAll();

    // 9. Unified Real-Time Shop Activity Feed (top 25 latest events across Retail + Online + Wholesale + Expenses + Salaries)
    $feed = [];
    foreach (array_slice($recentSales, 0, 10) as $s) {
        $feed[] = [
            'kind' => 'POS_SALE',
            'badge' => 'POS SALE',
            'title' => $s['invoice_number'] . ' • ' . ($s['items_summary'] ?: 'Counter Bill'),
            'terminal' => $s['terminal_id'],
            'meta' => $s['payment_method'] . ' • ' . (int)$s['total_units'] . ' unit(s)',
            'amount_paisa' => (int)$s['net_payable_paisa'],
            'positive' => true,
            'ts' => $s['invoice_date'],
        ];
    }
    foreach (array_slice($periodOnlineOrders, 0, 10) as $o) {
        $ch = strtoupper((string)$o['channel']);
        $feed[] = [
            'kind' => $ch === 'WEBSITE' ? 'WEB_ORDER' : 'WA_ORDER',
            'badge' => $ch === 'WEBSITE' ? 'WEBSITE ORDER' : 'WHATSAPP ORDER',
            'title' => $o['order_number'] . ' • ' . ($o['customer_name'] ?: $o['customer_phone']),
            'terminal' => $o['terminal_id'] ?? 'POS-01',
            'meta' => ($o['city'] ?: 'Pakistan') . ' • ' . strtoupper((string)$o['delivery_status']),
            'amount_paisa' => (int)$o['total_amount_paisa'],
            'positive' => strtoupper((string)$o['delivery_status']) !== 'RETURNED_RTO',
            'ts' => $o['created_at'],
        ];
    }
    foreach (array_slice($wholesaleInvoices, 0, 8) as $w) {
        $feed[] = [
            'kind' => 'WHOLESALE',
            'badge' => 'WHOLESALE',
            'title' => $w['invoice_number'] . ' • ' . $w['customer_name'],
            'terminal' => $w['terminal_id'] ?? 'POS-01',
            'meta' => $w['payment_status'] . ' • Paid ' . ameer_pkr((int)$w['amount_paid_paisa']),
            'amount_paisa' => (int)$w['net_total_paisa'],
            'positive' => true,
            'ts' => $w['invoice_date'],
        ];
    }
    foreach (array_slice($expenses, 0, 6) as $e) {
        $feed[] = [
            'kind' => 'EXPENSE',
            'badge' => 'EXPENSE',
            'title' => $e['category'] . ' • ' . ($e['recipient_payee'] ?: 'Store'),
            'terminal' => $e['terminal_id'] ?? 'POS-01',
            'meta' => $e['description'] ?: 'Operational',
            'amount_paisa' => -(int)$e['amount_paisa'],
            'positive' => false,
            'ts' => $e['expense_date'],
        ];
    }
    foreach (array_slice($salaries, 0, 6) as $sa) {
        $feed[] = [
            'kind' => 'SALARY',
            'badge' => 'SALARY',
            'title' => $sa['employee_name'] . ' (' . $sa['payout_type'] . ')',
            'terminal' => $sa['terminal_id'] ?? 'POS-01',
            'meta' => $sa['payment_method'],
            'amount_paisa' => -(int)$sa['amount_paisa'],
            'positive' => false,
            'ts' => $sa['payout_date'],
        ];
    }
    usort($feed, static fn (array $a, array $b): int => strcmp((string)$b['ts'], (string)$a['ts']));
    $feed = array_slice($feed, 0, 25);

    $cursorInfo = ameer_get_live_cursor($pdo);

    return [
        'period' => $period,
        'branch' => $hasBranchFilter ? $branch : 'ALL',
        'syncCursor' => $cursorInfo['cursor'],
        'totalEventsCount' => $cursorInfo['eventsCount'],
        'stateSignature' => $cursorInfo['signature'],
        'serverTimePkt' => date('Y-m-d H:i:s'),
        'kpis' => [
            'totalGrossSalesPaisa' => $totalGrossSalesPaisa,
            'totalNetRealizedPaisa' => $totalNetRealizedPaisa,
            'totalDiscountsPaisa' => $totalDiscountsPaisa,
            'totalDiscountedCount' => $totalDiscountedCount,
            'totalReturnsPaisa' => $totalReturnsPaisa,
            'totalReturnsCount' => $totalReturnsCount,
            'cogsPaisa' => $cogsPaisa,
            'grossProfitPaisa' => $grossProfitPaisa,
            'pettyExpensesPaisa' => $pettyExpensesPaisa,
            'expensesCount' => count($expenses),
            'salariesPaisa' => $salariesPaisa,
            'salariesCount' => count($salaries),
            'netOperatingMarginPaisa' => $netOperatingMarginPaisa,
            'estNetProfitPaisa' => $estNetProfitPaisa,
            // Channel Split
            'retailGrossPaisa' => $retailGrossPaisa,
            'retailNetPaisa' => $retailNetPaisa,
            'retailDiscountsPaisa' => $retailDiscountsPaisa,
            'retailReturnsPaisa' => $retailReturnsPaisa,
            'retailInvoicesCount' => $retailInvoicesCount,
            'retailUnits' => $retailUnits,
            'perfumeSalesPaisa' => (int)($salesAgg['perfume_sales_paisa'] ?? 0),
            'attarSalesPaisa' => (int)($salesAgg['attar_sales_paisa'] ?? 0),
            'testerSalesPaisa' => (int)($salesAgg['tester_sales_paisa'] ?? 0),
            // Online & WhatsApp vs Website Split
            'onlineOrdersCount' => $onlineOrdersCount,
            'onlineGrossPaisa' => $onlineGrossPaisa,
            'onlineRealizedPaisa' => $onlineRealizedPaisa,
            'onlineDiscountsPaisa' => $onlineDiscountsPaisa,
            'onlinePendingCodPaisa' => $onlinePendingCodPaisa,
            'onlinePendingCodCount' => $onlinePendingCodCount,
            'onlineReturnsPaisa' => $onlineReturnsPaisa,
            'onlineReturnsCount' => $onlineReturnsCount,
            'onlineUnits' => $onlineUnits,
            'waOrdersCount' => $waOrdersCount,
            'waGrossPaisa' => $waGrossPaisa,
            'waRealizedPaisa' => $waRealizedPaisa,
            'waPendingCodPaisa' => $waPendingCodPaisa,
            'waPendingCount' => $waPendingCount,
            'waReturnsPaisa' => $waReturnsPaisa,
            'webOrdersCount' => $webOrdersCount,
            'webGrossPaisa' => $webGrossPaisa,
            'webRealizedPaisa' => $webRealizedPaisa,
            'webPendingCodPaisa' => $webPendingCodPaisa,
            'webPendingCount' => $webPendingCount,
            'webReturnsPaisa' => $webReturnsPaisa,
            // Wholesale
            'wholesaleInvoicesCount' => $wholesaleInvoicesCount,
            'wholesaleGrossPaisa' => $wholesaleGrossPaisa,
            'wholesaleBilledPaisa' => $wholesaleBilledPaisa,
            'wholesaleDiscountsPaisa' => $wholesaleDiscountsPaisa,
            'wholesalePaidPaisa' => $wholesalePaidPaisa,
            'wholesalePeriodUdarPaisa' => $wholesalePeriodUdarPaisa,
            'wholesaleTotalLedgerUdarPaisa' => $wholesaleTotalLedgerUdarPaisa,
            // Payments
            'cashReceiptsPaisa' => $cashReceiptsPaisa,
            'easypaisaReceiptsPaisa' => $easypaisaReceiptsPaisa,
            'jazzcashReceiptsPaisa' => $jazzcashReceiptsPaisa,
            // Inventory
            'fgCostValPaisa' => $fgCostValPaisa,
            'fgRetailValPaisa' => $fgRetailValPaisa,
            'totalBottlesStock' => $totalBottlesStock,
            'productsCount' => count($products),
            'attarsCount' => count($attars),
            'lowStockCount' => $lowStockCount,
            'outOfStockCount' => $outOfStockCount,
        ],
        'branches' => $branches,
        'liveFeed' => $feed,
        'recentSales' => $recentSales,
        'onlineOrders' => array_slice($periodOnlineOrders, 0, 120),
        'wholesaleInvoices' => array_slice($wholesaleInvoices, 0, 80),
        'wholesaleParties' => $wholesaleParties,
        'products' => $products,
        'attars' => $attars,
        'returns' => $returnsList,
        'expenses' => array_slice($expenses, 0, 80),
        'salaries' => array_slice($salaries, 0, 80),
        'shifts' => $recentShifts,
        'backups' => $backups,
    ];
}
