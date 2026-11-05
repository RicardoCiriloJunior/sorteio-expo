from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request, Response, Security
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Stand
from ..schemas import TokenResponse
from ..security import generate_token, stand_pin_header, verify_pin

router = APIRouter(prefix="/stands", tags=["Estandes"])


@router.get(
    "/{slug}/token",
    response_model=TokenResponse,
    responses={
        401: {"description": "PIN ausente ou inválido"},
        404: {"description": "Estande não encontrado"},
    },
)
def stand_token(
    slug: str,
    request: Request,
    response: Response,
    pin: str | None = Security(stand_pin_header),
    db: Session = Depends(get_db),
):
    stand = db.scalar(select(Stand).where(Stand.slug == slug))
    if stand is None:
        raise HTTPException(status_code=404, detail="Estande não encontrado")
    if pin is None or not verify_pin(pin, stand.pin_acesso):
        raise HTTPException(status_code=401, detail="PIN inválido")
    settings = request.app.state.settings
    token, expires = generate_token(slug, settings.hmac_secret.get_secret_value())
    query = urlencode({"stand": slug, "token": token})
    url = f"{str(settings.public_base_url).rstrip('/')}/checkin?{query}"
    response.headers["Cache-Control"] = "no-store"
    return TokenResponse(stand=slug, token=token, expires_in_seconds=expires, qr_url=url)
