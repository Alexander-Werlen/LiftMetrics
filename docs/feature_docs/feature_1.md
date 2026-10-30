# Feature 1: Initial backend implementation

## Goal

Implement the initial LiftMetrics backend described in [`backend_data_model.md`](../backend_data_model.md): account identity and ownership, body-weight records, the shared exercise catalog, reusable workout sessions, weekly plans, and performed workouts. Deliver it as a documented REST/JSON API using NestJS, TypeScript, PostgreSQL, and Prisma.

Build and validate this as a sequence of working increments. At the end of each step, the application should still start, its migrations should be reproducible, and the newly completed behavior should have a focused validation checkpoint before the next step begins.

## Scope

This feature includes:

- Multi-user account resolution and server-enforced ownership for all personal data.
- Daily body-weight entry, correction, and history retrieval.
- A shared, version-controlled exercise catalog with fixed measurement types.
- User-owned reusable workout session blueprints and their ordered exercise prescriptions.
- Weekly plans with ordered assignments of sessions to weekdays.
- Starting, editing, completing, reviewing, correcting, and deleting workout records, including their exercises and sets.
- REST contracts documented with OpenAPI, focused automated tests, and the backend reliability and operations foundations needed for a real service.

This feature does not include specialized endpoints that calculate or return summaries, trends, charts, or progression reports (for example, weight evolution or exercise progress). It also excludes offline synchronization and spreadsheet import/export. The API may return the underlying records and histories needed by the product; it should not calculate aggregate progress summaries in this scope.

## Domain rules to preserve

- Derive the owner from the authenticated principal. Never trust a client-supplied `userId` for authorization. Scope reads, updates, and deletes to that owner and avoid disclosing foreign records.
- A user has at most one weight entry per local calendar date. Store weight and exercise load as decimals in kilograms; weight must be positive, while zero load is valid for repetitions-plus-weight exercises.
- Store user-local calendar dates as PostgreSQL `DATE` values and event times as UTC timestamps. Use the account's declared IANA time zone for dates and weekday schedules; it is immutable after account creation.
- Exercise measurement type is fixed: `REPS_AND_WEIGHT` or `TIME`. Set values must match the exercise snapshot's type. Repetitions are positive; load is zero or greater; duration is positive.
- Reusable blueprints and performed workouts are distinct. Starting a workout copies the blueprint name, exercises, and planned values so later blueprint changes do not rewrite workout history.
- A user can have no more than one in-progress workout. A recommendation is editable during the workout; users can add, remove, reorder, and adjust exercises and sets.
- Archive reusable catalog and blueprint items when references or history must remain intact. Enforce ownership consistency in service operations and with database constraints where the schema supports it.
- Keep backend contracts independent of the current React client. Use transactions for multi-row operations such as starting a workout, changing ordered positions, and deleting account-owned data.

## Decisions confirmed for this feature

- Auth0 is selected for the initial identity provider. Validate JWT signature, issuer, and audience from deployment configuration; keep provider secrets out of the database and source control. Preserve the principal boundary so domain modules do not depend directly on Auth0.
- Hosting and deployment targets remain open. Build the local Docker Compose and reverse-proxy-ready service shape described in `general_design.md`, but do not bind the implementation plan to a hosting vendor.
- Weight and load API values carry an explicit `KG` or `LB` unit. Convert to canonical kilograms for persistence, rounding to the data model's 1 g precision with a documented decimal rule. Write responses retain the submitted unit; read responses always identify their unit and use an explicitly requested unit or, when omitted, the authenticated user's preferred unit. Test conversion and rounding at the supported precision.
- The initial exercise catalog is defined in [`exercise_catalog_seed.md`](exercise_catalog_seed.md). Keep catalog names and measurement types stable and version controlled; additions or corrections are explicit seed changes.

## Implementation steps and validation checkpoints

### 1. Establish the backend foundation

