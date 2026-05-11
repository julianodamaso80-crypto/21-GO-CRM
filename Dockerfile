# =====================================================================
# 21Go CRM — Dockerfile multi-stage otimizado
# Builda frontend (Vite) + backend (Fastify TS) num único container.
# Fastify serve API em /api/* e SPA estática em / (com fallback p/ index.html)
#
# Otimizações chave:
# - npm workspaces com lockfile na raiz → npm ci (3-5x mais rápido que npm install)
# - Stage `deps` isolado → cache de layer só invalida se package*.json mudar
# - COPY de código DEPOIS do install → mudança em src/ não reinstala deps
# =====================================================================

# ─────────────────────────────────────────────────────────────────────
# STAGE 1 — deps (compartilhado por frontend e backend)
# Só invalida cache se algum package.json ou lockfile mudar.
# ─────────────────────────────────────────────────────────────────────
FROM node:20-slim AS deps

WORKDIR /app

# Lockfile + manifests dos 3 workspaces (frontend, backend, shared)
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
COPY shared/package.json ./shared/

# npm ci é determinístico e 3-5x mais rápido que npm install.
# --ignore-scripts evita postinstall (prisma generate) antes de copiar o schema.
RUN npm ci --no-audit --no-fund --ignore-scripts

# ─────────────────────────────────────────────────────────────────────
# STAGE 2 — build do frontend (Vite SPA)
# ─────────────────────────────────────────────────────────────────────
FROM deps AS frontend-builder

COPY shared/ ./shared/
COPY frontend/ ./frontend/

RUN npm run build --workspace=frontend

# ─────────────────────────────────────────────────────────────────────
# STAGE 3 — build do backend (Fastify TS → JS)
# ─────────────────────────────────────────────────────────────────────
FROM deps AS backend-builder

COPY shared/ ./shared/
COPY backend/ ./backend/

WORKDIR /app/backend
RUN npx prisma generate
RUN npx tsup

# ─────────────────────────────────────────────────────────────────────
# STAGE 4 — runtime
# ─────────────────────────────────────────────────────────────────────
FROM node:20-slim AS runtime

# Chromium do sistema + libs do Puppeteer (usado pra gerar PDFs de cotação)
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    fonts-liberation \
    fonts-noto-color-emoji \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libxkbcommon0 \
    libpango-1.0-0 libcairo2 libasound2 libdbus-1-3 libxext6 libxshmfence1 libdrm2 \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PORT=3333

WORKDIR /app

# Backend: artifacts + node_modules + Prisma client + schema
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/backend/package.json ./backend/package.json
COPY --from=backend-builder /app/backend/prisma ./backend/prisma

# Frontend: bundle estático servido pelo Fastify (em /app/frontend/dist)
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

WORKDIR /app/backend

EXPOSE 3333

CMD ["node", "dist/server.js"]
