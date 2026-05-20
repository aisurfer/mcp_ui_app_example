# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Install all dependencies (including devDependencies for tsc)
COPY package.json ./
RUN npm install

# Copy source and compile
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Stage 2: run ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS run

WORKDIR /app

# Copy compiled output
COPY --from=build /app/dist ./dist

# Install only production dependencies
COPY package.json ./
RUN npm install --omit=dev

ENV PORT=3001
EXPOSE 3001

CMD ["node", "dist/index.js"]
