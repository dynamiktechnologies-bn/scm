# Architecture

---

## System Overview

```
Browser (React SPA)
      │  HTTP/JSON
      ▼
FastAPI (Python)
      │  SQLAlchemy ORM
      ▼
PostgreSQL
```

The frontend and backend are completely decoupled. The React app communicates exclusively through the REST API. They can be deployed on different servers.

---

## Backend Structure

```
backend/
├── app/
│   ├── main.py              App factory, CORS, router registration
│   ├── config.py            Pydantic-settings (.env loader)
│   ├── database.py          SQLAlchemy engine + session + Base
│   ├── dependencies.py      JWT decode, get_current_user, require_role
│   │
│   ├── models/              SQLAlchemy ORM models (one file per domain)
│   │   ├── __init__.py      Re-exports all models (needed for Alembic)
│   │   ├── user.py
│   │   ├── accounting.py    Account, JournalEntry, JournalLine
│   │   ├── party.py         Supplier, Customer
│   │   ├── product.py       UoM, Product
│   │   ├── warehouse.py     Warehouse, Location
│   │   ├── inventory.py     InventoryTransaction, FifoLayer
│   │   ├── purchase.py      PR, PO, GRN, SupplierInvoice, PurchaseReturn
│   │   ├── sales.py         SO, Shipment, SalesReturn
│   │   └── inv_ops.py       InventoryAdjustment, StockTransfer
│   │
│   ├── schemas/             Pydantic v2 request/response models
│   │   ├── auth.py
│   │   ├── accounting.py
│   │   ├── product.py
│   │   ├── party.py
│   │   ├── purchase.py
│   │   ├── sales.py
│   │   └── inventory.py
│   │
│   ├── routers/             FastAPI routers (one per module)
│   │   ├── auth.py
│   │   ├── products.py
│   │   ├── parties.py
│   │   ├── purchase.py
│   │   ├── sales.py
│   │   ├── inventory.py
│   │   ├── accounting.py
│   │   ├── warehouses.py
│   │   └── reports.py
│   │
│   └── services/            Business logic (no HTTP concerns)
│       ├── inventory_service.py   WAVG/FIFO costing engine
│       ├── posting_service.py     Double-entry journal builder
│       └── number_service.py      Sequential document numbering
│
├── alembic/                 Database migrations
│   ├── env.py               Reads DATABASE_URL from app.config
│   └── versions/            Migration files
│
├── seed.py                  Demo data loader
├── requirements.txt
└── .env                     Local environment (not committed)
```

### Key design decisions

**Services vs routers:** Business logic lives in `services/`. Routers only handle HTTP concerns (parsing request bodies, returning responses, calling service functions). This keeps the logic testable without an HTTP context.

**Append-only inventory ledger:** `inventory_transactions` is never updated or deleted. Stock balances are always computed as `SUM(qty * direction)`. This gives a complete, auditable history of every movement and makes the system naturally consistent.

**Denormalized avg cost:** `products.current_avg_cost` is updated after every GRN post. This is a denormalization — the authoritative value could be derived from the inventory ledger, but computing it on every shipment would be expensive. The denormalized value is kept in sync by the `inventory_service.receive()` function.

**Transaction boundary:** Each "post" operation (GRN post, shipment post, etc.) runs inside a single database transaction. If the journal entry creation or inventory update fails, the entire operation rolls back. This ensures the inventory ledger and GL are always in sync.

---

## Frontend Structure

```
frontend/src/
├── main.tsx                 React root, QueryClient, RouterProvider, Toaster
├── router.tsx               All routes (createBrowserRouter)
├── index.css                Tailwind directives + custom component classes
│
├── lib/
│   ├── api.ts               Axios instance with JWT interceptors
│   └── types.ts             TypeScript interfaces mirroring backend schemas
│
├── stores/
│   └── authStore.ts         Zustand: user, token, setAuth, logout
│
├── hooks/
│   └── useLocations.ts      Shared hook for warehouse location dropdown data
│
├── components/
│   ├── layout/
│   │   └── Layout.tsx       Sidebar navigation + <Outlet />
│   └── ui/
│       └── index.tsx        PageHeader, StatusBadge, Modal, FormField,
│                            Input, Select, Spinner, TableSkeleton,
│                            EmptyState, StatCard, SectionHeader, cn()
│
└── pages/
    ├── auth/                LoginPage
    ├── Dashboard.tsx
    ├── products/            ProductsPage, UoMPage
    ├── suppliers/           SuppliersPage
    ├── customers/           CustomersPage
    ├── purchase/            PurchaseRequisitionsPage, PurchaseOrdersPage,
    │                        GoodsReceiptsPage, SupplierInvoicesPage,
    │                        PurchaseReturnsPage
    ├── sales/               SalesOrdersPage, ShipmentsPage, SalesReturnsPage
    ├── inventory/           StockPage, TransactionsPage,
    │                        AdjustmentsPage, TransfersPage
    ├── accounting/          JournalPage, COAPage, TrialBalancePage
    ├── reports/             ReportsPages (5 reports in one file)
    └── settings/            WarehousesPage
```

