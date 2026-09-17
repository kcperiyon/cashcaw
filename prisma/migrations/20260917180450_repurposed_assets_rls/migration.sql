-- RLS backstop for RepurposedAsset — carries organizationId directly, same
-- pattern as Product/Offer.

ALTER TABLE "RepurposedAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RepurposedAsset" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "RepurposedAsset"
  USING ("organizationId" = current_setting('app.organization_id', true));
