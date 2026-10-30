CREATE FUNCTION "prevent_referenced_exercise_measurement_change"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD."measurementType" IS DISTINCT FROM NEW."measurementType"
        AND (
            EXISTS (SELECT 1 FROM "BlueprintExercise" WHERE "exerciseId" = OLD."id")
            OR EXISTS (SELECT 1 FROM "WorkoutExercise" WHERE "exerciseId" = OLD."id")
        ) THEN
        RAISE EXCEPTION 'measurement type cannot change after an exercise is referenced'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "Exercise_measurement_type_immutable_after_reference"
BEFORE UPDATE OF "measurementType" ON "Exercise"
FOR EACH ROW
EXECUTE FUNCTION "prevent_referenced_exercise_measurement_change"();
