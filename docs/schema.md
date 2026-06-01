# Database Schema Reference

Database: PostgreSQL 15+

All monetary values: `NUMERIC(15,4)` — never `FLOAT`
All timestamps: `TIMESTAMPTZ` (UTC)
Soft deletes via `is_active` column where present

---

## Entity Relationship Overview

```
users
  └─ (created_by on most documents)

accounts  ──────────────────────────────────────────────────────┐
  └─ journal_entries                                            │
       └─ journal_lines ──→ accounts                            │
                                                                │
warehouses                                                      │
  └─ locations                                                  │
       └─ inventory_transactions ──→ products                   │
       └─ fifo_layers            ──→ products                   │
                                                                │
suppliers ──→ accounts (ap_account_id)                          │
  └─ purchase_orders                                            │
       └─ po_lines ──→ products                                 │
       └─ goods_receipts ──→ locations                          │
            └─ grn_lines ──→ products                           │
            └─ supplier_invoices                                │
       └─ purchase_returns ──→ locations                        │
            └─ purchase_return_lines ──→ products               │
                                                                │
customers ──→ accounts (ar_account_id)                         │
  └─ sales_orders                                               │
       └─ so_lines ──→ products                                 │
       └─ shipments ──→ locations                               │
            └─ shipment_lines ──→ products                      │
       └─ sales_returns ──→ locations                           │
            └─ sales_return_lines ──→ products                  │
                                                                │
products ──→ accounts (inventory, cogs, revenue) ───────────────┘
  ├─ uom
  ├─ preferred_supplier ──→ suppliers
  └─ inventory_transactions
```

---

## Table Reference

### `users`

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| email | VARCHAR(120) UNIQUE | |
| hashed_password | VARCHAR(200) | bcrypt |
| full_name | VARCHAR(120) | |
| role | VARCHAR(20) | ADMIN \| MANAGER \| STAFF |
| is_active | BOOLEAN | default true |
| created_at | TIMESTAMPTZ | |

---

### `accounts`

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| code | VARCHAR(20) UNIQUE | Immutable after creation |
| name | VARCHAR(120) | |
| account_type | VARCHAR(30) | ASSET \| LIABILITY \| EQUITY \| REVENUE \| EXPENSE |
| normal_side | CHAR(1) | D = Debit, C = Credit |
| parent_id | INT FK → accounts | Optional hierarchy |
| is_active | BOOLEAN | Inactive accounts cannot be selected |
| created_at | TIMESTAMPTZ | |

---

### `journal_entries`

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| entry_date | DATE | |
| reference | VARCHAR(60) | e.g. "GRN-2026-0001" |
| memo | TEXT | |
| source_type | VARCHAR(40) | GRN \| SUPPLIER_INVOICE \| SHIPMENT_COGS \| SHIPMENT_REVENUE \| PURCHASE_RETURN \| SALES_RETURN \| ADJUSTMENT \| MANUAL |
| source_id | INT | FK to the source document (NULL for MANUAL) |
| is_posted | BOOLEAN | Always true for auto-generated entries |
| posted_at | TIMESTAMPTZ | |
| created_by | INT | FK → users |
| created_at | TIMESTAMPTZ | |

**Index:** `(source_type, source_id)` for reverse lookup

---

### `journal_lines`

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| entry_id | INT FK → journal_entries CASCADE | |
| account_id | INT FK → accounts | |
| debit | NUMERIC(15,4) | default 0 |
| credit | NUMERIC(15,4) | default 0 |
| description | VARCHAR(200) | |

**Constraint:** debit and credit cannot both be non-zero on the same line
**Index:** `(account_id)` for balance queries

---

### `uom` (Unit of Measure)

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| code | VARCHAR(10) UNIQUE | EA, KG, LTR, BOX, etc. |
| name | VARCHAR(60) | |

---

