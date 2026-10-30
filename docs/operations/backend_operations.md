# Backend operations

This guide covers the current Docker Compose backend. The hosting provider and production deployment target remain open; production-specific backup storage, retention, alert thresholds, and recovery objectives must be set by the eventual operator.

## Required configuration

Keep deployment values in an environment-specific secret store. The root `.env` is for local use and is not committed. Required values are:

- `DATABASE_URL`, plus `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` for the Compose database.
- `AUTH0_ISSUER`, `AUTH0_API_AUDIENCE`, and `AUTH0_CLIENT_IDS` for access-token verification.
- `AUTH0_MGMT_CLIENT_ID`, `AUTH0_MGMT_CLIENT_SECRET`, and `AUTH0_MGMT_AUDIENCE` for account deletion. The machine-to-machine client needs the `delete:users` scope.
- `PORT`, `NODE_ENV`, `LOG_LEVEL`, and `ACCOUNT_DELETION_POLL_MS` may be set per deployment; local defaults are provided.

Never put provider tokens, passwords, or database credentials in logs, source control, or API records. Restrict access to deployment configuration and rotate credentials through the deployment's secret store.

## Deploying schema changes

Build and start the application stack, then apply committed migrations before directing traffic to a new application version:

```sh
docker compose up -d --build db api frontend proxy
docker compose run --build --rm migrate
```

The migration service uses the build image with Prisma CLI and schema files. The runtime API image does not contain migration tooling. Migrations are forward-only; take and verify a database backup before applying a production migration. If a migration fails, keep the previous application version available, inspect the migration and PostgreSQL logs, and fix the migration forward. Do not edit an already-applied migration or assume application rollback reverses database changes.

Seed the shared exercise catalog after the initial migration (safe to rerun):

```sh
docker compose run --build --rm seed
```

## Clean database verification

Use a separate Compose project name so the check gets its own network and database volume. This does not touch the normal local development volume:

```sh
docker compose -p liftmetrics-checks up -d db
docker compose -p liftmetrics-checks run --build --rm migrate
docker compose -p liftmetrics-checks run --build --rm seed
docker compose -p liftmetrics-checks run --build --rm integration-test
docker compose -p liftmetrics-checks down --volumes
```

Run the fast unit suite and TypeScript checks from `backend/`:

```sh
npm ci
npm run prisma:validate
npm run lint:types
npm test
```

The integration test creates temporary user records and a scoped failure trigger, checks authorization, history paging, constraints, transaction rollback, archive behavior, and account deletion, then removes its test data. Run it only against a disposable or dedicated test database.

## Health and logs

- `GET /api/health` is a liveness check. It confirms the process can answer and deliberately does not query PostgreSQL.
- `GET /api/ready` checks PostgreSQL connectivity. Remove the instance from traffic if readiness fails; restore traffic after it recovers.
- `GET /api/docs` serves Swagger UI; `GET /api/openapi.json` serves the OpenAPI document. Keep these endpoints access-controlled by the edge layer in deployments where the API contract should not be public.
- Each response includes `X-Request-Id`. Request logs include the ID, method, path, status, and duration. Server-error logs include the ID, status, and path. Request bodies, query values, credentials, and measurements are not logged.
- Set `LOG_LEVEL` to `warn` or `error` in production unless more detail is needed to investigate an incident. Account-deletion retries log task IDs, attempt count, error category, and delay; they do not log provider tokens.

Use readiness failures, elevated 5xx counts, and repeated account-deletion retry events as operational signals. Protect log access and set alert thresholds in the chosen hosting platform.

## Backup and restore

The Compose database is persistent but a volume is not a backup. Create a logical PostgreSQL dump and store it outside the database host. Restrict the local file while it is being written; encrypt it before transferring it to backup storage. Choose retention and backup frequency based on the service's recovery objectives.

Create a local dump:

```sh
umask 077
backup="liftmetrics-$(date -u +%Y-%m-%dT%H-%M-%SZ).sql"
docker compose exec -T db sh -c 'pg_dump --no-owner --no-privileges -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$backup"
```

Verify the dump is non-empty and can be read before copying it to protected backup storage. Periodically test restoration into a separate disposable database. A backup is useful only if restoration succeeds.

To restore a plain SQL dump into the Compose database, first stop application traffic and confirm the target database is the intended recovery target. This replaces every object in the `public` schema:

```sh
docker compose stop api proxy
docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"'
docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$backup"
docker compose start api proxy
```

After restoration, confirm `/api/ready` is healthy, exercise authenticated reads with a test account, and review database and API logs before reopening traffic. For point-in-time recovery or managed database snapshots, use the selected hosting provider's documented mechanism; no provider has been chosen yet.

## CI checks

The repository's GitHub Actions workflow validates the Prisma schema, generates the client, type-checks and builds the backend, applies migrations to a fresh PostgreSQL service, seeds the catalog, runs unit tests, and executes PostgreSQL integration checks. Branch protection can require this workflow before merge.

