from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.database import get_db
from app.dependencies import get_current_user
from app.models.product import Product, UoM
from app.models.inventory import InventoryTransaction
from app.models.warehouse import Location
from app.schemas.product import ProductCreate, ProductUpdate, ProductOut, UoMOut, StockBalance
from decimal import Decimal

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=list[ProductOut])
def list_products(
    active_only: bool = True,
    supplier_id: int | None = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Product).options(joinedload(Product.uom))
    if active_only:
        q = q.filter(Product.is_active == True)
    if supplier_id:
        q = q.filter(Product.preferred_supplier_id == supplier_id)
    return q.order_by(Product.sku).all()


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(body: ProductCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if db.query(Product).filter(Product.sku == body.sku).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"SKU {body.sku!r} already exists")
    p = Product(**body.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.get("/uom", response_model=list[UoMOut])
def list_uom(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(UoM).order_by(UoM.code).all()


@router.post("/uom", response_model=UoMOut, status_code=status.HTTP_201_CREATED)
def create_uom(body: dict, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if db.query(UoM).filter(UoM.code == body.get("code", "").upper()).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"UoM code already exists")
    uom = UoM(code=body["code"].upper(), name=body["name"])
    db.add(uom)
    db.commit()
    db.refresh(uom)
    return uom


@router.put("/uom/{uom_id}", response_model=UoMOut)
def update_uom(uom_id: int, body: dict, db: Session = Depends(get_db), _=Depends(get_current_user)):
    uom = db.query(UoM).filter(UoM.id == uom_id).first()
    if not uom:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "UoM not found")
    if "name" in body:
        uom.name = body["name"]
    db.commit()
    db.refresh(uom)
    return uom


@router.get("/below-reorder", response_model=list[ProductOut])
def below_reorder(db: Session = Depends(get_db), _=Depends(get_current_user)):
    products = db.query(Product).filter(Product.is_active == True).all()
    result = []
    for p in products:
        on_hand = db.query(
            func.coalesce(func.sum(InventoryTransaction.qty * InventoryTransaction.direction), Decimal("0"))
        ).filter(InventoryTransaction.product_id == p.id).scalar() or Decimal("0")
        if on_hand <= p.reorder_point:
            result.append(p)
    return result


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(Product).options(joinedload(Product.uom)).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return p


@router.put("/{product_id}", response_model=ProductOut)
def update_product(product_id: int, body: ProductUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    p.is_active = False
    db.commit()


@router.get("/{product_id}/stock", response_model=list[StockBalance])
def product_stock(product_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")

    rows = db.query(
        InventoryTransaction.location_id,
        func.sum(InventoryTransaction.qty * InventoryTransaction.direction).label("qty_on_hand"),
    ).filter(InventoryTransaction.product_id == product_id).group_by(
        InventoryTransaction.location_id
    ).all()

    result = []
    for row in rows:
        loc = db.query(Location).filter(Location.id == row.location_id).first()
        qty = row.qty_on_hand or Decimal("0")
        result.append(StockBalance(
            product_id=p.id,
            sku=p.sku,
            name=p.name,
            location_id=row.location_id,
            location_code=loc.code if loc else "",
            warehouse_name=loc.warehouse.name if loc and loc.warehouse else "",
            qty_on_hand=qty,
            avg_cost=p.current_avg_cost,
            inventory_value=qty * p.current_avg_cost,
        ))
    return result