Create the NestJS TypeScript application with clear domain modules, validated environment configuration, Prisma integration, PostgreSQL connectivity, structured request/error handling, health and readiness endpoints, and initial OpenAPI setup. Add local Docker Compose support for the application, database, and same-origin reverse proxy shape described in the general design. Keep database and backend services on the internal container network.

**Checkpoint:** From a clean checkout, a developer can start the local stack using documented commands. The app reports health and dependency readiness correctly; OpenAPI is reachable; invalid required configuration fails clearly; API paths are forwarded without redirecting; frontend catch-all routing is not swallowed by the API route. Confirm secrets are supplied through configuration, not committed files.

### 2. Implement account identity and authenticated user resolution

Create the local user and external identity mapping flow, including immutable time zone and preferred weight unit. Add Auth0 JWT validation, authentication middleware/guards, principal resolution, first-account provisioning, and environment-specific issuer/audience/client configuration. Never persist provider passwords or tokens. Define account deletion behavior as a retryable workflow for the database and identity provider, since they cannot share a transaction.

**Checkpoint:** Valid credentials resolve to exactly one local user; missing, invalid, expired, wrong-issuer, and wrong-audience credentials are rejected. First account provisioning is atomic locally and duplicate external identities cannot create duplicate users. Attempts to alter an established time zone are rejected. Account deletion removes local personal data and its external identity through a retryable, observable flow; failure on either side can be safely retried.

### 3. Create the complete Prisma schema and migrations

Implement the proposed entities and relationships: `User`, `AuthIdentity`, `WeightEntry`, `Exercise`, `SessionBlueprint`, `BlueprintExercise`, `WeeklyPlan`, `WeeklyPlanAssignment`, `WorkoutSession`, `WorkoutExercise`, and `WorkoutSet`. Add UUID keys, appropriate timestamp/date/decimal types, same-owner composite references, delete/archive behavior, indexes, unique constraints, and SQL checks or partial indexes where Prisma schema syntax is insufficient.

**Checkpoint:** A clean PostgreSQL database can be created entirely by applying committed migrations. Schema review confirms decimal and calendar-date storage, user ownership references, one weight entry per user/day, one active weekly plan per user, one in-progress workout per user, ordering uniqueness, and valid mutually exclusive set shapes. Verify invalid ownership references and invalid row shapes are rejected by the database where intended. Prisma client generation succeeds from the committed schema.

### 4. Seed and expose the shared exercise catalog

Add version-controlled seed data for the initial exercise catalog, using the separate [`exercise_catalog_seed.md`](exercise_catalog_seed.md) as the initial seed baseline. Normalize names for uniqueness, fix each exercise's measurement type, and support archiving without deleting exercises referenced by existing plans or history. Provide read endpoints for catalog browsing and detail needed by clients; no user-managed catalog CRUD is in scope.

**Checkpoint:** Seeding a fresh database and re-running the seed process is repeatable. Duplicate normalized names and measurement-type mutations are rejected. Active exercises are discoverable; archived exercises cannot be newly selected, while existing blueprint and workout history remains readable.

### 5. Implement body-weight recording and history

Add authenticated API operations to create or correct a user's entry for a calendar date, retrieve entries, and list that user's history in a stable date order. Enforce positive decimal values, the selected API unit convention, user-local date semantics, and the `(userId, entryDate)` upsert behavior.

**Checkpoint:** API/OpenAPI validation shows that saving a new date creates one row, saving it again corrects that row, past dates can be corrected, invalid dates and weights are rejected, and history is ordered consistently. Two users can record the same date without seeing or changing one another's records. No weight-summary or evolution endpoint is added.

### 6. Implement reusable session blueprints

Add owner-scoped create, read, update, archive, and list operations for session blueprints, including their ordered exercises, planned set counts, and optional repetition ranges. Validate that referenced catalog exercises are active when a blueprint is edited, that exercises do not repeat within one blueprint, and that repetition targets are valid and only used for repetitions-plus-weight exercises. Preserve referenced blueprints by archiving rather than hard deletion.

