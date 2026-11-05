from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .config import Settings
from .database import make_engine
from .routers import admin, checkin, stand


def create_app(settings: Settings | None = None) -> FastAPI:
    config = settings or Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.settings = config
        app.state.engine = make_engine(config.database_url.get_secret_value())
        try:
            yield
        finally:
            app.state.engine.dispose()

    app = FastAPI(title="Sorteio Expotech 2026", version="1.0.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "X-Stand-Pin", "X-Admin-Key"],
    )

    @app.middleware("http")
    async def no_cache(request: Request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.get("/")
    def hello_world():
        return {"msg": "Hello World"}

    for router in (stand.router, checkin.router, admin.router):
        app.include_router(router, prefix="/api/v1")
    return app
