# LiftMetrics frontend

This is the client-rendered React and TypeScript application. It uses React Router Framework Mode with runtime server rendering disabled and serves browser routes from the generated `index.html` through Nginx.

## Local development

Use Node.js 22.22 or newer. From this directory, run `npm ci`, then `npm run dev`. The Vite development server is available on port 5173. The application uses same-origin `/api` paths; to use it with the backend, browse through the Compose proxy at `http://localhost:8080`.

Run `npm run build` to create the static client output in `build/client`. Run `npm start` to preview that build on port 4173.

The current routes are the Today, History, and Plan shell. Authentication and API data connections are added in later Feature 2 steps. Until then, the shell contains no account data and its daily weight action is disabled.
