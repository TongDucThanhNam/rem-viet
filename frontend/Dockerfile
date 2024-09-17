FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /frontend
COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY . .
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ARG BACKEND_URL
ENV BACKEND_URL $BACKEND_URL
RUN pnpm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /frontend

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ARG BACKEND_URL
ENV BACKEND_URL $BACKEND_URL

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /frontend/next.config.js ./
COPY --from=builder /frontend/public ./public
COPY --from=builder /frontend/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /frontend/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
