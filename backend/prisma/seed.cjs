const { PrismaClient } = require('@prisma/client');
const { seedExercises } = require('../dist/exercise/seed-exercises.js');
const exercises = require('./exercises.json');

const prisma = new PrismaClient();

seedExercises(prisma, exercises)
  .then(({ created, existing }) => {
    process.stdout.write(`Exercise catalog seed complete: ${created} created, ${existing} already present.\n`);
  })
  .catch((error) => {
    process.stderr.write(`Exercise catalog seed failed: ${error instanceof Error ? error.message : 'unknown error'}\n`);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
