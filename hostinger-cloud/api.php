<?php
declare(strict_types=1);

/**
 * Ameer Perfumes ERP — Hostinger Shared Cloud Sync & Telemetry REST API
 *
 * Routed via .htaccess from /api/v1/<endpoint> -> api.php?route=<endpoint>
 * Also supports direct access: api.php?route=health
 */

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

require_once __DIR__ . '/db.php';

$cfg = ameer_load_config();
if (!empty($cfg['__missing_config'])) {
    ameer_json_response([
        'status' => 'ERROR',
        'message' => 'Hostinger cloud config.php is missing. Copy config.example.php to config.php first.',
    ], 503);
}

$expectedToken = trim((string)($cfg['api_token'] ?? ''));
if ($expectedToken === '' || str_starts_with($expectedToken, 'CHANGE_ME_')) {
    ameer_json_response([
        'status' => 'ERROR',
        'message' => 'api_token in config.php is still set to placeholder. Generate a real token first.',
    ], 503);
}

// Resolve route cleanly from ?route= or PATH_INFO
$rawRoute = (string)($_GET['route'] ?? '');
if ($rawRoute === '' && !empty($_SERVER['PATH_INFO'])) {
    $rawRoute = ltrim((string)$_SERVER['PATH_INFO'], '/');
}
$route = trim($rawRoute, "/ \t\r\n");
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

// Public lightweight ping (still reports auth verification boolean if token was supplied)
if ($route === '' || $route === 'health') {
    $supplied = ameer_extract_bearer_token();
    $authValid = $supplied !== '' && hash_equals($expectedToken, $supplied);
    $dbOk = false;
    $dbError = null;
    try {
        $pdo = ameer_get_pdo($cfg);
        $pdo->query('SELECT 1');
        $dbOk = true;
    } catch (Throwable $e) {
        $dbError = $e->getMessage();
    }
    ameer_json_response([
        'status' => $dbOk ? 'OK' : 'DEGRADED',
        'service' => 'Ameer Perfumes Hostinger Cloud API',
        'database' => $dbOk ? 'CONNECTED' : 'ERROR',
        'databaseError' => $dbError,
        'tokenProvided' => $supplied !== '',
        'tokenValid' => $authValid,
        'phpVersion' => PHP_VERSION,
        'serverTimestamp' => gmdate('c'),
    ], $dbOk ? 200 : 500);
}

// All other API endpoints require valid Bearer Token
$suppliedToken = ameer_extract_bearer_token();
if ($suppliedToken === '' || !hash_equals($expectedToken, $suppliedToken)) {
    ameer_json_response([
        'status' => 'UNAUTHORIZED',
        'message' => 'Invalid or missing Hostinger Cloud API Bearer token.',
    ], 401);
}

try {
    $pdo = ameer_get_pdo($cfg);
    ameer_ensure_cloud_schema_upgrades($pdo);
} catch (Throwable $e) {
    ameer_json_response([
        'status' => 'ERROR',
        'message' => 'Database connection failed: ' . $e->getMessage(),
    ], 500);
}

// Helper for safe integer extraction from decoded JSON
$asInt = static function (array $row, array $keys, int $default = 0): int {
    foreach ($keys as $k) {
        if (array_key_exists($k, $row) && $row[$k] !== null && $row[$k] !== '') {
            return (int)$row[$k];
        }
    }
    return $default;
};

$asStr = static function (array $row, array $keys, string $default = ''): string {
    foreach ($keys as $k) {
        if (array_key_exists($k, $row) && $row[$k] !== null) {
            return (string)$row[$k];
        }
    }
    return $default;
};

$asNullableStr = static function (array $row, array $keys): ?string {
    foreach ($keys as $k) {
        if (array_key_exists($k, $row) && $row[$k] !== null && $row[$k] !== '') {
            return (string)$row[$k];
        }
    }
    return null;
};

$asNullableInt = static function (array $row, array $keys): ?int {
    foreach ($keys as $k) {
        if (array_key_exists($k, $row) && $row[$k] !== null && $row[$k] !== '') {
            return (int)$row[$k];
        }
    }
    return null;
};

$asBoolInt = static function (array $row, array $keys, int $default = 0): int {
    foreach ($keys as $k) {
        if (array_key_exists($k, $row) && $row[$k] !== null) {
            if (is_bool($row[$k])) {
                return $row[$k] ? 1 : 0;
            }
            return ((int)$row[$k]) !== 0 ? 1 : 0;
        }
    }
    return $default;
};

