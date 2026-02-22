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
- `POSTGRES_PASSWORD`: senha do banco
- `VITE_API_BASE_URL`: base da API no frontend (default `/api`)
- `VITE_API_PROXY_TARGET`: alvo da API no Vite dev server (default `http://localhost:4000`)

## Desenvolvimento local

### Opcao 1: tudo com Docker Compose

1. Crie `.env` com base em `.env.example`.
2. Execute:
   `docker compose up -d --build`

No compose para EasyPanel, os servicos usam apenas rede interna (`expose`) e nao publicam porta no host.

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
5. Faca deploy.

## Estrutura de deploy

- `Dockerfile` (frontend web)
- `nginx.conf` (SPA + proxy `/api`)
- `api/Dockerfile` (backend)
- `docker-compose.yml` (web + api + postgres)
