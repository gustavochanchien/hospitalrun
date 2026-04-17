# syntax=docker/dockerfile:1.7

# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: serve ────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS serve

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/docker-entrypoint.sh /docker-entrypoint.d/40-hospitalrun-config.sh
RUN chmod +x /docker-entrypoint.d/40-hospitalrun-config.sh

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# nginx:alpine's base entrypoint runs every /docker-entrypoint.d/*.sh before
# launching nginx, so our config-writer fires automatically.
