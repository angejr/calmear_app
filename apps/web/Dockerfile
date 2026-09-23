# syntax=docker/dockerfile:1
#
# Production Dockerfile for the CalmEar Nuxt application.
#
#   Build:  docker build -t calmear-web .
#   Run:    docker run --rm -p 8080:8080 --env-file .env calmear-web
#
# No secrets are baked into this image. All runtime configuration
# (Clerk, Stripe, database, app URL) is injected as environment variables
# when the container starts (on Fly.io: `fly secrets set ...`).

############################################
# Stage 1 — install dependencies and build
############################################
FROM node:22-alpine AS build

WORKDIR /app

ENV NUXT_TELEMETRY_DISABLED=1

# Install dependencies first for better layer caching.
# Uses the committed package-lock.json for reproducible installs.
COPY package.json package-lock.json ./
RUN npm ci

# Copy the application source and build the Nuxt/Nitro production output.
# NOTE: nuxt.config.ts reads process.env at build time only for defaults —
# every value has a safe '' fallback and real values are injected at runtime
# via NUXT_* environment variables, so no secrets are needed here.
COPY . .
RUN npm run build

############################################
# Stage 2 — minimal production runtime
############################################
FROM node:22-alpine AS runtime

WORKDIR /app

# Nitro (node-server preset) listens on HOST:PORT.
ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0

# Only the Nitro production output is needed at runtime —
# no source code, no devDependencies.
COPY --from=build /app/.output ./.output

# Run as the unprivileged node user (built into the base image).
USER node

EXPOSE 8080

CMD ["node", ".output/server/index.mjs"]
