# ===========================================================================
# Stage 1 — install dependencies (including the native SQLite addon)
# ===========================================================================
FROM node:24-slim AS deps

WORKDIR /app

# better-sqlite3 is a *native* addon: part of it is C++ that must be compiled
# for the target platform. It normally downloads a prebuilt binary, but falls
# back to building from source — and these are the tools that fallback needs.
# They exist only in this stage, so the shipped image never carries a compiler.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 \
      make \
      g++ \
 && rm -rf /var/lib/apt/lists/*

# Copy ONLY the manifests, before the source. Docker caches each instruction as
# a layer and reuses it as long as that instruction's inputs are unchanged.
# Because dependencies are installed before any source is copied, editing
# src/server.js later reuses the cached install instead of re-running it.
# Copying the source first would invalidate npm ci on every code change.
COPY package.json package-lock.json ./

# `npm ci` installs precisely the versions pinned in package-lock.json and
# fails if the lockfile disagrees with package.json. `npm install` would be free
# to resolve newer versions, which makes image builds non-reproducible.
# --omit=dev leaves out devDependencies, which production never needs.
RUN npm ci --omit=dev

# ===========================================================================
# Stage 2 — the runtime image
# ===========================================================================
# Starting from a fresh base is what makes this "multi-stage": the compilers,
# apt cache, and build tooling above are all discarded. Only what we explicitly
# COPY --from crosses the boundary.
FROM node:24-slim AS runtime

WORKDIR /app

# Signals production to Express and the npm ecosystem (disables dev-only
# warnings, enables view caching, etc.).
ENV NODE_ENV=production

# Bring over the already-installed modules, compiled binary included.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# The official node images ship a non-root `node` user. Running as root means a
# container breakout begins with root privileges. SQLite also needs write
# access to the data directory, so that must be owned by the same user.
RUN mkdir -p /app/data && chown -R node:node /app
USER node

ENV PORT=3001 \
    DB_PATH=/app/data/decks.db

# Documentation for humans and tooling — it does not itself publish the port.
# Compose decides what is actually reachable from the host.
EXPOSE 3001

# Lets Docker distinguish "the process is alive" from "the app is serving".
# Compose uses this below to hold the frontend back until the API is ready.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Exec form (a JSON array, not a bare string) runs node directly as PID 1 so it
# receives SIGTERM on `docker compose down`. The shell form would wrap it in
# /bin/sh, which swallows the signal and forces a 10-second kill instead.
CMD ["node", "src/server.js"]
