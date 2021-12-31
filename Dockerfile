# syntax=docker/dockerfile:1.3
FROM node:16-alpine as base
FROM base AS deps

WORKDIR /app
COPY ./.yarn ./.yarn
COPY ./package.json ./yarn.lock ./.yarnrc.yml ./

RUN \
  apk add --no-cache --virtual build-deps python3 alpine-sdk autoconf libtool automake && \
  yarn install --immutable && \
  yarn cache clean && \
  apk del build-deps

# ---
FROM base AS builder
WORKDIR /app

COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN yarn build

# ---
FROM base AS runner

WORKDIR /app
ENV NODE_ENV production

RUN apk add --no-cache tini

COPY ./assets ./assets
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/.yarn ./.yarn
COPY --from=deps /app/.yarnrc.yml ./.yarnrc.yml
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./package.json

RUN \
  addgroup -g 1001 -S nodejs && \
  adduser -S nodejs -u 1001 && \
  chown nodejs:nodejs /app && \
  chown -R nodejs:nodejs /app/build

USER nodejs

ARG GIT_REPO
LABEL org.opencontainers.image.source=${GIT_REPO}

EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "."]
