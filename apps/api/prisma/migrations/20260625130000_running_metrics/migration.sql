-- CreateEnum
CREATE TYPE "HeartRateZone" AS ENUM ('ZONE_1', 'ZONE_2', 'ZONE_3', 'ZONE_4', 'ZONE_5');

-- AlterTable
ALTER TABLE "WorkoutSession"
  ADD COLUMN "stopwatchPulseBpm" INTEGER,
  ADD COLUMN "heartRateZone" "HeartRateZone",
  ADD COLUMN "distanceMeters" INTEGER,
  ADD COLUMN "avgPaceSecPerKm" INTEGER,
  ADD COLUMN "avgSpeedKmh" DOUBLE PRECISION,
  ADD COLUMN "cadenceSpm" INTEGER,
  ADD COLUMN "breathingNote" TEXT;
