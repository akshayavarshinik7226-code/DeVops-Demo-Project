# ---- stage 1: build the static files with Node ----
FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ---- stage 2: serve them with Nginx (no Node tools in the final image) ----
FROM nginxinc/nginx-unprivileged:1.27-alpine
ARG APP_VERSION=0.0.0-dev
ARG GIT_COMMIT=local
LABEL org.opencontainers.image.source="https://github.com/YOUR-USER/forgeops" \
      org.opencontainers.image.revision="${GIT_COMMIT}" \
      org.opencontainers.image.version="${APP_VERSION}"
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1:8080/nginx-health || exit 1
