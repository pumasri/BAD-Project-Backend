-- Store only the minimal, staff-facing result returned from the Medicine Box API.
-- Raw partner responses and API credentials are intentionally never persisted here.
CREATE TABLE "MedicineBoxCheck" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "status" TEXT NOT NULL,
    "supportLocation" TEXT,
    "message" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itemReportId" UUID NOT NULL,
    "checkedByUserId" UUID NOT NULL,

    CONSTRAINT "MedicineBoxCheck_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MedicineBoxCheck_itemReportId_checkedAt_idx"
  ON "MedicineBoxCheck"("itemReportId", "checkedAt");
CREATE INDEX "MedicineBoxCheck_checkedByUserId_checkedAt_idx"
  ON "MedicineBoxCheck"("checkedByUserId", "checkedAt");

ALTER TABLE "MedicineBoxCheck"
  ADD CONSTRAINT "MedicineBoxCheck_itemReportId_fkey"
  FOREIGN KEY ("itemReportId") REFERENCES "ItemReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MedicineBoxCheck"
  ADD CONSTRAINT "MedicineBoxCheck_checkedByUserId_fkey"
  FOREIGN KEY ("checkedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
