import hashlib
import hmac
import re
import secrets
import time

from fastapi import HTTPException, Request, Security
from fastapi.security import APIKeyHeader

stand_pin_header = APIKeyHeader(name="X-Stand-Pin", scheme_name="StandPin", auto_error=False)
admin_key_header = APIKeyHeader(name="X-Admin-Key", scheme_name="AdminKey", auto_error=False)
PIN_ITERATIONS = 600_000
QR_TOKEN_TTL_SECONDS = 300


def hash_pin(pin: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", pin.encode(), salt.encode(), PIN_ITERATIONS)
    return f"pbkdf2_sha256${PIN_ITERATIONS}${salt}${digest.hex()}"


def verify_pin(pin: str, stored: str) -> bool:
    if not pin or not stored:
        return False
    if "$" not in stored:
        return hmac.compare_digest(pin.encode(), stored.encode())
    try:
        algorithm, iterations, salt, expected = stored.split("$")
        if algorithm != "pbkdf2_sha256" or int(iterations) != PIN_ITERATIONS:
            return False
        digest = hashlib.pbkdf2_hmac("sha256", pin.encode(), salt.encode(), int(iterations))
        return hmac.compare_digest(digest.hex(), expected)
    except (ValueError, TypeError):
        return False


def token_signature(slug: str, secret: str, expires_at: int) -> str:
    message = f"checkin:v2:{slug}:{expires_at}".encode()
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def generate_token(slug: str, secret: str, now: float | None = None) -> tuple[str, int]:
    timestamp = int(time.time() if now is None else now)
    expires_at = timestamp + QR_TOKEN_TTL_SECONDS
    signature = token_signature(slug, secret, expires_at)
    return f"{expires_at}.{signature}", QR_TOKEN_TTL_SECONDS


def validate_token(slug: str, token: str, secret: str, now: float | None = None) -> bool:
    match = re.fullmatch(r"([1-9][0-9]{0,11})\.([0-9a-f]{64})", token)
    if match is None:
        return False
    expires_at = int(match.group(1))
    timestamp = time.time() if now is None else now
    if timestamp >= expires_at:
        return False
    # Alterar o estande ou a expiração invalida a assinatura.
    expected = token_signature(slug, secret, expires_at)
    return hmac.compare_digest(match.group(2), expected)


def require_admin(request: Request, key: str | None = Security(admin_key_header)):
    expected = request.app.state.settings.admin_key.get_secret_value()
    if key is None or not hmac.compare_digest(key.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Credencial administrativa inválida")