### Key design decisions

**React Query for server state:** All API calls go through `useQuery` / `useMutation`. Cache invalidation is explicit — after a mutation, the relevant query keys are invalidated so the UI refreshes automatically.

**Zustand only for auth:** Auth state (user, token) is the only global client state. Everything else is either server state (React Query) or local component state (useState).

**`cn()` utility:** The `cn()` helper (clsx + tailwind-merge) is used for conditional classes. It resolves Tailwind conflicts correctly, e.g. `cn("px-4", isPrimary && "px-6")` produces `"px-6"` not `"px-4 px-6"`.

**`TableSkeleton` for loading:** Every table renders `<TableSkeleton>` while loading instead of a spinner. This prevents layout shifts and gives a more polished feel.

**Forms with react-hook-form:** All forms use `useFieldArray` for dynamic line items. Validation is schema-based with zod or inline `register()` rules.

---

## Authentication Flow

```
1. POST /auth/login → { access_token, refresh_token }
2. Store tokens in localStorage via Zustand setAuth()
3. Axios interceptor attaches `Authorization: Bearer <token>` to every request
4. On 401 response → clear tokens, redirect to /login
5. POST /auth/refresh → new token pair (called when access token expires)
```

JWT payload: `{ "sub": "email@example.com", "exp": ..., "type": "access"|"refresh" }`

---

## Posting Flow (GRN example)

```
1. User clicks "Post" on GRN-2026-0001
2. POST /purchase/receipts/1/post
3. Router: load GRN with lines, validate status == "DRAFT"
4. For each GRN line:
   a. inventory_service.receive()
      - INSERT inventory_transactions (direction=+1)
      - Recalculate product.current_avg_cost (WAVG) OR insert fifo_layer (FIFO)
      - UPDATE grn_lines.it_id = new transaction id
   b. UPDATE po_lines.qty_received += qty_received
5. posting_service.post_grn()
   - INSERT journal_entry (source_type="GRN", source_id=1)
   - INSERT journal_lines (DR 1200, CR 1210 per line)
   - _assert_balanced() — raises 500 if not balanced
   - UPDATE goods_receipts.je_id = new je id
6. UPDATE goods_receipts.status = "POSTED"
7. UPDATE purchase_orders.status = "PARTIALLY_RECEIVED" or "FULLY_RECEIVED"
8. db.commit()
9. Return updated GRN
```

All steps 3–8 run in a single database transaction. If step 5 fails (unbalanced), the transaction rolls back and no inventory movement is recorded.

---

## Document Number Generation

`services/number_service.py` generates sequential numbers:

```python
def next_number(db, prefix):
    year = current_year()
    like = f"{prefix}-{year}-%"
    last = db.execute(
        f"SELECT MAX({col}) FROM {table} WHERE {col} LIKE :like",
        {"like": like}
    ).scalar()
    seq = int(last.split("-")[-1]) + 1 if last else 1
    return f"{prefix}-{year}-{seq:04d}"
```

Numbers reset each year (PO-2026-0001, PO-2027-0001) for readability. The `MAX()` approach is safe for single-instance deployments. For high-concurrency production deployments, replace with a PostgreSQL sequence.

---

## Adding a New Module

To add a new module (e.g. Fixed Assets):

1. **Model** — create `backend/app/models/fixed_assets.py`, add import to `models/__init__.py`
2. **Schema** — create `backend/app/schemas/fixed_assets.py`
3. **Router** — create `backend/app/routers/fixed_assets.py`, register in `main.py`
4. **Migration** — run `alembic revision --autogenerate -m "add_fixed_assets"` then `alembic upgrade head`
5. **Frontend types** — add to `frontend/src/lib/types.ts`
6. **Frontend page** — create in `frontend/src/pages/fixed_assets/`
7. **Router** — add route in `frontend/src/router.tsx`
8. **Sidebar** — add nav entry in `Layout.tsx`

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `SECRET_KEY` | Yes | — | JWT signing key (min 32 chars) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | 60 | Access token TTL |
| `REFRESH_TOKEN_EXPIRE_DAYS` | No | 7 | Refresh token TTL |
| `VITE_API_URL` | No | `http://localhost:8000/api/v1` | Frontend API base URL |
