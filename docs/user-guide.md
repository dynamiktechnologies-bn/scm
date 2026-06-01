# User Guide

This guide walks through every module in the order you would typically use them when going live.

---

## Getting Started

1. Open `http://localhost:5173`
2. Log in with your credentials
3. The **Dashboard** shows a real-time snapshot: open POs, confirmed SOs, inventory value, and low-stock alerts

---

## Settings

### Warehouses & Locations

**Path:** Settings → Warehouses & Locations

Before creating any inventory transactions you must have at least one warehouse and one location.

| Field | Description |
|---|---|
| Warehouse Code | Short immutable identifier, e.g. `WH01` |
| Warehouse Name | Display name, e.g. `Main Warehouse` |
| Location Code | Bin/rack identifier within the warehouse, e.g. `BIN-A1`, `RACK-2B` |
| Location Description | Optional friendly label |

> A **Location** is always a child of a **Warehouse**. Every inventory movement (GRN, shipment, adjustment, transfer) requires a location. The system records stock balances per product per location, so you can see exactly where each unit is stored.

---

## Chart of Accounts

**Path:** Accounting → Chart of Accounts

The Chart of Accounts (COA) is the master list of all General Ledger accounts. Every journal entry posts to accounts defined here.

### Account types and normal sides

| Type | Normal Side | Increases with | Examples |
|---|---|---|---|
| Asset | Debit (DR) | Debit | 1200 Inventory, 1300 AR, 1100 Cash |
| Liability | Credit (CR) | Credit | 2100 AP, 1210 Inventory Received |
| Equity | Credit (CR) | Credit | 3000 Retained Earnings |
| Revenue | Credit (CR) | Credit | 4000 Sales Revenue |
| Expense | Debit (DR) | Debit | 5000 COGS, 6100 Inv. Adj. Expense |

### Default seed accounts

| Code | Name | Type |
|---|---|---|
| 1100 | Cash | Asset |
| 1200 | Inventory Asset | Asset |
| 1210 | Inventory Received / Accrual | Liability |
| 1300 | Accounts Receivable | Asset |
| 2100 | Accounts Payable | Liability |
| 3000 | Retained Earnings | Equity |
| 4000 | Sales Revenue | Revenue |
| 4100 | Sales Returns & Allowances | Revenue |
| 5000 | Cost of Goods Sold | Expense |
| 6100 | Inventory Adjustment Expense | Expense |

> **Important:** Account codes are immutable after creation. You can rename or deactivate an account but not change its code. Deactivating an account prevents it from being selected in new transactions.

---

## Products (Item Master)

**Path:** Products → Item Master

### Creating a product

| Field | Required | Notes |
|---|---|---|
| SKU | Yes | Unique identifier, immutable after creation |
| Name | Yes | Display name |
| Unit of Measure | Yes | Select from the UoM list |
| Valuation Method | Yes | WAVG or FIFO (see below) |
| Inventory Account | Yes | Must be an Asset account (e.g. 1200) |
| COGS Account | Yes | Must be an Expense account (e.g. 5000) |
| Revenue Account | Yes | Must be a Revenue account (e.g. 4000) |
| Reorder Point | No | Alert threshold — products at or below this appear in Dashboard |
| Reorder Quantity | No | Suggested order quantity when reordering |
| Preferred Supplier | No | Used as a default suggestion when creating POs |

### Valuation methods

**Weighted Average (WAVG)**
- Cost is re-calculated after every goods receipt using the formula:
  `new_avg = (old_qty × old_avg + received_qty × received_cost) ÷ (old_qty + received_qty)`
- Simple, common in most industries
- All units of the same product share one cost

**FIFO (First In, First Out)**
- Cost layers are maintained per receipt
- When stock is shipped, the oldest layer is consumed first
- Provides a more accurate cost matching when purchase prices fluctuate
- Required by some accounting standards for perishables or items with high price variation

> You cannot change the valuation method after inventory transactions have been posted. Set it correctly at product creation.

### Units of Measure

**Path:** Products → Units of Measure

Create units before creating products. Common examples:

| Code | Name |
|---|---|
| EA | Each |
| KG | Kilogram |
| LTR | Litre |
| BOX | Box |
| MTR | Metre |

---

## Purchasing

### Workflow overview

```
Purchase Requisition (optional)
        ↓
  Purchase Order  ──→  Approve  ──→  Cancel
        ↓
  Goods Receipt (GRN)  ──→  Post  ←── updates inventory + posts JE
        ↓
  Supplier Invoice  ──→  Match  ←── posts AP journal entry
        ↓
  Purchase Return (if needed)  ──→  Post
```

### Purchase Requisitions

**Path:** Purchasing → Requisitions

A PR is an internal request to purchase goods — it does not commit any money. A manager can approve or reject it before a PO is raised.

**Statuses:** DRAFT → SUBMITTED → APPROVED → CLOSED

- Only DRAFT PRs can be edited
- Only SUBMITTED PRs can be approved
- An approved PR can be used as the basis for a PO

### Purchase Orders

**Path:** Purchasing → Purchase Orders

