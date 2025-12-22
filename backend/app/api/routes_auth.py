from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.auth.security import (
    authenticate,
    create_access_token,
    create_refresh_token,
    get_current_user,
    get_role_value,
)
from app.database.session import get_db
from app.models.user import User
from app.schemas import auth as auth_schema
from jose import JWTError, jwt
from app.core.config import get_settings

router = APIRouter(redirect_slashes=False)
settings = get_settings()
logger = logging.getLogger(__name__)


async def _extract_credentials(request: Request) -> tuple[str | None, str | None]:
    content_type = request.headers.get("content-type", "")
    if content_type.startswith("application/json"):
        try:
            payload = await request.json()
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неверный JSON")
        return payload.get("login"), payload.get("password")

    form = await request.form()
    return (form.get("username") or form.get("login")), form.get("password")


@router.post("/login", response_model=auth_schema.Token)
async def login(request: Request, db: Session = Depends(get_db)):
    """
    Тестовые запросы:
      curl -i -X POST http://127.0.0.1:8000/api/auth/login -H "Content-Type: application/json" -d '{"login":"admin","password":"..."}'
      curl -i -X POST http://127.0.0.1:8000/api/auth/login -H "Content-Type: application/x-www-form-urlencoded" -d "username=admin&password=..."
    """
    login_value: str | None = None
    try:
        login_value, password = await _extract_credentials(request)
        user = authenticate(db, login_value, password)
        role_value = get_role_value(user.role)
        token_payload = {
            "sub": str(user.id),
            "user_id": user.id,
            "role": role_value,
            "branch_id": user.branch_id,
        }
        access_token = create_access_token(token_payload)
        refresh_token = create_refresh_token(token_payload)
        return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}
    except HTTPException as exc:
        if exc.status_code >= status.HTTP_500_INTERNAL_SERVER_ERROR:
            logger.exception("HTTPException during login for user %s", login_value)
        else:
            logger.info("Authentication failed for user %s: %s", login_value, exc.detail)
        raise
    except SQLAlchemyError as exc:
        logger.exception("Database error during login for user %s", login_value)
        raise HTTPException(status_code=500, detail="Ошибка базы данных при входе") from exc
    except Exception as exc:  # pragma: no cover - defensive logging for unexpected errors
        logger.exception("Unexpected error during login for user %s", login_value)
        raise HTTPException(status_code=500, detail="Ошибка аутентификации") from exc


@router.get("/me", response_model=auth_schema.AuthUser)
async def get_profile(current_user: User = Depends(get_current_user)):
    return auth_schema.AuthUser(
        id=current_user.id,
        login=current_user.login,
        name=current_user.name,
        role=get_role_value(current_user.role),
        active=current_user.active,
        branch_id=current_user.branch_id,
        branch_name=current_user.branch.name if current_user.branch else None,
    )


@router.post("/refresh", response_model=auth_schema.Token)
async def refresh_token(payload: auth_schema.RefreshRequest, db: Session = Depends(get_db)):
    try:
        data = jwt.decode(payload.refresh_token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid refresh token") from exc
    user_id = data.get("user_id") or data.get("sub")
    try:
        user = db.get(User, user_id)
    except SQLAlchemyError as exc:
        logger.exception("Database error during token refresh for user %s", user_id)
        raise HTTPException(status_code=500, detail="Ошибка базы данных при обновлении токена") from exc
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    role_value = get_role_value(user.role)
    token_payload = {
        "sub": str(user.id),
        "user_id": user.id,
        "role": role_value,
        "branch_id": user.branch_id,
    }
    access_token = create_access_token(token_payload)
    refresh_token = create_refresh_token(token_payload)
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}
