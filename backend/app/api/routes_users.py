from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.security import admin_only_for_write, get_current_user, hash_password
from app.database.session import get_db
from app.models.user import User
from app.schemas import users as user_schema

router = APIRouter(redirect_slashes=False, dependencies=[Depends(admin_only_for_write)])


@router.get("", response_model=list[user_schema.User])
async def list_users(db: Session = Depends(get_db)):
    result = db.execute(select(User))
    return result.scalars().all()


@router.post("", response_model=user_schema.User, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: user_schema.UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exists = db.execute(select(User).where(User.login == payload.login))
    if exists.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Login already used")
    safe_role = payload.role
    safe_active = payload.active
    safe_branch_id = payload.branch_id

    if current_user.role != "admin":
        if payload.role == "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")
        if payload.branch_id is None:
            raise HTTPException(status_code=400, detail="Сотрудник должен быть привязан к филиалу")
        if current_user.branch_id is not None and payload.branch_id != current_user.branch_id:
            raise HTTPException(status_code=400, detail="Нельзя назначить другой филиал")
        safe_role = "employee"
        safe_active = True
        safe_branch_id = current_user.branch_id or payload.branch_id
    user = User(
        name=payload.name,
        login=payload.login,
        role=safe_role,
        active=safe_active,
        password_hash=hash_password(payload.password),
        branch_id=safe_branch_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}", response_model=user_schema.User)
async def update_user(
    user_id: int,
    payload: user_schema.UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for field, value in payload.dict(exclude_unset=True).items():
        if field == "password" and value:
            user.password_hash = hash_password(value)
        elif field != "password":
            if current_user.role != "admin":
                if field in {"role", "active"}:
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")
                if field == "branch_id":
                    if current_user.branch_id is None:
                        raise HTTPException(status_code=400, detail="Сотрудник не привязан к филиалу")
                    if value != current_user.branch_id:
                        raise HTTPException(status_code=400, detail="Нельзя назначить другой филиал")
            setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return None
