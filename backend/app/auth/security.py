from __future__ import annotations

import logging
from datetime import datetime, timedelta

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib import exc as passlib_exc
from passlib.context import CryptContext
from sqlalchemy.future import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.enums import UserRole
from app.database.session import get_db
from app.models.user import User

settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
password_context = CryptContext(schemes=["bcrypt", "pbkdf2_sha256"], deprecated="auto")
logger = logging.getLogger(__name__)


def get_role_value(role: UserRole | str | None) -> str | None:
    if role is None:
        return None
    return role.value if isinstance(role, UserRole) else str(role)


def get_user_by_login(db: Session, login: str) -> User | None:
    result = db.execute(select(User).where(User.login == login))
    return result.scalar_one_or_none()


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def create_token(payload: dict, expires_delta: timedelta) -> str:
    to_encode = payload.copy()
    to_encode.update({"exp": datetime.utcnow() + expires_delta})
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(data: dict) -> str:
    return create_token(data, timedelta(minutes=settings.access_token_expire_minutes))


def create_refresh_token(data: dict) -> str:
    return create_token(data, timedelta(minutes=settings.refresh_token_expire_minutes))


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return password_context.verify(plain, hashed)
    except ValueError:
        return False
    except passlib_exc.PasslibError:
        return False
    except Exception:  # pragma: no cover - defensive guard against unexpected errors
        logger.exception("Unexpected error verifying password")
        return False


def hash_password(password: str) -> str:
    return password_context.hash(password)


def get_password_hash(password: str) -> str:
    """Alias for password hashing to keep naming consistent across the app."""

    return hash_password(password)


def authenticate(db: Session, login: str | None, password: str | None) -> User:
    if not login or not password:
        logger.warning("Authentication attempt with missing credentials (login=%s)", login)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication failed")

    try:
        user = get_user_by_login(db, login)
    except SQLAlchemyError as exc:
        logger.exception("Database error during login for user %s", login)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error") from exc
    except Exception as exc:  # pragma: no cover - defensive logging for unexpected errors
        logger.exception("Unexpected error during login for user %s", login)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error") from exc

    try:
        is_valid_password = verify_password(password, user.password_hash) if user else False
    except Exception as exc:
        logger.exception("Password verification failed for user %s", login)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error"
        ) from exc

    if not user:
        logger.warning("Authentication failed: user %s not found", login)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication failed")
    if not is_valid_password:
        logger.warning("Authentication failed: invalid password for user %s", login)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication failed")
    if not user.active:
        logger.warning("Authentication failed: inactive user %s", login)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication failed")

    return user


async def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        user_id = payload.get("user_id") or payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError as exc:
        raise credentials_exception from exc

    try:
        user = get_user_by_id(db, int(user_id))
    except (TypeError, ValueError) as exc:
        raise credentials_exception from exc
    if user is None or not user.active:
        raise credentials_exception
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    role_value = get_role_value(current_user.role)
    if role_value != UserRole.ADMIN.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return current_user


def require_employee(current_user: User = Depends(get_current_user)) -> User:
    role_value = get_role_value(current_user.role)
    if role_value not in {UserRole.ADMIN.value, UserRole.EMPLOYEE.value}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return current_user


def admin_only_for_write(request: Request, current_user: User = Depends(get_current_user)) -> User:
    role_value = get_role_value(current_user.role)
    if request.method in {"PUT", "PATCH", "DELETE"} and role_value != UserRole.ADMIN.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")
    return current_user
