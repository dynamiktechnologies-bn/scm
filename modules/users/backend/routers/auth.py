from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from app.database import get_db
from app.models.user import User
from app.schemas.auth import UserCreate, UserOut, LoginRequest, TokenResponse, RefreshRequest
from app.dependencies import create_access_token, create_refresh_token, decode_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(body: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email already registered")
    user = User(
        email=body.email,
        hashed_password=pwd_ctx.hash(body.password),
        full_name=body.full_name,
        role=body.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email, User.is_active == True).first()
    if not user or not pwd_ctx.verify(body.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    return TokenResponse(
        access_token=create_access_token(user.email),
        refresh_token=create_refresh_token(user.email),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_token(body.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    user = db.query(User).filter(User.email == payload["sub"], User.is_active == True).first()
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return TokenResponse(
        access_token=create_access_token(user.email),
        refresh_token=create_refresh_token(user.email),
    )


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/users", response_model=list[UserOut])
def list_users(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "ADMIN":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only admins can list users")
    return db.query(User).order_by(User.created_at.desc()).all()


@router.get("/users/{user_id}", response_model=UserOut)
def get_user(user_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "ADMIN" and current_user.id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


@router.put("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "ADMIN":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only admins can update users")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    allowed_fields = {"full_name", "role", "is_active"}
    for key, value in body.items():
        if key in allowed_fields:
            setattr(user, key, value)

    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "ADMIN":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only admins can delete users")
    if current_user.id == user_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot delete your own user")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    db.delete(user)
    db.commit()
