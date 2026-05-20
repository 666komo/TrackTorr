# syntax=docker/dockerfile:1
# ----------------------------------------
# STAGE 1: Build Go streamer binary
# ----------------------------------------
FROM golang:1.26-alpine AS go-builder
WORKDIR /build
RUN apk add --no-cache git
COPY packages/streamer/go.mod packages/streamer/go.sum ./
RUN go mod download
COPY packages/streamer/ .
RUN CGO_ENABLED=0 go build -o /dist/streamer .

# ----------------------------------------
# STAGE 2: Build server (tsc) + frontend (Vite)
# ----------------------------------------
FROM node:22-alpine AS node-builder
WORKDIR /build

COPY package.json package-lock.json ./
COPY packages/client/package.json packages/client/
COPY packages/server/package.json packages/server/
RUN npm ci --ignore-scripts

COPY packages/server/tsconfig.json packages/server/
COPY packages/server/src/ packages/server/src/
RUN npm run build -w packages/server

COPY packages/client/ packages/client/
RUN npm run build -w packages/client

# ----------------------------------------
# STAGE 3: Runtime
# ----------------------------------------
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=go-builder /dist/streamer ./dist/streamer
COPY --from=node-builder /build/packages/client/dist ./packages/client/dist
COPY --from=node-builder /build/packages/server/dist ./packages/server/dist
COPY --from=node-builder /build/node_modules ./node_modules
COPY --from=node-builder /build/package.json ./

ENV NODE_ENV=production
EXPOSE 3030

VOLUME ["/data"]

CMD ["node", "packages/server/dist/index.js"]