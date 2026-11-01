# LiftMetrics frontend

This is the client-rendered React and TypeScript application. It uses React Router Framework Mode with runtime server rendering disabled and serves browser routes from the generated `index.html` through Nginx.

## Local development

Use Node.js 22.22 or newer. From this directory, run `npm ci`, then `npm run dev`. The Vite development server is available on port 5173 and proxies same-origin `/api` requests to `http://localhost:3000` by default. Set `LIFTMETRICS_API_PROXY_TARGET` to change that target. For the complete Compose stack, browse through the same-origin proxy at `http://localhost:8080`.

For direct Vite development, copy `.env.example` to `.env.local` and set `VITE_AUTH0_ISSUER`, `VITE_AUTH0_AUDIENCE`, and `VITE_AUTH0_CLIENT_ID`. The issuer and audience must match `AUTH0_ISSUER` and `AUTH0_API_AUDIENCE` used by the backend. The client ID must be included in the backend's `AUTH0_CLIENT_IDS` allowlist. In Auth0, allow the local origin `http://localhost:5173` and Compose origin `http://localhost:8080` as callback, logout, and web origins when using both modes.

Compose builds the frontend with public Auth0 settings sourced from the root `.env`: `AUTH0_ISSUER`, `AUTH0_API_AUDIENCE`, and the SPA client ID. The client ID comes from `AUTH0_SPA_CLIENT_ID`, or from `AUTH0_CLIENT_IDS` when that allowlist contains exactly one ID. Set `AUTH0_SPA_CLIENT_ID` explicitly when the backend allowlist contains multiple clients. These values are included in the browser bundle and are identifiers, not secrets. Rebuild the frontend after changing them. Never pass Auth0 Management API credentials to the frontend build.

Run `npm run build` to create the static client output in `build/client`. Run `npm start` to preview that build on port 4173.

The client routes are Today (`/`), History (`/history`), workout history and details (`/history/workouts`), and Plan (`/plan`), plus the workout recorder (`/workout/:id`). Nginx serves the client application for direct route requests; API calls use same-origin `/api/...` paths and authenticated backend responses. The frontend does not use browser storage for account records. The standalone design prototype may contain disposable local sample data, but it is not part of the running client.

All routes require Auth0 sign-in and a provisioned LiftMetrics account. First-time users choose an IANA time zone and preferred weight unit. The Auth0 SPA client uses its default in-memory token cache. After a hard browser reload, the route is served by the client app and kept as the sign-in return path, but the user may need to sign in again. Persistent token renewal is not configured; enabling it requires a separate Auth0 refresh-token rotation and token-storage security decision.

For a production-style local review, run the Compose stack and open `http://localhost:8080`; this exercises the frontend container and same-origin proxy. Use `npm run typecheck` and `npm run build` for frontend validation. The PostgreSQL two-user integration check runs inside Compose with `docker compose exec api node --test dist/integration/*.integration-test.js`; it creates disposable test records and cleans them up afterwards.
