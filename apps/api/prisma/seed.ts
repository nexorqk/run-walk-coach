import {
  DEFAULT_STRENGTH_EXERCISES,
  DEFAULT_STRENGTH_WORKOUT_TEMPLATES,
  DEFAULT_WORKOUT_TEMPLATES
} from "@run-walk-coach/shared";
import { ensureDefaultStrengthCatalog, ensureDefaultTemplates } from "../src/bootstrap.js";
import { prisma } from "../src/prisma.js";

async function main() {
  await ensureDefaultTemplates();
  await ensureDefaultStrengthCatalog();

  console.log(`Seeded ${DEFAULT_WORKOUT_TEMPLATES.length} templates.`);
  console.log(
    `Seeded ${DEFAULT_STRENGTH_EXERCISES.length} exercises and ${DEFAULT_STRENGTH_WORKOUT_TEMPLATES.length} strength templates.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
