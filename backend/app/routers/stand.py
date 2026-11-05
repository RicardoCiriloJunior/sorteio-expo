from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, Security
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import Settings
from ..constants import STANDS
from ..database import get_db
from ..models import Stand
from ..schemas import StandItem, StandLoginRequest, StandLoginResponse, TokenResponse
from ..security import generate_token, stand_pin_header, verify_pin

router = APIRouter(prefix="/stands", tags=["Estandes"])


def build_qr_url(slug: str, token: str, settings: Settings, base_url: str | None = None) -> str:
    query = urlencode({"stand": slug, "token": token})
    raw_base = (base_url or str(settings.public_base_url)).strip().rstrip("/")
    if raw_base.endswith("/checkin.html") or raw_base.endswith("/checkin"):
        return f"{raw_base}?{query}"
    return f"{raw_base}/checkin.html?{query}"


@router.get("", response_model=list[StandItem])
def list_stands(db: Session = Depends(get_db)):
    stands_by_slug = {s.slug: s for s in db.scalars(select(Stand)).all()}
    result: list[StandItem] = []
    for slug, default_name in STANDS:
        if slug in stands_by_slug:
            result.append(StandItem(slug=slug, nome=stands_by_slug[slug].nome))
        else:
            result.append(StandItem(slug=slug, nome=default_name))
    return result


@router.post(
    "/login",
    response_model=StandLoginResponse,
    responses={
        400: {"description": "Requisição inválida"},
        401: {"description": "PIN incorreto ou inválido"},
        404: {"description": "Estande não encontrado"},
    },
)
def stand_login(
    payload: StandLoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    pin = payload.pin.strip()
    if not pin:
        raise HTTPException(status_code=400, detail="Informe o PIN de acesso")

    stands = list(db.scalars(select(Stand)).all())
    target_stand: Stand | None = None

    if payload.stand_slug:
        slug = payload.stand_slug.strip().lower()
        slug = "ecociente" if slug == "eco" else slug
        target_stand = next((s for s in stands if s.slug == slug), None)
        if target_stand is None:
            raise HTTPException(status_code=404, detail="Estande não encontrado")
        if not verify_pin(pin, target_stand.pin_acesso):
            raise HTTPException(status_code=401, detail="PIN inválido para este estande")
    else:
        # Tenta identificar automaticamente o estande correspondente ao PIN
        for s in stands:
            if verify_pin(pin, s.pin_acesso):
                target_stand = s
                break
        if target_stand is None:
            raise HTTPException(status_code=401, detail="PIN inválido")

    settings: Settings = request.app.state.settings
    token, expires = generate_token(target_stand.slug, settings.hmac_secret.get_secret_value())
    url = build_qr_url(target_stand.slug, token, settings, payload.base_url)
    response.headers["Cache-Control"] = "no-store"
    return StandLoginResponse(
        sucesso=True,
        stand=target_stand.slug,
        nome=target_stand.nome,
        token=token,
        expires_in_seconds=expires,
        qr_url=url,
    )


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
    pin_param: str | None = Query(default=None, alias="pin"),
    base_url: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    effective_pin = pin or pin_param
    clean_slug = slug.strip().lower()
    clean_slug = "ecociente" if clean_slug == "eco" else clean_slug
    stand = db.scalar(select(Stand).where(Stand.slug == clean_slug))
    if stand is None:
        raise HTTPException(status_code=404, detail="Estande não encontrado")
    if effective_pin is None or not verify_pin(effective_pin, stand.pin_acesso):
        raise HTTPException(status_code=401, detail="PIN inválido")
    settings: Settings = request.app.state.settings
    token, expires = generate_token(clean_slug, settings.hmac_secret.get_secret_value())
    url = build_qr_url(clean_slug, token, settings, base_url)
    response.headers["Cache-Control"] = "no-store"
    return TokenResponse(
        stand=clean_slug,
        nome=stand.nome,
        token=token,
        expires_in_seconds=expires,
        qr_url=url,
    )
