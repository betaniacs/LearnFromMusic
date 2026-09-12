# ===========================================================================
# Stage 1 — compile the React app
# ===========================================================================
FROM node:24-slim AS build

WORKDIR /app

# Same manifest-first ordering as the backend, for the same caching reason.
COPY package.json package-lock.json ./

# Vite and @vitejs/plugin-react are devDependencies and are required to build,
# so this install deliberately does NOT use --omit=dev.
RUN npm ci

# .dockerignore keeps the host's node_modules and dist out of this copy.
COPY . .

# Produces static HTML/CSS/JS in /app/dist. Note what is absent: no API key.
# Only VITE_-prefixed variables are inlined into the bundle, and the key is
# never exposed as one — it stays in the backend container's environment.
RUN npm run build

# ===========================================================================
# Stage 2 — serve the built files
# ===========================================================================
# The compiled app is just static files, so the runtime needs a web server, not
# Node. Discarding the toolchain is what makes this image 76 MB while the
# Node-based backend image is 461 MB — and an image with no node, no npm and no
# source code in it has far less surface to attack.
FROM nginx:1.27-alpine AS runtime

# Our server block: SPA fallback plus the /api reverse proxy.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# The only artifact carried across from the build stage.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# The nginx image normally daemonizes. `daemon off;` keeps it in the foreground,
# because a container exits the moment its main process backgrounds itself.
CMD ["nginx", "-g", "daemon off;"]