A PO is a formal commitment to a supplier.

**Statuses:** DRAFT → SUBMITTED → APPROVED → PARTIALLY_RECEIVED → FULLY_RECEIVED → CANCELLED

| Field | Notes |
|---|---|
| Supplier | Must exist in the Suppliers list |
| Order Date | Date the PO is raised |
| Expected Date | When you expect delivery |
| Lines | Each line: product, quantity, unit price, tax rate |

> Only APPROVED POs can have a GRN raised against them. A PO can only be cancelled while in DRAFT, SUBMITTED, or APPROVED status — once goods have been received it cannot be cancelled.

### Goods Receipts (GRN)

**Path:** Purchasing → Goods Receipts

A GRN records the physical receipt of goods into a warehouse location.

**Creating a GRN:**
1. Select the PO (optional — you can receive without a PO)
2. Select the supplier and receiving location
3. Enter the quantity and unit cost for each received line
4. Click **Create GRN** → status: DRAFT

**Posting a GRN:**
- Click **Post** on a DRAFT GRN
- The system will:
  1. Create inventory transactions (stock increases)
  2. Update the product's weighted-average cost (or add a FIFO layer)
  3. Post a journal entry: **DR Inventory Asset / CR Inventory Received**
  4. Update the PO's `qty_received` on each line
  5. Automatically set PO status to `PARTIALLY_RECEIVED` or `FULLY_RECEIVED`

> Once posted, a GRN cannot be edited. All corrections are made via a Purchase Return.

**Partial receipts** are supported — you can receive part of a PO line and the remainder stays open.

### Supplier Invoices

**Path:** Purchasing → Supplier Invoices

When you receive a supplier's invoice, record it here and link it to the GRN.

**Matching an invoice:**
- Click **Match** on a RECEIVED invoice
- The system posts: **DR Inventory Received / CR Accounts Payable**
- This clears the `1210 Inventory Received` accrual account and recognises the liability

> **Why two steps?** The GRN posts to an accrual account (1210) because the goods arrived before the invoice. The invoice match transfers that liability to Accounts Payable (2100). This is the correct accrual-basis treatment — inventory cost is recognised when goods arrive, not when the invoice comes.

### Purchase Returns

**Path:** Purchasing → Purchase Returns

Use this to return goods to a supplier after a GRN has been posted.

1. Select the original GRN
2. Select the supplier and the location to return from
3. Enter the quantities and unit costs being returned
4. Click **Create** → status: DRAFT
5. Click **Post** → reverses the inventory and posts: **DR Inventory Received / CR Inventory Asset**

---

## Sales

### Workflow overview

```
Sales Order  ──→  Confirm (availability check)
      ↓
  Shipment  ──→  Post  ←── reduces inventory, posts COGS + Revenue JE
      ↓
  Sales Return (if needed)  ──→  Post
```

### Sales Orders

**Path:** Sales → Sales Orders

**Statuses:** DRAFT → CONFIRMED → PARTIALLY_SHIPPED → FULLY_SHIPPED → CANCELLED

| Field | Notes |
|---|---|
| Customer | Must exist in the Customers list |
| Order Date | Date the order was placed |
| Required Date | Requested delivery date |
| Lines | Product, quantity, unit price, discount %, tax rate |

**Confirming an SO:**
- Runs an availability check for each line
- If stock is insufficient, the confirmation is rejected with a message showing the shortfall
- Once confirmed, the order moves to the picking stage

> Confirmed SOs cannot be edited. Cancel and recreate if changes are needed.

**Picking List:**
- Available via `GET /api/v1/sales/orders/{id}/picking-list`
- Lists each line with the quantity to pick

### Shipments

**Path:** Sales → Shipments

A shipment records the physical dispatch of goods to a customer. Partial shipments are supported — you can ship a subset of the SO lines and the order status becomes `PARTIALLY_SHIPPED`.

**Posting a shipment:**
1. Select the SO (only CONFIRMED or PARTIALLY_SHIPPED SOs are available)
2. Select the dispatch location and ship date
3. Enter the quantities and selling prices for each line
4. Click **Create** → status: DRAFT
5. Click **Post** → the system will:
   - Deduct stock from inventory
   - Capture the unit cost at the time of shipment (WAVG or FIFO)
   - Post **COGS journal**: DR COGS / CR Inventory Asset
   - Post **Revenue journal**: DR Accounts Receivable / CR Sales Revenue
   - Update `qty_shipped` on the SO lines

> The unit cost is captured at the moment of posting and stored permanently on the shipment line. Even if the product's average cost changes later, the historical COGS is preserved.

### Sales Returns

**Path:** Sales → Sales Returns

Use when a customer returns goods after a shipment has been posted.

1. Select the original shipment
2. Enter the quantities, unit price (for revenue reversal), and unit cost (for COGS reversal)
3. Click **Post** → the system reverses both the COGS and Revenue journal entries and restores inventory

---

## Inventory

### Stock on Hand

**Path:** Inventory → Stock on Hand

Read-only view of current stock levels. Shows per-product, per-location:
- Quantity on hand
- Average cost
- Inventory value (qty × avg cost)

