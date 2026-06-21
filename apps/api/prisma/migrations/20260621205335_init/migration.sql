-- CreateEnum
CREATE TYPE "WorkoutType" AS ENUM ('RUN_WALK', 'EASY_RUN', 'WALK', 'BIKE', 'STRENGTH');

-- CreateEnum
CREATE TYPE "BreathingLevel" AS ENUM ('EASY', 'MEDIUM', 'HARD', 'VERY_HARD');

-- CreateEnum
CREATE TYPE "PainType" AS ENUM ('NONE', 'SHIN', 'KNEE', 'ACHILLES', 'FOOT', 'HIP', 'BACK', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "heightCm" INTEGER NOT NULL DEFAULT 185,
    "goalSpeedKmh" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "easyHrMin" INTEGER NOT NULL DEFAULT 130,
    "easyHrMax" INTEGER NOT NULL DEFAULT 150,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "type" "WorkoutType" NOT NULL,
    "warmupSec" INTEGER NOT NULL,
    "runSec" INTEGER NOT NULL,
    "walkSec" INTEGER NOT NULL,
    "repeats" INTEGER NOT NULL,
    "cooldownSec" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkoutTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT true,
    "totalDurationSec" INTEGER NOT NULL,
    "totalRunSec" INTEGER NOT NULL,
    "totalWalkSec" INTEGER NOT NULL,
    "avgHr" INTEGER,
    "maxHr" INTEGER,
    "difficulty" INTEGER NOT NULL,
    "breathing" "BreathingLevel" NOT NULL,
    "pain" "PainType" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "WorkoutTemplate_level_idx" ON "WorkoutTemplate"("level");

-- CreateIndex
CREATE INDEX "WorkoutTemplate_userId_idx" ON "WorkoutTemplate"("userId");

-- CreateIndex
CREATE INDEX "WorkoutSession_userId_date_idx" ON "WorkoutSession"("userId", "date");

-- CreateIndex
CREATE INDEX "WorkoutSession_templateId_idx" ON "WorkoutSession"("templateId");

-- AddForeignKey
ALTER TABLE "WorkoutTemplate" ADD CONSTRAINT "WorkoutTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkoutTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
