-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "movementPattern" TEXT NOT NULL,
    "equipment" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrengthWorkoutTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrengthWorkoutTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrengthWorkoutExercise" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "sets" INTEGER NOT NULL,
    "repsMin" INTEGER NOT NULL,
    "repsMax" INTEGER NOT NULL,
    "restSeconds" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "StrengthWorkoutExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrengthWorkoutSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT true,
    "durationMinutes" INTEGER,
    "difficulty" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrengthWorkoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrengthSetLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "rpe" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrengthSetLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrengthExerciseFeedback" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "muscleDifficulty" INTEGER,
    "breathingDifficulty" INTEGER,
    "pain" "PainType" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrengthExerciseFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserExerciseState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "currentLevel" INTEGER NOT NULL DEFAULT 1,
    "bestSetReps" INTEGER,
    "bestWeightKg" DOUBLE PRECISION,
    "bestVolume" DOUBLE PRECISION,
    "lastDifficulty" INTEGER,
    "averageDifficultyLast3" DOUBLE PRECISION,
    "lastPain" "PainType",
    "trend" TEXT,
    "nextRecommendedSets" INTEGER,
    "nextRecommendedReps" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserExerciseState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseAlternative" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "alternativeExerciseId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "difficultyDelta" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExerciseAlternative_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_slug_key" ON "Exercise"("slug");

-- CreateIndex
CREATE INDEX "Exercise_category_idx" ON "Exercise"("category");

-- CreateIndex
CREATE INDEX "Exercise_movementPattern_idx" ON "Exercise"("movementPattern");

-- CreateIndex
CREATE UNIQUE INDEX "StrengthWorkoutTemplate_code_key" ON "StrengthWorkoutTemplate"("code");

-- CreateIndex
CREATE UNIQUE INDEX "StrengthWorkoutExercise_templateId_exerciseId_key" ON "StrengthWorkoutExercise"("templateId", "exerciseId");

-- CreateIndex
CREATE INDEX "StrengthWorkoutExercise_templateId_sortOrder_idx" ON "StrengthWorkoutExercise"("templateId", "sortOrder");

-- CreateIndex
CREATE INDEX "StrengthWorkoutExercise_exerciseId_idx" ON "StrengthWorkoutExercise"("exerciseId");

-- CreateIndex
CREATE INDEX "StrengthWorkoutSession_userId_date_idx" ON "StrengthWorkoutSession"("userId", "date");

-- CreateIndex
CREATE INDEX "StrengthWorkoutSession_templateId_idx" ON "StrengthWorkoutSession"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "StrengthSetLog_sessionId_exerciseId_setNumber_key" ON "StrengthSetLog"("sessionId", "exerciseId", "setNumber");

-- CreateIndex
CREATE INDEX "StrengthSetLog_exerciseId_idx" ON "StrengthSetLog"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "StrengthExerciseFeedback_sessionId_exerciseId_key" ON "StrengthExerciseFeedback"("sessionId", "exerciseId");

-- CreateIndex
CREATE INDEX "StrengthExerciseFeedback_exerciseId_idx" ON "StrengthExerciseFeedback"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "UserExerciseState_userId_exerciseId_key" ON "UserExerciseState"("userId", "exerciseId");

-- CreateIndex
CREATE INDEX "UserExerciseState_exerciseId_idx" ON "UserExerciseState"("exerciseId");

-- CreateIndex
CREATE INDEX "UserRule_userId_type_idx" ON "UserRule"("userId", "type");

-- CreateIndex
CREATE INDEX "UserRule_userId_priority_idx" ON "UserRule"("userId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseAlternative_exerciseId_alternativeExerciseId_reason_key" ON "ExerciseAlternative"("exerciseId", "alternativeExerciseId", "reason");

-- CreateIndex
CREATE INDEX "ExerciseAlternative_alternativeExerciseId_idx" ON "ExerciseAlternative"("alternativeExerciseId");

-- AddForeignKey
ALTER TABLE "StrengthWorkoutExercise" ADD CONSTRAINT "StrengthWorkoutExercise_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "StrengthWorkoutTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrengthWorkoutExercise" ADD CONSTRAINT "StrengthWorkoutExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrengthWorkoutSession" ADD CONSTRAINT "StrengthWorkoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrengthWorkoutSession" ADD CONSTRAINT "StrengthWorkoutSession_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "StrengthWorkoutTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrengthSetLog" ADD CONSTRAINT "StrengthSetLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StrengthWorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrengthSetLog" ADD CONSTRAINT "StrengthSetLog_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrengthExerciseFeedback" ADD CONSTRAINT "StrengthExerciseFeedback_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StrengthWorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrengthExerciseFeedback" ADD CONSTRAINT "StrengthExerciseFeedback_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserExerciseState" ADD CONSTRAINT "UserExerciseState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserExerciseState" ADD CONSTRAINT "UserExerciseState_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRule" ADD CONSTRAINT "UserRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseAlternative" ADD CONSTRAINT "ExerciseAlternative_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseAlternative" ADD CONSTRAINT "ExerciseAlternative_alternativeExerciseId_fkey" FOREIGN KEY ("alternativeExerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
