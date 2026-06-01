# API Reference

Base URL: `http://localhost:8000/api/v1`

Interactive docs: `http://localhost:8000/docs` (Swagger UI)

All endpoints except `/auth/login` and `/auth/register` require:
```
Authorization: Bearer <access_token>
```

---

## Authentication

### POST `/auth/login`
```json
Request:  { "email": "admin@scm.example.com", "password": "admin123" }
Response: { "access_token": "eyJ...", "refresh_token": "eyJ...", "token_type": "bearer" }
```

### POST `/auth/register`
```json
Request:  { "email": "user@example.com", "password": "password", "full_name": "Jane Smith", "role": "STAFF" }
Response: UserOut
```
Roles: `ADMIN` | `MANAGER` | `STAFF`

### POST `/auth/refresh`
```json
Request:  { "refresh_token": "eyJ..." }
Response: { "access_token": "...", "refresh_token": "...", "token_type": "bearer" }
```

### GET `/auth/me`
Returns the current user profile.

---

## Products

### GET `/products`
Query params: `active_only=true`, `supplier_id=<int>`

### POST `/products`
```json
{
  "sku": "WIDGET-A",
  "name": "Widget Type A",
  "uom_id": 1,
  "valuation_method": "WAVG",
  "inventory_account_id": 2,
  "cogs_account_id": 9,
  "revenue_account_id": 7,
  "reorder_point": 50,
  "reorder_qty": 200,
  "current_avg_cost": 10.00
}
```

### GET `/products/{id}`
### PUT `/products/{id}`
### DELETE `/products/{id}` — soft delete (sets `is_active = false`)
### GET `/products/{id}/stock` — on-hand quantities by location
### GET `/products/below-reorder` — products at or below reorder point

### GET `/products/uom`
### POST `/products/uom`
```json
{ "code": "EA", "name": "Each" }
```
### PUT `/products/uom/{id}`
```json
{ "name": "Each (updated)" }
```

---

## Suppliers & Customers

### GET `/suppliers`
### POST `/suppliers`
```json
{
  "code": "SUP001",
  "name": "Acme Components Ltd",
  "contact_email": "orders@acme.com",
  "phone": "+1-555-0101",
  "payment_terms": 30,
  "ap_account_id": 5
}
```
### GET `/suppliers/{id}`
### PUT `/suppliers/{id}`
### DELETE `/suppliers/{id}` — soft delete

### GET `/customers`
### POST `/customers`
### GET `/customers/{id}`
### PUT `/customers/{id}`
### DELETE `/customers/{id}`

---

## Warehouses & Locations

### GET `/warehouses`
### POST `/warehouses`
```json
{ "code": "WH01", "name": "Main Warehouse" }
```
### PUT `/warehouses/{id}`

### GET `/warehouses/locations`
Query params: `warehouse_id=<int>`

### POST `/warehouses/locations`
```json
{ "warehouse_id": 1, "code": "BIN-A1", "name": "Aisle A - Bin 1" }
```
### PUT `/warehouses/locations/{id}`

---

## Purchase Module

### Purchase Requisitions

| Method | Path | Notes |
|---|---|---|
| GET | `/purchase/requisitions` | Filter: `status=DRAFT\|SUBMITTED\|APPROVED` |
| POST | `/purchase/requisitions` | Create with lines |
| GET | `/purchase/requisitions/{id}` | Detail |
| POST | `/purchase/requisitions/{id}/submit` | DRAFT → SUBMITTED |
| POST | `/purchase/requisitions/{id}/approve` | SUBMITTED → APPROVED |

```json
POST /purchase/requisitions
{
  "required_date": "2026-07-01",
  "notes": "Urgent restock",
  "lines": [
    { "product_id": 1, "qty_requested": 200, "notes": "Low stock" }
  ]
}
```

### Purchase Orders

| Method | Path | Notes |
|---|---|---|
| GET | `/purchase/orders` | Filter: `po_status`, `supplier_id` |
| POST | `/purchase/orders` | Create |
| GET | `/purchase/orders/{id}` | Detail with lines |
| PUT | `/purchase/orders/{id}` | Update (DRAFT only) |
| POST | `/purchase/orders/{id}/submit` | DRAFT → SUBMITTED |
| POST | `/purchase/orders/{id}/approve` | SUBMITTED → APPROVED |
| POST | `/purchase/orders/{id}/cancel` | → CANCELLED |

```json
POST /purchase/orders
{
  "supplier_id": 1,
  "order_date": "2026-06-15",
  "expected_date": "2026-06-22",
  "lines": [
    { "product_id": 1, "qty_ordered": 200, "unit_price": 10.50, "tax_rate": 0 }
  ]
}
```

### Goods Receipts

| Method | Path | Notes |
|---|---|---|
| GET | `/purchase/receipts` | List all |
| POST | `/purchase/receipts` | Create GRN |
| GET | `/purchase/receipts/{id}` | Detail |
| POST | `/purchase/receipts/{id}/post` | **Posts inventory + JE** |

```json
POST /purchase/receipts
{
  "po_id": 1,
  "supplier_id": 1,
  "location_id": 1,
  "receipt_date": "2026-06-20",
  "supplier_ref": "DN-12345",
  "lines": [
    { "po_line_id": 1, "product_id": 1, "qty_received": 200, "unit_cost": 10.50 }
  ]
}
```

### Supplier Invoices

