/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'MORE_INFORMATION_REQUIRED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "username" TEXT;

-- CreateTable
CREATE TABLE "ItemImage" (
    "id" UUID NOT NULL,
    "objectKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportId" UUID NOT NULL,

    CONSTRAINT "ItemImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchSuggestion" (
    "id" UUID NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "matchSource" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lostReportId" UUID NOT NULL,
    "foundReportId" UUID NOT NULL,

    CONSTRAINT "MatchSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimRequest" (
    "id" UUID NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "identifyingDetails" TEXT NOT NULL,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "claimantUserId" UUID NOT NULL,
    "foundReportId" UUID NOT NULL,
    "reviewedByUserId" UUID,

    CONSTRAINT "ClaimRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimEvidence" (
    "id" UUID NOT NULL,
    "evidenceType" TEXT NOT NULL,
    "textValue" TEXT,
    "objectKey" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimRequestId" UUID NOT NULL,

    CONSTRAINT "ClaimEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" UUID NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerClient" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baseUrl" TEXT NOT NULL,
    "apiKeyIdentifier" TEXT NOT NULL,
    "apiKeyHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerClient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemImage_objectKey_key" ON "ItemImage"("objectKey");

-- CreateIndex
CREATE INDEX "ItemImage_reportId_idx" ON "ItemImage"("reportId");

-- CreateIndex
CREATE INDEX "MatchSuggestion_foundReportId_idx" ON "MatchSuggestion"("foundReportId");

-- CreateIndex
CREATE INDEX "MatchSuggestion_confidenceScore_idx" ON "MatchSuggestion"("confidenceScore");

-- CreateIndex
CREATE UNIQUE INDEX "MatchSuggestion_lostReportId_foundReportId_key" ON "MatchSuggestion"("lostReportId", "foundReportId");

-- CreateIndex
CREATE INDEX "ClaimRequest_claimantUserId_idx" ON "ClaimRequest"("claimantUserId");

-- CreateIndex
CREATE INDEX "ClaimRequest_foundReportId_status_idx" ON "ClaimRequest"("foundReportId", "status");

-- CreateIndex
CREATE INDEX "ClaimRequest_reviewedByUserId_idx" ON "ClaimRequest"("reviewedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ClaimEvidence_objectKey_key" ON "ClaimEvidence"("objectKey");

-- CreateIndex
CREATE INDEX "ClaimEvidence_claimRequestId_idx" ON "ClaimEvidence"("claimRequestId");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerClient_name_key" ON "PartnerClient"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerClient_apiKeyIdentifier_key" ON "PartnerClient"("apiKeyIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "ItemImage" ADD CONSTRAINT "ItemImage_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ItemReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchSuggestion" ADD CONSTRAINT "MatchSuggestion_lostReportId_fkey" FOREIGN KEY ("lostReportId") REFERENCES "ItemReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchSuggestion" ADD CONSTRAINT "MatchSuggestion_foundReportId_fkey" FOREIGN KEY ("foundReportId") REFERENCES "ItemReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimRequest" ADD CONSTRAINT "ClaimRequest_claimantUserId_fkey" FOREIGN KEY ("claimantUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimRequest" ADD CONSTRAINT "ClaimRequest_foundReportId_fkey" FOREIGN KEY ("foundReportId") REFERENCES "ItemReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimRequest" ADD CONSTRAINT "ClaimRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimEvidence" ADD CONSTRAINT "ClaimEvidence_claimRequestId_fkey" FOREIGN KEY ("claimRequestId") REFERENCES "ClaimRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
