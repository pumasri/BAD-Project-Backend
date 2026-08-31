-- AlterTable
ALTER TABLE "MatchSuggestion" ALTER COLUMN "matchSource" SET DEFAULT 'AI_ASSISTED',
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PartnerSyncEvent" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PartnerSyncedItem" ALTER COLUMN "id" DROP DEFAULT;
