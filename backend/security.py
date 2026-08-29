"""Auth utilities: password hashing, JWT issue/verify, RBAC dependencies."""
import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from db import users

bearer = HTTPBearer(auto_error=False)

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ISSUER = os.environ["JWT_ISSUER"]
JWT_AUDIENCE = os.environ["JWT_AUDIENCE"]
ACCESS_TOKEN_HOURS = int(os.environ.get("ACCESS_TOKEN_HOURS", "72"))

# A constant hash to run against unknown users to reduce timing enumeration.
_DUMMY_HASH = bcrypt.hashpw(b"timing-only-password", bcrypt.gensalt()).decode()


def now() -> datetime:
    return datetime.now(timezone.utc)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except (ValueError, TypeError):
        return False


def dummy_verify(password: str) -> bool:
    return verify_password(password, _DUMMY_HASH)


def token_digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def issue_access_token(user: dict) -> str:
    t = now()
    claims = {
        "sub": user["id"],
        "role": user["role"],
        "tv": user.get("token_version", 0),
        "jti": secrets.token_urlsafe(16),
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
        "iat": t,
        "exp": t + timedelta(hours=ACCESS_TOKEN_HOURS),
    }
    return jwt.encode(claims, JWT_SECRET, algorithm="HS256")


async def current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET,
            algorithms=["HS256"],
            issuer=JWT_ISSUER,
            audience=JWT_AUDIENCE,
        )
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    user = await users.find_one({"id": payload.get("sub")}, {"_id": 0})
    if not user or user.get("token_version", 0) != payload.get("tv"):
        raise HTTPException(status_code=401, detail="Session revoked. Please sign in again.")
    if user.get("status") != "active":
        raise HTTPException(status_code=403, detail=f"Account is {user.get('status')}")
    return user


def require_roles(*allowed):
    async def dependency(user: dict = Depends(current_user)) -> dict:
        if user["role"] not in allowed:
            raise HTTPException(status_code=403, detail="You do not have permission for this action")
        return user

    return dependency
