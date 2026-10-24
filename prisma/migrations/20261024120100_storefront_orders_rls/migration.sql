-- RLS for the public storefront. Buyers are unauthenticated, so two narrow
-- escape hatches exist beside the normal tenant policy (policies are OR'd):
--
--   * Product: a SELECT-only policy that exposes a row ONLY when it is
--     published AND the session named its exact slug (app.public_slug). This
--     is how a public request finds which org owns /p/<slug>; every further
--     read then goes through withOrgScope as usual.
--   * Order: visible to a session that names its id (app.order_id, payment
--     callbacks) or its unguessable accessToken (app.order_token, delivery
--     page). Child tables follow the order via EXISTS.
--
-- Nothing here lets a session list orders or products it can't name exactly.

CREATE POLICY public_storefront_lookup ON "Product"
  FOR SELECT
  USING (
    "publishedAt" IS NOT NULL
    AND "publicSlug" = nullif(current_setting('app.public_slug', true), '')
  );

ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Order"
  USING ("organizationId" = current_setting('app.organization_id', true));
CREATE POLICY buyer_access ON "Order"
  USING (
    "id" = nullif(current_setting('app.order_id', true), '')
    OR "accessToken" = nullif(current_setting('app.order_token', true), '')
  );

ALTER TABLE "OrderLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderLine" FORCE ROW LEVEL SECURITY;
CREATE POLICY order_scoped ON "OrderLine"
  USING (EXISTS (SELECT 1 FROM "Order" o WHERE o.id = "OrderLine"."orderId"));

ALTER TABLE "PaymentTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentTransaction" FORCE ROW LEVEL SECURITY;
CREATE POLICY order_scoped ON "PaymentTransaction"
  USING (EXISTS (SELECT 1 FROM "Order" o WHERE o.id = "PaymentTransaction"."orderId"));

ALTER TABLE "Enrollment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Enrollment" FORCE ROW LEVEL SECURITY;
CREATE POLICY order_scoped ON "Enrollment"
  USING (EXISTS (SELECT 1 FROM "Order" o WHERE o.id = "Enrollment"."orderId"));
