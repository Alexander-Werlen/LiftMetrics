# LiftMetrics backend foundation

## Local stack

Copy the repository's `.env.example` to `.env` and replace the local database password with a secret of your choice. The committed example contains placeholders only. Start the services from the repository root:

```sh
docker compose up --build
```

The same-origin entry point is `http://localhost:8080`. The API is under `/api`, liveness is `/api/health`, readiness (including PostgreSQL) is `/api/ready`, and the OpenAPI UI is `/api/docs`. The JSON OpenAPI document is at `/api/openapi.json`. Non-API paths reach the frontend container, whose fallback serves `index.html` for client-side routes.

The database and API share a Docker network marked internal. Only the reverse proxy publishes a host port. For local development without Docker, install dependencies with `npm ci`, set `DATABASE_URL` to a reachable PostgreSQL instance, then run `npm run start:dev` from `backend/`.

After starting Compose, apply committed migrations with `docker compose run --rm migrate`. This one-off service uses the build image (which contains the Prisma CLI and schema files) and shares only the internal database network. The running API image stays lean and does not include migration tooling. Run the focused backend checks with `cd backend && npm test`.

Load the shared exercise catalog after applying migrations with `cd backend && npm run prisma:seed`. The seed is safe to rerun: it matches normalized names, preserves archived rows, and fails if an existing exercise's measurement type differs from the version-controlled catalog. The catalog is read-only through the API: `GET /api/exercises` browses active exercises, and `GET /api/exercises/:id` also returns archived exercises so existing references can still be displayed. Both endpoints require a valid bearer access token.

Weight entries use `PUT /api/weight-entries/YYYY-MM-DD` with a decimal-string `weight` and explicit `unit` (`KG` or `LB`); saving the same date corrects its value. The date is a calendar day in the account's fixed time zone. Reads use `GET /api/weight-entries/YYYY-MM-DD` or `GET /api/weight-entries`, optionally filtered by inclusive `from`/`to` dates. Reads default to the account's preferred unit; values are returned to 0.001 precision in that unit. Writes echo the submitted unit and value. Pounds are converted using `1 lb = 0.45359237 kg`, then rounded half up to 0.001 kg for storage. Entry weight inputs accept up to six fractional digits.

Reusable workouts use `POST`, `GET`, `PUT /api/session-blueprints` and `POST /api/session-blueprints/:id/archive`. A submitted exercise array defines zero-based order; blueprint updates replace the full prescription atomically. Rep targets require both positive bounds, must be ordered, and apply only to repetitions-and-weight exercises. Archived blueprints remain readable and can be included in lists with `includeArchived=true`; archived exercises cannot be selected when creating or editing a blueprint.

Weekly schedules use `POST /api/weekly-plans`, `GET /api/weekly-plans` and `GET /api/weekly-plans/:id`, `PUT /api/weekly-plans/:id`, and `POST /api/weekly-plans/:id/activate` or `/deactivate`. Assignments use ISO weekdays (Monday=1, Sunday=7); their order in the submitted array determines the session order within each weekday. Activating a plan deactivates the user's previous plan. `GET /api/weekly-plans/recommendation/today` resolves the weekday in the account's time zone and returns an empty `sessions` array when no plan or session is scheduled. Existing assignments retain archived blueprints, while newly submitted assignments must reference active blueprints.

## Configuration

`DATABASE_URL` is required and validated at startup. `PORT`, `NODE_ENV`, and the deletion-worker interval have local defaults. Compose also requires `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD`; provide them in an untracked root `.env`. Do not commit real credentials.

Account authentication requires `AUTH0_ISSUER`, `AUTH0_API_AUDIENCE`, and a comma-separated `AUTH0_CLIENT_IDS` allowlist. Local health checks can run without an Auth0 tenant configured, but authenticated account routes return service unavailable until these values are set. Production startup requires the Auth0 API configuration and a Management API machine-to-machine client (`AUTH0_MGMT_CLIENT_ID`, `AUTH0_MGMT_CLIENT_SECRET`, `AUTH0_MGMT_AUDIENCE`) authorized for the `delete:users` scope. Account deletion is accepted only when the retry worker can be configured.

## Database and API notes

Prisma's schema and migrations define account identity, weight history, exercises, workout blueprints, weekly plans, and workout history. Generate its client with `npm run prisma:generate`. Health reports process liveness independently from readiness so an unavailable database does not make the liveness endpoint fail. Every response gets a request ID; structured request and server-error logs include that ID and omit request bodies and query values.

The account endpoints are `POST`, `GET`, `PATCH`, and `DELETE /api/account`. The first `POST` provisions a local account for the validated Auth0 `(iss, sub)` identity and requires the user's IANA time zone and preferred weight unit. Repeated provisioning for that identity returns the existing account. The time zone cannot be changed later. `DELETE` removes local account rows in a database transaction and creates a minimal outbox task containing only the Auth0 subject; a worker calls Auth0 and retries failures with capped exponential backoff. A 404 from Auth0 is treated as already deleted, so a crash after remote deletion is safe to retry.
