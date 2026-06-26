import {
  DEFAULT_EXERCISE_ALTERNATIVES,
  DEFAULT_STRENGTH_EXERCISES,
  DEFAULT_STRENGTH_WORKOUT_TEMPLATES,
  DEFAULT_WORKOUT_TEMPLATES
} from "@run-walk-coach/shared";
import { prisma } from "./prisma.js";

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

export async function ensureDefaultStrengthCatalog() {
  const exerciseBySlug = new Map<string, { id: string }>();

  for (const exercise of DEFAULT_STRENGTH_EXERCISES) {
    const saved = await prisma.exercise.upsert({
      where: { slug: exercise.slug },
      update: {
        name: exercise.name,
        category: exercise.category,
        movementPattern: exercise.movementPattern,
        equipment: exercise.equipment,
        difficulty: exercise.difficulty
      },
      create: exercise
    });

    exerciseBySlug.set(exercise.slug, saved);
  }

  for (const template of DEFAULT_STRENGTH_WORKOUT_TEMPLATES) {
    const savedTemplate = await prisma.strengthWorkoutTemplate.upsert({
      where: { code: template.code },
      update: {
        name: template.name,
        isDefault: template.isDefault
      },
      create: {
        code: template.code,
        name: template.name,
        isDefault: template.isDefault
      }
    });

    await prisma.strengthWorkoutExercise.deleteMany({
      where: { templateId: savedTemplate.id }
    });

    for (const templateExercise of template.exercises) {
      const exercise = exerciseBySlug.get(templateExercise.exerciseSlug);

      if (!exercise) {
        throw new Error(`Default exercise ${templateExercise.exerciseSlug} is missing.`);
      }

      await prisma.strengthWorkoutExercise.create({
        data: {
          templateId: savedTemplate.id,
          exerciseId: exercise.id,
          sets: templateExercise.sets,
          repsMin: templateExercise.repsMin,
          repsMax: templateExercise.repsMax,
          restSeconds: templateExercise.restSeconds,
          sortOrder: templateExercise.sortOrder
        }
      });
    }
  }

  for (const alternative of DEFAULT_EXERCISE_ALTERNATIVES) {
    const exercise = exerciseBySlug.get(alternative.exerciseSlug);
    const alternativeExercise = exerciseBySlug.get(alternative.alternativeExerciseSlug);

    if (!exercise || !alternativeExercise) {
      throw new Error(
        `Default exercise alternative ${alternative.exerciseSlug} -> ${alternative.alternativeExerciseSlug} is missing.`
      );
    }

    await prisma.exerciseAlternative.upsert({
      where: {
        exerciseId_alternativeExerciseId_reason: {
          exerciseId: exercise.id,
          alternativeExerciseId: alternativeExercise.id,
          reason: alternative.reason
        }
      },
      update: {
        difficultyDelta: alternative.difficultyDelta
      },
      create: {
        exerciseId: exercise.id,
        alternativeExerciseId: alternativeExercise.id,
        reason: alternative.reason,
        difficultyDelta: alternative.difficultyDelta
      }
    });
  }
}

export async function bootstrapData() {
  await ensureDefaultTemplates();
  await ensureDefaultStrengthCatalog();
}
