import uvicorn

from backend.app.main import create_app

app = create_app()

if __name__ == "__main__":
    uvicorn.run(app="backend.main:app", host="127.0.0.1", port=6767)
