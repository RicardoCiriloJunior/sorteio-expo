from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..constants import STANDS
from ..database import get_db
from ..models import Checkin, Participante, Stand
from ..schemas import CheckinRequest, CheckinResponse, StandStatus, StatusResponse
from ..security import validate_token

router = APIRouter(tags=["Participação"])


@router.post(
    "/checkin",
    response_model=CheckinResponse,
    responses={
        400: {"description": "Token inválido/expirado ou telefone em uso"},
        404: {"description": "Estande ou participante não encontrado"},
    },
)
def checkin(payload: CheckinRequest, request: Request, db: Session = Depends(get_db)):
    stand = db.scalar(select(Stand).where(Stand.slug == payload.stand_slug))
    if stand is None:
        raise HTTPException(status_code=404, detail="Estande não encontrado")
    secret = request.app.state.settings.hmac_secret.get_secret_value()
    if not validate_token(stand.slug, payload.token, secret):
        raise HTTPException(
            status_code=400, detail="Token expirado ou inválido. Leia o QR Code novamente."
        )

    if payload.participante_id is None:
        participante = Participante(nome=payload.nome, telefone=payload.telefone)
        db.add(participante)
    else:
        # Serializa check-ins concorrentes e alterações do mesmo participante.
        participante = db.scalar(
            select(Participante).where(Participante.id == payload.participante_id).with_for_update()
        )
        if participante is None:
            raise HTTPException(status_code=404, detail="Participante não encontrado")
        participante.nome = payload.nome
        participante.telefone = payload.telefone

    try:
        db.flush()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=400, detail="Telefone já cadastrado para outro participante"
        ) from error

    existing = db.scalar(
        select(Checkin.id).where(
            Checkin.participante_id == participante.id, Checkin.stand_id == stand.id
        )
    )
    if existing is None:
        db.add(Checkin(participante_id=participante.id, stand_id=stand.id))
    # Cadastro/atualização e presença são confirmados na mesma transação.
    db.commit()
    return CheckinResponse(
        mensagem=f"Presença confirmada no estande {stand.nome}!", participante=participante
    )


@router.get(
    "/participantes/{participante_id}/status",
    response_model=StatusResponse,
    responses={404: {"description": "Participante não encontrado"}},
)
def status(participante_id: UUID, db: Session = Depends(get_db)):
    if db.get(Participante, participante_id) is None:
        raise HTTPException(status_code=404, detail="Participante não encontrado")
    visited = set(
        db.scalars(
            select(Stand.slug)
            .join(Checkin, Checkin.stand_id == Stand.id)
            .where(Checkin.participante_id == participante_id)
        )
    )
    stands = [StandStatus(slug=slug, nome=nome, visitado=slug in visited) for slug, nome in STANDS]
    total = sum(stand.visitado for stand in stands)
    return StatusResponse(
        participante_id=participante_id,
        total_visitados=total,
        concluiu_todos=total == len(STANDS),
        stands=stands,
    )
