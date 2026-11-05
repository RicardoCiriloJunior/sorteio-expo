from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import Settings
from .constants import STANDS
from .database import make_engine
from .models import Stand
from .security import hash_pin


def main():
    settings = Settings()
    pins = {}
    for slug, _ in STANDS:
        value = getattr(settings, f"{slug}_pin")
        if value is None or len(value.get_secret_value()) < 6:
            raise ValueError(f"Configure {slug.upper()}_PIN com pelo menos 6 caracteres")
        pins[slug] = value.get_secret_value()
    engine = make_engine(settings.database_url.get_secret_value())
    try:
        with Session(engine) as db, db.begin():
            for slug, nome in STANDS:
                stand = db.scalar(select(Stand).where(Stand.slug == slug))
                if stand is None:
                    db.add(Stand(slug=slug, nome=nome, pin_acesso=hash_pin(pins[slug])))
        print("Estandes cadastrados. Credenciais de estandes existentes foram preservadas.")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
