// ── Shared types mirroring backend Pydantic schemas ────────────────────────

export interface Account { id: number; code: string; name: string; account_type: string; normal_side: string; is_active: boolean; }
export interface UoM { id: number; code: string; name: string; }
export interface Product { id: number; sku: string; name: string; description?: string; uom_id: number; uom?: UoM; reorder_point: string; reorder_qty: string; preferred_supplier_id?: number; valuation_method: string; inventory_account_id?: number; cogs_account_id?: number; revenue_account_id?: number; current_avg_cost: string; is_active: boolean; created_at: string; }
export interface StockBalance { product_id: number; sku: string; name: string; location_id: number; location_code: string; warehouse_name: string; qty_on_hand: string; avg_cost: string; inventory_value: string; }
export interface Supplier { id: number; code: string; name: string; contact_email?: string; phone?: string; address?: string; payment_terms: number; ap_account_id?: number; is_active: boolean; }
export interface Customer { id: number; code: string; name: string; contact_email?: string; phone?: string; address?: string; credit_limit?: string; ar_account_id?: number; is_active: boolean; }

export interface POLine { id: number; product_id: number; product?: Product; qty_ordered: string; qty_received: string; unit_price: string; tax_rate: string; notes?: string; }
export interface PurchaseOrder { id: number; po_number: string; supplier_id: number; pr_id?: number; status: string; order_date: string; expected_date?: string; currency: string; subtotal: string; tax_amount: string; total_amount: string; notes?: string; lines: POLine[]; created_at: string; }

export interface GRNLine { id: number; po_line_id?: number; product_id: number; product?: Product; qty_received: string; unit_cost: string; it_id?: number; }
export interface GoodsReceipt { id: number; grn_number: string; po_id?: number; supplier_id: number; location_id: number; status: string; receipt_date: string; supplier_ref?: string; je_id?: number; lines: GRNLine[]; created_at: string; }

export interface SupplierInvoice { id: number; inv_number: string; supplier_id: number; grn_id?: number; po_id?: number; status: string; invoice_date: string; due_date?: string; subtotal: string; tax_amount: string; total_amount: string; je_id?: number; created_at: string; }

export interface SOLine { id: number; product_id: number; product?: Product; qty_ordered: string; qty_shipped: string; unit_price: string; discount_pct: string; tax_rate: string; qty_available?: string; }
export interface SalesOrder { id: number; so_number: string; customer_id: number; status: string; order_date: string; required_date?: string; currency: string; subtotal: string; tax_amount: string; total_amount: string; notes?: string; lines: SOLine[]; created_at: string; }

export interface ShipmentLine { id: number; so_line_id?: number; product_id: number; product?: Product; qty_shipped: string; unit_price: string; unit_cost: string; it_id?: number; }
export interface Shipment { id: number; shipment_number: string; so_id: number; customer_id: number; location_id: number; status: string; ship_date: string; carrier?: string; tracking_ref?: string; cogs_je_id?: number; sales_je_id?: number; lines: ShipmentLine[]; created_at: string; }

export interface JournalLine { id: number; account_id: number; account_code?: string; account_name?: string; debit: string; credit: string; description?: string; }
export interface JournalEntry { id: number; entry_date: string; reference?: string; memo?: string; source_type?: string; source_id?: number; is_posted: boolean; posted_at?: string; lines: JournalLine[]; }

export interface InventoryTransaction { id: number; product_id: number; product_sku?: string; product_name?: string; location_id: number; txn_type: string; reference_type?: string; reference_id?: number; qty: string; direction: number; unit_cost: string; txn_date: string; notes?: string; created_at: string; }

export interface MarginRow { product_id: number; sku: string; name: string; qty_sold: string; revenue: string; cogs: string; gross_margin: string; margin_pct: string; }
export interface ValuationRow { product_id: number; sku: string; name: string; qty_on_hand: string; avg_cost: string; inventory_value: string; }
export interface StockAgingRow { product_id: number; sku: string; name: string; last_txn_date?: string; days_since_last_movement?: number; qty_on_hand: string; }
export interface TrialBalanceLine { account_id: number; code: string; name: string; account_type: string; debit_total: string; credit_total: string; balance: string; }
