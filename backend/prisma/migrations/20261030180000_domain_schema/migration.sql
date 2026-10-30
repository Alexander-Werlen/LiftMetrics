-- CreateEnum
CREATE TYPE "ExerciseMeasurementType" AS ENUM ('REPS_AND_WEIGHT', 'TIME');

-- CreateEnum
CREATE TYPE "WorkoutStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "WeightEntry" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "entryDate" DATE NOT NULL,
    "weightKg" DECIMAL(7,3) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "WeightEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "measurementType" "ExerciseMeasurementType" NOT NULL,
    "archivedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionBlueprint" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "notes" TEXT,
    "archivedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "SessionBlueprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlueprintExercise" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "blueprintId" UUID NOT NULL,
    "exerciseId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "plannedSetCount" INTEGER NOT NULL,
    "targetRepMin" INTEGER,
    "targetRepMax" INTEGER,

    CONSTRAINT "BlueprintExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyPlan" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "WeeklyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyPlanAssignment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "weeklyPlanId" UUID NOT NULL,
    "blueprintId" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "WeeklyPlanAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sourceBlueprintId" UUID,
    "sourceNameSnapshot" VARCHAR(120),
    "workoutDate" DATE NOT NULL,
    "status" "WorkoutStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "WorkoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutExercise" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "workoutSessionId" UUID NOT NULL,
    "exerciseId" UUID NOT NULL,
    "exerciseNameSnapshot" VARCHAR(120) NOT NULL,
    "measurementTypeSnapshot" "ExerciseMeasurementType" NOT NULL,
    "position" INTEGER NOT NULL,
    "plannedSetCountSnapshot" INTEGER,

    CONSTRAINT "WorkoutExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutSet" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "workoutExerciseId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "repetitions" INTEGER,
    "weightKg" DECIMAL(7,3),
    "durationSeconds" INTEGER,

    CONSTRAINT "WorkoutSet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeightEntry_userId_entryDate_idx" ON "WeightEntry"("userId", "entryDate" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "WeightEntry_userId_entryDate_key" ON "WeightEntry"("userId", "entryDate");

-- CreateIndex
CREATE UNIQUE INDEX "WeightEntry_userId_id_key" ON "WeightEntry"("userId", "id");

-- CreateIndex
CREATE INDEX "SessionBlueprint_userId_archivedAt_idx" ON "SessionBlueprint"("userId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SessionBlueprint_userId_id_key" ON "SessionBlueprint"("userId", "id");

-- CreateIndex
CREATE INDEX "BlueprintExercise_userId_blueprintId_idx" ON "BlueprintExercise"("userId", "blueprintId");

-- CreateIndex
CREATE UNIQUE INDEX "BlueprintExercise_userId_id_key" ON "BlueprintExercise"("userId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "BlueprintExercise_blueprintId_position_key" ON "BlueprintExercise"("blueprintId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "BlueprintExercise_blueprintId_exerciseId_key" ON "BlueprintExercise"("blueprintId", "exerciseId");

-- CreateIndex
CREATE INDEX "WeeklyPlan_userId_isActive_idx" ON "WeeklyPlan"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyPlan_userId_id_key" ON "WeeklyPlan"("userId", "id");

-- CreateIndex
CREATE INDEX "WeeklyPlanAssignment_userId_weeklyPlanId_weekday_idx" ON "WeeklyPlanAssignment"("userId", "weeklyPlanId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyPlanAssignment_userId_id_key" ON "WeeklyPlanAssignment"("userId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyPlanAssignment_weeklyPlanId_weekday_position_key" ON "WeeklyPlanAssignment"("weeklyPlanId", "weekday", "position");

-- CreateIndex
CREATE INDEX "WorkoutSession_userId_workoutDate_idx" ON "WorkoutSession"("userId", "workoutDate" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutSession_userId_id_key" ON "WorkoutSession"("userId", "id");

-- CreateIndex
CREATE INDEX "WorkoutExercise_userId_workoutSessionId_idx" ON "WorkoutExercise"("userId", "workoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutExercise_userId_id_key" ON "WorkoutExercise"("userId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutExercise_workoutSessionId_position_key" ON "WorkoutExercise"("workoutSessionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutExercise_workoutSessionId_exerciseId_key" ON "WorkoutExercise"("workoutSessionId", "exerciseId");

-- CreateIndex
CREATE INDEX "WorkoutSet_userId_workoutExerciseId_idx" ON "WorkoutSet"("userId", "workoutExerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutSet_workoutExerciseId_position_key" ON "WorkoutSet"("workoutExerciseId", "position");

-- AddForeignKey
ALTER TABLE "WeightEntry" ADD CONSTRAINT "WeightEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionBlueprint" ADD CONSTRAINT "SessionBlueprint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlueprintExercise" ADD CONSTRAINT "BlueprintExercise_userId_blueprintId_fkey" FOREIGN KEY ("userId", "blueprintId") REFERENCES "SessionBlueprint"("userId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlueprintExercise" ADD CONSTRAINT "BlueprintExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyPlan" ADD CONSTRAINT "WeeklyPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyPlanAssignment" ADD CONSTRAINT "WeeklyPlanAssignment_userId_weeklyPlanId_fkey" FOREIGN KEY ("userId", "weeklyPlanId") REFERENCES "WeeklyPlan"("userId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyPlanAssignment" ADD CONSTRAINT "WeeklyPlanAssignment_userId_blueprintId_fkey" FOREIGN KEY ("userId", "blueprintId") REFERENCES "SessionBlueprint"("userId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_userId_sourceBlueprintId_fkey" FOREIGN KEY ("userId", "sourceBlueprintId") REFERENCES "SessionBlueprint"("userId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExercise" ADD CONSTRAINT "WorkoutExercise_userId_workoutSessionId_fkey" FOREIGN KEY ("userId", "workoutSessionId") REFERENCES "WorkoutSession"("userId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExercise" ADD CONSTRAINT "WorkoutExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSet" ADD CONSTRAINT "WorkoutSet_userId_workoutExerciseId_fkey" FOREIGN KEY ("userId", "workoutExerciseId") REFERENCES "WorkoutExercise"("userId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Domain checks and partial indexes that Prisma's schema language cannot express.
CREATE UNIQUE INDEX "Exercise_normalized_name_key"
    ON "Exercise" (lower(regexp_replace(btrim("name"), '\s+', ' ', 'g')));

CREATE UNIQUE INDEX "WeeklyPlan_one_active_per_user_key"
    ON "WeeklyPlan" ("userId") WHERE "isActive" = true;

CREATE UNIQUE INDEX "WorkoutSession_one_in_progress_per_user_key"
    ON "WorkoutSession" ("userId") WHERE "status" = 'IN_PROGRESS';

ALTER TABLE "WeightEntry"
    ADD CONSTRAINT "WeightEntry_weightKg_positive_check" CHECK ("weightKg" > 0);

ALTER TABLE "Exercise"
    ADD CONSTRAINT "Exercise_name_nonempty_check" CHECK (length(btrim("name")) > 0);

ALTER TABLE "SessionBlueprint"
    ADD CONSTRAINT "SessionBlueprint_name_nonempty_check" CHECK (length(btrim("name")) > 0);

ALTER TABLE "BlueprintExercise"
    ADD CONSTRAINT "BlueprintExercise_position_nonnegative_check" CHECK ("position" >= 0),
    ADD CONSTRAINT "BlueprintExercise_set_count_positive_check" CHECK ("plannedSetCount" > 0),
    ADD CONSTRAINT "BlueprintExercise_rep_range_check" CHECK (
        ("targetRepMin" IS NULL AND "targetRepMax" IS NULL)
        OR ("targetRepMin" > 0 AND "targetRepMax" >= "targetRepMin")
    );

ALTER TABLE "WeeklyPlanAssignment"
    ADD CONSTRAINT "WeeklyPlanAssignment_weekday_check" CHECK ("weekday" BETWEEN 1 AND 7),
    ADD CONSTRAINT "WeeklyPlanAssignment_position_nonnegative_check" CHECK ("position" >= 0);

ALTER TABLE "WorkoutSession"
    ADD CONSTRAINT "WorkoutSession_completion_state_check" CHECK (
        ("status" = 'IN_PROGRESS' AND "completedAt" IS NULL)
        OR ("status" = 'COMPLETED' AND "completedAt" IS NOT NULL)
    );

ALTER TABLE "WorkoutExercise"
    ADD CONSTRAINT "WorkoutExercise_position_nonnegative_check" CHECK ("position" >= 0),
    ADD CONSTRAINT "WorkoutExercise_planned_set_count_positive_check" CHECK (
        "plannedSetCountSnapshot" IS NULL OR "plannedSetCountSnapshot" > 0
    );

ALTER TABLE "WorkoutSet"
    ADD CONSTRAINT "WorkoutSet_position_nonnegative_check" CHECK ("position" >= 0),
    ADD CONSTRAINT "WorkoutSet_measurement_shape_check" CHECK (
        ("repetitions" IS NOT NULL AND "repetitions" > 0
            AND "weightKg" IS NOT NULL AND "weightKg" >= 0
            AND "durationSeconds" IS NULL)
        OR ("repetitions" IS NULL AND "weightKg" IS NULL
            AND "durationSeconds" IS NOT NULL AND "durationSeconds" > 0)
    );

