# LiftMetrics frontend

This is the client-rendered React and TypeScript application. It uses React Router Framework Mode with runtime server rendering disabled and serves browser routes from the generated `index.html` through Nginx.

## Local development

Use Node.js 22.22 or newer. From this directory, run `npm ci`, then `npm run dev`. The Vite development server is available on port 5173 and proxies same-origin `/api` requests to `http://localhost:3000` by default. Set `LIFTMETRICS_API_PROXY_TARGET` to change that target. For the complete Compose stack, browse through the same-origin proxy at `http://localhost:8080`.

For direct Vite development, copy `.env.example` to `.env.local` and set `VITE_AUTH0_ISSUER`, `VITE_AUTH0_AUDIENCE`, and `VITE_AUTH0_CLIENT_ID`. The issuer and audience must match `AUTH0_ISSUER` and `AUTH0_API_AUDIENCE` used by the backend. The client ID must be included in the backend's `AUTH0_CLIENT_IDS` allowlist. In Auth0, allow the local origin `http://localhost:5173` and Compose origin `http://localhost:8080` as callback, logout, and web origins when using both modes.

Compose builds the frontend with public Auth0 settings sourced from the root `.env`: `AUTH0_ISSUER`, `AUTH0_API_AUDIENCE`, and the SPA client ID. The client ID comes from `AUTH0_SPA_CLIENT_ID`, or from `AUTH0_CLIENT_IDS` when that allowlist contains exactly one ID. Set `AUTH0_SPA_CLIENT_ID` explicitly when the backend allowlist contains multiple clients. These values are included in the browser bundle and are identifiers, not secrets. Rebuild the frontend after changing them. Never pass Auth0 Management API credentials to the frontend build.

Run `npm run build` to create the static client output in `build/client`. Run `npm start` to preview that build on port 4173.

The current routes are Today, History, and Plan. All routes require Auth0 sign-in and a provisioned LiftMetrics account. A first-time user chooses an IANA time zone and preferred weight unit before entering the app. Until the following feature slices connect their data, the shell contains no weight or workout records and the daily weight action is disabled.
