## Base image using Node.js for initial setup
#FROM node:20-alpine AS base
#
## Setup environment variables for PNPM
#ENV PNPM_HOME="/pnpm"
#ENV PATH="$PNPM_HOME:$PATH"
#
## Enable corepack to manage package managers (like PNPM)
#RUN corepack enable
#
## Builder stage to install dependencies and build the app
#FROM base AS builder
#WORKDIR /frontend
#
## Copy only package-related files first to leverage caching during installation
#COPY package.json .npmrc ./
#
## Install dependencies using PNPM and cache them
#RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install
#
## Copy the rest of the project files after dependencies are installed
#COPY . .
#
## Set production environment and disable telemetry
#ENV NODE_ENV=production
#ENV NEXT_TELEMETRY_DISABLED=1
#
## Backend URL as a build argument and environment variable
#ARG BACKEND_URL
#ENV BACKEND_URL=$BACKEND_URL
#
## Build the project
#RUN pnpm run build
#
## Final stage using Bun for running the built app in production
#FROM oven/bun:1 AS runner
#
## Working directory inside the container
#WORKDIR /frontend
#
## Set environment variables for production and disable telemetry
#ENV NODE_ENV=production
#ENV NEXT_TELEMETRY_DISABLED=1
#
## Same BACKEND_URL used in runtime
#ARG BACKEND_URL
#ENV BACKEND_URL=$BACKEND_URL
#
## Add a non-root user for security
#RUN addgroup --system --gid 1001 nodejs && \
#    adduser --system --uid 1001 nextjs
#
## Copy necessary build artifacts from the builder stage
#COPY --from=builder /frontend/next.config.js ./
#COPY --from=builder /frontend/public ./public
#COPY --from=builder /frontend/package.json ./package.json
#COPY --from=builder --chown=nextjs:nodejs /frontend/.next/standalone ./
#COPY --from=builder --chown=nextjs:nodejs /frontend/.next/static ./.next/static
#
## Set the user to `nextjs` for better security
#USER nextjs
#
## Expose the application port
#EXPOSE 3000
#ENV PORT=3000
#
## Command to run the application using Bun
#CMD ["bun --bun", "server.js"]

# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lockb /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# install with --production (exclude devDependencies)
RUN mkdir -p /temp/prod
COPY package.json bun.lockb /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# copy node_modules from temp directory
# then copy all (non-ignored) project files into the image
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .
#RUN ls;sleep 10s;


# [optional] tests & build
ENV NODE_ENV=production
ARG BACKEND_URL
ENV BACKEND_URL=$BACKEND_URL
RUN bun --bun next build --no-lint
#RUN ls -la;sleep 10s;



# copy production dependencies and source code into final image
FROM base AS release


COPY --from=install /temp/prod/node_modules node_modules
#COPY --from=prerelease /usr/src/app/index.ts .
COPY --from=prerelease /usr/src/app/package.json .
#COPY --from=builder /frontend/next.config.js ./
#COPY --from=builder /frontend/public ./public
#COPY --from=builder /frontend/package.json ./package.json
#COPY --from=builder --chown=nextjs:nodejs /frontend/.next/standalone ./
#COPY --from=builder --chown=nextjs:nodejs /frontend/.next/static ./.next/static
COPY --from=prerelease /usr/src/app/public ./public
COPY --from=prerelease /usr/src/app/.next/standalone ./
COPY --from=prerelease /usr/src/app/.next/static ./.next/static

RUN ls -la;
# Allow all users to read the app
RUN chmod -R 777 /usr/src/app/.next /usr/src/app/public


# env
ARG BACKEND_URL
ENV BACKEND_URL=$BACKEND_URL

USER nextjs


# run the app
USER bun
EXPOSE 3000/tcp
CMD ["bun", "--bun", "server.js"]