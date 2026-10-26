# Production image: Vite builds a minified bundle, unprivileged nginx serves it on port 80. No backend.
# The build context is the repository root (see docker-compose.yml): the app reads the repo's
# content/, samples/, infra/, scripts/ and workflows at build time, so the lab can't drift from them.
FROM node:24-alpine AS build
WORKDIR /repo/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
COPY content /repo/content
COPY samples/concepts /repo/samples/concepts
COPY infra/lib /repo/infra/lib
COPY infra/bin /repo/infra/bin
COPY site/src/data /repo/site/src/data
COPY site/src/lib /repo/site/src/lib
COPY site/src/islands/types.ts /repo/site/src/islands/types.ts
COPY scripts /repo/scripts
COPY .github/workflows /repo/.github/workflows
COPY frontend ./
RUN npm run build

# Test stage: `docker build -f frontend/Dockerfile --target test .` runs the Vitest suite
FROM build AS test
RUN npm test

# Unprivileged nginx runs as uid 101, not root. It can still listen on 80 because Docker lets
# containers bind low ports (net.ipv4.ip_unprivileged_port_start=0).
FROM nginxinc/nginx-unprivileged:1.31-alpine AS runtime
COPY --from=build /repo/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY frontend/security-headers.conf /etc/nginx/snippets/security-headers.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
