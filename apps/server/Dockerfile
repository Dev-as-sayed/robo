FROM node:22-alpine AS build
RUN apk add --no-cache openssl && corepack enable && corepack prepare pnpm@12.11.2 --activate
WORKDIR /app

COPY apps/server/package.json apps/server/pnpm-lock.yaml apps/server/pnpm-workspace.yaml ./apps/server/
COPY packages/shared ./packages/shared
RUN pnpm --dir apps/server install --frozen-lockfile

COPY apps/server ./apps/server
RUN pnpm --dir apps/server db:generate && pnpm --dir apps/server build

FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl && corepack enable && corepack prepare pnpm@12.11.2 --activate
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build --chown=node:node /app/apps/server/package.json /app/apps/server/pnpm-lock.yaml /app/apps/server/pnpm-workspace.yaml ./apps/server/
COPY --from=build --chown=node:node /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=build --chown=node:node /app/apps/server/prisma ./apps/server/prisma
COPY --from=build --chown=node:node /app/apps/server/dist ./apps/server/dist
COPY --from=build --chown=node:node /app/packages/shared ./packages/shared

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:3000/health >/dev/null || exit 1
CMD ["sh", "-c", "pnpm --dir apps/server exec prisma migrate deploy && node apps/server/dist/index.js"]
