# Accounting Integration

This document explains how the double-entry accounting engine works inside SCM ERP — the most critical and most misunderstood part of the system.

---

## Fundamental Rule

> **Every financial event produces a balanced journal entry. Sum of debits always equals sum of credits. No exceptions.**

The system enforces this at two levels:
1. **Service layer** (`posting_service.py`) — calls `_assert_balanced()` before committing
2. **API layer** — manual journal endpoint rejects unbalanced payloads with HTTP 400

---

## The Clearing Account Pattern

The most important concept to understand is the **1210 Inventory Received / Accrual** account. This is a liability clearing account that bridges the time gap between receiving goods and receiving the supplier's invoice.

```
Day 1: Goods arrive → GRN posted
  DR 1200  Inventory Asset         1,000.00   ← stock increases
  CR 1210  Inventory Received      1,000.00   ← we owe something but no invoice yet

Day 3: Invoice arrives → matched
  DR 1210  Inventory Received      1,000.00   ← clears the accrual
  CR 2100  Accounts Payable        1,000.00   ← now it's a formal payable
```

The `1210` account balance at any point equals the value of goods received but not yet invoiced. A non-zero `1210` balance after month-end means unmatched GRNs — this is normal and expected for goods in transit.

---

## All Auto-Generated Journal Entries

### 1. Goods Receipt (GRN) — Post

**Trigger:** Clicking "Post" on a DRAFT GRN

```
DR  1200  Inventory Asset           [total receipt value]
CR  1210  Inventory Received        [total receipt value]
```

One DR/CR pair per GRN line. The `source_type = "GRN"` on the journal entry.

**Also happens:**
- `inventory_transactions` row inserted (direction = +1)
- Product `current_avg_cost` recalculated (WAVG) or FIFO layer added
- PO `qty_received` incremented, PO status updated

---

### 2. Supplier Invoice — Match

**Trigger:** Clicking "Match" on a RECEIVED supplier invoice

```
DR  1210  Inventory Received        [invoice total]
CR  2100  Accounts Payable          [invoice total]
```

`source_type = "SUPPLIER_INVOICE"`

**Important:** If the invoice amount differs from the GRN value (price variance), the difference goes to a purchase price variance account. In the current implementation the full invoice amount clears `1210` — if you need purchase price variance tracking, add a dedicated PPV account and split the entry.

---

### 3. Shipment — COGS

**Trigger:** Clicking "Post" on a DRAFT shipment (first of two entries)

```
DR  5000  Cost of Goods Sold        [qty × unit_cost_at_shipment]
CR  1200  Inventory Asset           [qty × unit_cost_at_shipment]
```

`source_type = "SHIPMENT_COGS"`

**Cost determination:**
- **WAVG:** uses `product.current_avg_cost` at the moment of posting
- **FIFO:** consumes the oldest cost layers until quantity is satisfied; uses the weighted average cost of consumed layers

---

### 4. Shipment — Revenue / AR

**Trigger:** Same post action as above (second of two entries)

```
DR  1300  Accounts Receivable       [qty × unit_price]
CR  4000  Sales Revenue             [qty × unit_price]
```

`source_type = "SHIPMENT_REVENUE"`

One entry per shipment (not per line). The shipment links to both `cogs_je_id` and `sales_je_id`.

---

### 5. Inventory Adjustment

**Trigger:** Clicking "Post" on a DRAFT adjustment

**Gain (qty_actual > qty_system):**
```
DR  1200  Inventory Asset           [variance × unit_cost]
CR  6100  Inventory Adj. Expense    [variance × unit_cost]
```

**Loss (qty_actual < qty_system):**
```
DR  6100  Inventory Adj. Expense    [|variance| × unit_cost]
CR  1200  Inventory Asset           [|variance| × unit_cost]
```

`source_type = "ADJUSTMENT"`

---

### 6. Purchase Return

**Trigger:** Clicking "Post" on a DRAFT purchase return

```
DR  1210  Inventory Received        [qty × unit_cost]
CR  1200  Inventory Asset           [qty × unit_cost]
```

`source_type = "PURCHASE_RETURN"`

This reverses the GRN entry — stock decreases and the accrual account is debited. You would then issue a debit note to the supplier to reduce the AP balance.

---

### 7. Sales Return

**Trigger:** Clicking "Post" on a DRAFT sales return

Reverses both the COGS and Revenue entries from the original shipment:

```
# Reverse COGS (restore inventory)
DR  1200  Inventory Asset           [qty × unit_cost]
CR  5000  Cost of Goods Sold        [qty × unit_cost]

# Reverse Revenue (reduce AR)
DR  4000  Sales Revenue             [qty × unit_price]
CR  1300  Accounts Receivable       [qty × unit_price]
```

`source_type = "SALES_RETURN"`

---

### 8. Manual Journal

**Trigger:** "Post Journal" button in Accounting → Journal Entries

Any balanced entry the user constructs manually.

`source_type = "MANUAL"`, `source_id = NULL`

---

## Full Transaction Flow Example

Starting from zero stock, here is the full GL impact of buying 100 units at $10 and selling 30 at $25:

```
Event                   Account                          DR         CR
──────────────────────────────────────────────────────────────────────────
GRN posted              1200 Inventory Asset          1,000.00
                        1210 Inventory Received                  1,000.00

Invoice matched         1210 Inventory Received       1,000.00
                        2100 Accounts Payable                    1,000.00

Shipment COGS           5000 COGS                       300.00
                        1200 Inventory Asset                       300.00

Shipment Revenue        1300 Accounts Receivable        750.00
                        4000 Sales Revenue                         750.00
──────────────────────────────────────────────────────────────────────────
                        Totals                        3,050.00   3,050.00  ✓
```

**Resulting balances:**
```
1200 Inventory Asset         700.00  (1,000 − 300)
1210 Inventory Received        0.00  (cleared by invoice match)
1300 Accounts Receivable     750.00  (outstanding customer payment)
2100 Accounts Payable      1,000.00  (outstanding supplier payment)
4000 Sales Revenue           750.00
5000 COGS                    300.00
```

**Gross Margin:** $750 − $300 = **$450 (60%)**

---

## WAVG Cost Recalculation

After every GRN receipt:

```
new_avg = (old_qty × old_avg + received_qty × received_cost)
          ÷ (old_qty + received_qty)
```

**Example:**
```
Before: 100 units @ $10.00 avg = $1,000
Receive: 50 units @ $12.00    = $600

new_avg = (100 × 10.00 + 50 × 12.00) ÷ (100 + 50)
        = (1,000 + 600) ÷ 150
        = 1,600 ÷ 150
        = $10.6667
```

All future COGS entries use $10.6667 until the next receipt.

---

## FIFO Layer Consumption

Each GRN creates a **FIFO layer** row:

```
Layer 1: GRN-2026-0001  100 units  $10.00/unit  remaining: 100
Layer 2: GRN-2026-0002   50 units  $12.00/unit  remaining: 50
```

When 120 units are shipped:
```
Consume Layer 1: 100 units × $10.00 = $1,000.00  (layer exhausted)
Consume Layer 2:  20 units × $12.00 =   $240.00  (30 remaining)

Total COGS = $1,240.00
Unit cost used = $1,240 ÷ 120 = $10.3333
```

---

## Period-End Procedures

### Month-End Checklist

1. **Match all GRNs** — ensure `1210 Inventory Received` balance equals expected in-transit value
2. **Post adjustments** — enter physical count variances
3. **Post accruals** — use manual journals for accrued expenses, prepayments
4. **Run Trial Balance** — verify DR = CR
5. **Run Inventory Valuation** — reconcile to the `1200 Inventory Asset` GL balance
6. **Run Margin Report** — review gross margins by product

### Verifying Inventory Asset Reconciliation

The `1200 Inventory Asset` GL balance should equal the Inventory Valuation report total:

```
Inventory Valuation Report total  =  GL account 1200 balance
```

If they differ, look for:
- Adjustments posted to the wrong account
- Opening stock entered without a journal entry (the seed does this for demo data)
- Manual journals that touched `1200` directly

---

## Accounts Payable Reconciliation

The `2100 Accounts Payable` balance should equal the sum of all matched, unpaid supplier invoices:

```sql
SELECT SUM(total_amount) FROM supplier_invoices WHERE status = 'MATCHED';
```

---

## Source Type Reference

| source_type | Triggered by | Accounts affected |
|---|---|---|
| `GRN` | GRN post | 1200, 1210 |
| `SUPPLIER_INVOICE` | Invoice match | 1210, 2100 |
| `SHIPMENT_COGS` | Shipment post | 1200, 5000 |
| `SHIPMENT_REVENUE` | Shipment post | 1300, 4000 |
| `PURCHASE_RETURN` | Purchase return post | 1200, 1210 |
| `SALES_RETURN` | Sales return post | 1200, 1300, 4000, 5000 |
| `ADJUSTMENT` | Adjustment post | 1200, 6100 |
| `MANUAL` | Manual journal | Any |