| Method | Path | Notes |
|---|---|---|
| GET | `/purchase/invoices` | Filter: `supplier_id` |
| POST | `/purchase/invoices` | Create |
| GET | `/purchase/invoices/{id}` | Detail |
| POST | `/purchase/invoices/{id}/match` | **Posts AP journal** |

### Purchase Returns

| Method | Path | Notes |
|---|---|---|
| GET | `/purchase/returns` | List |
| POST | `/purchase/returns` | Create |
| POST | `/purchase/returns/{id}/post` | **Posts reversal** |

---

## Sales Module

### Sales Orders

| Method | Path | Notes |
|---|---|---|
| GET | `/sales/orders` | Filter: `so_status`, `customer_id` |
| POST | `/sales/orders` | Create |
| GET | `/sales/orders/{id}` | Detail with availability injected |
| PUT | `/sales/orders/{id}` | Update (DRAFT only) |
| POST | `/sales/orders/{id}/confirm` | Availability check → CONFIRMED |
| POST | `/sales/orders/{id}/cancel` | → CANCELLED |
| GET | `/sales/orders/{id}/picking-list` | Picking list JSON |

```json
POST /sales/orders
{
  "customer_id": 1,
  "order_date": "2026-06-20",
  "required_date": "2026-06-25",
  "lines": [
    { "product_id": 1, "qty_ordered": 30, "unit_price": 25.00, "discount_pct": 0 }
  ]
}
```

### Shipments

| Method | Path | Notes |
|---|---|---|
| GET | `/sales/shipments` | Filter: `so_id` |
| POST | `/sales/shipments` | Create |
| GET | `/sales/shipments/{id}` | Detail |
| POST | `/sales/shipments/{id}/post` | **Posts COGS + Revenue JE + reduces inventory** |

### Sales Returns

| Method | Path | Notes |
|---|---|---|
| GET | `/sales/returns` | List |
| POST | `/sales/returns` | Create |
| POST | `/sales/returns/{id}/post` | **Reverses COGS + Revenue, restores inventory** |

---

## Inventory

### GET `/inventory/stock`
Query params: `location_id`

Returns: `[{ product_id, sku, name, location_id, location_code, warehouse_name, qty_on_hand, avg_cost, inventory_value }]`

### GET `/inventory/transactions`
Query params: `product_id`, `location_id`, `txn_type`, `from_date`, `to_date`
Max 500 results.

### Adjustments

| Method | Path | Notes |
|---|---|---|
| GET | `/inventory/adjustments` | List |
| POST | `/inventory/adjustments` | Create |
| POST | `/inventory/adjustments/{id}/post` | **Posts JE + inventory** |

```json
POST /inventory/adjustments
{
  "location_id": 1,
  "adj_date": "2026-06-30",
  "reason_code": "COUNT_CORRECTION",
  "notes": "Monthly stocktake",
  "lines": [
    { "product_id": 1, "qty_system": 70, "qty_actual": 68, "unit_cost": 10.50 }
  ]
}
```

### Transfers

| Method | Path | Notes |
|---|---|---|
| GET | `/inventory/transfers` | List |
| POST | `/inventory/transfers` | Create |
| POST | `/inventory/transfers/{id}/post` | **Posts movement** |

---

## Accounting

### Chart of Accounts

| Method | Path | Notes |
|---|---|---|
| GET | `/accounting/accounts` | Filter: `active_only=true` |
| POST | `/accounting/accounts` | Create account |
| PUT | `/accounting/accounts/{id}` | Update name/normal_side/is_active |

```json
POST /accounting/accounts
{
  "code": "1400",
  "name": "Prepaid Expenses",
  "account_type": "ASSET",
  "normal_side": "D"
}
```

### Journal Entries

| Method | Path | Notes |
|---|---|---|
| GET | `/accounting/journal-entries` | Filter: `source_type`, `reference`, `from_date`, `to_date` |
| POST | `/accounting/journal-entries` | Create manual journal |
| GET | `/accounting/journal-entries/{id}` | Detail with enriched lines |

```json
POST /accounting/journal-entries
{
  "entry_date": "2026-06-30",
  "reference": "ACCRUAL-JUN-26",
  "memo": "June payroll accrual",
  "lines": [
    { "account_id": 9,  "debit": 5000.00, "credit": 0,       "description": "Salaries expense" },
    { "account_id": 14, "debit": 0,       "credit": 5000.00, "description": "Accrued payroll" }
  ]
}
```

Server returns HTTP 400 if `sum(debit) ≠ sum(credit)`.

### GET `/accounting/trial-balance`
Query params: `as_of=YYYY-MM-DD`

---

## Reports

All report endpoints are GET with optional date range filters (`from_date`, `to_date`).

| Endpoint | Description |
|---|---|
| `/reports/inventory-valuation` | Qty × avg cost per product |
| `/reports/stock-aging` | Days since last movement per product |
| `/reports/purchase-register` | POs by period |
| `/reports/sales-register` | SOs by period |
| `/reports/margin` | Revenue, COGS, gross margin per product (filter: `product_id`, `so_id`) |

---

## Common Response Codes

| Code | Meaning |
|---|---|
| 200 | OK |
| 201 | Created |
| 204 | Deleted (no content) |
| 400 | Validation error (check `detail` field) |
| 401 | Unauthenticated or expired token |
| 403 | Insufficient role |
| 404 | Resource not found |
| 422 | Request body schema error |
| 500 | Server error (check `detail` for balance violations) |
