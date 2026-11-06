import re
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CheckinRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    participante_id: UUID | None = None
    nome: str = Field(min_length=2, max_length=150)
    telefone: str = Field(min_length=10, max_length=30)
    stand_slug: str = Field(min_length=1, max_length=50)
    token: str = Field(min_length=1, max_length=128)

    @field_validator("telefone")
    @classmethod
    def normalize_phone(cls, value: str) -> str:
        if not re.fullmatch(r"\+?[0-9() .-]+", value):
            raise ValueError("Telefone deve conter apenas números e formatação telefônica")
        digits = re.sub(r"[^0-9]", "", value)
        if len(digits) in (12, 13) and digits.startswith("55"):
            digits = digits[2:]
        if len(digits) not in (10, 11):
            raise ValueError("Informe telefone brasileiro com DDD (10 ou 11 dígitos)")
        return digits


class ParticipanteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    nome: str
    telefone: str


class StandItem(BaseModel):
    slug: str
    nome: str


class StandLoginRequest(BaseModel):
    pin: str = Field(min_length=1, max_length=64)
    stand_slug: str | None = Field(default=None, max_length=50)
    base_url: str | None = None


class StandLoginResponse(BaseModel):
    sucesso: bool = True
    stand: str
    nome: str
    token: str
    expires_in_seconds: int
    qr_url: str


class TokenResponse(BaseModel):
    stand: str
    nome: str | None = None
    token: str
    expires_in_seconds: int
    qr_url: str


class CheckinResponse(BaseModel):
    sucesso: bool = True
    mensagem: str
    participante: ParticipanteResponse


class StandStatus(BaseModel):
    slug: str
    nome: str
    visitado: bool


class StatusResponse(BaseModel):
    participante_id: UUID
    nome: str | None = None
    telefone: str | None = None
    total_visitados: int
    concluiu_todos: bool
    stands: list[StandStatus]


class ParticipanteLookupRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    telefone: str = Field(min_length=10, max_length=30)
    stand_slug: str = Field(min_length=1, max_length=50)
    token: str = Field(min_length=1, max_length=128)

    @field_validator("telefone")
    @classmethod
    def normalize_phone(cls, value: str) -> str:
        if not re.fullmatch(r"\+?[0-9() .-]+", value):
            raise ValueError("Telefone deve conter apenas números e formatação telefônica")
        digits = re.sub(r"[^0-9]", "", value)
        if len(digits) in (12, 13) and digits.startswith("55"):
            digits = digits[2:]
        if len(digits) not in (10, 11):
            raise ValueError("Informe telefone brasileiro com DDD (10 ou 11 dígitos)")
        return digits


class ParticipanteLookupResponse(BaseModel):
    encontrado: bool
    participante: ParticipanteResponse | None = None


class SorteioResponse(BaseModel):
    total_aptos: int
    ganhador: ParticipanteResponse | None


class StandContagem(BaseModel):
    slug: str
    nome: str
    total_checkins: int


class AdminResumoResponse(BaseModel):
    total_participantes: int
    total_checkins: int
    total_aptos: int
    stands: list[StandContagem]
    aptos: list[ParticipanteResponse]

