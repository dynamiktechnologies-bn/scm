# Setup Guide

## Prerequisites

| Requirement | Minimum | Notes |
|---|---|---|
| Python | 3.12+ | 3.14 tested; use system Python, not Homebrew on macOS |
| Node.js | 20+ | |
| PostgreSQL | 15+ | v18 recommended |
| OS | macOS / Linux / Windows (WSL2) | |

---

## 1. Clone & Directory Structure

```
SCM/
├── backend/           FastAPI application
├── frontend/          React application
├── docs/              This documentation
├── docker-compose.yml Optional containerised setup
└── README.md
```

---

## 2. Database Setup

### Local PostgreSQL

```bash
# Create database and user
createdb scm_db
createuser scm_user -P        # enter password when prompted

# Grant permissions
psql scm_db -c "GRANT ALL ON DATABASE scm_db TO scm_user;"
```

### Using an existing PostgreSQL installation (e.g. EDB / Postgres.app)

```bash
# Connect as superuser and create the database
PGPASSWORD=<your_pg_password> psql -h localhost -U postgres -c "CREATE DATABASE scm_db;"
```

---

## 3. Backend Setup

```bash
cd backend

# Create virtual environment (use the Python that works with your OS)
/usr/local/bin/python3.14 -m venv .venv      # macOS with Python.org installer
# OR
python3 -m venv .venv                         # Linux

source .venv/bin/activate                     # macOS / Linux
# .venv\Scripts\activate                      # Windows

# Install dependencies
pip install -r requirements.txt
```

### Environment configuration

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL=postgresql+psycopg2://postgres:yourpassword@localhost:5432/scm_db
SECRET_KEY=replace-with-a-random-32-char-string
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7
```

> **Security note:** Generate a strong SECRET_KEY with `python -c "import secrets; print(secrets.token_hex(32))"`

### Run migrations

```bash
python -m alembic upgrade head
```

### Load demo data

```bash
python seed.py
```

This creates:
- 1 admin user: `admin@scm.example.com` / `admin123`
- 10 Chart of Accounts entries
- 1 warehouse (WH01) with 1 location (BIN-A1)
- 4 units of measure (EA, KG, LTR, BOX)
- 2 suppliers, 2 customers
- 4 products with opening stock

### Start the API server

```bash
uvicorn app.main:app --reload --port 8000
```

| URL | Description |
|---|---|
| `http://localhost:8000` | Redirects to Swagger UI |
| `http://localhost:8000/docs` | Interactive API documentation |
| `http://localhost:8000/health` | Health check |

---

## 4. Frontend Setup

```bash
cd frontend

# Copy environment file
cp .env.example .env

# Install dependencies
npm install

# Start development server
npm run dev
```

Open **http://localhost:5173**

Login with `admin@scm.example.com` / `admin123`

---

## 5. Docker Compose (alternative)

```bash
# Start all services
docker compose up -d

# First run only: migrate and seed
docker compose exec backend python -m alembic upgrade head
docker compose exec backend python seed.py
```

Services:
- PostgreSQL on port `5432`
- Backend API on port `8000`
- Frontend on port `5173`

---

## 6. Common Issues

### `pydantic-core` build fails on Python 3.14

The pinned `pydantic==2.10.x` uses an old pydantic-core that fails to build against Python 3.14. The `requirements.txt` already uses `pydantic>=2.12.0` which has pre-built wheels for Python 3.14.

### `bcrypt` version warning

`passlib 1.7.4` prints a `(trapped) error reading bcrypt version` warning when used with `bcrypt>=5.x`. This is **non-fatal** — authentication works correctly. The fix is pinning `bcrypt==4.2.1` which `requirements.txt` already does.

### Tailwind CSS PostCSS error

If you see `It looks like you're trying to use tailwindcss directly as a PostCSS plugin`, Tailwind v4 was installed. Fix:

```bash
cd frontend
npm install tailwindcss@^3 @tailwindcss/forms@^0.5
```

### `FATAL: password authentication failed`

Check that `DATABASE_URL` in `.env` matches your actual PostgreSQL credentials. The `alembic.ini` URL is overridden at runtime from `.env` — you do not need to edit `alembic.ini`.

---

## 7. Production Checklist

- [ ] Change `SECRET_KEY` to a cryptographically random value
- [ ] Set `ACCESS_TOKEN_EXPIRE_MINUTES` to a shorter window (e.g. 15)
- [ ] Use a dedicated database user with only `CONNECT` + schema privileges
- [ ] Run behind a reverse proxy (nginx / Caddy) with HTTPS
- [ ] Set `allow_origins` in `main.py` to your actual frontend domain
- [ ] Build the frontend: `npm run build` and serve `dist/` statically
- [ ] Disable `--reload` in uvicorn for production
- [ ] Enable PostgreSQL SSL (`?sslmode=require` in `DATABASE_URL`)