> Stock is **never entered directly** on this page. It comes from posting GRNs (for purchases) or Adjustments (for opening balances and corrections).

### Inventory Transactions

**Path:** Inventory → Transactions

A complete, append-only log of every inventory movement. Filter by product, location, type, or date range.

| Transaction Type | Triggered by |
|---|---|
| `GRN_RECEIPT` | Posting a Goods Receipt |
| `GRN_RETURN` | Posting a Purchase Return |
| `SO_SHIPMENT` | Posting a Shipment |
| `SO_RETURN` | Posting a Sales Return |
| `INV_ADJUST_IN` | Posting a positive Adjustment |
| `INV_ADJUST_OUT` | Posting a negative Adjustment |
| `STOCK_TRANSFER_OUT` | Posting a Transfer (source location) |
| `STOCK_TRANSFER_IN` | Posting a Transfer (destination location) |
| `OPENING` | Opening balance from the seed script |

### Inventory Adjustments

**Path:** Inventory → Adjustments

Use adjustments for:
- **Opening stock** when going live (`qty_system = 0`, `qty_actual = actual count`)
- **Periodic count corrections** after a physical stocktake
- **Damage / write-offs** (reduces stock)

**Reason codes:**

| Code | Use case |
|---|---|
| COUNT_CORRECTION | Physical count differs from system count |
| DAMAGE | Goods damaged in storage |
| THEFT | Shrinkage / theft |
| WRITE_OFF | Expired or obsolete stock |

**Posting an adjustment:**
- Variance = `qty_actual − qty_system`
- Positive variance → **DR Inventory Asset / CR Adj Expense** (stock gain)
- Negative variance → **DR Adj Expense / CR Inventory Asset** (stock loss)

### Stock Transfers

**Path:** Inventory → Transfers

Move stock between locations within the same or different warehouses. No journal entry is created (it's the same inventory asset moving between bins).

---

## Accounting

### Journal Entries

**Path:** Accounting → Journal Entries

All journal entries — both system-generated and manual — are listed here. Click any row to view the full debit/credit breakdown with a balance check.

**System-generated entries** are tagged with their source type: `GRN`, `SUPPLIER_INVOICE`, `SHIPMENT_COGS`, `SHIPMENT_REVENUE`, `PURCHASE_RETURN`, `SALES_RETURN`, `ADJUSTMENT`.

**Manual Journal Entries:**

Use manual journals for entries the system does not generate automatically:

| Use Case | Typical Entry |
|---|---|
| Month-end accrual | DR Expense / CR Accrued Liabilities |
| Prepaid expense amortisation | DR Expense / CR Prepaid Asset |
| Depreciation | DR Depreciation Expense / CR Acc. Depreciation |
| Bank charges | DR Bank Charge Expense / CR Cash |
| Opening balance entry | DR Asset accounts / CR Equity |
| Correction / reclassification | DR correct account / CR wrong account |

**Balance enforcement:** The Post button is disabled until total debits equal total credits. The server also validates balance independently and rejects unbalanced entries.

> Manual journals cannot be edited or deleted after posting. Create a reversing entry (same amounts, sides swapped) if you need to correct a posted manual journal.

### Trial Balance

**Path:** Accounting → Trial Balance

Shows the net debit or credit balance for every account with activity, as of today (or a specified date). Verifies that the ledger is in balance — total DR column should equal total CR column.

---

## Reports

### Inventory Valuation

Current quantity and value (qty × avg cost) for every product with stock. Use for month-end balance sheet preparation.

### Stock Aging

Shows how many days since each product last had an inventory movement. Products idle for 90+ days are highlighted in red. Useful for identifying slow-moving or obsolete stock.

### Purchase Register

All purchase orders within a date range with status and total amount. Filter by date to produce a period report.

### Sales Register

All sales orders within a date range. Filter by date to produce a period report for revenue reconciliation.

### Margin Report

Per-product gross margin based on actual posted shipments:

```
Revenue    = qty_shipped × unit_price
COGS       = qty_shipped × unit_cost (captured at shipment time)
Gross Margin = Revenue − COGS
Margin %   = Gross Margin ÷ Revenue × 100
```

> Margin is based on **posted shipments only**. Drafted or unconfirmed shipments are excluded.

---

## Key Operational Rules

1. **Documents are immutable once posted.** Posted GRNs, shipments, and invoices cannot be edited. Corrections require a reversal document (Purchase Return, Sales Return, or manual journal).

2. **Stock on Hand is always calculated.** It is the sum of all `inventory_transactions`. There is no "edit stock" function — every change must have a source document.

3. **Journal entries must balance.** The system enforces `sum(debit) = sum(credit)` at both the service layer and database layer. An unbalanced entry will be rejected.

4. **Document numbers are sequential and permanent.** PO-2026-0001, GRN-2026-0001 etc. are assigned at creation and never reused, even if the document is cancelled.

5. **COGS is locked at shipment time.** The unit cost stored on a shipment line is the cost at the moment of posting. Future cost changes do not affect historical shipments.
