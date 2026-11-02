# syntax=docker/dockerfile:1

# Imagem do front do CRM BRL: o Node 24 compila o Angular e o Caddy serve o resultado,
# repassando /api para a API. Para subir tudo (banco, API e front), use o
# docker-compose.yml do repositório crmbrl-api.
#
# Variáveis do container: PORT (padrão 8080) e API_UPSTREAM (host:porta da API, padrão
# api:3000, o nome do serviço no compose). O Caddy roda sem root (uid 1000).

# 1. Build do Angular (configuração de produção, com hash nos nomes dos arquivos).
FROM node:24-alpine AS build
WORKDIR /app
ENV NG_CLI_ANALYTICS=false
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npx ng build

# Content-Security-Policy com o hash (sha256) de cada <script> inline do index.html — o que
# aplica o tema antes da primeira pintura, o que liga o CSS crítico… Calculada aqui, a política
# acompanha qualquer mudança neles. 'unsafe-inline' em style-src é necessário: o Angular põe
# os estilos dos componentes em <style> (as ligações [style.--x] usam o CSSOM e não contam).
# O script é um `node -e` sem aspas simples dentro (o valor de cada fonte sai de `aspas()`),
# para funcionar também no construtor antigo do Docker, que não aceita heredoc.
RUN node -e ' \
  const { createHash } = require("node:crypto"); \
  const { readFileSync, writeFileSync } = require("node:fs"); \
  const aspas = (valor) => String.fromCharCode(39) + valor + String.fromCharCode(39); \
  const html = readFileSync("dist/crmbrl/browser/index.html", "utf8"); \
  const scripts = [...html.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)]; \
  const hashes = scripts.map(([, codigo]) => \
    aspas("sha256-" + createHash("sha256").update(codigo, "utf8").digest("base64"))); \
  const politica = [ \
    "default-src " + aspas("self"), \
    ["script-src", aspas("self"), ...hashes].join(" "), \
    "style-src " + aspas("self") + " " + aspas("unsafe-inline"), \
    "img-src " + aspas("self") + " data: blob:", \
    "media-src " + aspas("self") + " blob:", \
    "font-src " + aspas("self"), \
    "connect-src " + aspas("self"), \
    "object-src " + aspas("none"), \
    "base-uri " + aspas("self"), \
    "form-action " + aspas("self"), \
    "frame-ancestors " + aspas("none"), \
  ].join("; "); \
  writeFileSync("dist/csp.caddy", "header Content-Security-Policy \"" + politica + "\"\n"); \
  console.log("CSP: " + hashes.length + " script(s) inline com hash."); \
'

# 2. Servidor: Caddy com o build em /srv (configuração no Caddyfile) e a CSP gerada acima.
FROM caddy:2.10-alpine
ENV PORT=8080 \
    API_UPSTREAM=api:3000
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist/csp.caddy /etc/caddy/csp.caddy
COPY --from=build /app/dist/crmbrl/browser /srv
# Sem root: a porta 8080 não precisa de privilégio; só /data e /config (do Caddy) são
# graváveis pelo usuário.
RUN mkdir -p /data /config && chown -R 1000:1000 /data /config
USER 1000:1000
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/" || exit 1
