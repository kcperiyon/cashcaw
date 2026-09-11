-- RLS backstop for Phase 1's new tables, same pattern as the earlier
-- KnowledgeSource policy — see 20260910194500_add_rls_policies for the
-- rationale (app-level scoping is primary, this is the backstop; FORCE is
-- required because the app connects as the table owner).

ALTER TABLE "InterviewMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InterviewMessage" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "InterviewMessage"
  USING ("organizationId" = current_setting('app.organization_id', true));

ALTER TABLE "ExpertiseFact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExpertiseFact" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ExpertiseFact"
  USING ("organizationId" = current_setting('app.organization_id', true));

ALTER TABLE "Opportunity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Opportunity" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Opportunity"
  USING ("organizationId" = current_setting('app.organization_id', true));
