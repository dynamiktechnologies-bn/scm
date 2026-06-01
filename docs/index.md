# SCM ERP — Documentation

**Version 1.0** · Built with FastAPI, React, PostgreSQL

---

## Contents

| Document | Description |
|---|---|
| [Setup Guide](setup.md) | Installation, environment, database, first run |
| [User Guide](user-guide.md) | Module-by-module walkthrough for end users |
| [Accounting Integration](accounting.md) | Double-entry logic, journal entries, GL flow |
| [API Reference](api-reference.md) | All REST endpoints with request/response examples |
| [Database Schema](schema.md) | All tables, columns, relationships, indexes |
| [Architecture](architecture.md) | System design, folder structure, key patterns |

---

## What is SCM ERP?

SCM ERP is a full-stack Supply Chain Management system designed for medium-sized businesses. It covers the complete procure-to-pay and order-to-cash cycles with **deeply integrated double-entry accounting** — every inventory movement automatically produces a balanced, auditable journal entry.

### Modules

```
┌─────────────────────────────────────────────────────────────┐
│                        SCM ERP                              │
├──────────────┬──────────────┬──────────────┬────────────────┤
│   Products   │  Purchasing  │    Sales     │   Inventory    │
│  Item Master │  PR → PO     │  SO →        │  Stock on Hand │
│  UoM         │  GRN         │  Shipment    │  Adjustments   │
│  Valuation   │  Inv. Match  │  Returns     │  Transfers     │
│  WAVG / FIFO │  Pur. Return │              │                │
├──────────────┴──────────────┴──────────────┴────────────────┤
│                    Accounting (GL)                          │
│   Chart of Accounts · Journal Entries · Trial Balance       │
├─────────────────────────────────────────────────────────────┤
│              Reports & Analytics                            │
│  Valuation · Aging · Purchase Register · Margin            │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS v3 |
| State | Zustand (auth), React Query (server state) |
| Backend | Python 3.14, FastAPI, SQLAlchemy 2.0 |
| Database | PostgreSQL 18 |
| Auth | JWT (access + refresh tokens, bcrypt passwords) |
| Migrations | Alembic |
| API docs | OpenAPI / Swagger (auto-generated) |