// Project a normalized event into MySQL read-optimized dashboard tables
$projectEvent = static function (
    PDO $pdo,
    string $entityType,
    string $entityId,
    string $opType,
    array $data,
    string $originTerminal,
    string $createdAt
) use ($asInt, $asStr, $asNullableStr, $asNullableInt, $asBoolInt): void {
    $type = strtoupper(trim($entityType));
    $op = strtoupper(trim($opType));
    $isDelete = ($op === 'DELETE' || $op === 'VOID');

    switch ($type) {
        case 'FINISHED_PRODUCT':
        case 'PRODUCT': {
            $id = $asStr($data, ['product_id', 'productId', 'id'], $entityId);
            if ($op === 'DELETE') {
                $stmt = $pdo->prepare('UPDATE cloud_finished_products SET is_active = 0, updated_at = ? WHERE product_id = ?');
                $stmt->execute([$createdAt, $id]);
                return;
            }
            $stmt = $pdo->prepare(
                'INSERT INTO cloud_finished_products (
                    product_id, sku, barcode, name, brand, size_ml, category,
                    current_stock_units, retail_price_paisa, wholesale_price_paisa,
                    latest_batch_cost_paisa, reorder_threshold_units, is_active, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    sku = VALUES(sku),
                    barcode = VALUES(barcode),
                    name = VALUES(name),
                    brand = VALUES(brand),
                    size_ml = VALUES(size_ml),
                    category = VALUES(category),
                    current_stock_units = VALUES(current_stock_units),
                    retail_price_paisa = VALUES(retail_price_paisa),
                    wholesale_price_paisa = VALUES(wholesale_price_paisa),
                    latest_batch_cost_paisa = VALUES(latest_batch_cost_paisa),
                    reorder_threshold_units = VALUES(reorder_threshold_units),
                    is_active = VALUES(is_active),
                    updated_at = VALUES(updated_at)'
            );
            $stmt->execute([
                $id,
                $asStr($data, ['sku'], $id),
                $asNullableStr($data, ['barcode']),
                $asStr($data, ['name'], 'Unnamed Product'),
                $asStr($data, ['brand'], 'Ameer Perfumes'),
                $asInt($data, ['size_ml', 'sizeMl'], 0),
                $asStr($data, ['category'], 'UNISEX'),
                $asInt($data, ['current_stock_units', 'currentStockUnits'], 0),
                $asInt($data, ['retail_price_paisa', 'retailPricePaisa'], 0),
                $asInt($data, ['wholesale_price_paisa', 'wholesalePricePaisa'], 0),
                $asInt($data, ['latest_batch_cost_paisa', 'latestBatchCostPaisa'], 0),
                $asInt($data, ['reorder_threshold_units', 'reorderThresholdUnits'], 5),
                $asBoolInt($data, ['is_active', 'isActive'], 1),
                $asStr($data, ['updated_at', 'updatedAt'], $createdAt),
            ]);
            break;
        }

        case 'ATTAR_PRODUCT':
        case 'ATTAR': {
            $id = $asStr($data, ['attar_id', 'attarId', 'id'], $entityId);
            if ($op === 'DELETE') {
                $stmt = $pdo->prepare('UPDATE cloud_attar_products SET is_active = 0, updated_at = ? WHERE attar_id = ?');
                $stmt->execute([$createdAt, $id]);
                return;
            }
            $stmt = $pdo->prepare(
                'INSERT INTO cloud_attar_products (
                    attar_id, sku, name, origin_country, cost_per_tola_paisa,
                    selling_price_per_tola_paisa, wholesale_price_per_tola_paisa,
                    is_active, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    sku = VALUES(sku),
                    name = VALUES(name),
                    origin_country = VALUES(origin_country),
                    cost_per_tola_paisa = VALUES(cost_per_tola_paisa),
                    selling_price_per_tola_paisa = VALUES(selling_price_per_tola_paisa),
                    wholesale_price_per_tola_paisa = VALUES(wholesale_price_per_tola_paisa),
                    is_active = VALUES(is_active),
                    updated_at = VALUES(updated_at)'
            );
            $stmt->execute([
                $id,
                $asStr($data, ['sku'], $id),
                $asStr($data, ['name'], 'Unnamed Attar'),
                $asStr($data, ['origin_country', 'originCountry'], ''),
                $asInt($data, ['cost_per_tola_paisa', 'costPerTolaPaisa'], 0),
                $asInt($data, ['selling_price_per_tola_paisa', 'sellingPricePerTolaPaisa'], 0),
                $asInt($data, ['wholesale_price_per_tola_paisa', 'wholesalePricePerTolaPaisa'], 0),
                $asBoolInt($data, ['is_active', 'isActive'], 1),
                $asStr($data, ['updated_at', 'updatedAt'], $createdAt),
            ]);
            break;
        }

        case 'SALES_INVOICE': {
            $id = $asStr($data, ['invoice_id', 'invoiceId', 'id'], $entityId);
            if ($isDelete) {
                $stmt = $pdo->prepare('UPDATE cloud_sales_invoices SET is_voided = 1 WHERE invoice_id = ?');
                $stmt->execute([$id]);
                return;
            }
            $stmt = $pdo->prepare(
                'INSERT INTO cloud_sales_invoices (
                    invoice_id, invoice_number, terminal_id, order_source, customer_phone,
                    gross_total_paisa, item_discount_paisa, special_discount_paisa,
                    net_payable_paisa, total_cost_paisa, perfume_sales_paisa,
                    attar_sales_paisa, tester_sales_paisa, payment_method,
                    items_summary, salesperson_name, total_units, invoice_date, is_voided
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    invoice_number = VALUES(invoice_number),
                    terminal_id = VALUES(terminal_id),
                    order_source = VALUES(order_source),
                    customer_phone = VALUES(customer_phone),
                    gross_total_paisa = VALUES(gross_total_paisa),
                    item_discount_paisa = VALUES(item_discount_paisa),
                    special_discount_paisa = VALUES(special_discount_paisa),
                    net_payable_paisa = VALUES(net_payable_paisa),
                    total_cost_paisa = VALUES(total_cost_paisa),
                    perfume_sales_paisa = VALUES(perfume_sales_paisa),
                    attar_sales_paisa = VALUES(attar_sales_paisa),
                    tester_sales_paisa = VALUES(tester_sales_paisa),
                    payment_method = VALUES(payment_method),
                    items_summary = VALUES(items_summary),
                    salesperson_name = VALUES(salesperson_name),
                    total_units = VALUES(total_units),
                    invoice_date = VALUES(invoice_date),
                    is_voided = VALUES(is_voided)'
            );
            $stmt->execute([
                $id,
                $asStr($data, ['invoice_number', 'invoiceNumber'], $id),
                $asStr($data, ['terminal_id', 'terminalId'], $originTerminal),
                $asStr($data, ['order_source', 'orderSource'], 'WALK_IN'),
                $asStr($data, ['customer_phone', 'customerPhone'], ''),
                $asInt($data, ['gross_total_paisa', 'grossTotalPaisa'], 0),
                $asInt($data, ['item_discount_paisa', 'itemDiscountPaisa'], 0),
                $asInt($data, ['special_discount_paisa', 'specialDiscountPaisa'], 0),
                $asInt($data, ['net_payable_paisa', 'netPayablePaisa'], 0),
                $asInt($data, ['total_cost_paisa', 'totalCostPaisa'], 0),
                $asInt($data, ['perfume_sales_paisa', 'perfumeSalesPaisa'], 0),
                $asInt($data, ['attar_sales_paisa', 'attarSalesPaisa'], 0),
                $asInt($data, ['tester_sales_paisa', 'testerSalesPaisa'], 0),
                $asStr($data, ['payment_method', 'paymentMethod'], 'CASH'),
                $asNullableStr($data, ['items_summary', 'itemsSummary']),
                $asStr($data, ['salesperson_name', 'salespersonName'], ''),
                $asInt($data, ['total_units', 'totalUnits'], 0),
                $asStr($data, ['invoice_date', 'invoiceDate'], $createdAt),
                $asBoolInt($data, ['is_voided', 'isVoided'], 0),
            ]);
            break;
        }

        case 'RETURN_VOUCHER': {
            $id = $asStr($data, ['return_id', 'returnId', 'id'], $entityId);
            $stmt = $pdo->prepare(
                'INSERT INTO cloud_return_vouchers (
                    return_id, return_voucher_number, original_sales_invoice_id,
                    invoice_type, return_type, condition_status,
                    total_refund_amount_paisa, refund_settlement_method,
                    terminal_id, return_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    return_voucher_number = VALUES(return_voucher_number),
                    original_sales_invoice_id = VALUES(original_sales_invoice_id),
                    invoice_type = VALUES(invoice_type),
                    return_type = VALUES(return_type),
                    condition_status = VALUES(condition_status),
                    total_refund_amount_paisa = VALUES(total_refund_amount_paisa),
                    refund_settlement_method = VALUES(refund_settlement_method),
                    terminal_id = VALUES(terminal_id),
                    return_date = VALUES(return_date)'
            );
            $stmt->execute([
                $id,
                $asStr($data, ['return_voucher_number', 'returnVoucherNumber'], $id),
                $asNullableStr($data, ['original_sales_invoice_id', 'originalSalesInvoiceId']),
                $asStr($data, ['invoice_type', 'invoiceType'], 'RETAIL'),
                $asStr($data, ['return_type', 'returnType'], 'FULL_REFUND'),
                $asStr($data, ['condition_status', 'conditionStatus'], 'UNDAMAGED_NORMAL'),
                $asInt($data, ['total_refund_amount_paisa', 'totalRefundAmountPaisa'], 0),
                $asStr($data, ['refund_settlement_method', 'refundSettlementMethod'], 'CASH'),
                $asStr($data, ['terminal_id', 'terminalId'], $originTerminal),
                $asStr($data, ['return_date', 'returnDate'], $createdAt),
            ]);
            break;
        }

        case 'ONLINE_ORDER': {
            $id = $asStr($data, ['order_id', 'orderId', 'id'], $entityId);
            $itemsJson = null;
            if (isset($data['items_json'])) {
                $itemsJson = is_string($data['items_json']) ? $data['items_json'] : json_encode($data['items_json']);
            } elseif (isset($data['items'])) {
                $itemsJson = is_string($data['items']) ? $data['items'] : json_encode($data['items']);
            }
            $stmt = $pdo->prepare(
                'INSERT INTO cloud_online_orders (
                    order_id, order_number, channel, customer_name, customer_phone,
                    city, items_json, subtotal_paisa, delivery_charges_paisa,
                    discount_paisa, total_amount_paisa, advance_paid_paisa,
                    cod_balance_paisa, payment_status, payment_custodian,
                    courier_partner, tracking_number, delivery_status,
                    refund_amount_paisa, deduction_amount_paisa, terminal_id,
                    collected_at, collection_method, return_reason, notes, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    order_number = VALUES(order_number),
                    channel = VALUES(channel),
                    customer_name = VALUES(customer_name),
                    customer_phone = VALUES(customer_phone),
                    city = VALUES(city),
                    items_json = COALESCE(VALUES(items_json), items_json),
                    subtotal_paisa = VALUES(subtotal_paisa),
                    delivery_charges_paisa = VALUES(delivery_charges_paisa),
                    discount_paisa = VALUES(discount_paisa),
                    total_amount_paisa = VALUES(total_amount_paisa),
                    advance_paid_paisa = VALUES(advance_paid_paisa),
                    cod_balance_paisa = VALUES(cod_balance_paisa),
                    payment_status = VALUES(payment_status),
                    payment_custodian = VALUES(payment_custodian),
                    courier_partner = VALUES(courier_partner),
                    tracking_number = VALUES(tracking_number),
                    delivery_status = VALUES(delivery_status),
                    refund_amount_paisa = VALUES(refund_amount_paisa),
                    deduction_amount_paisa = VALUES(deduction_amount_paisa),
                    terminal_id = VALUES(terminal_id),
                    collected_at = VALUES(collected_at),
                    collection_method = VALUES(collection_method),
                    return_reason = VALUES(return_reason),
                    notes = VALUES(notes),
                    created_at = VALUES(created_at)'
            );
            $stmt->execute([
                $id,
                $asStr($data, ['order_number', 'orderNumber'], $id),
                $asStr($data, ['channel'], 'WHATSAPP'),
                $asStr($data, ['customer_name', 'customerName'], ''),
                $asStr($data, ['customer_phone', 'customerPhone'], ''),
                $asStr($data, ['city'], ''),
                $itemsJson,
                $asInt($data, ['subtotal_paisa', 'subtotalPaisa'], 0),
                $asInt($data, ['delivery_charges_paisa', 'deliveryChargesPaisa'], 0),
                $asInt($data, ['discount_paisa', 'discountPaisa'], 0),
                $asInt($data, ['total_amount_paisa', 'totalAmountPaisa'], 0),
                $asInt($data, ['advance_paid_paisa', 'advancePaidPaisa'], 0),
                $asInt($data, ['cod_balance_paisa', 'codBalancePaisa'], 0),
                $asStr($data, ['payment_status', 'paymentStatus'], 'PENDING'),
                $asStr($data, ['payment_custodian', 'paymentCustodian'], 'COURIER'),
                $asStr($data, ['courier_partner', 'courierPartner'], ''),
                $asStr($data, ['tracking_number', 'trackingNumber'], ''),
                $asStr($data, ['delivery_status', 'deliveryStatus'], 'BOOKED'),
                $asInt($data, ['refund_amount_paisa', 'refundAmountPaisa'], 0),
                $asInt($data, ['deduction_amount_paisa', 'deductionAmountPaisa'], 0),
                $asStr($data, ['terminal_id', 'terminalId'], $originTerminal),
                $asNullableStr($data, ['collected_at', 'collectedAt']),
                $asNullableStr($data, ['collection_method', 'collectionMethod']),
                $asNullableStr($data, ['return_reason', 'returnReason']),
                $asNullableStr($data, ['notes']),
                $asStr($data, ['created_at', 'createdAt'], $createdAt),
            ]);
            break;
        }

        case 'WHOLESALE_CUSTOMER': {
            $id = $asStr($data, ['customer_id', 'customerId', 'id'], $entityId);
            $stmt = $pdo->prepare(
                'INSERT INTO cloud_wholesale_customers (
                    customer_id, business_name, contact_person, phone, city,
                    current_balance_paisa, credit_limit_paisa, is_active, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    business_name = VALUES(business_name),
                    contact_person = VALUES(contact_person),
                    phone = VALUES(phone),
                    city = VALUES(city),
                    current_balance_paisa = VALUES(current_balance_paisa),
                    credit_limit_paisa = VALUES(credit_limit_paisa),
                    is_active = VALUES(is_active),
                    updated_at = VALUES(updated_at)'
            );
            $stmt->execute([
                $id,
                $asStr($data, ['business_name', 'businessName'], ''),
                $asStr($data, ['contact_person', 'contactPerson'], ''),
                $asStr($data, ['phone'], ''),
                $asStr($data, ['city'], ''),
                $asInt($data, ['current_balance_paisa', 'currentBalancePaisa'], 0),
                $asInt($data, ['credit_limit_paisa', 'creditLimitPaisa'], 0),
                $asBoolInt($data, ['is_active', 'isActive'], 1),
                $asStr($data, ['updated_at', 'updatedAt'], $createdAt),
            ]);
            break;
        }

        case 'WHOLESALE_INVOICE': {
            $id = $asStr($data, ['wholesale_invoice_id', 'wholesaleInvoiceId', 'id'], $entityId);
            $stmt = $pdo->prepare(
                'INSERT INTO cloud_wholesale_invoices (
                    wholesale_invoice_id, invoice_number, customer_id, customer_name,
                    subtotal_paisa, discount_paisa, net_total_paisa, amount_paid_paisa,
                    balance_due_paisa, payment_status, invoice_date, terminal_id, is_voided
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    invoice_number = VALUES(invoice_number),
                    customer_id = VALUES(customer_id),
                    customer_name = VALUES(customer_name),
                    subtotal_paisa = VALUES(subtotal_paisa),
                    discount_paisa = VALUES(discount_paisa),
                    net_total_paisa = VALUES(net_total_paisa),
                    amount_paid_paisa = VALUES(amount_paid_paisa),
                    balance_due_paisa = VALUES(balance_due_paisa),
                    payment_status = VALUES(payment_status),
                    invoice_date = VALUES(invoice_date),
                    terminal_id = VALUES(terminal_id),
                    is_voided = VALUES(is_voided)'
            );
            $stmt->execute([
                $id,
                $asStr($data, ['invoice_number', 'invoiceNumber'], $id),
                $asStr($data, ['customer_id', 'customerId'], ''),
                $asStr($data, ['customer_name', 'customerName'], ''),
                $asInt($data, ['subtotal_paisa', 'subtotalPaisa'], 0),
                $asInt($data, ['discount_paisa', 'discountPaisa'], 0),
                $asInt($data, ['net_total_paisa', 'netTotalPaisa'], 0),
                $asInt($data, ['amount_paid_paisa', 'amountPaidPaisa'], 0),
                $asInt($data, ['balance_due_paisa', 'balanceDuePaisa'], 0),
                $asStr($data, ['payment_status', 'paymentStatus'], 'UNPAID'),
                $asStr($data, ['invoice_date', 'invoiceDate'], $createdAt),
                $asStr($data, ['terminal_id', 'terminalId'], $originTerminal),
                $asBoolInt($data, ['is_voided', 'isVoided'], 0),
            ]);
            break;
        }

        case 'PETTY_EXPENSE': {
            $id = $asStr($data, ['expense_id', 'expenseId', 'id'], $entityId);
            $stmt = $pdo->prepare(
                'INSERT INTO cloud_petty_expenses (
                    expense_id, category, expense_date, amount_paisa,
                    description, recipient_payee, authorized_by_name, terminal_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    category = VALUES(category),
                    expense_date = VALUES(expense_date),
                    amount_paisa = VALUES(amount_paisa),
                    description = VALUES(description),
                    recipient_payee = VALUES(recipient_payee),
                    authorized_by_name = VALUES(authorized_by_name),
                    terminal_id = VALUES(terminal_id)'
            );
            $stmt->execute([
                $id,
                $asStr($data, ['category'], 'OTHER'),
                $asStr($data, ['expense_date', 'expenseDate'], $createdAt),
                $asInt($data, ['amount_paisa', 'amountPaisa'], 0),
                $asNullableStr($data, ['description']),
                $asStr($data, ['recipient_payee', 'recipientPayee'], ''),
                $asNullableStr($data, ['authorized_by_name', 'authorizedByName']),
                $asStr($data, ['terminal_id', 'terminalId'], $originTerminal),
            ]);
            break;
        }

        case 'EMPLOYEE_SALARY': {
            $id = $asStr($data, ['payout_id', 'payoutId', 'id'], $entityId);
            $stmt = $pdo->prepare(
                'INSERT INTO cloud_employee_salaries (
                    payout_id, employee_name, employee_role, payout_type,
                    amount_paisa, payment_method, payout_date, notes, terminal_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    employee_name = VALUES(employee_name),
                    employee_role = VALUES(employee_role),
                    payout_type = VALUES(payout_type),
                    amount_paisa = VALUES(amount_paisa),
                    payment_method = VALUES(payment_method),
                    payout_date = VALUES(payout_date),
                    notes = VALUES(notes),
                    terminal_id = VALUES(terminal_id)'
            );
            $stmt->execute([
                $id,
                $asStr($data, ['employee_name', 'employeeName'], ''),
                $asStr($data, ['employee_role', 'employeeRole'], 'SALES_STAFF'),
                $asStr($data, ['payout_type', 'payoutType'], 'MONTHLY_SALARY'),
                $asInt($data, ['amount_paisa', 'amountPaisa'], 0),
                $asStr($data, ['payment_method', 'paymentMethod'], 'CASH'),
                $asStr($data, ['payout_date', 'payoutDate'], $createdAt),
                $asNullableStr($data, ['notes']),
                $asStr($data, ['terminal_id', 'terminalId'], $originTerminal),
            ]);
            break;
        }

        case 'CASH_SHIFT': {
            $id = $asStr($data, ['shift_id', 'shiftId', 'id'], $entityId);
            $stmt = $pdo->prepare(
                'INSERT INTO cloud_cash_shifts (
                    shift_id, terminal_id, opened_at, closed_at,
                    opening_cash_float_paisa, system_expected_cash_paisa,
                    actual_counted_cash_paisa, shift_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    terminal_id = VALUES(terminal_id),
                    opened_at = VALUES(opened_at),
                    closed_at = VALUES(closed_at),
                    opening_cash_float_paisa = VALUES(opening_cash_float_paisa),
                    system_expected_cash_paisa = VALUES(system_expected_cash_paisa),
                    actual_counted_cash_paisa = VALUES(actual_counted_cash_paisa),
                    shift_status = VALUES(shift_status)'
            );
            $stmt->execute([
                $id,
                $asStr($data, ['terminal_id', 'terminalId'], $originTerminal),
                $asStr($data, ['opened_at', 'openedAt'], $createdAt),
                $asNullableStr($data, ['closed_at', 'closedAt']),
                $asInt($data, ['opening_cash_float_paisa', 'openingCashFloatPaisa'], 0),
                $asInt($data, ['system_expected_cash_paisa', 'systemExpectedCashPaisa'], 0),
                $asNullableInt($data, ['actual_counted_cash_paisa', 'actualCountedCashPaisa']),
                $asStr($data, ['shift_status', 'shiftStatus'], 'OPEN'),
            ]);
            break;
        }

        default:
            // Unknown / future entity types are safely preserved in cloud_sync_events.
            break;
    }
};

