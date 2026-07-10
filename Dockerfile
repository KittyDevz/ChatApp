# ── chat-server: Bun + WebSocket + YouTube music ──────────────
# Official Bun image (Debian slim). Pin a version for reproducible builds.
FROM oven/bun:1.3-slim

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Copy the rest of the app
COPY . .

# Render/most PaaS inject $PORT; default to 3001 locally.
# config.ts already reads process.env.PORT.
ENV PORT=3001
EXPOSE 3001

CMD ["bun", "run", "src/index.ts"]
