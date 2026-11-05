import secrets

from fastapi import APIRouter, Depends, Response
from sqlalchemy import distinct, func, select
from sqlalchemy.orm import Session

from ..constants import STAND_SLUGS
from ..database import get_db
from ..models import Checkin, Participante, Stand
from ..schemas import SorteioResponse
from ..security import require_admin

router = APIRouter(prefix="/admin", tags=["Administração"], dependencies=[Depends(require_admin)])


@router.get(
    "/sorteio/sortear",
    response_model=SorteioResponse,
    responses={401: {"description": "Credencial administrativa ausente ou inválida"}},
)
def sortear(response: Response, db: Session = Depends(get_db)):
    eligible_ids = (
        select(Checkin.participante_id)
        .join(Stand, Stand.id == Checkin.stand_id)
        .where(Stand.slug.in_(STAND_SLUGS))
        .group_by(Checkin.participante_id)
        .having(func.count(distinct(Stand.slug)) == len(STAND_SLUGS))
    )
    eligible = list(db.scalars(select(Participante).where(Participante.id.in_(eligible_ids))))
    response.headers["Cache-Control"] = "no-store"
    return SorteioResponse(
        total_aptos=len(eligible), ganhador=secrets.choice(eligible) if eligible else None
    )
