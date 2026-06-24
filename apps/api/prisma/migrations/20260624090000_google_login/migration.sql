ALTER TABLE "User" ADD COLUMN "googleId" TEXT;
ALTER TABLE "User" ADD COLUMN "googleLinkedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
