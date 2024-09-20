# Base image using Node.js for initial setup
FROM node:20-alpine AS base

# Setup environment variables for PNPM
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Enable corepack to manage package managers (like PNPM)
RUN corepack enable

# Builder stage to install dependencies and build the app
FROM base AS builder
WORKDIR /frontend

# Copy only package-related files first to leverage caching during installation
COPY package.json .npmrc ./

# Install dependencies using PNPM and cache them
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install

# Copy the rest of the project files after dependencies are installed
COPY . .

# Set production environment and disable telemetry
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Backend URL as a build argument and environment variable
ARG BACKEND_URL
ENV BACKEND_URL $BACKEND_URL

# Build the project
RUN pnpm run build

# Final stage using Bun for running the built app in production
FROM oven/bun:1 AS runner

# Working directory inside the container
WORKDIR /frontend

# Set environment variables for production and disable telemetry
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Same BACKEND_URL used in runtime
ARG BACKEND_URL
ENV BACKEND_URL $BACKEND_URL

# Add a non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary build artifacts from the builder stage
COPY --from=builder /frontend/next.config.js ./
COPY --from=builder /frontend/public ./public
COPY --from=builder /frontend/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /frontend/.next/static ./.next/static

# Set the user to `nextjs` for better security
USER nextjs

# Expose the application port
EXPOSE 3000
ENV PORT 3000

# Command to run the application using Bun
CMD ["bun", "server.js"]

# Use Bun image for both building and running
#FROM oven/bun:1 AS runner
#
## Set working directory
#WORKDIR /frontend
#
## Install pnpm within the Bun environment
#RUN bun install pnpm --global
#
## Copy package-related files first to optimize caching
#COPY package.json .npmrc ./
#
## Install dependencies using pnpm with cache for efficiency
#RUN pnpm install
#
## Copy the rest of the project files after dependencies are installed
#COPY . .
#
## Set environment variables for production and disable telemetry
#ENV NODE_ENV production
#ENV NEXT_TELEMETRY_DISABLED 1
#
## Backend URL as a build argument and environment variable
#ARG BACKEND_URL
#ENV BACKEND_URL $BACKEND_URL
#
## Build the project using pnpm
#RUN bun run build
#
## Add a non-root user for better security
#RUN addgroup --system --gid 1001 nodejs && \
#    adduser --system --uid 1001 nextjs
#
#RUN ls ;sleep 10
#
## Change ownership of the build output to the non-root user
#COPY --chown=nextjs:nodejs ./.next/standalone ./
#COPY --chown=nextjs:nodejs ./.next/static ./.next/static
#
## Set the user to `nextjs` for running the app
#USER nextjs
#
## Expose the application port
#EXPOSE 3000
#ENV PORT 3000
#
## Run the application using Bun
#CMD ["bun", "server.js"]
