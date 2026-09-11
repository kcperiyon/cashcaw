-- RLS backstop for the Product Factory tables. Product carries
-- organizationId directly, same pattern as everything else. Module/Lesson/
-- ContentSection don't — they're scoped through Product — so their policies
-- use an EXISTS subquery instead of a direct column comparison. Same
-- app-level-is-primary / this-is-the-backstop discipline as every other
-- policy in this app.

ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Product"
  USING ("organizationId" = current_setting('app.organization_id', true));

ALTER TABLE "Module" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Module" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Module"
  USING (EXISTS (
    SELECT 1 FROM "Product" p
    WHERE p.id = "Module"."productId"
      AND p."organizationId" = current_setting('app.organization_id', true)
  ));

ALTER TABLE "Lesson" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lesson" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Lesson"
  USING (EXISTS (
    SELECT 1 FROM "Module" m
    JOIN "Product" p ON p.id = m."productId"
    WHERE m.id = "Lesson"."moduleId"
      AND p."organizationId" = current_setting('app.organization_id', true)
  ));

ALTER TABLE "ContentSection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContentSection" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ContentSection"
  USING (EXISTS (
    SELECT 1 FROM "Product" p
    WHERE p.id = "ContentSection"."productId"
      AND p."organizationId" = current_setting('app.organization_id', true)
  ));
