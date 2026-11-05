import secrets

from fastapi import APIRouter, Depends, Response
from sqlalchemy import distinct, func, select
from sqlalchemy.orm import Session

from ..constants import STAND_SLUGS, STANDS
from ..database import get_db
from ..models import Checkin, Participante, Stand
from ..schemas import AdminResumoResponse, ParticipanteResponse, SorteioResponse, StandContagem
from ..security import require_admin

router = APIRouter(prefix="/admin", tags=["Administração"], dependencies=[Depends(require_admin)])


def _eligible_ids_subquery():
    return (
        select(Checkin.participante_id)
        .join(Stand, Stand.id == Checkin.stand_id)
        .where(Stand.slug.in_(STAND_SLUGS))
        .group_by(Checkin.participante_id)
        .having(func.count(distinct(Stand.slug)) == len(STAND_SLUGS))
    )


@router.get(
    "/sorteio/resumo",
    response_model=AdminResumoResponse,
    responses={401: {"description": "Credencial administrativa ausente ou inválida"}},
)
def resumo_sorteio(response: Response, db: Session = Depends(get_db)):
    total_participantes = db.scalar(select(func.count()).select_from(Participante)) or 0
    total_checkins = db.scalar(select(func.count()).select_from(Checkin)) or 0

    eligible_ids = _eligible_ids_subquery()
    eligible = list(
        db.scalars(
            select(Participante)
            .where(Participante.id.in_(eligible_ids))
            .order_by(Participante.nome.asc())
        )
    )

    counts_rows = db.execute(
        select(Stand.slug, func.count(Checkin.id))
        .outerjoin(Checkin, Checkin.stand_id == Stand.id)
        .group_by(Stand.slug)
    ).all()
    counts_by_slug = {slug: int(cnt or 0) for slug, cnt in counts_rows}

    stands_summary = [
        StandContagem(slug=slug, nome=nome, total_checkins=counts_by_slug.get(slug, 0))
        for slug, nome in STANDS
    ]

    response.headers["Cache-Control"] = "no-store"
    return AdminResumoResponse(
        total_participantes=int(total_participantes),
        total_checkins=int(total_checkins),
        total_aptos=len(eligible),
        stands=stands_summary,
        aptos=[ParticipanteResponse.model_validate(p) for p in eligible],
    )


@router.get(
    "/sorteio/sortear",
    response_model=SorteioResponse,
    responses={401: {"description": "Credencial administrativa ausente ou inválida"}},
)
def sortear(response: Response, db: Session = Depends(get_db)):
    eligible_ids = _eligible_ids_subquery()
    eligible = list(db.scalars(select(Participante).where(Participante.id.in_(eligible_ids))))
    response.headers["Cache-Control"] = "no-store"
    return SorteioResponse(
        total_aptos=len(eligible), ganhador=secrets.choice(eligible) if eligible else None
    )
