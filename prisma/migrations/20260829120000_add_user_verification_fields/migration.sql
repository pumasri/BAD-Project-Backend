-- Add the nullable fields used by the existing user verification workflow.
ALTER TABLE "User"
ADD COLUMN "verificationCode" TEXT,
ADD COLUMN "verificationExpiresAt" TIMESTAMP(3);
