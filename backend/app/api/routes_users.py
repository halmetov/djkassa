from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.security import hash_password, require_admin
from app.database.session import get_db
from app.models.user import User
from app.schemas import users as user_schema

router = APIRouter(redirect_slashes=False, dependencies=[Depends(require_admin)])


@router.get("", response_model=list[user_schema.User])
async def list_users(db: Session = Depends(get_db)):
    result = db.execute(select(User))
    return result.scalars().all()


@router.post("", response_model=user_schema.User, status_code=status.HTTP_201_CREATED)
async def create_user(payload: user_schema.UserCreate, db: Session = Depends(get_db)):
    exists = db.execute(select(User).where(User.login == payload.login))
    if exists.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Login already used")
    user = User(
        name=payload.name,
        login=payload.login,
        role=payload.role,
        active=payload.active,
        password_hash=hash_password(payload.password),
        branch_id=payload.branch_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}", response_model=user_schema.User)
async def update_user(user_id: int, payload: user_schema.UserUpdate, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for field, value in payload.dict(exclude_unset=True).items():
        if field == "password" and value:
            user.password_hash = hash_password(value)
        elif field != "password":
            setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return None
