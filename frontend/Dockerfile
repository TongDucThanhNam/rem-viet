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

# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
#FROM oven/bun:1 AS base
#
## Install dependencies only when needed
#FROM base AS deps
## Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
##RUN apk add --no-cache libc6-compat
#WORKDIR /app
#
## Install dependencies based on the preferred package manager
#COPY . ./
##RUN npm ci
#RUN bun i
#
## Rebuild the source code only when needed
#FROM base AS builder
#WORKDIR /app
#COPY --from=deps /app/node_modules ./node_modules
#COPY . .
#
## Next.js collects completely anonymous telemetry data about general usage.
## Learn more here: https://nextjs.org/telemetry
## Uncomment the following line in case you want to disable telemetry during the build.
## ENV NEXT_TELEMETRY_DISABLED 1
#
#RUN bun run build
#
## Production image, copy all the files and run next
#FROM base AS runner
#WORKDIR /app
#
#ENV NODE_ENV production
## Uncomment the following line in case you want to disable telemetry during runtime.
## ENV NEXT_TELEMETRY_DISABLED 1
#
#RUN addgroup --system --gid 1001 nodejs
#RUN adduser --system --uid 1001 nextjs
#
## Set the correct permission for prerender cache
#RUN mkdir .next
#RUN chown nextjs:nodejs .next
#
## Automatically leverage output traces to reduce image size
## https://nextjs.org/docs/advanced-features/output-file-tracing
##COPY --from=builder /frontend/next.config.js ./
##COPY --from=builder /frontend/public ./public
##COPY --from=builder /frontend/package.json ./package.json
##COPY --from=builder --chown=nextjs:nodejs /frontend/.next/standalone ./
##COPY --from=builder --chown=nextjs:nodejs /frontend/.next/static ./.next/static
#
##.npmrc
#
#COPY --from=builder /app/.npmrc ./.npmrc
#COPY --from=builder /app/next.config.js ./
#COPY --from=builder /app/public ./public
#COPY --from=builder /app/package.json ./package.json
#COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
#COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
#
#
#
#USER nextjs
#
#EXPOSE 3000
#
#ENV PORT 3000
## set hostname to localhost
#ENV HOSTNAME "0.0.0.0"
#
## server.js is created by next build from the standalone output
## https://nextjs.org/docs/pages/api-reference/next-config-js/output
#CMD ["bun", "server.js"]