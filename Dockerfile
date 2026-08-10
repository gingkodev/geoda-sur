# Multi-stage. The `dev` target is what docker-compose.yml builds locally (source
# bind-mounted over it, Vite dev server + tsx watch); the final `prod` target is
# what ships. They must stay separate: the whole reason production was serving
# /@vite/client to real visitors is that a single-stage image ran `npm run dev`.

# ---------- shared dependency layer ----------
FROM node:22-alpine AS deps
# sharp's musl prebuilds need libc6-compat.
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- development ----------
FROM deps AS dev
COPY . .
CMD ["npm", "run", "dev"]

# ---------- build ----------
FROM deps AS build
COPY . .
# Emits dist/*.js (tsc, server) + dist/client/ (vite, frontend).
RUN npm run build

# ---------- production runtime ----------
FROM node:22-alpine AS prod
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Belt-and-braces with the error handler in src/app.ts and the NODE_ENV in the
# compose file: whichever way the container is started, it starts in production.
ENV NODE_ENV=production

# Reinstalled rather than copied from `deps` so the tree is pruned to runtime
# dependencies, and so sharp resolves its platform binary for this stage.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# migrate.ts resolves migrations/ from process.cwd(), which is WORKDIR.
COPY migrations ./migrations
# Served by express.static in app.ts.
COPY admin ./admin
COPY public ./public
# Backs the /banco mount. Gitignored, so on a fresh VPS clone this directory has
# to be copied to the host out of band before building — otherwise the home
# canvas loads with no images and the build still succeeds silently.
COPY random-imgs/banco-imagenes ./random-imgs/banco-imagenes

EXPOSE 3000
CMD ["npm", "start"]
