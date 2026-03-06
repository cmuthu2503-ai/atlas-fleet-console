# Atlas Fleet Console

A fleet management console for AI agents — built with React + Vite (frontend) and Hono + SQLite (backend).

## Quick Start (Development)

```bash
npm install
npm run dev          # Frontend on :5173
npm run dev:server   # Backend on :3590
```

## Docker Deployment

Build and run with Docker Compose:

```bash
docker compose up -d --build
```

- **Frontend**: http://localhost:8088
- **Backend API**: http://localhost:3590
- **Health check**: http://localhost:3590/api/health

The frontend nginx container proxies all `/api/` requests to the backend container. SQLite data is persisted in a Docker volume (`fleet-data`).

### Bedrock Discovery

The backend now supports live AWS Bedrock model discovery at `/api/bedrock/models`.

- Docker passes through `AWS_REGION`, `AWS_PROFILE`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_SESSION_TOKEN`
- The backend also mounts `${HOME}/.aws` read-only into the container for profile-based auth
- Default region is `us-east-1` unless overridden

### Seed the database (optional)

```bash
docker compose exec backend npx tsx src/server/db/seed.ts
```

### Stop

```bash
docker compose down
```

To also remove the database volume:

```bash
docker compose down -v
```
