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

As páginas chamam `/api/v1` no mesmo domínio. Para desenvolver localmente, abra
as páginas pelo FastAPI na porta 6767.

## Deploy no Render (backend e frontend juntos)

O `Dockerfile` empacota a API e o frontend em um único serviço. O processo escuta
em `0.0.0.0:$PORT`, e `/healthz` fornece o health check do Render.
O PostgreSQL permanece no banco externo já configurado; o deploy não cria nem altera tabelas.

### Usando o Blueprint

1. Faça commit e push deste projeto, incluindo `Dockerfile`, `.dockerignore` e `render.yaml`.
2. No Render, escolha **New > Blueprint** e conecte o repositório com `render.yaml` na raiz.
3. Informe `DATABASE_URL` com a conexão do PostgreSQL existente (por exemplo, a conexão do Neon,
   incluindo `sslmode=require` e `channel_binding=require`, quando fornecidos pelo provedor).
4. Confirme a criação do serviço. O Blueprint gera `HMAC_SECRET` e `ADMIN_KEY` automaticamente.
5. Após o deploy, abra `https://SEU-SERVICO.onrender.com/totem.html` e entre com o PIN do estande.
   O painel de sorteio fica em `/admin.html`; use o valor de `ADMIN_KEY` da seção **Environment**.

Não é necessário configurar `PUBLIC_BASE_URL` para o domínio padrão do Render:
a aplicação usa `RENDER_EXTERNAL_URL`, fornecida pela plataforma. Se usar domínio próprio,
configure `PUBLIC_BASE_URL=https://seu-dominio.com`. O totem também envia a origem atual
para gerar links que funcionam no celular.

As credenciais dos estandes continuam sendo as cadastradas no PostgreSQL.
Os valores `OUROS_PIN`, `CERIS_PIN`, `ECOCIENTE_PIN` e `APOLLO_PIN` são usados pelo
comando de cadastro inicial e não precisam ser informados para iniciar o serviço.
O arquivo `.env` local não é incluído na imagem; configure os segredos no Render.

O Blueprint usa `plan: free` para testes. Esse plano suspende o serviço após 15 minutos
sem tráfego e demora para reativá-lo. Para o evento, escolha um plano que mantenha a aplicação ativa.
Veja as [limitações do plano gratuito](https://render.com/docs/free).

### Criando o serviço manualmente

Em **New > Web Service**, conecte o repositório, escolha **Docker** e mantenha a raiz
do repositório como contexto. Use `./Dockerfile`, health check `/healthz` e deixe
**Docker Command** vazio para usar o comando da imagem. Configure:

| Variável | Valor |
| --- | --- |
| `DATABASE_URL` | Conexão do PostgreSQL existente |
| `HMAC_SECRET` | Segredo de pelo menos 32 caracteres |
| `ADMIN_KEY` | Outro segredo de pelo menos 32 caracteres |
| `PUBLIC_BASE_URL` | Opcional; use apenas para sobrescrever o domínio padrão |

Mantenha os segredos estáveis entre deploys para preservar a validação dos QR Codes
que ainda estiverem válidos. Não há comando de build ou start adicional: o Dockerfile já os define.

Referências: [Docker no Render](https://render.com/docs/docker),
[Blueprint](https://render.com/docs/blueprint-spec) e
[variáveis de ambiente da plataforma](https://render.com/docs/environment-variables).

### Executar a imagem localmente

```powershell
docker build -t sorteio-expo .
docker run --rm -p 6767:10000 --env-file backend/.env sorteio-expo
```

Abra [http://localhost:6767/totem.html](http://localhost:6767/totem.html).
Se usar `--env-file`, os valores precisam estar no formato `CHAVE=valor`, sem aspas
externas envolvendo a URL ou os segredos. Se o PostgreSQL estiver no computador local,
substitua `localhost` por `host.docker.internal` na URL usada pelo contêiner.

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