### `products`

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| sku | VARCHAR(50) UNIQUE | Immutable after creation |
| name | VARCHAR(120) | |
| description | TEXT | |
| uom_id | INT FK → uom | |
| reorder_point | NUMERIC(15,4) | Alert threshold |
| reorder_qty | NUMERIC(15,4) | Suggested order quantity |
| preferred_supplier_id | INT FK → suppliers | Optional |
| valuation_method | VARCHAR(20) | WAVG \| FIFO |
| inventory_account_id | INT FK → accounts | Asset account |
| cogs_account_id | INT FK → accounts | Expense account |
| revenue_account_id | INT FK → accounts | Revenue account |
| current_avg_cost | NUMERIC(15,4) | Denormalized; updated on every GRN |
| is_active | BOOLEAN | |
| created_at / updated_at | TIMESTAMPTZ | |

---

### `warehouses`

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| code | VARCHAR(20) UNIQUE | |
| name | VARCHAR(120) | |
| is_active | BOOLEAN | |

---

### `locations`

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| warehouse_id | INT FK → warehouses | |
| code | VARCHAR(30) | Unique within warehouse |
| name | VARCHAR(80) | Optional description |

**Unique constraint:** `(warehouse_id, code)`

---

### `inventory_transactions`

The append-only ledger — **never updated, only inserted**.

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| product_id | INT FK → products | |
| location_id | INT FK → locations | |
| txn_type | VARCHAR(30) | See below |
| reference_type | VARCHAR(30) | GRN \| SHIP \| ADJ \| TRF \| PRET \| SRET \| OPENING |
| reference_id | INT | FK to the source document |
| reference_line | INT | FK to the source document line |
| qty | NUMERIC(15,4) | Always positive |
| direction | SMALLINT | +1 = IN, -1 = OUT |
| unit_cost | NUMERIC(15,4) | Cost at time of transaction |
| txn_date | DATE | |
| notes | TEXT | |
| created_by | INT | |
| created_at | TIMESTAMPTZ | |

**txn_type values:** `GRN_RECEIPT`, `GRN_RETURN`, `SO_SHIPMENT`, `SO_RETURN`, `INV_ADJUST_IN`, `INV_ADJUST_OUT`, `STOCK_TRANSFER_OUT`, `STOCK_TRANSFER_IN`, `OPENING`

**Indexes:** `(product_id, location_id)`, `(txn_date)`

**Stock balance view:**
```sql
CREATE VIEW v_stock_balance AS
SELECT product_id, location_id,
       SUM(qty * direction) AS qty_on_hand,
       SUM(qty * direction * unit_cost) AS inventory_value
FROM inventory_transactions
GROUP BY product_id, location_id;
```

---

### `fifo_layers`

One row per GRN line for FIFO products. Consumed oldest-first during shipment.

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| product_id | INT FK → products | |
| location_id | INT FK → locations | |
| grn_txn_id | INT FK → inventory_transactions | |
| receipt_date | DATE | Used for FIFO ordering |
| qty_received | NUMERIC(15,4) | Original quantity |
| qty_remaining | NUMERIC(15,4) | Decremented as stock is consumed |
| unit_cost | NUMERIC(15,4) | |

**Index:** `(product_id, location_id, receipt_date)`

---

### `suppliers`

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| code | VARCHAR(20) UNIQUE | |
| name | VARCHAR(120) | |
| contact_email | VARCHAR(120) | |
| phone | VARCHAR(30) | |
| address | TEXT | |
| payment_terms | INT | Days net (e.g. 30) |
| ap_account_id | INT FK → accounts | Default AP account |
| is_active | BOOLEAN | |

---

### `customers`

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| code | VARCHAR(20) UNIQUE | |
| name | VARCHAR(120) | |
| contact_email | VARCHAR(120) | |
| phone | VARCHAR(30) | |
| address | TEXT | |
| credit_limit | NUMERIC(15,4) | Optional |
| ar_account_id | INT FK → accounts | Default AR account |
| is_active | BOOLEAN | |

---

### `purchase_requisitions`

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| pr_number | VARCHAR(20) UNIQUE | Auto-generated: PR-YYYY-NNNN |
| status | VARCHAR(20) | DRAFT \| SUBMITTED \| APPROVED \| CLOSED |
| requested_by | INT FK → users | |
| approved_by | INT FK → users | |
| required_date | DATE | |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | |

