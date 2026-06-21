import { DEFAULT_USER_PROFILE, DEFAULT_WORKOUT_TEMPLATES } from "@run-walk-coach/shared";
import { env } from "./env.js";
import { prisma } from "./prisma.js";

export async function ensureDevUser() {
  return prisma.user.upsert({
    where: { email: env.devUserEmail },
    update: {},
    create: {
      email: env.devUserEmail,
      ...DEFAULT_USER_PROFILE
    }
  });
}

export async function ensureDefaultTemplates() {
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
}

export async function bootstrapData() {
  await ensureDevUser();
  await ensureDefaultTemplates();
}
