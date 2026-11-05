from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from .config import Settings
from .database import make_engine
from .routers import admin, checkin, stand


def create_app(settings: Settings | None = None) -> FastAPI:
    config = settings or Settings()
    engine = make_engine(config.database_url.get_secret_value())

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.settings = config
        app.state.engine = engine
        try:
            yield
        finally:
            engine.dispose()

    app = FastAPI(title="Sorteio Expotech 2026", version="1.0.0", lifespan=lifespan)
    app.state.settings = config
    app.state.engine = engine

    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_origins if config.cors_origins else ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def no_cache(request: Request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        return response

    for router in (stand.router, checkin.router, admin.router):
        app.include_router(router, prefix="/api/v1")

    @app.get("/healthz", include_in_schema=False)
    def healthz():
        return {"status": "ok"}

    # Servir arquivos estáticos do frontend quando presentes
    frontend_dir = Path(__file__).resolve().parents[2] / "frontend"
    if frontend_dir.exists():
        assets_dir = frontend_dir / "assets"
        css_dir = frontend_dir / "css"
        js_dir = frontend_dir / "js"

        if assets_dir.exists():
            app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
        if css_dir.exists():
            app.mount("/css", StaticFiles(directory=css_dir), name="css")
        if js_dir.exists():
            app.mount("/js", StaticFiles(directory=js_dir), name="js")

        app.mount("/frontend", StaticFiles(directory=frontend_dir, html=True), name="frontend_dir")

        @app.get("/totem", include_in_schema=False)
        @app.get("/totem.html", include_in_schema=False)
        def serve_totem():
            return FileResponse(frontend_dir / "totem.html")

        @app.get("/checkin", include_in_schema=False)
        @app.get("/checkin.html", include_in_schema=False)
        def serve_checkin():
            return FileResponse(frontend_dir / "checkin.html")

        @app.get("/status", include_in_schema=False)
        @app.get("/status.html", include_in_schema=False)
        def serve_status():
            return FileResponse(frontend_dir / "status.html")

        @app.get("/admin", include_in_schema=False)
        @app.get("/admin.html", include_in_schema=False)
        def serve_admin():
            return FileResponse(frontend_dir / "admin.html")

        @app.get("/", include_in_schema=False)
        def root():
            return RedirectResponse(url="/totem.html")
    else:
        @app.get("/")
        def hello_world():
            return {"msg": "Sorteio Expotech API v1"}

    return app