// ----------------------------------------------------------------------------
// Route dispatch
// ----------------------------------------------------------------------------

if ($method === 'GET' && $route === 'sync/status') {
    $nodes = $pdo->query('SELECT terminal_id, branch_name, station_role, lan_ip, last_heartbeat_at, last_sync_at, app_version, is_online FROM cloud_terminal_nodes ORDER BY terminal_id')->fetchAll();
    $watermarks = $pdo->query('SELECT source_terminal_id, target_node_id, last_replicated_sequence, last_sync_timestamp FROM cloud_sync_watermarks ORDER BY source_terminal_id')->fetchAll();
    $totalEvents = (int)$pdo->query('SELECT COUNT(*) FROM cloud_sync_events')->fetchColumn();
    $latestEventId = (int)$pdo->query('SELECT COALESCE(MAX(id), 0) FROM cloud_sync_events')->fetchColumn();
    $totalBackups = (int)$pdo->query('SELECT COUNT(*) FROM cloud_backups')->fetchColumn();

    ameer_json_response([
        'status' => 'ONLINE',
        'cloudServer' => 'Hostinger Shared MySQL + PHP',
        'totalSyncedEvents' => $totalEvents,
        'latestEventCursor' => $latestEventId,
        'totalCloudBackups' => $totalBackups,
        'terminalNodes' => $nodes,
        'watermarks' => $watermarks,
        'serverTimestamp' => gmdate('c'),
    ]);
}

