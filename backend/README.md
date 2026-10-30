# LiftMetrics backend foundation

## Local stack

Copy the repository's `.env.example` to `.env` and replace the local database password with a secret of your choice. The committed example contains placeholders only. Start the services from the repository root:

```sh
docker compose up --build
```

The same-origin entry point is `http://localhost:8080`. The API is under `/api`, liveness is `/api/health`, readiness (including PostgreSQL) is `/api/ready`, and the OpenAPI UI is `/api/docs`. The JSON OpenAPI document is at `/api/openapi.json`. Non-API paths reach the frontend container, whose fallback serves `index.html` for client-side routes.

The database and API share a Docker network marked internal. Only the reverse proxy publishes a host port. For local development without Docker, install dependencies with `npm ci`, set `DATABASE_URL` to a reachable PostgreSQL instance, then run `npm run start:dev` from `backend/`.

## Configuration

`DATABASE_URL` is required and validated at startup. `PORT` and `NODE_ENV` have safe local defaults. Compose also requires `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD`; provide them in an untracked root `.env`. Do not commit real credentials. Auth0 configuration is added with the account identity step.

## Database and API notes

Prisma's schema is in `prisma/schema.prisma`; committed migrations will be added with the domain schema step. Generate its client with `npm run prisma:generate`. Health reports process liveness independently from readiness so an unavailable database does not make the liveness endpoint fail. Every response gets a request ID; structured request and server-error logs include that ID and omit request bodies and query values.
