FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
LABEL org.opencontainers.image.title="NiubiGEO"
LABEL org.opencontainers.image.description="Open-source AI brand visibility and competitor reports"
LABEL org.opencontainers.image.source="https://github.com/Albert-Weasker/niubigeo"
LABEL org.opencontainers.image.licenses="Apache-2.0"
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
CMD ["node", "dist/src/server.js"]
