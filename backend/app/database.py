from fastapi import Request
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session


class Base(DeclarativeBase):
    pass


def make_engine(database_url: str):
    return create_engine(database_url, pool_pre_ping=True, hide_parameters=True)


def get_db(request: Request):
    with Session(request.app.state.engine, expire_on_commit=False) as session:
        yield session
