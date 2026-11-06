from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..constants import STANDS
from ..database import get_db
from ..models import Checkin, Participante, Stand
from ..schemas import (
    CheckinRequest,
    CheckinResponse,
    ParticipanteLookupRequest,
    ParticipanteLookupResponse,
    StandStatus,
    StatusResponse,
)
from ..security import validate_token

router = APIRouter(tags=["Participação"])


def _set_participant_cookies(response: Response, participante: Participante) -> None:
    max_age = 30 * 24 * 3600  # 30 dias
    response.set_cookie(
        key="participante_id",
        value=str(participante.id),
        max_age=max_age,
        httponly=False,
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        key="participante_nome",
        value=participante.nome,
        max_age=max_age,
        httponly=False,
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        key="participante_telefone",
        value=participante.telefone,
        max_age=max_age,
        httponly=False,
        samesite="lax",
        path="/",
    )


@router.post(
    "/checkin",
    response_model=CheckinResponse,
    responses={
        400: {"description": "Token inválido/expirado ou telefone em uso"},
        404: {"description": "Estande não encontrado"},
    },
)
def checkin(
    payload: CheckinRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    clean_slug = payload.stand_slug.strip().lower()
    clean_slug = "ecociente" if clean_slug == "eco" else clean_slug
    stand = db.scalar(select(Stand).where(Stand.slug == clean_slug))
    if stand is None:
        raise HTTPException(status_code=404, detail="Estande não encontrado")
    secret = request.app.state.settings.hmac_secret.get_secret_value()
    if not validate_token(stand.slug, payload.token, secret):
        raise HTTPException(
            status_code=400, detail="Token expirado ou inválido. Leia o QR Code novamente."
        )

    participante: Participante | None = None

    # 1. Se participante_id foi enviado, tenta localizar por ID com lock de escrita
    if payload.participante_id is not None:
        participante = db.scalar(
            select(Participante).where(Participante.id == payload.participante_id).with_for_update()
        )

    # 2. Se não localizou por ID ou ID não foi enviado, busca pelo telefone único
    if participante is None:
        participante = db.scalar(
            select(Participante).where(Participante.telefone == payload.telefone).with_for_update()
        )

    # 3. Criação ou atualização do participante
    if participante is None:
        # Novo participante
        participante = Participante(nome=payload.nome.strip(), telefone=payload.telefone)
        db.add(participante)
    else:
        # Participante já existente (seja por ID ou por telefone):
        # Se o telefone foi modificado para outro valor, garante que não conflita com terceiro
        if participante.telefone != payload.telefone:
            outro = db.scalar(
                select(Participante.id).where(
                    Participante.telefone == payload.telefone,
                    Participante.id != participante.id,
                )
            )
            if outro is not None:
                raise HTTPException(
                    status_code=400, detail="Telefone já cadastrado para outro participante"
                )
            participante.telefone = payload.telefone

        # Atualiza nome se informado
        if payload.nome and payload.nome.strip():
            participante.nome = payload.nome.strip()

    try:
        db.flush()
    except IntegrityError as error:
        db.rollback()
        # Tratamento resiliente para concorrência simultânea no primeiro cadastro
        participante = db.scalar(
            select(Participante).where(Participante.telefone == payload.telefone).with_for_update()
        )
        if participante is None:
            raise HTTPException(
                status_code=400, detail="Telefone já cadastrado para outro participante"
            ) from error
        if payload.nome and payload.nome.strip():
            participante.nome = payload.nome.strip()
        db.flush()

    existing = db.scalar(
        select(Checkin.id).where(
            Checkin.participante_id == participante.id, Checkin.stand_id == stand.id
        )
    )
    if existing is None:
        db.add(Checkin(participante_id=participante.id, stand_id=stand.id))
    # Cadastro/atualização e presença são confirmados na mesma transação.
    db.commit()
    db.refresh(participante)

    _set_participant_cookies(response, participante)

    return CheckinResponse(
        mensagem=f"Presença confirmada no estande {stand.nome}!", participante=participante
    )


@router.post(
    "/checkin/recuperar",
    response_model=ParticipanteLookupResponse,
    responses={
        400: {"description": "Token inválido ou expirado"},
        404: {"description": "Estande não encontrado"},
    },
)
def recuperar_participante(
    payload: ParticipanteLookupRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    clean_slug = payload.stand_slug.strip().lower()
    clean_slug = "ecociente" if clean_slug == "eco" else clean_slug
    stand = db.scalar(select(Stand).where(Stand.slug == clean_slug))
    if stand is None:
        raise HTTPException(status_code=404, detail="Estande não encontrado")
    secret = request.app.state.settings.hmac_secret.get_secret_value()
    if not validate_token(stand.slug, payload.token, secret):
        raise HTTPException(
            status_code=400, detail="Token expirado ou inválido. Leia o QR Code novamente."
        )

    participante = db.scalar(
        select(Participante).where(Participante.telefone == payload.telefone)
    )
    if participante is None:
        return ParticipanteLookupResponse(encontrado=False, participante=None)

    _set_participant_cookies(response, participante)

    return ParticipanteLookupResponse(
        encontrado=True,
        participante=participante,
    )


@router.get(
    "/participantes/{participante_id}/status",
    response_model=StatusResponse,
    responses={404: {"description": "Participante não encontrado"}},
)
def status(participante_id: UUID, db: Session = Depends(get_db)):
    participante = db.get(Participante, participante_id)
    if participante is None:
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
        nome=participante.nome,
        telefone=participante.telefone,
        total_visitados=total,
        concluiu_todos=total == len(STANDS),
        stands=stands,
    )
