# My Business Pro - Controle Financeiro

Projeto frontend em React + Vite para gestao financeira de microempresa.

## Variaveis de ambiente

Copie `.env.example` para `.env.local` (execucao local) ou configure no ambiente de deploy:

- `API_KEY`: chave usada pelo Advisor (Google GenAI).
- `VITE_API_KEY`: fallback opcional para a mesma chave.
- `APP_PORT`: porta publicada no host pelo Docker Compose (padrao `40`).

## Rodar localmente (sem Docker)

Pre-requisito: Node.js 20+.

1. Instale dependencias:
   `npm install`
2. Configure variaveis em `.env.local`.
3. Suba em modo desenvolvimento:
   `npm run dev`

## Deploy com Docker Compose

Arquivos de deploy incluidos no projeto:

- `Dockerfile` (build multi-stage: Node -> Nginx)
- `docker-compose.yml`
- `nginx.conf`

### Subir localmente com Docker

1. Crie um arquivo `.env` com as variaveis (pode usar `.env.example` como base).
2. Execute:
   `docker compose up -d --build`
3. Acesse:
   `http://localhost:40`

## Deploy na VPS com EasyPanel (importando do GitHub)

1. Faca push deste repositorio no GitHub.
2. No EasyPanel, crie um app do tipo Docker Compose via GitHub.
3. Aponte para este repositorio/branch.
4. Configure as variaveis de ambiente no EasyPanel:
   - `API_KEY` (obrigatoria para o Advisor)
   - `APP_PORT` (opcional; default `40`)
5. Execute o deploy.

O container publica a aplicacao web via Nginx na porta interna `80` (mapeada para `${APP_PORT}` no host).
