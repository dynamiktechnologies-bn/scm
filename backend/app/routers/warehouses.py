from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.dependencies import get_current_user
from app.models.warehouse import Warehouse, Location

router = APIRouter(prefix="/warehouses", tags=["warehouses"])


class WarehouseCreate(BaseModel):
    code: str
    name: str


class WarehouseOut(BaseModel):
    id: int
    code: str
    name: str
    is_active: bool
    model_config = {"from_attributes": True}


class LocationCreate(BaseModel):
    warehouse_id: int
    code: str
    name: str | None = None


class LocationOut(BaseModel):
    id: int
    warehouse_id: int
    code: str
    name: str | None
    warehouse_name: str | None = None
    model_config = {"from_attributes": True}


# ── Warehouses ───────────────────────────────────────────────────────────────

@router.get("", response_model=list[WarehouseOut])
def list_warehouses(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Warehouse).order_by(Warehouse.code).all()


@router.post("", response_model=WarehouseOut, status_code=status.HTTP_201_CREATED)
def create_warehouse(body: WarehouseCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if db.query(Warehouse).filter(Warehouse.code == body.code).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Warehouse code {body.code!r} already exists")
    wh = Warehouse(code=body.code, name=body.name)
    db.add(wh)
    db.commit()
    db.refresh(wh)
    return wh


@router.put("/{wh_id}", response_model=WarehouseOut)
def update_warehouse(wh_id: int, body: WarehouseCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    wh = db.query(Warehouse).filter(Warehouse.id == wh_id).first()
    if not wh:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Warehouse not found")
    wh.name = body.name
    db.commit()
    db.refresh(wh)
    return wh


# ── Locations ─────────────────────────────────────────────────────────────────

@router.get("/locations", response_model=list[LocationOut])
def list_locations(warehouse_id: int | None = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(Location)
    if warehouse_id:
        q = q.filter(Location.warehouse_id == warehouse_id)
    locations = q.order_by(Location.warehouse_id, Location.code).all()
    result = []
    for loc in locations:
        out = LocationOut.model_validate(loc)
        out.warehouse_name = loc.warehouse.name if loc.warehouse else None
        result.append(out)
    return result


@router.post("/locations", response_model=LocationOut, status_code=status.HTTP_201_CREATED)
def create_location(body: LocationCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    wh = db.query(Warehouse).filter(Warehouse.id == body.warehouse_id).first()
    if not wh:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Warehouse not found")
    if db.query(Location).filter(Location.warehouse_id == body.warehouse_id, Location.code == body.code).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Location code {body.code!r} already exists in this warehouse")
    loc = Location(warehouse_id=body.warehouse_id, code=body.code, name=body.name)
    db.add(loc)
    db.commit()
    db.refresh(loc)
    out = LocationOut.model_validate(loc)
    out.warehouse_name = wh.name
    return out


@router.put("/locations/{loc_id}", response_model=LocationOut)
def update_location(loc_id: int, body: LocationCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    loc = db.query(Location).filter(Location.id == loc_id).first()
    if not loc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Location not found")
    loc.name = body.name
    db.commit()
    db.refresh(loc)
    out = LocationOut.model_validate(loc)
    out.warehouse_name = loc.warehouse.name if loc.warehouse else None
    return out
