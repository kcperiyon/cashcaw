-- CreateEnum
CREATE TYPE "RepurposeAssetType" AS ENUM ('lead_magnet', 'email_sequence', 'social_posts', 'webinar_script');

-- CreateTable
CREATE TABLE "RepurposedAsset" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "RepurposeAssetType" NOT NULL,
    "title" TEXT NOT NULL,
    "contentJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepurposedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RepurposedAsset_productId_type_idx" ON "RepurposedAsset"("productId", "type");

-- AddForeignKey
ALTER TABLE "RepurposedAsset" ADD CONSTRAINT "RepurposedAsset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepurposedAsset" ADD CONSTRAINT "RepurposedAsset_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
