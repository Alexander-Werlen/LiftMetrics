import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { ExerciseMeasurementType, PrismaClient, WeightUnit } from '@prisma/client';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AccountContext } from '../auth/auth.types';
import { AccountService } from '../account/account.service';
import { Auth0ManagementClient } from '../account/auth0-management.client';
import { BlueprintService } from '../blueprint/blueprint.service';
import { ExerciseService } from '../exercise/exercise.service';
import { WorkoutService } from '../workout/workout.service';
import { WeightService } from '../weight/weight.service';
import { WeeklyPlanService, resolveLocalScheduleDay } from '../weekly-plan/weekly-plan.service';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) throw new Error('DATABASE_URL is required for the PostgreSQL integration checks');

test('PostgreSQL domain integrity and two-user isolation', async () => {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const suffix = randomUUID();
  const userAId = randomUUID();
  const userBId = randomUUID();
  const accountA: AccountContext = { id: userAId, timeZone: 'America/Argentina/Buenos_Aires', preferredWeightUnit: WeightUnit.KG };
  const accountB: AccountContext = { id: userBId, timeZone: 'America/Argentina/Buenos_Aires', preferredWeightUnit: WeightUnit.LB };
  const weight = new WeightService(prisma as never);
  const blueprints = new BlueprintService(prisma as never);
  const exerciseCatalog = new ExerciseService(prisma as never);
  const plans = new WeeklyPlanService(prisma as never);
  const workouts = new WorkoutService(prisma as never);
  let blueprintAId: string | undefined;
  let blueprintBId: string | undefined;
  let planAId: string | undefined;
  let secondPlanAId: string | undefined;
  let workoutAId: string | undefined;
  let workoutExerciseId: string | undefined;
  let archivedExerciseId: string | undefined;
  let userAInserted = false;
  let userBInserted = false;
  let rejectionTriggerInstalled = false;

  try {
    await prisma.user.createMany({ data: [
      { id: userAId, timeZone: accountA.timeZone, preferredWeightUnit: accountA.preferredWeightUnit },
      { id: userBId, timeZone: accountB.timeZone, preferredWeightUnit: accountB.preferredWeightUnit },
    ] });
    userAInserted = userBInserted = true;

    const catalog = await prisma.exercise.findMany({ where: { archivedAt: null }, select: { id: true, measurementType: true }, orderBy: { id: 'asc' } });
    const repsExercise = catalog.find((exercise) => exercise.measurementType === ExerciseMeasurementType.REPS_AND_WEIGHT);
    const timeExercise = catalog.find((exercise) => exercise.measurementType === ExerciseMeasurementType.TIME);
    assert.ok(repsExercise, 'exercise catalog must contain a reps-and-weight exercise');
    assert.ok(timeExercise, 'exercise catalog must contain a time exercise');
    const archivedExercise = await prisma.exercise.create({ data: {
      name: `Integration archive ${suffix}`,
      measurementType: ExerciseMeasurementType.REPS_AND_WEIGHT,
      archivedAt: new Date(),
    } });
    archivedExerciseId = archivedExercise.id;
    assert.ok((await exerciseCatalog.getById(archivedExercise.id)).archivedAt);
    assert.equal((await exerciseCatalog.list(`Integration archive ${suffix}`)).some(({ id }) => id === archivedExercise.id), false);
    await assert.rejects(blueprints.create(accountA, { name: 'Archived catalog item', exercises: [
      { exerciseId: archivedExercise.id, plannedSetCount: 1 },
    ] }), BadRequestException);

    // Same date is a separate entry for each owner; corrections stay within that owner.
    await weight.save(accountA, '2026-10-30', { weight: '80.125', unit: WeightUnit.KG });
    await weight.save(accountB, '2026-10-30', { weight: '200', unit: WeightUnit.LB });
    await weight.save(accountA, '2026-10-30', { weight: '81', unit: WeightUnit.KG });
    assert.equal((await weight.get(accountA, '2026-10-30')).weight, '81.000');
    // Stored loads are canonicalized to whole grams; a kg/lb round trip can lose 0.001 lb.
    assert.equal((await weight.get(accountB, '2026-10-30')).weight, '199.999');
    assert.equal((await weight.history(accountA, {})).length, 1);
    await assert.rejects(
      prisma.weightEntry.create({ data: { userId: userAId, entryDate: new Date('2026-10-30T00:00:00.000Z'), weightKg: '82.000' } }),
      (error: { code?: string }) => error.code === 'P2002',
      'database must enforce unique owner/date weight entries',
    );

    const blueprintA = await blueprints.create(accountA, { name: 'Integration A', exercises: [
      { exerciseId: repsExercise.id, plannedSetCount: 3, targetRepMin: 8, targetRepMax: 12 },
      { exerciseId: timeExercise.id, plannedSetCount: 2 },
    ] });
    const blueprintB = await blueprints.create(accountB, { name: 'Integration B', exercises: [] });
    blueprintAId = blueprintA!.id;
    blueprintBId = blueprintB!.id;
    assert.equal((await blueprints.list(accountB)).length, 1);
    await assert.rejects(blueprints.get(accountB, blueprintAId), NotFoundException);
    await assert.rejects(blueprints.update(accountB, blueprintAId, { name: 'Intrusion', exercises: [] }), NotFoundException);
    await assert.rejects(blueprints.create(accountB, { name: 'Foreign exercise', exercises: [
      { exerciseId: repsExercise.id, plannedSetCount: 0 },
    ] }), BadRequestException);

    // Failed replacement must leave the prior name and ordered exercise rows intact.
    await assert.rejects(blueprints.update(accountA, blueprintAId, { name: 'Should roll back', exercises: [
      { exerciseId: repsExercise.id, plannedSetCount: 1 },
      { exerciseId: repsExercise.id, plannedSetCount: 1 },
    ] }), BadRequestException);
    const unchangedBlueprint = await blueprints.get(accountA, blueprintAId);
    assert.equal(unchangedBlueprint.name, 'Integration A');
    assert.deepEqual(unchangedBlueprint.exercises.map((entry) => entry.exerciseId), [repsExercise.id, timeExercise.id]);

    const today = resolveLocalScheduleDay(new Date(), accountA.timeZone);
    const planA = await plans.create(accountA, { name: 'Integration plan', assignments: [{ blueprintId: blueprintAId, weekday: today.weekday }] });
    planAId = planA!.id;
    await plans.activate(accountA, planAId);
    const secondPlanA = await plans.create(accountA, { name: 'Second inactive plan', assignments: [] });
    secondPlanAId = secondPlanA!.id;
    await assert.rejects(prisma.weeklyPlan.update({
      where: { userId_id: { userId: userAId, id: secondPlanAId } }, data: { isActive: true },
    }), (error: { code?: string }) => error.code === 'P2002', 'database must enforce one active plan per user');
    await assert.rejects(plans.create(accountB, { name: 'Foreign assignment', assignments: [{ blueprintId: blueprintAId, weekday: today.weekday }] }), BadRequestException);
    await assert.rejects(plans.get(accountB, planAId), NotFoundException);
    assert.equal((await plans.recommendation(accountB)).sessions.length, 0);
    const rec = await plans.recommendation(accountA);
    assert.equal(rec.sessions.length, 1);
    assert.equal(rec.sessions[0].blueprint.id, blueprintAId);

    const started = await workouts.startRecommendation(accountA, rec.sessions[0].id);
    workoutAId = started.id;
    assert.deepEqual(started.exercises.map((entry) => [entry.plannedSetCountSnapshot, entry.targetRepMinSnapshot, entry.targetRepMaxSnapshot]), [
      [3, 8, 12], [2, null, null],
    ]);
    assert.equal((await workouts.list(accountB, {})).length, 0);
    assert.equal(await workouts.inProgress(accountB), null);
    await assert.rejects(workouts.get(accountB, workoutAId), NotFoundException);
    await assert.rejects(workouts.complete(accountB, workoutAId), NotFoundException);
    await assert.rejects(workouts.delete(accountB, workoutAId), NotFoundException);

    const adHoc = await workouts.startAdHoc(accountB, { name: `ad hoc ${suffix.slice(0, 8)}` });
    await assert.rejects(workouts.startAdHoc(accountB, {}), ConflictException, 'one in-progress workout per user is enforced');
    await workouts.complete(accountB, adHoc.id);

    // A transaction failure after old child rows are deleted must roll the aggregate back.
    const setExercise = started.exercises.find((entry) => entry.exerciseId === repsExercise.id)!;
    await workouts.update(accountA, workoutAId, { exercises: [{
      exerciseId: repsExercise.id,
      sets: [{ repetitions: 8, weight: '0', unit: WeightUnit.KG }],
    }] });
    const existingChild = await prisma.workoutExercise.findFirst({ where: { userId: userAId, workoutSessionId: workoutAId, exerciseId: repsExercise.id } });
    assert.ok(existingChild);
    workoutExerciseId = existingChild.id;

    await prisma.$executeRawUnsafe(`CREATE FUNCTION liftmetrics_test_fail_set_insert() RETURNS trigger AS $$ BEGIN IF NEW."userId" = '${userAId}'::uuid THEN RAISE EXCEPTION 'forced integration rollback'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
    await prisma.$executeRawUnsafe('CREATE TRIGGER liftmetrics_test_fail_set_insert BEFORE INSERT ON "WorkoutSet" FOR EACH ROW EXECUTE FUNCTION liftmetrics_test_fail_set_insert()');
    rejectionTriggerInstalled = true;
    await assert.rejects(workouts.update(accountA, workoutAId, { workoutDate: '2026-10-29', exercises: [{
      exerciseId: repsExercise.id,
      sets: [{ repetitions: 10, weight: '20', unit: WeightUnit.KG }],
    }] }));
    await prisma.$executeRawUnsafe('DROP TRIGGER liftmetrics_test_fail_set_insert ON "WorkoutSet"');
    await prisma.$executeRawUnsafe('DROP FUNCTION liftmetrics_test_fail_set_insert()');
    rejectionTriggerInstalled = false;
    const afterRollback = await prisma.workoutSession.findFirst({
      where: { id: workoutAId, userId: userAId },
      include: { exercises: { include: { sets: true } } },
    });
    assert.equal(afterRollback!.workoutDate.toISOString().slice(0, 10), started.workoutDate);
    assert.equal(afterRollback!.exercises[0].id, workoutExerciseId);
    assert.equal(afterRollback!.exercises[0].sets[0].repetitions, 8);
    assert.equal(afterRollback!.exercises[0].sets[0].weightKg?.toFixed(3), '0.000');
    assert.equal(setExercise.measurementTypeSnapshot, ExerciseMeasurementType.REPS_AND_WEIGHT);

    // Archived blueprints remain readable but cannot be newly assigned or started.
    const archived = await blueprints.archive(accountA, blueprintAId);
    assert.ok(archived.archivedAt);
    assert.equal((await workouts.get(accountA, workoutAId)).exercises[0].exercise.name, archived.exercises[0].exercise.name);
    assert.equal((await blueprints.list(accountA)).some(({ id }) => id === blueprintAId), false);
    assert.equal((await blueprints.list(accountA, true)).some(({ id }) => id === blueprintAId), true);
    await assert.rejects(plans.update(accountA, planAId, { name: 'Bad archived assignment', assignments: [{ blueprintId: blueprintAId, weekday: today.weekday }] }), BadRequestException);
    assert.equal((await plans.get(accountA, planAId)).assignments[0].blueprint.id, blueprintAId, 'failed plan replacement leaves prior assignment intact');

    // The same-owner composite foreign key is a database backstop against nested cross-user references.
    await assert.rejects(prisma.weeklyPlanAssignment.create({ data: {
      userId: userBId, weeklyPlanId: planAId, blueprintId: blueprintBId, weekday: today.weekday, position: 99,
    } }));
    await assert.rejects(prisma.workoutSet.create({ data: {
      userId: userBId, workoutExerciseId: workoutExerciseId!, position: 99, repetitions: 1, weightKg: '1.000', durationSeconds: null,
    } }));
    await assert.rejects(prisma.workoutSet.create({ data: {
      userId: userAId, workoutExerciseId: workoutExerciseId!, position: 99, repetitions: 1, weightKg: '1.000', durationSeconds: 1,
    } }), () => true, 'database must reject a set row with a mixed measurement shape');

    // Deletion removes the complete user aggregate transactionally and queues provider deletion.
    const subject = `integration-${suffix}`;
    await prisma.authIdentity.create({ data: { userId: userAId, issuer: 'https://integration.invalid/', subject } });
    const management = { isConfigured: () => true } as Auth0ManagementClient;
    await new AccountService(prisma as never, management).scheduleDeletion(userAId);
    userAInserted = false;
    assert.equal(await prisma.user.findUnique({ where: { id: userAId } }), null);
    assert.equal(await prisma.weightEntry.count({ where: { userId: userAId } }), 0);
    assert.equal(await prisma.workoutSession.count({ where: { userId: userAId } }), 0);
    assert.equal(await prisma.weeklyPlan.count({ where: { userId: userAId } }), 0);
    assert.equal(await prisma.sessionBlueprint.count({ where: { userId: userAId } }), 0);
    assert.equal(await prisma.accountDeletionTask.count({ where: { subject } }), 1);
    await prisma.accountDeletionTask.deleteMany({ where: { subject } });
  } finally {
    if (rejectionTriggerInstalled) {
      await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS liftmetrics_test_fail_set_insert ON "WorkoutSet"').catch(() => undefined);
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS liftmetrics_test_fail_set_insert()').catch(() => undefined);
    }
    if (workoutAId) await prisma.workoutSession.deleteMany({ where: { userId: userAId, id: workoutAId } }).catch(() => undefined);
    if (planAId) await prisma.weeklyPlan.deleteMany({ where: { userId: userAId, id: planAId } }).catch(() => undefined);
    if (secondPlanAId) await prisma.weeklyPlan.deleteMany({ where: { userId: userAId, id: secondPlanAId } }).catch(() => undefined);
    if (blueprintAId) await prisma.sessionBlueprint.deleteMany({ where: { userId: userAId, id: blueprintAId } }).catch(() => undefined);
    if (blueprintBId) await prisma.sessionBlueprint.deleteMany({ where: { userId: userBId, id: blueprintBId } }).catch(() => undefined);
    if (userAInserted) await prisma.user.deleteMany({ where: { id: userAId } }).catch(() => undefined);
    if (userBInserted) await prisma.user.deleteMany({ where: { id: userBId } }).catch(() => undefined);
    if (archivedExerciseId) await prisma.exercise.deleteMany({ where: { id: archivedExerciseId } }).catch(() => undefined);
    await prisma.accountDeletionTask.deleteMany({ where: { subject: `integration-${suffix}` } }).catch(() => undefined);
    await prisma.$disconnect();
  }
});

