import { PrismaClient } from "@prisma/client";
import { DEFAULT_WORKOUT_TEMPLATES } from "@run-walk-coach/shared";

const prisma = new PrismaClient();

async function main() {
  for (const template of DEFAULT_WORKOUT_TEMPLATES) {
    const existing = await prisma.workoutTemplate.findFirst({
      where: {
        userId: null,
        isDefault: true,
        level: template.level
      }
    });

    const data = {
      userId: null,
      name: template.name,
      level: template.level,
      type: template.type,
      warmupSec: template.warmupSec,
      runSec: template.runSec,
      walkSec: template.walkSec,
      repeats: template.repeats,
      cooldownSec: template.cooldownSec,
      isDefault: true
    };

    if (existing) {
      await prisma.workoutTemplate.update({
        where: { id: existing.id },
        data
      });
    } else {
      await prisma.workoutTemplate.create({ data });
    }
  }

  console.log(`Seeded ${DEFAULT_WORKOUT_TEMPLATES.length} templates.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
