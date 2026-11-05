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
de pelo menos 32 caracteres. Os quatro PINs, com pelo menos 6 caracteres, só são
necessários para cadastrar estandes pelo comando `backend.app.seed`.
Gere cada segredo com:

```powershell
.\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_hex(32))"
```

Com `DATABASE_URL` configurada para um PostgreSQL acessível:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 6767 --reload
```

`DATABASE_URL` aceita `postgresql+psycopg://`, `postgresql://`, `postgres://` e
`jdbc:postgresql://`. A aplicação converte a URL para o driver psycopg e a opção JDBC
`channelBinding` para `channel_binding`, preservando SSL e as credenciais. Por exemplo:

```dotenv
DATABASE_URL=postgresql://usuario:senha@host/banco?sslmode=require&channel_binding=require
```

As tabelas já devem existir no banco. O comando `backend.app.seed` serve apenas para
cadastrar os quatro estandes, caso ainda não estejam cadastrados. Ele é idempotente
e preserva os PINs existentes. Se os estandes já estiverem cadastrados, basta iniciar o servidor.

Para cadastrar estandes ausentes, execute `python -m backend.app.seed` com o ambiente
virtual ativado e os PINs configurados.

Documentação interativa: [Swagger UI](http://localhost:6767/docs).
Contrato: [OpenAPI](http://localhost:6767/openapi.json).

## Endpoints

| Método | Rota | Credencial | Resultado |
| --- | --- | --- | --- |
| GET | `/api/v1/stands/{slug}/token` | `X-Stand-Pin` | Token, URL do QR Code e segundos até expirar |
| POST | `/api/v1/checkin` | Token no corpo | Cadastra/atualiza participante e confirma presença |
| GET | `/api/v1/participantes/{participante_id}/status` | UUID do participante | Progresso nos quatro estandes |
| GET | `/api/v1/admin/sorteio/sortear` | `X-Admin-Key` | Total de aptos e ganhador, ou `null` se não houver aptos |

Corpo do check-in:

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
Não há recuperação automática por telefone: sem o UUID, cadastrar o mesmo telefone retorna 400.

Token inválido/expirado retorna 400; estande inexistente retorna 404; credenciais
ausentes/incorretas retornam 401; erros de formato do corpo/UUID retornam 422.
Repetir um check-in com o UUID correto retorna 200 e mantém uma única presença.
Nome, telefone e check-in são gravados na mesma transação: conflito de telefone não deixa
alterações parciais. O banco também impõe unicidade e exclusão em cascata dos check-ins.

## Tokens e sorteio

Cada token vale por 5 minutos a partir da geração. O formato é
`{expires_at}.{assinatura}`, sendo `expires_at` um timestamp Unix e a assinatura o
HMAC-SHA256 completo de `checkin:v2:{slug}:{expires_at}`. A assinatura vincula o token
ao estande e à expiração: um token do Ceris não é válido para o Ouros, e alterar
a data de expiração também o invalida. `expires_in_seconds` retorna 300.
O totem usa esse prazo para renovar o QR Code antecipadamente, após 200 segundos.
Ao atualizar uma versão que usava tokens por janelas fixas, gere novos QR Codes.
A URL aponta para `PUBLIC_BASE_URL/checkin?stand=...&token=...`.

O cadastro pelo comando `seed` armazena PINs como hashes PBKDF2-SHA256 com salt
individual e 600 mil iterações; por isso o modelo usa VARCHAR(255) para `pin_acesso`.
A validação também aceita os PINs em texto já existentes no banco, sem alterar os registros.
Segredos ficam em variáveis de ambiente ou `backend/.env`, ignorado pelo Git.
Configuração é validada ao carregar a aplicação. As respostas usam `Cache-Control: no-store`.

O sorteio usa `secrets.choice` entre quem visitou os quatro slugs oficiais distintos.
Outros estandes não substituem uma visita obrigatória. A rota GET mantém o contrato proposto:
cada chamada realiza uma nova seleção; o ganhador não é persistido nem excluído de chamadas futuras.
Não foi especificada uma rota de relatório separado.

O UUID funciona como credencial de posse no contrato proposto. O token dinâmico limita
o tempo de uso do QR Code, mas permite compartilhamento dentro da janela e não comprova
presença física. Para exposição pública, configure HTTPS, limite de requisições no proxy,
origens CORS exatas e logs sem query strings, corpos ou credenciais.
Não distribua `HMAC_SECRET` ou `ADMIN_KEY` ao frontend público.

## Verificação de código

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
.\.venv\Scripts\python.exe -m ruff check backend
```

A implementação segue os padrões de sessão por requisição e injeção de dependências
da [documentação do FastAPI](https://fastapi.tiangolo.com/tutorial/sql-databases/)
e usa as restrições e transações do
[SQLAlchemy para PostgreSQL](https://docs.sqlalchemy.org/en/20/dialects/postgresql.html).