if ($method === 'POST' && $route === 'sync/heartbeat') {
    $body = json_decode(file_get_contents('php://input') ?: '{}', true);
    if (!is_array($body)) {
        $body = [];
    }
    $terminalId = trim((string)($body['terminalId'] ?? $body['terminal_id'] ?? 'POS-01'));
    if ($terminalId === '') {
        $terminalId = 'POS-01';
    }
    $branchName = trim((string)($body['branchName'] ?? $body['branch_name'] ?? ''));
    $stationRole = trim((string)($body['stationRole'] ?? $body['station_role'] ?? ($terminalId === 'POS-01' ? 'PRIMARY_SERVER' : 'CLIENT_PEER')));
    $lanIp = trim((string)($body['lanIp'] ?? $body['lan_ip'] ?? ''));
    $appVersion = trim((string)($body['appVersion'] ?? $body['app_version'] ?? '4.4.8'));

    $stmt = $pdo->prepare(
        "INSERT INTO cloud_terminal_nodes (terminal_id, branch_name, station_role, lan_ip, last_heartbeat_at, app_version, is_online)
         VALUES (?, ?, ?, ?, NOW(), ?, 1)
         ON DUPLICATE KEY UPDATE
             branch_name = CASE WHEN VALUES(branch_name) <> '' THEN VALUES(branch_name) ELSE branch_name END,
             station_role = VALUES(station_role),
             lan_ip = CASE WHEN VALUES(lan_ip) <> '' THEN VALUES(lan_ip) ELSE lan_ip END,
             last_heartbeat_at = NOW(),
             app_version = VALUES(app_version),
             is_online = 1"
    );
    $stmt->execute([$terminalId, $branchName, $stationRole, $lanIp, $appVersion]);

    ameer_json_response([
        'status' => 'OK',
        'terminalId' => $terminalId,
        'serverTimestamp' => gmdate('c'),
    ]);
}

