from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models.party import Supplier, Customer
from app.schemas.party import (
    SupplierCreate, SupplierUpdate, SupplierOut,
    CustomerCreate, CustomerUpdate, CustomerOut,
)

router = APIRouter(tags=["parties"])


# ── Suppliers ────────────────────────────────────────────────────────────────

@router.get("/suppliers", response_model=list[SupplierOut])
def list_suppliers(active_only: bool = True, db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(Supplier)
    if active_only:
        q = q.filter(Supplier.is_active == True)
    return q.order_by(Supplier.name).all()


@router.post("/suppliers", response_model=SupplierOut, status_code=status.HTTP_201_CREATED)
def create_supplier(body: SupplierCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if db.query(Supplier).filter(Supplier.code == body.code).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Supplier code {body.code!r} already exists")
    s = Supplier(**body.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.get("/suppliers/{supplier_id}", response_model=SupplierOut)
def get_supplier(supplier_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    s = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Supplier not found")
    return s


@router.put("/suppliers/{supplier_id}", response_model=SupplierOut)
def update_supplier(supplier_id: int, body: SupplierUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    s = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Supplier not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return s


@router.delete("/suppliers/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_supplier(supplier_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    s = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Supplier not found")
    s.is_active = False
    db.commit()


# ── Customers ────────────────────────────────────────────────────────────────

@router.get("/customers", response_model=list[CustomerOut])
def list_customers(active_only: bool = True, db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(Customer)
    if active_only:
        q = q.filter(Customer.is_active == True)
    return q.order_by(Customer.name).all()


@router.post("/customers", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
def create_customer(body: CustomerCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if db.query(Customer).filter(Customer.code == body.code).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Customer code {body.code!r} already exists")
    c = Customer(**body.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.get("/customers/{customer_id}", response_model=CustomerOut)
def get_customer(customer_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer not found")
    return c


@router.put("/customers/{customer_id}", response_model=CustomerOut)
def update_customer(customer_id: int, body: CustomerUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(customer_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer not found")
    c.is_active = False
    db.commit()
