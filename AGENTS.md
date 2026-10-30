# LiftMetrics Agent Guide

## Project context

LiftMetrics is a multi-user application for tracking body weight and strength training. It is intended for real users and production deployment. The primary learning goal is advanced backend development, while keeping the product practical for everyday use on phones and PCs.

Before changing product behavior, consult `docs/vision.md` and `docs/general_design.md`. Those documents describe the current product direction and domain decisions. Do not invent requirements where they are still open; call out meaningful gaps when they affect implementation.

For frontend visual exploration, also consult `docs/Visual Design Reference/visual_design_reference.md` and its accompanying concept image. Treat them as records of visual preferences, not as a locked layout or design system.

## Technology decisions

- **Backend:** NestJS with TypeScript.
- **Database:** PostgreSQL.
- **Persistence and migrations:** Prisma.
- **API:** REST with JSON, documented using OpenAPI.
- **Frontend:** React with TypeScript and React Router Framework Mode, configured for client rendering without runtime server-side rendering.
- **App-like access:** Build toward an installable Progressive Web App. The initial release is online-only.
- **Architecture:** Start with a modular monolith. Keep clear boundaries between domain areas without introducing microservices prematurely.

Use these choices consistently. Do not replace them with alternatives or add major infrastructure dependencies without discussing the tradeoff with the user first. Auth0 is selected as the initial identity provider; keep its issuer, audience, and client configuration in deployment configuration. Hosting and deployment targets remain open until requirements work decides them.

## Product and domain constraints

- Treat the application as multi-user from the start. Every user's records must be protected from access by other users, with authorization enforced by the backend.
- Body-weight entries are recorded by day and can be corrected later.
- Users can define reusable workout sessions and assign sessions to days in a weekly plan.
- A workout recommendation is a starting point. During a workout, users can change exercises, their order, set counts, and recorded values.
- Each exercise has one fixed measurement type: repetitions plus weight, or time. There is no repetitions-only type. Zero weight is valid for repetitions-plus-weight exercises.
- Keep the main screen focused on recording today's weight and viewing the scheduled or in-progress workout. Detailed history and reports belong on secondary screens.
- Offline entry and synchronization, and spreadsheet import/export, are outside the initial scope.

## Implementation guidance

- Keep the backend independent of the current frontend through the API boundary.
- Keep API contracts explicit and document changes in OpenAPI.
- Model ownership and relationships so user data isolation is enforced in backend operations, not only in the UI.
- Preserve domain invariants in server-side validation and business logic.
- Prefer clear, maintainable solutions that support reliability, security, observability, backups, and recovery without adding complexity without a product or learning benefit.
- Add or update focused tests when implementing behavior, especially for domain rules, authorization, and data isolation.
- Update relevant documentation when a product or architecture decision changes.