**Checkpoint:** Users can create and edit a blueprint and its ordered exercise list; invalid set counts, rep ranges, archived exercise selection, duplicates, and foreign-user IDs are rejected. Reordering is atomic and leaves unique positions intact after success or rollback. One user's blueprints cannot be read or modified by another user.

### 7. Implement weekly plans and schedule recommendations

Add owner-scoped weekly plan operations, ordered assignments of blueprints to ISO weekdays, and activation/deactivation behavior. Enforce at most one active plan per user while allowing multiple ordered sessions on a day. Resolve the day's recommendation using the user's time zone. Define behavior for a day with no active plan or no assignment without inventing a workout.

**Checkpoint:** A user can create a plan, assign multiple sessions to a weekday, order them, activate one plan, and retrieve the applicable day's recommendations. A second active plan for the same user is rejected; foreign-user plans or blueprints cannot be assigned; weekday, order, and time-zone boundary cases are covered by focused tests.

### 8. Implement workout lifecycle and set recording

Add operations to start a scheduled recommendation or an ad hoc workout, resume the single in-progress workout, edit its exercises and sets, reorder items, complete it, retrieve past workouts, correct past records, and delete a workout with its children. Starting a blueprint copies the relevant names, measurement types, and planned values into workout snapshots within one transaction. Permit changing exercises, order, sets, repetitions, weights, and durations while preserving measurement-type rules.

**Checkpoint:** Starting a recommendation atomically copies the expected snapshot; later blueprint edits do not change it. An ad hoc workout is supported. A second in-progress workout is rejected. Add/remove/reorder and set-value updates succeed for valid data and reject duplicate exercises, invalid measurements, mismatched set shapes, and foreign-owned workout IDs. Completing, retrieving, correcting, and deleting a workout behave consistently and preserve unrelated history.

### 9. Complete cross-domain authorization and data-integrity verification

Review every endpoint and nested reference across users, weight entries, blueprints, weekly plans, assignments, workouts, exercises, and sets. Add automated tests for the domain rules and data-isolation boundaries. Confirm multi-row writes and reorder operations use transactions and that errors do not leave partially updated aggregates.

**Checkpoint:** Integration tests with at least two users prove that cross-user reads and writes fail without revealing another user's records. Tests cover each critical invariant in the domain rules, transaction rollback, uniqueness constraints, archive behavior, and account deletion. Review all Prisma operations for authenticated-owner scoping and ensure database constraints backstop service validation.

### 10. Finish API documentation and operational readiness

Complete OpenAPI descriptions for request/response schemas, auth, validation errors, pagination where needed for record histories, and non-disclosing not-found behavior. Add production-minded configuration and operational documentation for migrations, structured logs, health/readiness, backup and recovery procedures, and CI checks. Keep hosting-specific deployment decisions open.

**Checkpoint:** The documented API matches the running routes and can be exercised from OpenAPI. Automated checks pass from a clean database and clean migration path. A new developer can follow the setup, seed, migration, and verification instructions. Operational documentation explains how to observe failures and restore a database backup; logs do not expose credentials or unnecessary personal measurements.

## Completion criteria

- All entities and domain invariants in `backend_data_model.md` are implemented, with Auth0 authentication and explicit-unit conversion covered by focused tests.
- Users can manage weight records, reusable workout sessions, weekly recommendations, and performed workout history through the API with backend-enforced ownership.
- Migrations, constraints, transactions, and tests protect the key domain rules and multi-user boundaries.
- OpenAPI, local setup, and operational guidance are complete and repeatable.
- No specialized summary, trend, chart, or progress-calculation endpoints are included in this feature.

## Exercise catalog seed

The proposed initial seed is maintained separately in [`exercise_catalog_seed.md`](exercise_catalog_seed.md), keeping the backend implementation plan focused on deliverables and validation checkpoints. The catalog contains a broad set of common exercises, each with one fixed measurement type.
