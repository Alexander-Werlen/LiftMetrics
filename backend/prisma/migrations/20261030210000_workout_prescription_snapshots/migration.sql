ALTER TABLE "WorkoutExercise"
    ADD COLUMN "targetRepMinSnapshot" INTEGER,
    ADD COLUMN "targetRepMaxSnapshot" INTEGER;

ALTER TABLE "WorkoutExercise"
    ADD CONSTRAINT "WorkoutExercise_rep_range_snapshot_check" CHECK (
        ("targetRepMinSnapshot" IS NULL AND "targetRepMaxSnapshot" IS NULL)
        OR ("targetRepMinSnapshot" > 0 AND "targetRepMaxSnapshot" >= "targetRepMinSnapshot")
    );
