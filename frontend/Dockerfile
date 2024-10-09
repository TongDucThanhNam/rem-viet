FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lockb /temp/dev/
RUN cd /temp/dev && bun i

# install with --production (exclude devDependencies)
RUN mkdir -p /temp/prod
COPY package.json bun.lockb /temp/prod/
RUN cd /temp/prod && bun i --production

# copy node_modules from temp directory
# then copy all (non-ignored) project files into the image
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# [optional] tests & build
ENV NODE_ENV=production
ARG BACKEND_URL
ENV BACKEND_URL=$BACKEND_URL
ARG NEXT_PUBLIC_DOMAIN
ENV NEXT_PUBLIC_DOMAIN=$NEXT_PUBLIC_DOMAIN

RUN bun --bun next build --no-lint
#RUN ls -la;sleep 10s;

# copy production dependencies and source code into final image
FROM base AS release

COPY --from=prerelease /usr/src/app/public ./public
COPY --from=prerelease /usr/src/app/.next/standalone ./
COPY --from=prerelease /usr/src/app/.next/static ./.next/static

#RUN ls -la;
# Allow all users to read the app
RUN chmod -R 777 /usr/src/app/.next /usr/src/app/public

# env
ARG BACKEND_URL
ENV BACKEND_URL=$BACKEND_URL

ARG NEXT_PUBLIC_DOMAIN
ENV NEXT_PUBLIC_DOMAIN=$NEXT_PUBLIC_DOMAIN

USER nextjs

# run the app
USER bun
EXPOSE 3000/tcp
CMD ["bun", "--bun", "server.js"]