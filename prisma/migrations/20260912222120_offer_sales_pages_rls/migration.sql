-- RLS backstop for Offer (direct organizationId column, same pattern as
-- everything else) and SalesPage (scoped one hop through Offer, same
-- EXISTS-subquery pattern as Module/ContentSection).

ALTER TABLE "Offer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Offer" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Offer"
  USING ("organizationId" = current_setting('app.organization_id', true));

ALTER TABLE "SalesPage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalesPage" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SalesPage"
  USING (EXISTS (
    SELECT 1 FROM "Offer" o
    WHERE o.id = "SalesPage"."offerId"
      AND o."organizationId" = current_setting('app.organization_id', true)
  ));
