# =====================================================================
# 21Go CRM — Dockerfile multi-stage
# Builda frontend (Vite) + backend (Fastify TS) num único container.
# Fastify serve API em /api/* e SPA estática em / (com fallback p/ index.html)
# =====================================================================

# ─────────────────────────────────────────────────────────────────────
# STAGE 1 — build do frontend (Vite SPA)
# ─────────────────────────────────────────────────────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY shared/ /app/shared/
COPY frontend/ ./

RUN npm run build

# ─────────────────────────────────────────────────────────────────────
# STAGE 2 — build do backend (Fastify TS → JS)
# ─────────────────────────────────────────────────────────────────────
FROM node:20-slim AS backend-builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY backend/package.json ./backend/
COPY shared/ ./shared/

# Instala deps SEM rodar postinstall (evita prisma generate prematuro)
RUN npm install --workspace=backend --include-workspace-root --no-audit --no-fund --ignore-scripts

COPY backend/ ./backend/

WORKDIR /app/backend
RUN npx prisma generate
RUN npx tsup

# ─────────────────────────────────────────────────────────────────────
# STAGE 3 — runtime
# ─────────────────────────────────────────────────────────────────────
FROM node:20-slim AS runtime

# Chromium do sistema + libs do Puppeteer
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
