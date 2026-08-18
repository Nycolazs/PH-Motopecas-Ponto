# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/desktop/package.json apps/desktop/package.json
RUN --mount=type=cache,id=ph-pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile --filter @ph-ponto/desktop...

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/desktop apps/desktop
RUN pnpm --filter @ph-ponto/shared build \
  && pnpm --filter @ph-ponto/desktop build:renderer

FROM nginx:alpine AS runtime
COPY apps/desktop/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/desktop/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
