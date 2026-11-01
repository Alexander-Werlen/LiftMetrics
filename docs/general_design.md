# General Design

This document captures the product behavior and domain concepts established so far. It is a working design reference, not a detailed screen specification or final requirements document.

## Product direction

- Build and deploy this as a real, multi-user application with production-quality implementation and operational practices.
- The main learning goal is advanced backend development. The application should be useful in everyday life as well, but its backend should provide substantial depth in areas such as business logic, authentication, observability, and other production concerns.
- Support the complete application experience on both phones and PCs. Neither device is limited to a reduced set of capabilities.
- The application is online-only initially. Offline behavior may be considered later.
- Excel import and export are out of scope for now.

## Architecture and deployment direction

- Use NestJS with TypeScript for the backend and React with TypeScript and React Router Framework Mode for the client-rendered frontend.
- Use PostgreSQL with Prisma for persistence and database migrations. Expose a REST API using JSON and document it with OpenAPI.
- Run the application services in Docker containers, orchestrated with Docker Compose.
- Put a reverse proxy in front of the frontend and backend and serve both through one origin. Forward `/api` and `/api/*` requests to the backend; serve all other paths from the frontend, including its client-side route fallback.
- The proxy forwards API requests internally; it does not redirect them. The browser uses same-origin paths such as `/api/weight-entries`, avoiding production CORS configuration for the web client.
- Keep the backend and database on the internal container network rather than exposing them directly to the public internet. The reverse proxy is the public entry point.
- Auth0 is selected for the initial identity provider; configure its issuer, API audience, and client IDs per deployment environment.
- The specific reverse proxy and hosting platform remain undecided.

## Main screen

Keep the main screen minimal and compact. It should provide only the two primary daily actions:

1. Record the user's body weight for the current day.
2. See one workout: the scheduled session recommended for today, or the workout that is already in progress if one has been started.

Do not fill the main screen with weight charts, weekly overviews, recent-history summaries, or other dashboard content. Put detailed operations and review views on secondary screens.

## Body-weight tracking

- Let a user record body weight by day.
- Provide a history of past weight entries and the ability to correct an earlier entry.
- Provide a way to review weight progression outside the minimal main screen.

## Workout plans and recommendations

- A user can create weekly plans, each with one workout blueprint assigned to each training day. A weekday can also be explicitly left as a rest day.
- Workouts are defined as part of the plan's day-by-day creation flow. The product does not need a shared workout library or multiple workouts on one day.
- Each session contains an ordered list of exercises and planned set counts. Repetition-and-weight exercises can have a target repetition range.
- On a day with a scheduled session, recommend that session from the main screen. The user can start it from there.
- A recommendation is a starting point, not a mandatory script. During a workout, the user can add or remove exercises, change their order, and adjust the number of sets and the recorded repetitions, weights, or time.

## Exercise measurement and workout records

Each exercise has one fixed measurement type, which remains consistent for that exercise over time. There are exactly two types:

- **Repetitions + weight:** record repetitions and weight for each set. A weight of zero is valid for unweighted work, such as bodyweight pull-ups.
- **Time:** record the duration for each set, such as seconds for a plank.

There is no repetitions-only measurement type. An exercise does not switch measurement types between sessions.

## History and progress

- Keep past workout sessions and body-weight entries available for review and correction.
- Provide reports showing progression for individual exercises, using the exercise's measurement type and its recorded sets.
- Keep history and detailed reports on secondary screens so the main screen stays focused.
