# Initial Exercise Catalog Seed

This document defines the complete proposed initial shared exercise seed for LiftMetrics: 99 exercises across common gym equipment, bodyweight training, Olympic lifts, and timed work. The list lives outside the implementation plan so it can be reviewed and maintained as catalog data.

Every exercise has exactly one fixed measurement type. `REPS_AND_WEIGHT` entries record repetitions and load; a zero load is valid for unweighted work. `TIME` entries record duration only. API values for body weight and load include an explicit `KG` or `LB` unit and are converted to canonical kilograms for storage. Exercise names are unique after case and whitespace normalization.

## Barbell — `REPS_AND_WEIGHT` (17)

| Exercise |
|---|
| Back squat |
| Front squat |
| Overhead squat |
| Barbell bench press |
| Incline barbell bench press |
| Barbell overhead press |
| Push press |
| Conventional deadlift |
| Sumo deadlift |
| Barbell Romanian deadlift |
| Barbell hip thrust |
| Bent-over barbell row |
| Pendlay row |
| Good morning |
| Barbell curl |
| Lying barbell triceps extension |
| Standing barbell calf raise |

## Dumbbell — `REPS_AND_WEIGHT` (16)

| Exercise |
|---|
| Dumbbell goblet squat |
| Dumbbell Bulgarian split squat |
| Dumbbell reverse lunge |
| Dumbbell step-up |
| Dumbbell Romanian deadlift |
| Dumbbell bench press |
| Dumbbell incline bench press |
| Dumbbell floor press |
| Seated dumbbell shoulder press |
| Dumbbell lateral raise |
| Bent-over dumbbell reverse fly |
| One-arm dumbbell row |
| Chest-supported dumbbell row |
| Alternating dumbbell curl |
| Dumbbell hammer curl |
| Overhead dumbbell triceps extension |

## Kettlebell — `REPS_AND_WEIGHT` (8)

| Exercise |
|---|
| Kettlebell goblet squat |
| Kettlebell swing |
| One-arm kettlebell swing |
| Kettlebell clean and press |
| Kettlebell snatch |
| Turkish get-up |
| Kettlebell deadlift |
| Kettlebell windmill |

## Cable — `REPS_AND_WEIGHT` (12)

| Exercise |
|---|
| Cable chest press |
| Cable chest fly |
| Cable lateral raise |
| Cable face pull |
| Cable lat pulldown |
| Cable seated row |
| Single-arm cable row |
| Cable biceps curl |
| Cable triceps pushdown |
| Cable overhead triceps extension |
| Cable wood chop |
| Cable pull-through |

## Machines — `REPS_AND_WEIGHT` (12)

| Exercise |
|---|
| Leg press |
| Hack squat |
| Smith machine squat |
| Chest press machine |
| Pec deck |
| Lat pulldown machine |
| Seated row machine |
| Leg extension |
| Seated leg curl |
| Lying leg curl |
| Standing calf raise machine |
| Assisted pull-up machine |

## Bodyweight and suspension — `REPS_AND_WEIGHT` (15)

| Exercise |
|---|
| Push-up |
| Ring push-up |
| Dip |
| Pull-up |
| Chin-up |
| Inverted row |
| Bodyweight squat |
| Pistol squat |
| Bodyweight Bulgarian split squat |
| Bodyweight reverse lunge |
| Bodyweight step-up |
| Glute bridge |
| Nordic hamstring curl |
| Hanging knee raise |
| Crunch |

## Resistance band — `REPS_AND_WEIGHT` (5)

| Exercise |
|---|
| Band squat |
| Band chest press |
| Band row |
| Band pull-apart |
| Band lateral walk |

## Olympic lifting — `REPS_AND_WEIGHT` (5)

| Exercise |
|---|
| Clean |
| Power clean |
| Snatch |
| Power snatch |
| Clean and jerk |

## Timed holds and conditioning — `TIME` (9)

| Exercise |
|---|
| Front plank |
| Side plank |
| Wall sit |
| Dead hang |
| L-sit hold |
| Handstand hold |
| Jump rope |
| Rowing machine |
| Treadmill run |

## Seed rules

- This is the full proposed v1 seed: 99 entries. Additions are reviewed and committed as explicit catalog changes.
- Seed execution must be repeatable and must not create duplicate rows. Match existing rows by normalized name.
- Do not mutate an exercise's measurement type after it is referenced. If a correction requires a different type, add a new exercise and archive the old one.
- Archived exercises remain available to existing blueprints and workout history but cannot be newly selected.
- Keep the catalog global and read-only to end users in the initial release.
