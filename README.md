# chat-server

Realtime chat with a shared YouTube music queue, built on [Bun](https://bun.com).

## Local dev

```bash
bun install
bun run dev      # or: bun run src/index.ts
```

Open http://localhost:3001

## Environment

| Var         | Default      | Purpose                          |
|-------------|--------------|----------------------------------|
| `PORT`      | `3001`       | HTTP/WebSocket port              |
| `ADMIN_KEY` | `admin1234`  | Admin login key (change in prod) |

## Deploy (Docker)

A `Dockerfile` and `render.yaml` are included. See **Render** (free, no credit
card): push to GitHub, then create a new **Blueprint** from this repo.

```bash
docker build -t chat-server .
docker run -p 3001:3001 chat-server
```
