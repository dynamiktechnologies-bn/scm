# SCM ERP — Supply Chain Management

Full-stack ERP with integrated double-entry accounting.

**Stack:** FastAPI · SQLAlchemy · PostgreSQL · React · TypeScript · Tailwind CSS

---

## Quick Start (Local Dev)

### 1 — Prerequisites

```bash
node >= 20
python >= 3.11
postgresql >= 15
```

### 2 — Database

```bash
createdb scm_db
createuser scm_user -P          # password: scm_pass
psql scm_db -c "GRANT ALL ON DATABASE scm_db TO scm_user;"
```

### 3 — Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env            # edit if needed

python -m alembic upgrade head  # create all tables
python seed.py                  # load demo data

uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### 4 — Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

App: http://localhost:5173

**Default login:** `admin@scm.example.com` / `admin123`

---

## Quick Start (Docker Compose)

```bash
docker compose up -d

# First run: migrate and seed
docker compose exec backend python -m alembic upgrade head
docker compose exec backend python seed.py
```

---

## Project Structure

```
SCM/
├── backend/
│   ├── app/
│   │   ├── main.py             — FastAPI app + router registration
│   │   ├── config.py           — Settings (from .env)
│   │   ├── database.py         — SQLAlchemy engine + session
│   │   ├── dependencies.py     — JWT auth + role checker
│   │   ├── models/             — SQLAlchemy ORM models
│   │   │   ├── user.py
│   │   │   ├── accounting.py   — Account, JournalEntry, JournalLine
│   │   │   ├── party.py        — Supplier, Customer
│   │   │   ├── product.py      — UoM, Product
│   │   │   ├── warehouse.py    — Warehouse, Location
│   │   │   ├── inventory.py    — InventoryTransaction, FifoLayer
│   │   │   ├── purchase.py     — PR, PO, GRN, SupplierInvoice, PurchaseReturn
│   │   │   ├── sales.py        — SO, Shipment, SalesReturn
│   │   │   └── inv_ops.py      — Adjustment, Transfer
│   │   ├── schemas/            — Pydantic v2 request/response models
│   │   ├── routers/            — FastAPI routers (one per module)
│   │   └── services/
│   │       ├── inventory_service.py   — WAVG/FIFO cost engine
│   │       ├── posting_service.py     — Double-entry journal builder
│   │       └── number_service.py      — Auto document numbering
│   ├── alembic/                — DB migrations
│   ├── seed.py                 — Demo data loader
│   └── requirements.txt
│
└── frontend/
    └── src/
        ├── main.tsx            — QueryClient + RouterProvider
        ├── router.tsx          — All routes
        ├── lib/
        │   ├── api.ts          — Axios instance + JWT interceptors
        │   └── types.ts        — TypeScript interfaces
        ├── stores/
        │   └── authStore.ts    — Zustand auth state
        ├── components/
        │   ├── layout/Layout.tsx   — Sidebar + nav
        │   └── ui/index.tsx        — Shared UI primitives
        └── pages/              — One folder per module
```

---

## Accounting Flow Reference

| Event | DR | CR |
|-------|----|----|
| GRN posted | 1200 Inventory Asset | 1210 Inventory Received |
| Supplier Invoice matched | 1210 Inventory Received | 2100 Accounts Payable |
| Shipment posted (COGS) | 5000 COGS | 1200 Inventory Asset |
| Shipment posted (Revenue) | 1300 AR | 4000 Sales Revenue |
| Inventory Adjustment (gain) | 1200 Inventory Asset | 6100 Adj Expense |
| Inventory Adjustment (loss) | 6100 Adj Expense | 1200 Inventory Asset |

---

## Test Flow

```
1. Login as admin@scm.example.com
2. Products → create WIDGET-X (WAVG, link accounts)
3. Purchase Orders → create PO for WIDGET-X
4. Purchase Orders → Approve PO
5. Goods Receipts → create GRN linked to PO → Post
   → Verify: Inventory +100, Journal Entry DR 1200 CR 1210
6. Supplier Invoices → create invoice for GRN → Match
   → Verify: Journal Entry DR 1210 CR 2100
7. Sales Orders → create SO for WIDGET-X → Confirm
8. Shipments → create shipment for SO → Post
   → Verify: Inventory −qty, COGS JE, Revenue JE
9. Accounting → Journal Entries: filter by SHIP reference
10. Reports → Margin: see revenue, COGS, gross margin
```
