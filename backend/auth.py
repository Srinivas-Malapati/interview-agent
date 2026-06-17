"""Optional Supabase JWT auth.

Verifies tokens issued by Supabase Auth. Supports BOTH signing strategies:
  - Legacy HS256 (shared secret)             via SUPABASE_JWT_SECRET
  - New ECC P-256 / RS256 asymmetric         via SUPABASE_URL JWKS endpoint

For new Supabase projects, ES256 is the default. We try HS256 first because
that's cheaper and fewer projects use ES256. If HS256 fails, we fetch the
JWKS once (cached) and verify with the public key.

Set these in production:
    SUPABASE_URL=https://<ref>.supabase.co
    SUPABASE_JWT_SECRET=<from Settings → JWT Keys → Legacy JWT Secret>
    AUTH_REQUIRED=1
"""
import os
from functools import lru_cache
from typing import Optional, Dict, Any

from fastapi import Header, HTTPException

AUTH_REQUIRED = os.getenv("AUTH_REQUIRED", "0") in ("1", "true", "True")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")
SUPABASE_URL = (os.getenv("SUPABASE_URL", "") or "").rstrip("/")


@lru_cache(maxsize=1)
def _supabase_jwks() -> Optional[Dict[str, Any]]:
    """Fetch & cache Supabase's public-key set (JWKS) for ES256/RS256 verification."""
    if not SUPABASE_URL:
        return None
    try:
        import httpx
        url = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        with httpx.Client(timeout=5.0) as c:
            r = c.get(url)
            r.raise_for_status()
            return r.json()
    except Exception as e:
        print("JWKS fetch failed:", e)
        return None


def _decode_supabase_jwt(token: str) -> Optional[Dict[str, Any]]:
    """Try HS256 (legacy shared secret) first, then ES256/RS256 via JWKS."""
    import jwt

    # ─── Attempt 1: HS256 legacy shared secret ───
    if SUPABASE_JWT_SECRET:
        try:
            return jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
            )
        except jwt.InvalidSignatureError:
            pass  # signed with a non-HS256 key — fall through to JWKS
        except jwt.InvalidAlgorithmError:
            pass
        except Exception as e:
            # Includes ExpiredSignatureError, InvalidAudienceError, …
            # don't try JWKS for these; the token is just bad.
            print("HS256 decode failed (token issue):", type(e).__name__, str(e)[:120])
            return None

    # ─── Attempt 2: asymmetric verification via JWKS ───
    try:
        jwks = _supabase_jwks()
        if not jwks:
            return None
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        if not kid:
            return None
        match = None
        for jwk in jwks.get("keys", []):
            if jwk.get("kid") == kid:
                match = jwk
                break
        if not match:
            return None
        signing_key = jwt.PyJWK(match).key
        return jwt.decode(
            token,
            signing_key,
            algorithms=["ES256", "RS256", "EdDSA"],
            audience="authenticated",
        )
    except Exception as e:
        print("Asymmetric decode failed:", type(e).__name__, str(e)[:160])
        return None


def current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """FastAPI dependency. Returns the decoded user claims (sub, email, …).

    Behavior:
      - AUTH_REQUIRED=0 → returns a sentinel anonymous user (no enforcement)
      - AUTH_REQUIRED=1 → 401 unless a valid Supabase Bearer token is present
    """
    if not AUTH_REQUIRED:
        return {"sub": "local-dev", "email": "dev@local", "is_anonymous": True}

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing Bearer token")

    token = authorization.split(" ", 1)[1].strip()
    claims = _decode_supabase_jwt(token)
    if not claims:
        raise HTTPException(401, "Invalid or expired token")
    return claims
