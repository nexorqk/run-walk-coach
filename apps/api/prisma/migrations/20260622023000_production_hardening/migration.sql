-- AlterTable
ALTER TABLE "RecoveryCode" ADD COLUMN "revokedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WorkoutSession" ADD COLUMN "clientSessionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutSession_userId_clientSessionId_key" ON "WorkoutSession"("userId", "clientSessionId");
