/*
  Warnings:

  - You are about to drop the column `colorPalette` on the `WebsiteData` table. All the data in the column will be lost.
  - You are about to drop the column `ogTags` on the `WebsiteData` table. All the data in the column will be lost.
  - You are about to drop the column `sitemap` on the `WebsiteData` table. All the data in the column will be lost.
  - You are about to drop the column `style` on the `WebsiteData` table. All the data in the column will be lost.
  - You are about to drop the column `typography` on the `WebsiteData` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "BusinessContext" ADD COLUMN     "radius" INTEGER;

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "componentCode" JSONB,
ADD COLUMN     "contentVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "customCSS" TEXT,
ADD COLUMN     "keywordTarget" JSONB,
ADD COLUMN     "seoMeta" JSONB,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "SkillInvocation" ADD COLUMN     "completionTokens" INTEGER,
ADD COLUMN     "cost" DOUBLE PRECISION,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "outputData" JSONB,
ADD COLUMN     "promptTokens" INTEGER;

-- AlterTable
ALTER TABLE "WebsiteData" DROP COLUMN "colorPalette",
DROP COLUMN "ogTags",
DROP COLUMN "sitemap",
DROP COLUMN "style",
DROP COLUMN "typography",
ADD COLUMN     "customComponents" JSONB,
ADD COLUMN     "generationJobId" TEXT,
ADD COLUMN     "qcReport" JSONB,
ADD COLUMN     "qcStatus" TEXT DEFAULT 'standby',
ADD COLUMN     "seasonalConfig" JSONB,
ADD COLUMN     "serviceRanking" JSONB;

-- CreateTable
CREATE TABLE "ProjectAsset" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "prompt" TEXT,
    "originalUrl" TEXT,
    "webpUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "cost" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "referenceAssetId" TEXT,
    "metadata" JSONB,

    CONSTRAINT "ProjectAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationKeywordMetrics" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "service" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "searchVolume" INTEGER NOT NULL,
    "difficulty" DOUBLE PRECISION,
    "cpc" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocationKeywordMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceKeywordMetrics" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "searchVolume" INTEGER NOT NULL,
    "monthlyVolumes" JSONB,
    "competition" TEXT,
    "cpc" DOUBLE PRECISION,
    "rank" INTEGER NOT NULL,
    "geoScope" TEXT NOT NULL DEFAULT 'city',
    "avgTicketPrice" DOUBLE PRECISION,
    "revenuePotential" DOUBLE PRECISION,
    "userOverrideRank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceKeywordMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LocationKeywordMetrics_projectId_city_service_key" ON "LocationKeywordMetrics"("projectId", "city", "service");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceKeywordMetrics_projectId_city_service_key" ON "ServiceKeywordMetrics"("projectId", "city", "service");

-- AddForeignKey
ALTER TABLE "ProjectAsset" ADD CONSTRAINT "ProjectAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationKeywordMetrics" ADD CONSTRAINT "LocationKeywordMetrics_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceKeywordMetrics" ADD CONSTRAINT "ServiceKeywordMetrics_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
