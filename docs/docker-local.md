# Local Docker Desktop stack

Run from PowerShell:

```powershell
docker compose -f D:\ticket-app\compose.local.yaml up -d --build
docker compose -f D:\ticket-app\compose.local.yaml ps -a
```

Swagger UI: http://localhost:3000/api/docs (gateway), http://localhost:3001/api/docs (payments), http://localhost:3002/api/docs (bookings).

All business routes are available through http://localhost:3000/api/v1. This repository is a REST API, with Swagger as its browser interface.

The stack configures all three sibling projects directly; separate .env files are unnecessary. All three apps and the migration job connect to Windows PostgreSQL at `host.docker.internal:5432`, database `ticket_app`, with default local credentials `postgres`/`postgres`. PostgreSQL must be running before starting the stack. Set `$env:DOCKER_DATABASE_URL` to override the full connection URL; URL-encode special characters in credentials. Containers use `host.docker.internal` to reach Windows; native npm runs use `localhost`. It uses Docker DNS service URLs and identical local JWT access secrets. Only the migrate job runs ticket-app's migrations; its successful exit is expected. Recurring Docker health checks are disabled for all three apps. Startup waits for migrations to complete and for the booking/payment containers to start, but does not wait for their HTTP readiness. Health endpoints remain available for manual checks. Host ports bind only to 127.0.0.1; PostgreSQL runs on Windows, outside Docker. The visible development credentials in Compose are intended only for this local stack.

Data persists in your Windows PostgreSQL database. The previous `ticket-local_ticket-data` volume is preserved but is no longer used or automatically imported. Stop the old database container with `docker stop ticket-local-db-1` if it exists. The obsolete ticket-app container was stopped to free port 3001. Use the explicit compose.local.yaml command above instead of the older standalone Compose files.

Stop and restart without deleting data:

```powershell
docker compose -f D:\ticket-app\compose.local.yaml stop
docker compose -f D:\ticket-app\compose.local.yaml up -d
```

Read logs:

```powershell
docker compose -f D:\ticket-app\compose.local.yaml logs --tail 100 app bookings payments migrate
```

Repeat the smoke test (adds a uniquely named test customer, schedule, booking, mock payment and ticket to this local database):

```powershell
Get-Content -Raw D:\ticket-app\docs\docker-smoke.cjs | docker compose -f D:\ticket-app\compose.local.yaml exec -T app node
```

The test exercises registration, login, seat lookup, booking and payment through the gateway, confirmation with an idempotent retry, and exactly one active ticket. Payment confirmation is a mock; no external payment processor is configured. The test adds uniquely named fixtures to your existing Windows database and preserves existing records. The repositories contain no usable seed script.
