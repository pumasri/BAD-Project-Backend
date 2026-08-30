-- Extend the existing report and match tables for AI-assisted suggestions.
CREATE TYPE "EmbeddingStatus" AS ENUM ('PENDING', 'READY', 'FAILED');
CREATE TYPE "MatchConfidence" AS ENUM ('HIGH', 'POSSIBLE');
CREATE TYPE "MatchStatus" AS ENUM ('SUGGESTED', 'CONFIRMED', 'REJECTED', 'CLAIMED', 'RESOLVED');

ALTER TABLE "ItemReport"
  ADD COLUMN "embedding" JSONB,
  ADD COLUMN "embeddingModel" TEXT,
  ADD COLUMN "embeddingUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "embeddingFingerprint" TEXT,
  ADD COLUMN "embeddingStatus" "EmbeddingStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "embeddingError" TEXT;

ALTER TABLE "MatchSuggestion" RENAME COLUMN "confidenceScore" TO "totalScore";
UPDATE "MatchSuggestion" SET "totalScore" = "totalScore" * 100 WHERE "totalScore" <= 1;

ALTER TABLE "MatchSuggestion"
  ADD COLUMN "descriptionSimilarityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "categoryScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "colorScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "locationScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "dateScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "confidence" "MatchConfidence" NOT NULL DEFAULT 'POSSIBLE',
  ADD COLUMN "reasons" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "status" "MatchStatus" NOT NULL DEFAULT 'SUGGESTED',
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "reviewerId" UUID;

UPDATE "MatchSuggestion"
SET "confidence" = CASE WHEN "totalScore" >= 80 THEN 'HIGH'::"MatchConfidence" ELSE 'POSSIBLE'::"MatchConfidence" END;

ALTER TABLE "MatchSuggestion"
  ALTER COLUMN "descriptionSimilarityScore" DROP DEFAULT,
  ALTER COLUMN "categoryScore" DROP DEFAULT,
  ALTER COLUMN "colorScore" DROP DEFAULT,
  ALTER COLUMN "locationScore" DROP DEFAULT,
  ALTER COLUMN "dateScore" DROP DEFAULT,
  ALTER COLUMN "confidence" DROP DEFAULT,
  ALTER COLUMN "reasons" DROP DEFAULT;

DROP INDEX "MatchSuggestion_confidenceScore_idx";
CREATE INDEX "MatchSuggestion_status_totalScore_idx" ON "MatchSuggestion"("status", "totalScore");
CREATE INDEX "MatchSuggestion_reviewerId_idx" ON "MatchSuggestion"("reviewerId");

ALTER TABLE "MatchSuggestion"
  ADD CONSTRAINT "MatchSuggestion_reviewerId_fkey"
  FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