### `pr_lines`

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| pr_id | INT FK → purchase_requisitions CASCADE | |
| product_id | INT FK → products | |
| qty_requested | NUMERIC(15,4) | |
| notes | TEXT | |

---

### `purchase_orders`

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| po_number | VARCHAR(20) UNIQUE | Auto-generated: PO-YYYY-NNNN |
| supplier_id | INT FK → suppliers | |
| pr_id | INT FK → purchase_requisitions | Optional |
| status | VARCHAR(30) | DRAFT \| SUBMITTED \| APPROVED \| PARTIALLY_RECEIVED \| FULLY_RECEIVED \| CANCELLED |
| order_date | DATE | |
| expected_date | DATE | |
| currency | CHAR(3) | default USD |
| subtotal | NUMERIC(15,4) | |
| tax_amount | NUMERIC(15,4) | |
| total_amount | NUMERIC(15,4) | |
| notes | TEXT | |
| created_by | INT | |
| created_at / updated_at | TIMESTAMPTZ | |

### `po_lines`

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| po_id | INT FK → purchase_orders CASCADE | |
| product_id | INT FK → products | |
| qty_ordered | NUMERIC(15,4) | |
| qty_received | NUMERIC(15,4) | Incremented on GRN post |
| unit_price | NUMERIC(15,4) | |
| tax_rate | NUMERIC(6,4) | |
| notes | TEXT | |

---

### `goods_receipts`

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| grn_number | VARCHAR(20) UNIQUE | Auto-generated: GRN-YYYY-NNNN |
| po_id | INT FK → purchase_orders | Optional |
| supplier_id | INT FK → suppliers | |
| location_id | INT FK → locations | Receiving location |
| status | VARCHAR(20) | DRAFT \| POSTED |
| receipt_date | DATE | |
| supplier_ref | VARCHAR(60) | Supplier's delivery note number |
| je_id | INT FK → journal_entries | Set on post |
| created_by | INT | |
| created_at | TIMESTAMPTZ | |

### `grn_lines`

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| grn_id | INT FK → goods_receipts CASCADE | |
| po_line_id | INT FK → po_lines | Optional |
| product_id | INT FK → products | |
| qty_received | NUMERIC(15,4) | |
| unit_cost | NUMERIC(15,4) | |
| it_id | INT FK → inventory_transactions | Set on post |

---

### `supplier_invoices`

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| inv_number | VARCHAR(40) UNIQUE | Supplier's invoice number |
| supplier_id | INT FK → suppliers | |
| grn_id | INT FK → goods_receipts | Optional |
| po_id | INT FK → purchase_orders | Optional |
| status | VARCHAR(20) | RECEIVED \| MATCHED \| APPROVED \| PAID |
| invoice_date | DATE | |
| due_date | DATE | |
| subtotal | NUMERIC(15,4) | |
| tax_amount | NUMERIC(15,4) | |
| total_amount | NUMERIC(15,4) | |
| je_id | INT FK → journal_entries | Set on match |
| created_at | TIMESTAMPTZ | |

---

### `purchase_returns`

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| return_number | VARCHAR(20) UNIQUE | PRET-YYYY-NNNN |
| grn_id | INT FK → goods_receipts | Original GRN being returned |
| supplier_id | INT FK → suppliers | |
| location_id | INT FK → locations | Return from location |
| status | VARCHAR(20) | DRAFT \| POSTED |
| return_date | DATE | |
| reason | TEXT | |
| je_id | INT FK → journal_entries | Set on post |
| created_at | TIMESTAMPTZ | |

### `purchase_return_lines`

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| return_id | INT FK → purchase_returns CASCADE | |
| grn_line_id | INT FK → grn_lines | Optional |
| product_id | INT FK → products | |
| qty_returned | NUMERIC(15,4) | |
| unit_cost | NUMERIC(15,4) | |

---

### `sales_orders`

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| so_number | VARCHAR(20) UNIQUE | SO-YYYY-NNNN |
| customer_id | INT FK → customers | |
| status | VARCHAR(30) | DRAFT \| CONFIRMED \| PICKING \| PARTIALLY_SHIPPED \| FULLY_SHIPPED \| CANCELLED |
| order_date | DATE | |
| required_date | DATE | |
| currency | CHAR(3) | |
| subtotal / tax_amount / total_amount | NUMERIC(15,4) | |
| created_by | INT | |
| created_at / updated_at | TIMESTAMPTZ | |

