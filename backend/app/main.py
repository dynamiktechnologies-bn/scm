from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from app.routers import auth, products, parties, purchase, sales, inventory, accounting, reports, warehouses, approvals

app = FastAPI(
    title="SCM API",
    version="1.0.0",
    description="Supply Chain Management with integrated double-entry accounting",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_routers = [auth, products, parties, purchase, sales, inventory, accounting, reports, warehouses, approvals]
for module in _routers:
    app.include_router(module.router, prefix="/api/v1")


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse("/docs")


@app.get("/health")
def health():
    return {"status": "ok"}
