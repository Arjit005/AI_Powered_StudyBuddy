import os
import jwt
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from . import models, database

# Require JWT_SECRET_KEY in production / runtime; do not silently use insecure fallback
SECRET_KEY = os.getenv('JWT_SECRET_KEY')
if not SECRET_KEY:
    if os.getenv('ENVIRONMENT', '').lower() == 'development':
        SECRET_KEY = 'dev-insecure-study-buddy-secret-key-change-in-production'
    else:
        raise RuntimeError(
            "CRITICAL SECURITY CONFIGURATION ERROR: JWT_SECRET_KEY environment variable is required outside development. "
            "Server startup halted to prevent token forgery."
        )
ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_DAYS = 7

security = HTTPBearer(auto_error=False)

def hash_password(password: str) -> str:
    # bcrypt has a hard maximum input limit of 72 bytes
    pw_bytes = password.encode('utf-8')
    if len(pw_bytes) > 72:
        import hashlib
        # Pre-hash long passwords using SHA-256 to remain strictly within 72 bytes
        pw_bytes = hashlib.sha256(pw_bytes).hexdigest().encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pw_bytes, salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        pw_bytes = plain_password.encode('utf-8')
        if len(pw_bytes) > 72:
            import hashlib
            pw_bytes = hashlib.sha256(pw_bytes).hexdigest().encode('utf-8')
        return bcrypt.checkpw(pw_bytes, hashed_password.encode('utf-8'))
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({'exp': expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except Exception:
        return None

def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(database.get_db)
) -> Optional[models.User]:
    if not credentials or not credentials.credentials:
        return None
    payload = decode_access_token(credentials.credentials)
    if not payload or 'sub' not in payload:
        return None
    try:
        user_id = int(payload.get('sub'))
    except (ValueError, TypeError):
        return None
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_current_user_required(
    user: Optional[models.User] = Depends(get_current_user_optional)
) -> models.User:
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Not authenticated or session expired. Please log in.',
            headers={'WWW-Authenticate': 'Bearer'},
        )
    return user