### `so_lines`

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| so_id | INT FK → sales_orders CASCADE | |
| product_id | INT FK → products | |
| qty_ordered | NUMERIC(15,4) | |
| qty_shipped | NUMERIC(15,4) | Incremented on shipment post |
| unit_price | NUMERIC(15,4) | |
| discount_pct | NUMERIC(5,2) | 0–100 |
| tax_rate | NUMERIC(6,4) | |

---

### `shipments`

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| shipment_number | VARCHAR(20) UNIQUE | SHIP-YYYY-NNNN |
| so_id | INT FK → sales_orders | |
| customer_id | INT FK → customers | |
| location_id | INT FK → locations | Dispatch location |
| status | VARCHAR(20) | DRAFT \| POSTED |
| ship_date | DATE | |
| carrier | VARCHAR(60) | |
| tracking_ref | VARCHAR(60) | |
| cogs_je_id | INT FK → journal_entries | COGS journal |
| sales_je_id | INT FK → journal_entries | Revenue journal |
| created_by | INT | |
| created_at | TIMESTAMPTZ | |

### `shipment_lines`

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| shipment_id | INT FK → shipments CASCADE | |
| so_line_id | INT FK → so_lines | Optional |
| product_id | INT FK → products | |
| qty_shipped | NUMERIC(15,4) | |
| unit_price | NUMERIC(15,4) | Selling price |
| unit_cost | NUMERIC(15,4) | **Cost at time of shipment — locked forever** |
| it_id | INT FK → inventory_transactions | Set on post |

---

### `sales_returns` / `sales_return_lines`

Mirrors purchase_returns. Links back to a posted shipment. On post, reverses the COGS and Revenue journal entries.

---

### `inventory_adjustments`

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| adj_number | VARCHAR(20) UNIQUE | ADJ-YYYY-NNNN |
| location_id | INT FK → locations | |
| adj_date | DATE | |
| reason_code | VARCHAR(40) | COUNT_CORRECTION \| DAMAGE \| THEFT \| WRITE_OFF |
| notes | TEXT | |
| status | VARCHAR(20) | DRAFT \| POSTED |
| je_id | INT FK → journal_entries | Set on post |
| created_by | INT | |
| created_at | TIMESTAMPTZ | |

### `adjustment_lines`

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| adj_id | INT FK → inventory_adjustments CASCADE | |
| product_id | INT FK → products | |
| qty_system | NUMERIC(15,4) | System balance before adjustment |
| qty_actual | NUMERIC(15,4) | Physical count |
| unit_cost | NUMERIC(15,4) | Used to value the variance |
| it_id | INT FK → inventory_transactions | Set on post |

**Computed:** `variance = qty_actual − qty_system`

---

### `stock_transfers` / `transfer_lines`

Move stock between locations. No journal entry. Each line creates two `inventory_transactions`: one OUT from source, one IN to destination.

---

## Document Numbering

All document numbers follow the format `PREFIX-YYYY-NNNN`:

| Prefix | Document |
|---|---|
| PR | Purchase Requisition |
| PO | Purchase Order |
| GRN | Goods Receipt |
| PRET | Purchase Return |
| SO | Sales Order |
| SHIP | Shipment |
| SRET | Sales Return |
| ADJ | Inventory Adjustment |
| TRF | Stock Transfer |

Numbers are assigned at creation and **never reused**, even if the document is cancelled.

---

## Key Constraints

1. `journal_lines.debit` and `journal_lines.credit` cannot both be non-zero on the same line
2. Every `journal_entry` must have `SUM(debit) = SUM(credit)` — enforced in the service layer
3. `inventory_transactions` is append-only — no UPDATE or DELETE
4. `products.sku` is immutable after creation
5. `accounts.code` is immutable after creation
6. A GRN, shipment, adjustment or transfer cannot be posted twice
7. Stock can only go negative if you bypass the service layer — the service checks on-hand before every issue
