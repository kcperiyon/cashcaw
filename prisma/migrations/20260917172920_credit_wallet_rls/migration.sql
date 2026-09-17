-- RLS backstop for the credit wallet — both carry organizationId directly,
-- same pattern as every other org-level table in this app.

ALTER TABLE "AiCreditWallet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AiCreditWallet" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AiCreditWallet"
  USING ("organizationId" = current_setting('app.organization_id', true));

ALTER TABLE "AiUsageLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AiUsageLog" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AiUsageLog"
  USING ("organizationId" = current_setting('app.organization_id', true));
