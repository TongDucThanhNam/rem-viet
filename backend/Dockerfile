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

# [optional] tests & build
ENV NODE_ENV=production

# copy production dependencies and source code into final image
FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app .

# Set environment variables at build time
ARG PORT
ENV PORT=$PORT
RUN bun run swagger

# Set environment variables at build time
ARG CONNECTION_STRING
ENV CONNECTION_STRING=$CONNECTION_STRING
ARG DATABASE_NAME
ENV DATABASE_NAME=$DATABASE_NAME
ARG TELEGRAM_BOT_TOKEN
ENV TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN
ARG TELEGRAM_CHAT_ID
ENV TELEGRAM_CHAT_ID=$TELEGRAM_CHAT_ID
ARG NOTION_API_KEY
ENV NOTION_API_KEY=$NOTION_API_KEY
ARG NOTION_DATABASE_ID
ENV NOTION_DATABASE_ID=$NOTION_DATABASE_ID

# run the app
USER bun
EXPOSE 3001/tcp
ENTRYPOINT [ "bun", "run", "start" ]