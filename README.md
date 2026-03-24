# Mechmate

Self-hosted maintenance for equipment and recurring tasks, built around **Mech**—an agent that talks to your real data so you can add equipment, schedule work, and **log service in plain language** instead of living in forms. The dashboard, lists, and history views are there when you want precision; the assistant is how most day-to-day management stays lightweight.

Configure an **OpenAI-compatible API** (cloud or local) to unlock the assistant, proactive dashboard nudges, and voice input where the browser allows it.

<img width="4384" height="2939" alt="mechmate screenshots" src="https://github.com/user-attachments/assets/724d54e6-8f26-4ac4-99f4-74c54e9ec50f" />

## Features

- **Agentic workflow (Mech)** — **Ask Mech** is always one tap away: a tool-using agent with session memory and **confirmed actions** so create/update equipment, tasks, and maintenance records stay safe and traceable. **Voice input** works when the app runs over HTTPS (or localhost). On the dashboard, **proactive suggestions** surface next steps from the same stack—so the UI and the chat feel like one system.
- **Dashboard** — Stats, upcoming work in **list** or **calendar** view, and due-soon callouts alongside those suggestions.
- **Equipment** — Types, serials, locations, usage; **service history** with logs, costs, attachments, CSV export, and print-style **PDF reports**; **resources** for manuals and docs (upload with text extraction) that the assistant can reason over in context.
- **Tasks** — Full task list with due buckets (overdue, today, week, later), filters, editing, completion flow, and bulk actions—complementing natural-language task work in Mech.
- **Labels & QR** — Printable equipment labels and QR codes that deep-link into the app (set `PUBLIC_APP_URL` when behind a reverse proxy).
- **Settings** — Instance name, upcoming-task window, metric/imperial, assistant tone, and notification thresholds.
- **Operations** — Scheduled SQLite backups with retention, optional **Web Push** (VAPID), rate limiting, `/health` checks, and an optional `/api/system/metrics` endpoint.

Without an API key the app still runs, but **Mech and LLM-driven suggestions are off**—you will rely on manual screens for most changes.

There is **no built-in user authentication**; run on a trusted network or protect with your reverse proxy or VPN.

## Tech stack

| Area        | Choice |
|------------|--------|
| App        | SvelteKit 2, Svelte 5, TypeScript, Vite 6 |
| UI         | Tailwind CSS 4 |
| Production | `@sveltejs/adapter-node` |
| Data       | SQLite (`better-sqlite3`), Kysely |
| Validation | Zod |
| AI / Mech  | OpenAI-compatible HTTP API (tools + chat; base URL, model, timeouts configurable) |
| Documents  | PDF and Office parsing for resource extraction (`pdf-parse`, `mammoth`) |
| Push       | `web-push` + VAPID |

## Quick start (Docker)

**Prerequisites:** Docker with Compose (`docker compose` or `docker-compose`).

```bash
git clone <repository-url>
cd mechmate
chmod +x deploy.sh
./deploy.sh
```

The script copies `.env.example` → `.env` if needed, then builds and starts the stack. Open `http://localhost:3000` (or the host/port shown when it finishes). Add `OPENAI_API_KEY` (and model/URL if not using defaults) so **Mech and proactive suggestions** are available.

Manual equivalent:

```bash
cp .env.example .env
docker compose up -d --build
```

Data lives in the `mechmate_data` volume under `/app/data` in the container (see `docker-compose.yml`).

## Configuration

**Authoritative reference:** [.env.example](.env.example).

| Topic | Notes |
|-------|--------|
| **Core** | `PORT`, `HOST`, `INSTANCE_NAME`, `DATABASE_DIR`, backup dirs and `AUTO_BACKUP_*` |
| **Mech / LLM** | `OPENAI_API_KEY` enables the assistant and dashboard LLM features. Also set `OPENAI_BASE_URL`, `OPENAI_MODEL`, `OPENAI_MAX_TOKENS`, or `LLM_TIMEOUT_MS` when not using OpenAI defaults. OpenAI, OpenRouter, Ollama/LM Studio, and other compatible hosts work. |
| **Push** | Generate keys: `npx web-push generate-vapid-keys` → `VAPID_*` in `.env` |
| **Public URL** | `PUBLIC_APP_URL` so QR codes and absolute links match your real origin behind TLS/proxy |
| **Security** | `RATE_LIMIT_ENABLED`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS` |
| **Metrics** | `METRICS_ENABLED=true` to allow `GET /api/system/metrics` |
| **Health** | `HEALTH_CHECK_ENABLED` (when off, `/health` responds as disabled) |

Restart the container after changing `.env`:

```bash
docker compose restart mechmate
```

## Day-to-day operations

```bash
docker compose logs -f mechmate
docker compose restart mechmate
docker compose down
docker compose pull && docker compose up -d
```

**Health (JSON):** `curl http://localhost:3000/health`

**Metrics** (only if `METRICS_ENABLED=true`): `curl http://localhost:3000/api/system/metrics`

**Manual backup:**

```bash
curl -X POST http://localhost:3000/api/system/backup \
  -H "Content-Type: application/json" \
  -d '{"type":"manual"}'
```

**Data volume** (typical volume name `mechmate_mechmate_data`; confirm with `docker volume ls`):

```bash
docker run --rm -v mechmate_mechmate_data:/data -v "$(pwd)":/backup ubuntu \
  tar czf /backup/mechmate-data-backup.tar.gz -C / data
```

## Reverse proxy

Terminate TLS in front of the Node server and forward headers so absolute links and optional client features behave correctly. Example (Nginx):

```nginx
server {
    listen 443 ssl;
    server_name maintenance.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Set `PUBLIC_APP_URL=https://maintenance.example.com` to match. For Traefik, attach router labels to the `mechmate` service and point the backend to port `3000` (see commented snippet in `docker-compose.yml`).

## Local development

```bash
npm install
npm run dev
```

Vite is configured with **HTTPS** via `@vitejs/plugin-basic-ssl` so **microphone / voice** can be tested; use the `https://` URL printed in the terminal (often `https://localhost:5173`).

## Troubleshooting

- **Port in use** — Change `PORT` in `.env` or free the port (`ss -tlnp` / `netstat`).
- **SQLite** — From a shell in the container: `sqlite3 /app/data/mechmate.db "PRAGMA integrity_check;"` (adjust path if `DATABASE_DIR` differs).
- **Restore backup** — `POST /api/system/backup/restore` with JSON `{"filename":"…"}` as documented in your deployment.
- **Verbose logs** — Set `LOG_LEVEL=debug` and `ENABLE_DEBUG_LOGS=true` in `.env`, then restart and inspect container logs.

## License

GPL-3.0 — see [LICENSE](LICENSE).

---

Mechmate is intended for **self-hosted, personal or small-team** use. Harden network access and backups for anything production-facing.
