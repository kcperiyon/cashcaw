-- CreateEnum
CREATE TYPE "InterviewRole" AS ENUM ('founder', 'interviewer');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('proposed', 'selected', 'archived');

-- CreateTable
CREATE TABLE "InterviewMessage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "InterviewRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpertiseFact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpertiseFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "demandScore" INTEGER NOT NULL,
    "demandEvidence" TEXT NOT NULL,
    "expertiseFitScore" INTEGER NOT NULL,
    "competitionDensity" INTEGER NOT NULL,
    "competitionEvidence" TEXT NOT NULL,
    "monetisationScore" INTEGER NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'proposed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InterviewMessage_organizationId_createdAt_idx" ON "InterviewMessage"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ExpertiseFact_organizationId_idx" ON "ExpertiseFact"("organizationId");

-- CreateIndex
CREATE INDEX "Opportunity_organizationId_overallScore_idx" ON "Opportunity"("organizationId", "overallScore");

-- AddForeignKey
ALTER TABLE "InterviewMessage" ADD CONSTRAINT "InterviewMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpertiseFact" ADD CONSTRAINT "ExpertiseFact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
