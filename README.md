# Sorteio Expotech 2026

Backend em Python 3.10+, FastAPI, SQLAlchemy 2 e PostgreSQL para confirmar visitas
aos estandes Ouros, Ceris, EcoCiente e apollo > e sortear participantes que completaram o circuito.

## Executar localmente

Na raiz do repositório, no PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
Copy-Item backend/.env.example backend/.env
```

Edite `backend/.env`: preencha `HMAC_SECRET` e `ADMIN_KEY` com valores diferentes
de pelo menos 32 caracteres. Os quatro PINs, com pelo menos 6 caracteres, são
usados para autenticar cada estande no Totem e cadastrar estandes pelo comando `backend.app.seed`.
Gere cada segredo com:

```powershell
.\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_hex(32))"
```

Com `DATABASE_URL` configurada para um PostgreSQL acessível:

```powershell
python -m uvicorn backend.main:app --host 0.0.0.0 --port 6767 --reload
```

A aplicação FastAPI já serve tanto a API REST (`/api/v1/...`) quanto as páginas do Totem e Check-in:
- **Totem do Estande**: [http://localhost:6767/totem.html](http://localhost:6767/totem.html)
- **Check-in do Participante**: [http://localhost:6767/checkin.html](http://localhost:6767/checkin.html)
- **Status do Participante**: [http://localhost:6767/status.html](http://localhost:6767/status.html)
- **Painel Admin do Sorteio**: [http://localhost:6767/admin.html](http://localhost:6767/admin.html)
- **Swagger UI**: [http://localhost:6767/docs](http://localhost:6767/docs)

## PINs de Acesso dos Estandes

Cada estande possui seu PIN exclusivo para autenticar no Totem:
- **Ouros**: `573550` (slug: `ouros`)
- **Ceris**: `729460` (slug: `ceris`)
- **EcoCiente**: `865686` (slug: `ecociente`)
- **Apollo**: `641450` (slug: `apollo`)

Ao digitar o PIN no Totem (com ou sem selecionar o estande), o sistema identifica o estande, autentica e gera o QR Code oficial assinado com validade de 5 minutos, renovado automaticamente a cada ~3 minutos e 20 segundos.

## Endpoints

| Método | Rota | Credencial | Resultado |
| --- | --- | --- | --- |
| GET | `/api/v1/stands` | Pública | Lista os estandes oficiais |
| POST | `/api/v1/stands/login` | PIN no corpo | Autentica o estande (identificado pelo PIN), gera token e QR Code |
| GET | `/api/v1/stands/{slug}/token` | `X-Stand-Pin` ou `?pin=` | Token, URL do QR Code e segundos até expirar |
| POST | `/api/v1/checkin` | Token no corpo | Cadastra/atualiza participante e confirma presença |
| GET | `/api/v1/participantes/{participante_id}/status` | UUID do participante | Progresso nos quatro estandes |
| GET | `/api/v1/admin/sorteio/sortear` | `X-Admin-Key` | Total de aptos e ganhador, ou `null` se não houver aptos |

Corpo do login do estande (`POST /api/v1/stands/login`):

```json
{
  "pin": "573550",
  "stand_slug": "ouros",
  "base_url": "http://192.168.1.15:6767"
}
```
*(Nota: `stand_slug` e `base_url` são opcionais; se `stand_slug` for omitido, o backend localiza o estande correspondente ao PIN automaticamente).*

Corpo do check-in (`POST /api/v1/checkin`):

```json
{
  "participante_id": null,
  "nome": "Lucas Porto",
  "telefone": "11999999999",
  "stand_slug": "ouros",
  "token": "TOKEN_RETORNADO_PELO_TOTEM"
}
```

No primeiro estande, omita `participante_id` ou envie `null`. Guarde o UUID retornado
no localStorage e envie-o nas visitas seguintes. Um UUID inexistente retorna 404;
um telefone já associado a outro participante retorna 400. O telefone é normalizado
para 10 ou 11 dígitos com DDD; a formatação e o prefixo brasileiro `+55` são removidos.

## Tokens e Sorteio

Cada token vale por 5 minutos a partir da geração. O formato é
`{expires_at}.{assinatura}`, sendo `expires_at` um timestamp Unix e a assinatura o
HMAC-SHA256 completo de `checkin:v2:{slug}:{expires_at}`. A assinatura vincula o token
ao estande e à expiração. O totem usa esse prazo para renovar o QR Code antecipadamente a cada 200 segundos.
A URL aponta para `BASE_URL/checkin.html?stand=...&token=...`.

O sorteio usa `secrets.choice` entre quem visitou os quatro slugs oficiais distintos.