if ($method === 'POST' && $route === 'sync/push') {
    $rawBody = file_get_contents('php://input');
    $body = json_decode($rawBody ?: '{}', true);
    if (!is_array($body)) {
        ameer_json_response(['status' => 'BAD_REQUEST', 'message' => 'Invalid JSON payload'], 400);
    }

    $terminalId = trim((string)($body['terminalId'] ?? $body['terminal_id'] ?? 'POS-01'));
    if ($terminalId === '') {
        $terminalId = 'POS-01';
    }
    $branchName = trim((string)($body['branchName'] ?? $body['branch_name'] ?? ''));
    $stationRole = trim((string)($body['stationRole'] ?? $body['station_role'] ?? ($terminalId === 'POS-01' ? 'PRIMARY_SERVER' : 'CLIENT_PEER')));
    $appVersion = trim((string)($body['appVersion'] ?? $body['app_version'] ?? '4.4.8'));
    $events = $body['events'] ?? [];
    if (!is_array($events)) {
        ameer_json_response(['status' => 'BAD_REQUEST', 'message' => 'events field must be an array'], 400);
    }

    $acceptedCount = 0;
    $duplicateCount = 0;
    $maxSequence = 0;

    try {
        $pdo->beginTransaction();

        $nodeStmt = $pdo->prepare(
            "INSERT INTO cloud_terminal_nodes (terminal_id, branch_name, station_role, last_heartbeat_at, last_sync_at, app_version, is_online)
             VALUES (?, ?, ?, NOW(), NOW(), ?, 1)
             ON DUPLICATE KEY UPDATE
                 branch_name = CASE WHEN VALUES(branch_name) <> '' THEN VALUES(branch_name) ELSE branch_name END,
                 station_role = VALUES(station_role),
                 last_heartbeat_at = NOW(),
                 last_sync_at = NOW(),
                 app_version = VALUES(app_version),
                 is_online = 1"
        );
        $nodeStmt->execute([$terminalId, $branchName, $stationRole, $appVersion]);

        $insertEvtStmt = $pdo->prepare(
            "INSERT IGNORE INTO cloud_sync_events (
                event_id, origin_terminal_id, origin_sequence_number,
                entity_type, entity_id, operation_type, payload_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        );

        foreach ($events as $evt) {
            if (!is_array($evt)) {
                continue;
            }
            $eventId = trim((string)($evt['eventId'] ?? $evt['event_id'] ?? ''));
            $originTerminal = trim((string)($evt['originTerminalId'] ?? $evt['origin_terminal_id'] ?? $terminalId));
            $seq = (int)($evt['originSequenceNumber'] ?? $evt['origin_sequence_number'] ?? 0);
            $entityType = trim((string)($evt['entityType'] ?? $evt['entity_type'] ?? 'UNKNOWN'));
            $entityId = trim((string)($evt['entityId'] ?? $evt['entity_id'] ?? ''));
            $opType = trim((string)($evt['operationType'] ?? $evt['operation_type'] ?? 'UPSERT'));
            $payloadJson = (string)($evt['payloadJson'] ?? $evt['payload_json'] ?? '{}');
            $createdAt = trim((string)($evt['createdAt'] ?? $evt['created_at'] ?? gmdate('c')));

            if ($eventId === '' || $entityId === '') {
                continue;
            }
            if ($seq > $maxSequence) {
                $maxSequence = $seq;
            }

            $insertEvtStmt->execute([
                $eventId,
                $originTerminal,
                $seq,
                $entityType,
                $entityId,
                $opType,
                $payloadJson,
                $createdAt,
            ]);

            if ($insertEvtStmt->rowCount() === 0) {
                $duplicateCount++;
            } else {
                $acceptedCount++;
            }

            // Always apply latest projection so snapshots/updates stay current
            $decoded = json_decode($payloadJson, true);
            if (!is_array($decoded)) {
                $decoded = [];
            }
            $projectEvent($pdo, $entityType, $entityId, $opType, $decoded, $originTerminal, $createdAt);
        }

        if ($maxSequence > 0) {
            $wmStmt = $pdo->prepare(
                "INSERT INTO cloud_sync_watermarks (source_terminal_id, target_node_id, last_replicated_sequence, last_sync_timestamp)
                 VALUES (?, 'HOSTINGER_MYSQL', ?, NOW())
                 ON DUPLICATE KEY UPDATE
                     last_replicated_sequence = GREATEST(last_replicated_sequence, VALUES(last_replicated_sequence)),
                     last_sync_timestamp = NOW()"
            );
            $wmStmt->execute([$terminalId, $maxSequence]);
        }

        $wmQuery = $pdo->prepare("SELECT COALESCE(last_replicated_sequence, 0) FROM cloud_sync_watermarks WHERE source_terminal_id = ? AND target_node_id = 'HOSTINGER_MYSQL'");
        $wmQuery->execute([$terminalId]);
        $latestWatermark = (int)($wmQuery->fetchColumn() ?: $maxSequence);

        $pdo->commit();

        ameer_json_response([
            'status' => 'SYNCED',
            'acceptedCount' => $acceptedCount,
            'duplicateCount' => $duplicateCount,
            'latestCloudWatermark' => $latestWatermark,
            'serverTimestamp' => gmdate('c'),
            'message' => "Hostinger Cloud synced {$acceptedCount} new event(s) ({$duplicateCount} duplicate(s) skipped).",
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        ameer_json_response([
            'status' => 'ERROR',
            'message' => 'Cloud push failed: ' . $e->getMessage(),
        ], 500);
    }
}

if ($method === 'GET' && $route === 'sync/pull') {
    $terminalId = trim((string)($_GET['terminal_id'] ?? $_GET['terminalId'] ?? 'POS-01'));
    $sinceId = max(0, (int)($_GET['since_id'] ?? $_GET['sinceId'] ?? 0));
    $limit = min(500, max(1, (int)($_GET['limit'] ?? 200)));

    $stmt = $pdo->prepare(
        "SELECT id, event_id, origin_terminal_id, origin_sequence_number, entity_type, entity_id, operation_type, payload_json, created_at
         FROM cloud_sync_events
         WHERE id > ? AND origin_terminal_id <> ?
         ORDER BY id ASC
         LIMIT ?"
    );
    $stmt->bindValue(1, $sinceId, PDO::PARAM_INT);
    $stmt->bindValue(2, $terminalId, PDO::PARAM_STR);
    $stmt->bindValue(3, $limit, PDO::PARAM_INT);
    $stmt->execute();
    $rows = $stmt->fetchAll();

    $nextCursor = $sinceId;
    $events = [];
    foreach ($rows as $r) {
        $id = (int)$r['id'];
        if ($id > $nextCursor) {
            $nextCursor = $id;
        }
        $events[] = [
            'cloudId' => $id,
            'eventId' => $r['event_id'],
            'originTerminalId' => $r['origin_terminal_id'],
            'originSequenceNumber' => (int)$r['origin_sequence_number'],
            'entityType' => $r['entity_type'],
            'entityId' => $r['entity_id'],
            'operationType' => $r['operation_type'],
            'payloadJson' => $r['payload_json'],
            'createdAt' => $r['created_at'],
        ];
    }

    ameer_json_response([
        'status' => 'OK',
        'events' => $events,
        'nextCursor' => $nextCursor,
        'serverTimestamp' => gmdate('c'),
    ]);
}

if ($method === 'POST' && $route === 'backup/upload') {
    $terminalId = trim((string)($_SERVER['HTTP_X_TERMINAL_ID'] ?? $_GET['terminal_id'] ?? 'POS-01'));
    $requestedName = trim((string)($_SERVER['HTTP_X_BACKUP_FILENAME'] ?? $_GET['filename'] ?? ''));
    $expectedSha = strtolower(trim((string)($_SERVER['HTTP_X_BACKUP_SHA256'] ?? $_GET['sha256'] ?? '')));
    $binary = null;

    if (!empty($_FILES['backup_file']['tmp_name']) && is_uploaded_file($_FILES['backup_file']['tmp_name'])) {
        $binary = file_get_contents($_FILES['backup_file']['tmp_name']);
        if ($requestedName === '') {
            $requestedName = (string)($_FILES['backup_file']['name'] ?? '');
        }
        if ($terminalId === 'POS-01' && !empty($_POST['terminal_id'])) {
            $terminalId = trim((string)$_POST['terminal_id']);
        }
        if ($expectedSha === '' && !empty($_POST['sha256_checksum'])) {
            $expectedSha = strtolower(trim((string)$_POST['sha256_checksum']));
        }
    } else {
        $raw = file_get_contents('php://input');
        $contentType = strtolower((string)($_SERVER['CONTENT_TYPE'] ?? ''));
        if (str_contains($contentType, 'application/json')) {
            $json = json_decode($raw ?: '{}', true);
            if (is_array($json)) {
                $terminalId = trim((string)($json['terminalId'] ?? $json['terminal_id'] ?? $terminalId));
                $requestedName = trim((string)($json['filename'] ?? $requestedName));
                $expectedSha = strtolower(trim((string)($json['sha256Checksum'] ?? $json['sha256_checksum'] ?? $expectedSha)));
                $b64 = (string)($json['contentBase64'] ?? $json['content_base64'] ?? '');
                if ($b64 !== '') {
                    $decoded = base64_decode($b64, true);
                    if ($decoded !== false) {
                        $binary = $decoded;
                    }
                }
            }
        } else {
            $binary = $raw;
        }
    }

    if (!is_string($binary) || strlen($binary) < 100) {
        ameer_json_response(['status' => 'BAD_REQUEST', 'message' => 'Backup payload is empty or invalid.'], 400);
    }

    if (!str_starts_with($binary, "SQLite format 3\0")) {
        ameer_json_response(['status' => 'BAD_REQUEST', 'message' => 'Uploaded file is not a valid SQLite 3 database.'], 400);
    }

    $actualSha = hash('sha256', $binary);
    if ($expectedSha !== '' && !hash_equals($expectedSha, $actualSha)) {
        ameer_json_response([
            'status' => 'CHECKSUM_MISMATCH',
            'message' => 'SHA-256 verification failed during cloud upload.',
        ], 422);
    }

    $backupDir = rtrim((string)($cfg['backup_dir'] ?? (__DIR__ . '/backups')), '/\\');
    if (!is_dir($backupDir) && !@mkdir($backupDir, 0750, true) && !is_dir($backupDir)) {
        ameer_json_response(['status' => 'ERROR', 'message' => 'Could not create backup directory on server.'], 500);
    }

    // Ensure direct HTTP protection inside backups directory
    $subHtaccess = $backupDir . '/.htaccess';
    if (!file_exists($subHtaccess)) {
        @file_put_contents($subHtaccess, "Options -Indexes\n<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nOrder allow,deny\nDeny from all\n</IfModule>\n");
    }

    $safeBase = preg_replace('/[^A-Za-z0-9._-]/', '_', basename($requestedName !== '' ? $requestedName : ('ameer_pos_' . date('Ymd_His') . '.db')));
    if (!str_ends_with(strtolower($safeBase), '.db')) {
        $safeBase .= '.db';
    }
    $storedName = date('Ymd_His') . '_' . substr($actualSha, 0, 8) . '_' . $safeBase;
    $targetPath = $backupDir . '/' . $storedName;

    if (file_put_contents($targetPath, $binary, LOCK_EX) === false) {
        ameer_json_response(['status' => 'ERROR', 'message' => 'Failed to write backup file on server.'], 500);
    }

    $backupId = 'bkp_' . bin2hex(random_bytes(8));
    $stmt = $pdo->prepare(
        'INSERT INTO cloud_backups (backup_id, terminal_id, filename, file_size_bytes, sha256_checksum, stored_path)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $backupId,
        $terminalId !== '' ? $terminalId : 'POS-01',
        $safeBase,
        strlen($binary),
        $actualSha,
        $storedName,
    ]);

    ameer_json_response([
        'status' => 'UPLOADED',
        'backupId' => $backupId,
        'filename' => $safeBase,
        'fileSizeBytes' => strlen($binary),
        'sha256Checksum' => $actualSha,
        'serverTimestamp' => gmdate('c'),
        'message' => 'SQLite hot backup uploaded and SHA-256 verified on Hostinger Cloud.',
    ]);
}

if ($method === 'GET' && $route === 'owner/metrics') {
    $period = strtolower(trim((string)($_GET['period'] ?? 'today')));
    $branch = trim((string)($_GET['branch'] ?? 'ALL'));
    $snap = ameer_build_live_dashboard_snapshot($pdo, $period, $branch);
    $k = $snap['kpis'];

    ameer_json_response([
        'status' => 'OK',
        'period' => $snap['period'],
        'branch' => $snap['branch'],
        'syncCursor' => $snap['syncCursor'],
        'grossSalesPaisa' => $k['totalGrossSalesPaisa'],
        'discountsPaisa' => $k['totalDiscountsPaisa'],
        'refundsPaisa' => $k['totalReturnsPaisa'],
        'netSalesPaisa' => $k['totalNetRealizedPaisa'],
        'cogsPaisa' => $k['cogsPaisa'],
        'grossProfitPaisa' => $k['grossProfitPaisa'],
        'pettyExpensesPaisa' => $k['pettyExpensesPaisa'],
        'salariesPaisa' => $k['salariesPaisa'],
        'netProfitPaisa' => $k['estNetProfitPaisa'],
        'perfumeSalesPaisa' => $k['perfumeSalesPaisa'],
        'attarSalesPaisa' => $k['attarSalesPaisa'],
        'testerSalesPaisa' => $k['testerSalesPaisa'],
        'invoiceCount' => $k['retailInvoicesCount'],
        'wholesaleReceivablePaisa' => $k['wholesaleTotalLedgerUdarPaisa'],
        'onlinePendingCodPaisa' => $k['onlinePendingCodPaisa'],
        'fgInventoryValuationPaisa' => $k['fgCostValPaisa'],
        'snapshot' => $snap,
        'serverTimestamp' => gmdate('c'),
    ]);
}

ameer_json_response([
    'status' => 'NOT_FOUND',
    'message' => "Unknown API route: {$method} /api/v1/{$route}",
], 404);

