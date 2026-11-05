from pathlib import Path

from pydantic import AnyHttpUrl, Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[1] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        hide_input_in_errors=True,
    )

    database_url: SecretStr
    hmac_secret: SecretStr = Field(min_length=32)
    admin_key: SecretStr = Field(min_length=32)
    public_base_url: AnyHttpUrl
    cors_origins: list[str] = []
    ouros_pin: SecretStr | None = None
    ceris_pin: SecretStr | None = None
    ecociente_pin: SecretStr | None = None
    apollo_pin: SecretStr | None = None

    @field_validator("database_url")
    @classmethod
    def normalize_database_url(cls, value: SecretStr) -> SecretStr:
        raw = value.get_secret_value().strip().removeprefix("jdbc:")
        try:
            url = make_url(raw)
            if url.drivername not in {"postgres", "postgresql", "postgresql+psycopg"}:
                raise ValueError
            # Valida também a porta, sem abrir conexão com o banco.
            _ = url.port
        except (ArgumentError, ValueError):
            raise ValueError("DATABASE_URL deve ser uma URL PostgreSQL válida") from None

        query = dict(url.query)
        # JDBC costuma fornecer as credenciais na query string. Na URL canônica,
        # movê-las para a autoridade permite que o SQLAlchemy oculte a senha.
        username = query.pop("user", url.username)
        password = query.pop("password", url.password)
        if isinstance(username, tuple) or isinstance(password, tuple):
            raise ValueError("DATABASE_URL contém credenciais duplicadas")
        channel_binding = query.pop("channelBinding", None)
        if channel_binding is not None:
            if "channel_binding" in query and query["channel_binding"] != channel_binding:
                raise ValueError("DATABASE_URL contém opções de channel binding conflitantes")
            query["channel_binding"] = channel_binding
        url = url.set(
            drivername="postgresql+psycopg", username=username, password=password, query=query
        )
        return SecretStr(url.render_as_string(hide_password=False))

    @model_validator(mode="after")
    def distinct_secrets(self):
        if self.hmac_secret == self.admin_key:
            raise ValueError("HMAC_SECRET e ADMIN_KEY devem ser diferentes")
        return self
