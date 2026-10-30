import { ExerciseMeasurementType } from '@prisma/client';

export interface ExerciseSeedEntry {
  name: string;
  measurementType: ExerciseMeasurementType;
}

interface ExistingExercise {
  id: string;
  measurementType: ExerciseMeasurementType;
}

interface SeedTransaction {
  $queryRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<ExistingExercise[]>;
  exercise: { create(args: { data: ExerciseSeedEntry }): Promise<unknown> };
}

interface SeedClient {
  $transaction<T>(callback: (transaction: SeedTransaction) => Promise<T>): Promise<T>;
}

export function normalizeExerciseName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export async function seedExercises(client: SeedClient, entries: ExerciseSeedEntry[]): Promise<{ created: number; existing: number }> {
  const normalizedNames = new Set<string>();
  for (const entry of entries) {
    const key = normalizeExerciseName(entry.name);
    if (!key) throw new Error('Exercise seed names cannot be empty');
    if (normalizedNames.has(key)) throw new Error(`Duplicate normalized exercise name in seed: ${entry.name}`);
    normalizedNames.add(key);
  }

  return client.$transaction(async (transaction) => {
    let created = 0;
    let existing = 0;
    for (const entry of entries) {
      const key = normalizeExerciseName(entry.name);
      const matches = await transaction.$queryRaw`
        SELECT "id", "measurementType"
        FROM "Exercise"
        WHERE lower(regexp_replace(btrim("name"), '\\s+', ' ', 'g')) = ${key}
        LIMIT 1
      `;
      const match = matches[0];
      if (match) {
        if (match.measurementType !== entry.measurementType) {
          throw new Error(`Exercise measurement type is immutable for referenced catalog item: ${entry.name}`);
        }
        existing += 1;
        continue;
      }
      await transaction.exercise.create({ data: entry });
      created += 1;
    }
    return { created, existing };
  });
}
