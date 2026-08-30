-- Store a partner's public inventory separately from local reports. This
-- avoids importing external users, claims, evidence, or image files.
CREATE TABLE "PartnerSyncedItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "location" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "sourceUrl" TEXT,
    "remoteUpdatedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "partnerId" UUID NOT NULL,

    CONSTRAINT "PartnerSyncedItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerSyncEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "operation" TEXT NOT NULL,
    "receivedCount" INTEGER NOT NULL,
    "createdCount" INTEGER NOT NULL,
    "updatedCount" INTEGER NOT NULL,
    "deactivatedCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "partnerId" UUID NOT NULL,

    CONSTRAINT "PartnerSyncEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartnerSyncedItem_partnerId_externalId_key"
  ON "PartnerSyncedItem"("partnerId", "externalId");
CREATE INDEX "PartnerSyncedItem_partnerId_status_idx"
  ON "PartnerSyncedItem"("partnerId", "status");
CREATE INDEX "PartnerSyncedItem_partnerId_category_idx"
  ON "PartnerSyncedItem"("partnerId", "category");
CREATE INDEX "PartnerSyncedItem_partnerId_location_idx"
  ON "PartnerSyncedItem"("partnerId", "location");
CREATE INDEX "PartnerSyncEvent_partnerId_createdAt_idx"
  ON "PartnerSyncEvent"("partnerId", "createdAt");

ALTER TABLE "PartnerSyncedItem"
  ADD CONSTRAINT "PartnerSyncedItem_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "PartnerClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerSyncEvent"
  ADD CONSTRAINT "PartnerSyncEvent_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "PartnerClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
