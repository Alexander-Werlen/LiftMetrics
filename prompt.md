Implement the LiftMetrics backend, following the staged plan in `docs/feature_docs/feature_1.md`.

Before making changes, read `AGENTS.md`, `docs/vision.md`, `docs/general_design.md`, `docs/backend_data_model.md`, the Feature 1 plan, and `docs/feature_docs/exercise_catalog_seed.md`. Treat these documents as the product and architecture source of truth.

Implement the full initial backend scope: account identity, body-weight entries and history, the shared exercise catalog, reusable workout blueprints, weekly plans, workout recording and history, and operational foundations. Do not add summary, trend, chart, or progress-calculation endpoints. Keep hosting decisions open.

Work through the implementation plan one numbered step at a time. For each step:

1. Implement the step and its stated requirements.
2. Complete its validation checkpoint, including focused tests where the plan calls for them.
3. Report what changed, which files changed, and the validation results.
4. Explain the main design choices in plain language so I can learn how the backend works and why it was built that way.
5. Identify any remaining risks or decisions that affect the next step.

After summarizing a step, stop and wait for my review before starting the next one. Ask me a clarifying question when a material product or architecture decision is unresolved; explain why the answer is needed and continue any independent work that does not depend on it. Don’t ask about routine implementation details you can decide from the project conventions.

Keep the plan and relevant design documents in sync if an agreed product decision changes. Do not silently invent product behavior or widen the scope.