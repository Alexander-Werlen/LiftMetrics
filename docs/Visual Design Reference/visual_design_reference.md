# Visual Design Reference

This document records the current visual preference for LiftMetrics. It guides exploration; it is not a locked design system or a final specification for every screen.

## Preferred direction

- **Mobile first:** design for a phone viewport first. Use a compact vertical flow, clear touch targets, and bottom navigation that is easy to reach with a thumb. Adapt the same experience for wider screens without making desktop the starting point.
- **Theme:** dark, calm, and practical. Use deep charcoal backgrounds, slightly lifted charcoal surfaces, restrained borders, and high-contrast text.
- **Accent:** keep terracotta or soft orange for the main action and selected state. Use muted blue-gray for secondary information and a restrained green for positive progress.
- **Typography:** editorial display type can add character to key headings and workout names; use highly legible sans-serif type for labels, values, and controls.
- **Density:** keep the Today screen focused on recording today's weight and seeing one recommended or in-progress workout. Keep histories, charts, and management views on secondary screens.

## Current reference prototype

The preferred visual reference is the mobile-first dark prototype at [`docs/design-prototypes/feature_2/index.html`](../design-prototypes/feature_2/index.html). It replaces the former light concept image, which has been removed. The user likes the current direction and wants it preserved as the starting point for implementation planning. It is a design artifact for exploration, not the current application frontend or production code. The implementation handoff and flows are recorded in [`feature_2.md`](../feature_docs/feature_2.md).

The user’s current design feedback is:

- The **Today** screen is close to the final direction and can be treated as the leading candidate.
- Keep Today visually balanced: omit motivational copy and a redundant date heading, give the body-weight card and exercise rows clear hierarchy and comfortable spacing, and fit the full scheduled list and start action on a typical phone screen without scrolling.
- The **History** screen is also a strong candidate, especially its weight trend and editable entries.
- The **workout recording** screen is acceptable as a starting point. The current prototype now lets the user switch between **One at a time** and **All exercises** views to compare exercise navigation and set visibility. The preferred interaction remains open.
- The **Plan** interactions now demonstrate switching the active week, assigning saved workouts to weekdays, and editing a saved workout. They are still local-only exploration, not an approved production design.
- Workout records are reached through **History → All workouts** in the prototype; the separate Sessions destination was removed because it duplicated workout history.

## How to use this reference

Keep the dark mobile-first mood and the focused daily home screen as the baseline when exploring. Treat layout, labels, navigation, workout interaction, exact colors, typography, and component details as open to iteration except where a decision is explicitly recorded in product documentation.
