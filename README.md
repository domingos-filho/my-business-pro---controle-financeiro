# My Business Pro - Controle Financeiro

Projeto de gestao financeira para microempresa com:

- `web`: frontend React + Vite servido por Nginx
- `api`: backend Node.js + Express
- `db`: PostgreSQL para persistencia centralizada na VPS

## Arquitetura

O frontend consome a API via `/api` (proxy no Nginx).  
Os dados nao ficam mais em IndexedDB/localStorage para o modulo financeiro principal.

## Variaveis de ambiente

Copie `.env.example` para `.env` (Docker) ou configure no EasyPanel:

- `API_KEY`: chave usada no Mentor IA
- `VITE_API_KEY`: fallback opcional para build do frontend
- `POSTGRES_DB`: nome do banco Postgres
- `POSTGRES_USER`: usuario do banco
- `POSTGRES_PASSWORD`: senha do banco (obrigatoria)
- `JWT_ACCESS_SECRET`: segredo do token de acesso (obrigatorio)
- `JWT_REFRESH_SECRET`: segredo do token de renovacao (obrigatorio)
- `ACCESS_TOKEN_TTL`: tempo de expiracao do access token (default `15m`)
- `ACCESS_TOKEN_MAX_AGE_MS`: validade do cookie de access token em ms (default `900000`)
- `REFRESH_TOKEN_TTL_DAYS`: validade do refresh token em dias (default `30`)
- `AUTH_COOKIE_SECURE`: cookie com flag secure (`true` em producao)
- `AUTH_COOKIE_SAME_SITE`: politica same-site do cookie (default `lax`)
- `APP_PORT`: porta publicada do frontend web no host (default `40`)
- `API_PORT`: porta publicada da API no host (default `4000`)
- `VITE_API_BASE_URL`: base da API no frontend (default `/api`)
- `VITE_API_PROXY_TARGET`: alvo da API no Vite dev server (default `http://localhost:4000`)

## Desenvolvimento local

### Opcao 1: tudo com Docker Compose

1. Crie `.env` com base em `.env.example`.
2. Execute:
   `docker compose up -d --build`

No compose atual, `mybizpro-app` e `mybizpro-api` publicam portas no host para facilitar roteamento externo.
Para ambiente local sem HTTPS, use `AUTH_COOKIE_SECURE=false`.

### Opcao 2: frontend + API separados

1. Inicie Postgres local (ou container).
2. Na pasta `api`, execute:
   `npm install && npm start`
3. Na raiz, execute:
   `npm install && npm run dev`

## Deploy na VPS com EasyPanel (GitHub + Docker Compose)

1. Faca push do repositorio atualizado no GitHub.
2. No EasyPanel, crie um app Docker Compose apontando para o repositorio.
3. Informe o arquivo `docker-compose.yml` da raiz.
4. Configure variaveis de ambiente no app:
   - `API_KEY` (obrigatoria para o Mentor IA)
   - `POSTGRES_DB`
   - `POSTGRES_USER`
   - `POSTGRES_PASSWORD`
   - `JWT_ACCESS_SECRET`
   - `JWT_REFRESH_SECRET`
5. Faca deploy.

## Base de identidade (etapa 1)

O backend agora prepara a estrutura para autenticacao real:

- tabela `users`
- tabela `sessions`
- coluna `user_id` nas tabelas de negocio

Nesta etapa, a coluna `user_id` ainda e opcional para manter compatibilidade com os dados atuais.

## Base de autenticacao (etapa 2+3+4)

O backend agora possui:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/social` (modo social simplificado)
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

As rotas de negocio usam autenticacao por cookie e isolamento por `user_id`.
No primeiro login apos atualizacao, dados legados sem `user_id` sao vinculados ao primeiro usuario autenticado.

## Estrutura de deploy

- `Dockerfile` (frontend web)
- `nginx.conf` (SPA + proxy `/api`)
- `api/Dockerfile` (backend)
- `docker-compose.yml` (web + api + postgres)
