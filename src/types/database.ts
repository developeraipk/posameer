// Ameer Perfumes ERP — Phase 2.3.1 Database Type Definitions (46 Tables)

export interface User {
  user_id: string;
  username: string;
  password_hash: string;
  pin_code_hash: string;
  full_name: string;
  role: "SUPER_ADMIN" | "SHOP_MANAGER" | "CASHIER_OPERATOR" | "OWNER";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Salesperson {
  salesperson_id: string;
  code: string;
  full_name: string;
  commission_rate_bp: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  supplier_id: string;
  company_name: string;
  contact_person: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  city: string;
  current_balance_paisa: number;
  is_active: boolean;
}

export interface RawMaterial {
  material_id: string;
  sku: string;
  name: string;
  material_type: "EMPTY_BOTTLE" | "CAP" | "COLLAR" | "PUMP" | "BOX" | "AROMA_CHEMICAL" | "ETHANOL" | "PACKAGING";
  unit_of_measure: "PIECE" | "ML" | "GRAM" | "KG" | "LITER";
  current_stock_units: number;
  weighted_average_cost_paisa: number;
  reorder_threshold_units: number;
  is_active: boolean;
}

export interface PurchaseLinePayload {
  material_id: string;
  quantity_received: number;
  unit_price_paisa: number;
  line_total_paisa: number;
}

export interface CreatePurchaseInvoicePayload {
  supplier_id: string;
  invoice_number: string;
  invoice_date: string;
  lines: PurchaseLinePayload[];
  paid_amount_paisa: number;
  received_by_user_id: string;
  notes?: string;
}

export interface PurchaseInvoiceResult {
  success: boolean;
  invoice_id: string;
  invoice_number: string;
  total_amount_paisa: number;
  paid_amount_paisa: number;
  balance_due_paisa: number;
  payment_status: string;
  items_count: number;
  message: string;
}

export interface FinishedProduct {
  product_id: string;
  sku: string;
  barcode: string;
  name: string;
  brand: string;
  size_ml: number;
  category: "MENS" | "WOMENS" | "UNISEX" | "ORIENTAL_LUXURY" | "LIMITED_EDITION" | "TESTER" | "OFFER" | string;
  current_stock_units: number;
  retail_price_paisa: number;
  wholesale_price_paisa: number;
  latest_batch_cost_paisa: number;
  reorder_threshold_units: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  product_id: string;
  sku: string;
  barcode: string;
  name: string;
  size_ml: number;
  unit_price_paisa: number;
  unit_cost_paisa: number;
  quantity: number;
  discount_paisa: number;
  line_total_paisa: number;
  item_type?: "PERFUME" | "ATTAR" | "TESTER" | "OFFER_BUNDLE";
  attar_id?: string;
  measurement_unit?: "BOTTLE" | "TOLA" | "HALF_TOLA" | "QUARTER_TOLA" | "12ML" | "6ML" | "3ML" | "CUSTOM_ML" | "CUSTOM_GRAM" | "CUSTOM_TOLA";
  density_grams_per_ml?: number;
  is_tester?: boolean;
  max_stock_units?: number;
  offer_bundle_title?: string;
}

export interface CreateProductPayload {
  name: string;
  sku: string;
  barcode?: string;
  brand?: string;
  size_ml: number;
  category: "MENS" | "WOMENS" | "UNISEX" | "ORIENTAL_LUXURY" | "LIMITED_EDITION" | "TESTER" | "OFFER" | string;
  retail_price_paisa: number;
  wholesale_price_paisa: number;
  unit_cost_paisa: number;
  initial_stock_units: number;
  reorder_threshold_units: number;
}

export interface UpdateProductPayload {
  product_id: string;
  name: string;
  category: string;
  size_ml: number;
  retail_price_paisa: number;
  wholesale_price_paisa: number;
  unit_cost_paisa: number;
  reorder_threshold_units: number;
  current_stock_units?: number;
  barcode?: string;
}

export interface CreateAttarPayload {
  name: string;
  sku: string;
  origin_country: string;
  density_grams_per_ml?: number;
  cost_per_tola_paisa: number;
  selling_price_per_tola_paisa: number;
  wholesale_price_per_tola_paisa?: number;
}

export interface UpdateAttarPayload {
  attar_id: string;
  name: string;
  sku: string;
  origin_country?: string;
  density_grams_per_ml?: number;
  cost_per_tola_paisa: number;
  selling_price_per_tola_paisa: number;
  wholesale_price_per_tola_paisa?: number;
  cost_per_half_tola_paisa?: number;
  selling_price_half_tola_paisa?: number;
  cost_per_quarter_tola_paisa?: number;
  selling_price_quarter_tola_paisa?: number;
  cost_per_ml_paisa?: number;
  selling_price_per_ml_paisa?: number;
}

export interface SalesPaymentTender {
  payment_method: "CASH" | "BANK_TRANSFER" | "DIGITAL_WALLET" | "CUSTOMER_CREDIT" | "CARD" | string;
  amount_paisa: number;
  reference_code?: string;
  is_cash_drawer_tender: boolean;
}

export interface CreateSalesInvoiceDto {
  customer_phone: string;
  salesperson_id: string;
  cashier_user_id: string;
  terminal_id: string;
  order_source: "WALK_IN" | "WHATSAPP" | "WEBSITE" | "PHONE" | "SHOP" | string;
  items: {
    product_id: string;
    product_name: string;
    quantity: number;
    size_ml: number;
    unit_cost_paisa: number;
    unit_selling_price_paisa: number;
    discount_amount_paisa: number;
    line_total_paisa: number;
    item_type?: string;
    attar_id?: string;
    measurement_unit?: string;
    density_grams_per_ml?: number;
  }[];
  payments: SalesPaymentTender[];
  gross_total_paisa: number;
  item_discount_paisa: number;
  special_discount_paisa: number;
  net_payable_paisa: number;
}

export interface SalesInvoiceResult {
  success: boolean;
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  terminal_id: string;
  gross_total_paisa: number;
  discount_paisa: number;
  net_payable_paisa: number;
  change_due_paisa: number;
  items_count: number;
  receipt_privacy_enforced: boolean;
  store_name: string;
  store_phone: string;
  store_address: string;
  ntn: string;
  items: {
    product_name: string;
    size_ml: number;
    quantity: number;
    unit_price_paisa: number;
    line_total_paisa: number;
  }[];
}

export interface AttarProduct {
  attar_id: string;
  sku: string;
  name: string;
  origin_country: string;
  density_grams_per_ml: number; // 1050 = 1.050 g/ml
  cost_per_tola_paisa: number;
  selling_price_per_tola_paisa: number;
  cost_per_half_tola_paisa: number;
  selling_price_half_tola_paisa: number;
  cost_per_quarter_tola_paisa: number;
  selling_price_quarter_tola_paisa: number;
  cost_per_ml_paisa: number;
  selling_price_per_ml_paisa: number;
  cost_per_gram_paisa: number;
  selling_price_per_gram_paisa: number;
  cost_per_bottle_paisa: number;
  selling_price_bottle_paisa: number;
  wholesale_price_per_tola_paisa?: number;
  is_active: boolean;
}

export interface StockMovement {
  movement_id: string;
  movement_type: "PURCHASE" | "PRODUCTION_IN" | "PRODUCTION_OUT" | "SALE" | "RETURN" | "ADJUSTMENT" | "QUARANTINE";
  finished_product_id?: string | null;
  material_id?: string | null;
  quantity: number;
  unit_cost_paisa: number;
  reference_invoice_id?: string | null;
  created_at: string;
  created_by_user_id: string;
}

export interface SaleItemStatus {
  product_name: string;
  quantity: number;
  returned_quantity: number;
}

export interface RecentSaleSummary {
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  customer_phone: string;
  net_payable_paisa: number;
  items_count: number;
  total_units: number;
  salesperson_name: string;
  order_source: string;
  payment_method: string;
  cashier_name?: string;
  is_returned?: boolean;
  returned_units?: number;
  return_status?: "NONE" | "PARTIAL" | "FULL" | string;
  product_names?: string;
  items_detail?: SaleItemStatus[];
  discount_paisa?: number;
  gross_total_paisa?: number;
}

export interface CreateSalespersonPayload {
  employee_code: string;
  full_name: string;
  phone: string;
}

export interface UpdateSalespersonPayload {
  salesperson_id: string;
  employee_code: string;
  full_name: string;
  phone: string;
  is_active?: boolean;
}

export interface SalesInvoice {
  invoice_id: string;
  invoice_number: string;
  terminal_id: "POS-01" | "POS-02";
  cashier_id: string; // Internal audit only
  salesperson_id: string; // Internal attribution only
  subtotal_paisa: number;
  discount_paisa: number;
  net_payable_paisa: number;
  status: "COMPLETED" | "VOIDED";
  created_at: string;
}

export interface SalesInvoiceItem {
  item_id: string;
  invoice_id: string;
  item_type: "FINISHED_PRODUCT" | "ATTAR_DECANT";
  finished_product_id?: string | null;
  attar_id?: string | null;
  volume_ml?: number | null;
  grams?: number | null;
  quantity: number;
  unit_price_paisa: number;
  line_total_paisa: number;
  unit_cost_paisa: number;
}

export interface SalesInvoicePayment {
  payment_id: string;
  invoice_id: string;
  payment_method: "CASH" | "RAAST_DIGITAL" | "CARD" | "STORE_CREDIT";
  amount_paisa: number;
  is_cash_drawer_tender: boolean;
  reference_note?: string | null;
}

export interface CashRegisterShift {
  shift_id: string;
  terminal_id: "POS-01" | "POS-02";
  cashier_id: string;
  opening_float_paisa: number;
  expected_cash_paisa: number;
  counted_cash_paisa: number;
  variance_paisa: number;
  shift_status: "OPEN" | "CLOSED";
  opened_at: string;
  closed_at?: string | null;
}

export interface ChartOfAccount {
  account_code: string;
  account_name: string;
  account_type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  current_balance_paisa: number;
}

export interface SyncWatermark {
  node_id: "POS-01" | "POS-02";
  peer_node_id: "POS-01" | "POS-02";
  last_replicated_seq: number;
  last_heartbeat_at: string;
}

// Phase 4 Milestone 2 — Native Rust IPC DTOs
export interface DatabaseInitResult {
  success: boolean;
  schema_version: number;
  tables_count: number;
  indexes_count: number;
  triggers_count: number;
  newly_initialized: boolean;
  message: string;
}

export interface DatabaseIntegrityResult {
  tables_count: number;
  indexes_count: number;
  triggers_count: number;
  foreign_keys_ok: boolean;
  wal_mode_active: boolean;
  integrity_status: string;
  db_file_path: string;
  file_size_bytes: number;
  schema_version: number;
}

export interface DatabaseStatus {
  is_connected: boolean;
  db_file_path: string;
  file_size_bytes: number;
  schema_version: number;
  tables_count: number;
  indexes_count: number;
  triggers_count: number;
  journal_mode: string;
  busy_timeout_ms: number;
  foreign_keys_enabled: boolean;
  integrity_check: string;
}

export interface AppVersionInfo {
  application_name: string;
  version: string;
  phase: string;
  milestone: string;
  database_schema_version: string;
  build_profile: string;
  os: string;
}

export interface WorkstationAppConfig {
  store_name: string;
  tagline: string;
  address: string;
  city: string;
  phone: string;
  ntn: string;
  currency_symbol: string;
  receipt_privacy_enforced: boolean;
  station_id: string;
  is_primary_server: boolean;
  mesh_port: number;
  peer_station_id: string;
}

// Milestone 4: Returns, Quarantine & Customer Store Credits Types
export interface ReturnableItem {
  invoice_item_id: string;
  product_id: string;
  product_name: string;
  size_ml: number;
  quantity_purchased: number;
  quantity_already_returned: number;
  quantity_available_to_return: number;
  unit_price_paisa: number;
  unit_cost_paisa: number;
  line_total_paisa: number;
  original_unit_price_paisa?: number;
}

export interface InvoiceForReturn {
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  customer_phone: string;
  terminal_id: string;
  net_payable_paisa: number;
  is_voided: boolean;
  items: ReturnableItem[];
}

export interface ReturnItemRequest {
  original_retail_item_id: string;
  product_id: string;
  quantity_returned: number;
  condition_status: "UNDAMAGED_NORMAL" | "DAMAGED_RUINED";
  condition_notes?: string;
  deduction_amount_paisa?: number;
  custom_refund_paisa?: number;
}

export interface ReturnHistoryEntry {
  return_id: string;
  return_voucher_number: string;
  original_invoice_number: string;
  customer_phone: string;
  return_date: string;
  condition_status: string;
  total_refund_amount_paisa: number;
  refund_settlement_method: string;
  cashier_name: string;
  items_count: number;
  total_units_returned: number;
  items_summary: string;
}

export interface ProcessReturnPayload {
  original_sales_invoice_id: string;
  refund_settlement_method: "CASH" | "EASYPAISA" | "JAZZCASH" | "CUSTOMER_CREDIT" | "BANK_TRANSFER";
  cashier_user_id: string;
  terminal_id: string;
  items: ReturnItemRequest[];
}

export interface ReturnVoucherResult {
  success: boolean;
  return_id: string;
  return_voucher_number: string;
  return_date: string;
  total_refund_amount_paisa: number;
  refund_settlement_method: string;
  condition_status: string;
  items_returned_count: number;
  store_credit_issued_paisa: number;
  customer_phone: string;
  message: string;
}

export interface CustomerCreditInfo {
  customer_phone: string;
  customer_name: string;
  current_credit_balance_paisa: number;
  last_updated_at: string;
}

export interface QuarantineItem {
  quarantine_id: string;
  return_item_id: string;
  product_id: string;
  product_name: string;
  item_type?: "TESTER" | "ATTAR" | "PERFUME" | string;
  quantity: number;
  unit_cost_paisa: number;
  sold_price_paisa?: number;
  sold_rate_paisa?: number;
  discount_paisa?: number;
  net_rate_paisa?: number;
  damage_deduction_paisa?: number;
  refund_amount_paisa?: number;
  damage_reason: string;
  admin_disposition?: string | null;
  created_at: string;
}

// ----------------------------------------------------------------------------
// MODULE 3 & 4: MANUFACTURING & BOM TYPES
// ----------------------------------------------------------------------------

export interface RecipeItem {
  item_id: string;
  raw_material_id: string;
  raw_material_name: string;
  unit_of_measure: string;
  quantity_required: number;
  current_stock_units: number;
  weighted_average_cost_paisa: number;
  item_cost_paisa: number;
}

export interface PerfumeRecipe {
  recipe_id: string;
  finished_product_id: string;
  finished_product_name: string;
  recipe_version: number;
  batch_output_units: number;
  instructions?: string | null;
  is_active: boolean;
  items: RecipeItem[];
  estimated_total_cost_paisa: number;
  estimated_unit_cost_paisa: number;
  category?: string;
  retail_price_paisa?: number;
  wholesale_price_paisa?: number;
  size_ml?: number;
  sku?: string;
}

export interface ManufacturingBatch {
  batch_id: string;
  batch_number: string;
  recipe_id: string;
  finished_product_id: string;
  finished_product_name: string;
  planned_units: number;
  produced_units: number;
  total_cost_paisa: number;
  cost_per_unit_paisa: number;
  status: "PLANNED" | "IN_PRODUCTION" | "COMPLETED" | "CANCELLED";
  production_date: string;
  completed_date?: string | null;
  created_by_user_id: string;
  notes?: string | null;
  size_ml?: number | null;
}

export interface CreateBatchPayload {
  recipe_id: string;
  batch_number: string;
  planned_units: number;
  production_date: string;
  created_by_user_id: string;
  notes?: string | null;
  category?: string;
  cost_per_unit_paisa?: number | null;
  total_cost_paisa?: number | null;
  size_ml?: number | null;
  retail_price_paisa?: number | null;
  wholesale_price_paisa?: number | null;
}

export interface ReleaseBatchPayload {
  batch_id: string;
  produced_units: number;
  authorized_by_user_id: string;
  notes?: string | null;
}

export interface ReleaseBatchResult {
  success: boolean;
  batch_id: string;
  batch_number: string;
  planned_units: number;
  produced_units: number;
  evaporation_loss_units: number;
  total_batch_cost_paisa: number;
  cost_per_unit_paisa: number;
  message: string;
}

// ----------------------------------------------------------------------------
// MODULE 5: WHOLESALE MANAGEMENT & CUSTOMER LEDGER TYPES
// ----------------------------------------------------------------------------

export interface CreateWholesaleCustomerPayload {
  business_name: string;
  contact_person: string;
  phone: string;
  city: string;
  credit_limit_paisa: number;
  initial_balance_paisa?: number;
}

export interface UpdateWholesaleCustomerPayload {
  customer_id: string;
  business_name: string;
  contact_person: string;
  phone: string;
  city: string;
  credit_limit_paisa: number;
}

export interface WholesaleCustomer {
  customer_id: string;
  business_name: string;
  contact_person: string;
  phone: string;
  city: string;
  credit_limit_paisa: number;
  current_balance_paisa: number;
  is_active: boolean;
}

export interface WholesaleInvoiceItemPayload {
  finished_product_id?: string;
  attar_id?: string;
  item_type: "PERFUME" | "ATTAR";
  quantity: number;
  agreed_wholesale_price_paisa: number;
  batch_id?: string;
}

export interface CreateWholesaleInvoicePayload {
  customer_id: string;
  invoice_number: string;
  order_source: "DIRECT" | "WHATSAPP" | "PHONE";
  salesperson_id: string;
  items: WholesaleInvoiceItemPayload[];
  discount_paisa: number;
  paid_amount_paisa: number;
  payment_method?: string;
  received_by_user_id: string;
  notes?: string;
}

export interface WholesaleInvoiceResult {
  success: boolean;
  wholesale_invoice_id: string;
  invoice_number: string;
  subtotal_paisa: number;
  discount_paisa: number;
  net_total_paisa: number;
  paid_amount_paisa: number;
  balance_due_paisa: number;
  payment_status: string;
  message: string;
}

export interface WholesaleInvoiceSummary {
  wholesale_invoice_id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  invoice_date: string;
  order_source: string;
  salesperson_name: string;
  net_total_paisa: number;
  paid_amount_paisa: number;
  balance_due_paisa: number;
  payment_status: string;
}

export interface WholesaleInvoiceDetailItem {
  item_id: string;
  name: string;
  item_type: string;
  quantity: number;
  unit_price_paisa: number;
  line_total_paisa: number;
  size_ml?: number | null;
}

export interface WholesaleInvoicePaymentItem {
  wholesale_payment_id: string;
  payment_date: string;
  payment_method: string;
  amount_paid_paisa: number;
  reference_number?: string | null;
  notes?: string | null;
  received_by: string;
  created_at: string;
}

export interface WholesaleInvoiceDetails {
  wholesale_invoice_id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  contact_person: string;
  phone: string;
  city: string;
  current_balance_paisa: number;
  invoice_date: string;
  order_source: string;
  salesperson_name: string;
  subtotal_paisa: number;
  discount_paisa: number;
  net_total_paisa: number;
  paid_amount_paisa: number;
  balance_due_paisa: number;
  payment_status: string;
  is_voided: boolean;
  items: WholesaleInvoiceDetailItem[];
  payments: WholesaleInvoicePaymentItem[];
}

export interface WholesaleLedgerEntry {
  ledger_entry_id: string;
  customer_id: string;
  transaction_timestamp: string;
  transaction_type: string;
  reference_type: string;
  reference_id: string;
  debit_paisa: number;
  credit_paisa: number;
  running_balance_paisa: number;
  notes?: string;
}

export interface RecordWholesalePaymentPayload {
  customer_id: string;
  wholesale_invoice_id?: string;
  amount_paid_paisa: number;
  payment_method: string;
  reference_number?: string;
  notes?: string;
  received_by_user_id: string;
}

// ----------------------------------------------------------------------------
// MODULE 9 & 10: CASH REGISTER SHIFTS & PETTY EXPENSES TYPES
// ----------------------------------------------------------------------------

export interface CashDenominationCount {
  note_5000: number;
  note_1000: number;
  note_500: number;
  note_100: number;
  note_50: number;
  note_20: number;
  note_10: number;
  coins_total_paisa: number;
  calculated_total_paisa: number;
}

export interface OpenShiftPayload {
  terminal_id: string;
  cashier_user_id: string;
  opening_cash_float_paisa: number;
  denominations?: CashDenominationCount;
}

export interface CloseShiftPayload {
  shift_id: string;
  counted_denominations: CashDenominationCount;
  discrepancy_reason?: string;
  manager_user_id: string;
}

export interface ShiftSummary {
  shift_id: string;
  terminal_id: string;
  cashier_user_id: string;
  cashier_name: string;
  opened_at: string;
  closed_at?: string | null;
  opening_cash_float_paisa: number;
  system_expected_cash_paisa: number;
  actual_counted_cash_paisa?: number | null;
  variance_paisa?: number | null;
  shift_status: "OPEN" | "CLOSED" | "AUDITED";
}

export interface CloseShiftResult {
  success: boolean;
  shift_id: string;
  system_expected_cash_paisa: number;
  actual_counted_cash_paisa: number;
  variance_paisa: number;
  variance_status: "MATCHED" | "EXCESS" | "SHORTAGE";
  message: string;
}

export interface PettyExpense {
  expense_id: string;
  shift_id?: string | null;
  category: "CHAI_REFRESHMENTS" | "CLEANING_SUPPLIES" | "UTILITIES_MISC" | "OFFICE_STATIONERY" | "REPAIR_MAINTENANCE" | "TRAVEL_CONVEYANCE" | "OTHER";
  expense_date: string;
  amount_paisa: number;
  description: string;
  recipient_payee: string;
  authorized_by_manager_name: string;
  authorized_by_name?: string | null;
  brought_by_name?: string | null;
  created_by_user_name: string;
  created_at: string;
}

export interface RecordPettyExpensePayload {
  shift_id?: string;
  deduct_from_drawer?: boolean;
  category: string;
  amount_paisa: number;
  description: string;
  recipient_payee: string;
  authorized_by_name?: string;
  brought_by_name?: string;
  authorized_by_manager_id: string;
  created_by_user_id: string;
}

// ============================================================================
// MODULE 10: FINANCIAL ACCOUNTING & GENERAL LEDGER TYPES
// ============================================================================

export interface Account {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  account_category: string;
  normal_balance: "DEBIT" | "CREDIT";
  parent_account_id?: string | null;
  is_active: boolean;
  current_balance_paisa: number;
  total_debit_paisa: number;
  total_credit_paisa: number;
}

export interface JournalVoucherItem {
  entry_id: string;
  voucher_id: string;
  account_id: string;
  account_code: string;
  account_name: string;
  entry_side: "DEBIT" | "CREDIT";
  debit_paisa: number;
  credit_paisa: number;
  currency: string;
  memo?: string | null;
}

export interface JournalVoucher {
  voucher_id: string;
  voucher_number: string;
  voucher_date: string;
  voucher_type: "STANDARD" | "PURCHASE" | "SALES" | "PAYMENT" | "RECEIPT" | "REVERSAL" | "CORRECTION" | "CLOSING";
  source_module: string;
  source_document_id: string;
  description: string;
  is_posted: boolean;
  is_immutable: boolean;
  posted_by_user_id: string;
  posted_by_user_name: string;
  created_at: string;
  total_debit_paisa: number;
  total_credit_paisa: number;
  items: JournalVoucherItem[];
}

export interface CreateJournalVoucherLinePayload {
  account_id: string;
  entry_side: "DEBIT" | "CREDIT";
  amount_paisa: number;
  memo?: string;
}

export interface CreateJournalVoucherPayload {
  voucher_date: string;
  voucher_type: string;
  source_module: string;
  source_document_id: string;
  description: string;
  user_id: string;
  auto_post: boolean;
  lines: CreateJournalVoucherLinePayload[];
}

export interface AccountLedgerEntry {
  entry_id: string;
  voucher_id: string;
  voucher_number: string;
  voucher_date: string;
  voucher_type: string;
  source_module: string;
  description: string;
  entry_side: "DEBIT" | "CREDIT";
  debit_paisa: number;
  credit_paisa: number;
  memo?: string | null;
  running_balance_paisa: number;
}

export interface TrialBalanceItem {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  account_category: string;
  normal_balance: "DEBIT" | "CREDIT";
  total_debit_paisa: number;
  total_credit_paisa: number;
  net_debit_paisa: number;
  net_credit_paisa: number;
}

export interface TrialBalanceReport {
  items: TrialBalanceItem[];
  grand_total_debit_paisa: number;
  grand_total_credit_paisa: number;
  is_balanced: boolean;
  generated_at: string;
}

export interface IncomeStatementReport {
  revenue_items: TrialBalanceItem[];
  total_gross_revenue_paisa: number;
  returns_allowances_paisa: number;
  discounts_given_paisa: number;
  net_revenue_paisa: number;
  cogs_items: TrialBalanceItem[];
  total_cogs_paisa: number;
  gross_profit_paisa: number;
  expense_items: TrialBalanceItem[];
  total_operating_expenses_paisa: number;
  net_profit_loss_paisa: number;
  generated_at: string;
}

export interface BalanceSheetReport {
  current_assets: TrialBalanceItem[];
  non_current_assets: TrialBalanceItem[];
  total_assets_paisa: number;
  current_liabilities: TrialBalanceItem[];
  total_liabilities_paisa: number;
  equity_items: TrialBalanceItem[];
  period_net_profit_loss_paisa: number;
  total_equity_paisa: number;
  total_liabilities_and_equity_paisa: number;
  is_balanced: boolean;
  variance_paisa: number;
  generated_at: string;
}

export interface FinancialStatements {
  income_statement: IncomeStatementReport;
  balance_sheet: BalanceSheetReport;
}

// ============================================================================
// MODULE 11: EXECUTIVE BI & REPORTING TYPES
// ============================================================================

export interface HourlySales {
  hour: number;
  total_sales_paisa: number;
  order_count: number;
}

export interface TopSellingProduct {
  name: string;
  item_type: string;
  quantity_sold: number;
  revenue_paisa: number;
}

export interface ExecutiveActivity {
  activity_type: string;
  title: string;
  subtitle: string;
  amount_paisa?: number | null;
  timestamp: string;
}

export interface ChannelMetric {
  channel: string;
  order_count: number;
  revenue_paisa: number;
  total_units?: number;
}

export interface EmployeePerformance {
  salesperson_id: string;
  employee_code: string;
  full_name: string;
  order_count: number;
  total_units: number;
  total_revenue_paisa: number;
}

export interface DiscountHistoryItem {
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  customer_phone: string;
  gross_total_paisa: number;
  discount_paisa: number;
  net_payable_paisa: number;
  cashier_name: string;
  salesperson_name?: string;
}

export interface MostReturnedProduct {
  product_name: string;
  item_type: string;
  total_units_returned: number;
  damaged_units: number;
  restocked_units: number;
  total_refund_paisa: number;
  return_vouchers_count?: number;
}

export interface ExecutiveDashboard {
  today_gross_sales_paisa: number;
  today_orders_count: number;
  today_attar_sales_paisa: number;
  today_perfume_sales_paisa: number;
  today_perfume_orders_count?: number;
  today_perfume_units_count?: number;
  today_attar_orders_count?: number;
  today_attar_units_count?: number;
  today_tester_samples_count?: number;
  today_tester_ml?: number;
  today_tester_orders_count?: number;
  today_tester_sales_paisa?: number;
  today_net_sales_paisa?: number;
  today_discount_paisa?: number;
  today_discount_orders_count?: number;
  today_refunds_paisa?: number;
  today_returns_count?: number;
  today_perfume_ret_units?: number;
  today_attar_ret_units?: number;
  today_tester_ret_units?: number;
  today_perfume_refunds_paisa?: number;
  today_attar_refunds_paisa?: number;
  today_tester_refunds_paisa?: number;
  total_online_pending_paisa?: number;
  online_pending_orders_count?: number;
  total_online_collected_paisa?: number;
  today_perfume_discount_paisa?: number;
  today_perfume_discount_units?: number;
  today_attar_discount_paisa?: number;
  today_attar_discount_units?: number;
  today_tester_discount_paisa?: number;
  today_tester_discount_units?: number;
  today_perfume_gross_paisa?: number;
  today_attar_gross_paisa?: number;
  today_tester_gross_paisa?: number;
  all_time_cash_drawer_paisa?: number;
  all_time_easypaisa_paisa?: number;
  all_time_jazzcash_paisa?: number;
  mtd_refunds_paisa?: number;
  mtd_returns_count?: number;
  discount_history?: DiscountHistoryItem[];
  most_returned_products?: MostReturnedProduct[];
  mtd_gross_revenue_paisa: number;
  mtd_net_profit_paisa: number;
  total_inventory_valuation_paisa: number;
  finished_goods_valuation_paisa: number;
  raw_materials_valuation_paisa: number;
  total_wholesale_receivables_paisa: number;
  cash_in_drawer_paisa: number;
  store_credit_liability_paisa: number;
  total_cash_received_paisa?: number;
  total_easypaisa_received_paisa?: number;
  total_jazzcash_received_paisa?: number;
  total_bank_received_paisa?: number;
  total_digital_bank_funds_paisa?: number;
  total_salary_paid_paisa?: number;
  total_shop_expenses_paisa?: number;
  total_gross_liquidity_paisa?: number;
  net_available_treasury_paisa?: number;
  hourly_sales: HourlySales[];
  top_selling_products: TopSellingProduct[];
  recent_activity: ExecutiveActivity[];
  channel_breakdown?: ChannelMetric[];
  employee_performance?: EmployeePerformance[];
}

export interface EmployeeSalaryPayout {
  payout_id: string;
  employee_id: string;
  employee_name: string;
  employee_role: string;
  payout_type: "DAILY_WAGE" | "WEEKLY_PAYOUT" | "MONTHLY_SALARY" | "ADVANCE_PAYMENT" | "COMMISSION";
  amount_paisa: number;
  payment_method: "CASH" | "EASYPAISA" | "JAZZCASH";
  disbursed_by_user_id: string;
  disbursed_by_name: string;
  notes?: string | null;
  payout_date: string;
  created_at: string;
}

export interface RecordSalaryPayoutPayload {
  employee_id: string;
  employee_name: string;
  employee_role?: string;
  payout_type: "DAILY_WAGE" | "WEEKLY_PAYOUT" | "MONTHLY_SALARY" | "ADVANCE_PAYMENT" | "COMMISSION";
  amount_paisa: number;
  payment_method: "CASH" | "EASYPAISA" | "JAZZCASH";
  disbursed_by_user_id: string;
  disbursed_by_name: string;
  notes?: string;
  payout_date?: string;
}

export interface RawMaterialValuation {
  material_id: string;
  sku: string;
  name: string;
  category: string;
  stock_quantity: number;
  unit_of_measure: string;
  cost_per_unit_paisa: number;
  total_value_paisa: number;
}

export interface FinishedGoodValuation {
  product_id: string;
  sku: string;
  name: string;
  stock_units: number;
  unit_cost_paisa: number;
  selling_price_paisa: number;
  total_cost_value_paisa: number;
  total_retail_value_paisa: number;
}

export interface InventoryValuationReport {
  total_cost_valuation_paisa: number;
  total_retail_valuation_paisa: number;
  raw_materials: RawMaterialValuation[];
  finished_goods: FinishedGoodValuation[];
  generated_at: string;
}

// ============================================================================
// MODULE 12: OFFLINE P2P LAN SYNCHRONIZATION TYPES
// ============================================================================

export interface SyncOutboxEvent {
  event_id: string;
  device_id: string;
  local_sequence_number: number;
  entity_type: string;
  entity_id: string;
  operation_type: "INSERT" | "UPDATE" | "DELETE";
  payload_json: string;
  is_synced: boolean;
  created_at: string;
}

export interface SyncInboxEvent {
  inbox_id: string;
  origin_device_id: string;
  origin_sequence_number: number;
  entity_type: string;
  entity_id: string;
  operation_type: string;
  payload_json: string;
  received_at: string;
  is_applied: boolean;
  applied_at?: string | null;
}

export interface SyncWatermarkRecord {
  source_device_id: string;
  target_device_id: string;
  last_replicated_sequence: number;
  last_sync_timestamp: string;
}

export interface SyncConflictQuarantine {
  conflict_id: string;
  event_id: string;
  conflict_reason: string;
  local_state_snapshot: string;
  incoming_state_snapshot: string;
  resolution_status: "PENDING" | "RESOLVED_LOCAL" | "RESOLVED_INCOMING" | "RESOLVED_MANUAL";
  resolved_by_user_id?: string | null;
  resolved_at?: string | null;
  created_at: string;
}

export interface SyncStatus {
  node_id: string;
  peer_node_id: string;
  peer_online: boolean;
  outbox_pending_count: number;
  outbox_synced_count: number;
  inbox_applied_count: number;
  quarantine_conflict_count: number;
  watermarks: SyncWatermarkRecord[];
  recent_outbox: SyncOutboxEvent[];
  recent_inbox: SyncInboxEvent[];
  quarantined_conflicts: SyncConflictQuarantine[];
}

export interface TriggerLanSyncResult {
  success: boolean;
  replicated_events_count: number;
  applied_events_count: number;
  conflicts_detected_count: number;
  message: string;
}

// ============================================================================
// MODULE 14: BACKUP & DISASTER RECOVERY TYPES
// ============================================================================

export interface BackupRecord {
  backup_id: string;
  filename: string;
  file_path: string;
  size_bytes: number;
  sha256_checksum: string;
  tables_count: number;
  indexes_count: number;
  triggers_count: number;
  is_verified: boolean;
  created_at: string;
}

export interface BackupResult {
  success: boolean;
  record: BackupRecord;
  message: string;
}

export interface BackupVerificationResult {
  is_valid: boolean;
  tables_count: number;
  indexes_count: number;
  triggers_count: number;
  integrity_status: string;
  message: string;
}

// ============================================================================
// MODULE 15: HARDWARE PERIPHERALS DIAGNOSTICS TYPES
// ============================================================================

export interface PrinterStatusDto {
  device_name: string;
  interface_type: "USB" | "NETWORK" | "SERIAL";
  paper_width_mm: number;
  status: "ONLINE" | "OUT_OF_PAPER" | "OFFLINE";
  test_print_success: boolean;
  privacy_enforced: boolean;
}

export interface CashDrawerStatusDto {
  connected_via_printer: boolean;
  pulse_pin: number;
  pulse_on_time_ms: number;
  pulse_off_time_ms: number;
  last_kick_at?: string | null;
}

export interface BarcodeScannerConfigDto {
  mode: "USB_HID_KEYBOARD_WEDGE" | "SERIAL_COM";
  prefix: string;
  suffix: string;
  last_scanned_barcode?: string | null;
}

export interface PoleDisplayConfigDto {
  port: string;
  baud_rate: number;
  columns: number;
  rows: number;
  last_message?: string | null;
}

export interface HardwareDiagnosticsDto {
  printer: PrinterStatusDto;
  drawer: CashDrawerStatusDto;
  scanner: BarcodeScannerConfigDto;
  display: PoleDisplayConfigDto;
  overall_healthy: boolean;
}

export interface PrintReceiptTestResult {
  success: boolean;
  bytes_spooled: number;
  privacy_verified: boolean;
  receipt_preview_text: string;
  message: string;
}

export interface KickDrawerResult {
  success: boolean;
  pulse_command_hex: string;
  message: string;
}

export interface PoleDisplayTestResult {
  success: boolean;
  line1_rendered: string;
  line2_rendered: string;
  message: string;
}

export interface OnlineOrderItem {
  item_id?: string;
  product_id?: string;
  attar_id?: string;
  name: string;
  item_type: "PERFUME" | "ATTAR" | "TESTER" | "OFFER";
  quantity: number;
  size_ml?: number;
  unit_price_paisa: number;
  line_total_paisa: number;
  discount_paisa?: number;
  grams?: number;
  is_tester?: boolean;
  returned_quantity?: number;
  return_status?: string;
}

export interface OnlineOrder {
  order_id: string;
  order_number: string;
  channel: "WHATSAPP" | "WEBSITE";
  customer_name: string;
  customer_phone: string;
  shipping_address: string;
  city: string;
  items_json: string;
  items?: OnlineOrderItem[];
  subtotal_paisa: number;
  delivery_charges_paisa: number;
  discount_paisa: number;
  total_amount_paisa: number;
  advance_paid_paisa: number;
  cod_balance_paisa: number;
  payment_status: "PAID" | "PARTIAL" | "PENDING" | "RETURNED";
  payment_custodian: "COURIER" | "STAFF_HANDLER" | "SETTLED" | "RETURNED";
  courier_partner: string;
  tracking_number: string;
  delivery_status: "BOOKED" | "DISPATCHED" | "DELIVERED" | "RETURNED_RTO" | "PARTIAL_RETURN" | "CANCELLED";
  collected_by: string;
  collected_at?: string | null;
  collection_method?: string | null;
  collection_reference?: string | null;
  return_reason?: string | null;
  notes?: string | null;
  created_at: string;
  created_by_user_id: string;
  refund_amount_paisa?: number;
  deduction_amount_paisa?: number;
  refund_settlement_method?: string | null;
}

export interface CreateOnlineOrderPayload {
  channel: "WHATSAPP" | "WEBSITE";
  customer_name: string;
  customer_phone: string;
  shipping_address: string;
  city: string;
  items_json: string;
  subtotal_paisa: number;
  delivery_charges_paisa: number;
  discount_paisa: number;
  total_amount_paisa: number;
  advance_paid_paisa: number;
  cod_balance_paisa: number;
  payment_custodian: "COURIER" | "STAFF_HANDLER";
  courier_partner: string;
  tracking_number?: string;
  notes?: string;
  created_by_user_id: string;
}

export interface CollectOnlinePaymentPayload {
  order_id: string;
  amount_paid_paisa: number;
  payment_method: string;
  reference_number?: string;
  collected_by: string;
  notes?: string;
}

export interface MarkOnlineReturnPayload {
  order_id: string;
  return_reason: string;
  user_id: string;
  refund_amount_paisa?: number;
  deduction_amount_paisa?: number;
  refund_settlement_method?: string;
  returned_items_json?: string;
  remaining_items_json?: string;
  new_total_paisa?: number;
  new_subtotal_paisa?: number;
  new_discount_paisa?: number;
  is_partial?: boolean;
}
