-- Row-Level Security backstop for tenant isolation. App-level scoping
-- (src/lib/tenant-db.ts) is the primary defense: every query that touches a
-- tenant table goes through withOrgScope(), which sets these session
-- variables before running the query. RLS is the backstop — if a query is
-- ever written without going through that wrapper, these policies make it
-- return zero rows instead of another org's data. Same two-layer pattern
-- as Zeroid and Closa, reused verbatim rather than re-derived.
--
-- FORCE ROW LEVEL SECURITY matters specifically because the app connects as
-- the table owner (cashcaw_dev) — by default Postgres RLS does NOT apply to
-- a table's owner, which would silently defeat this policy for every real
-- query the app makes. FORCE closes that gap.

ALTER TABLE "KnowledgeSource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KnowledgeSource" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "KnowledgeSource"
  USING ("organizationId" = current_setting('app.organization_id', true));

-- OrgMembership needs a second, narrower way in: login has to find which
-- org(s) a user belongs to BEFORE it knows which organizationId to scope
-- the request to — the org-scoped-only policy above can't serve that
-- lookup. A membership row is also visible to the specific user who holds
-- it, once the app has verified their identity and set app.user_id (see
-- withUserScope in src/lib/tenant-db.ts). Still not an open door —
-- app.user_id is only ever set after a password check succeeds, so this
-- doesn't let a caller enumerate anyone else's memberships.
ALTER TABLE "OrgMembership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrgMembership" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "OrgMembership"
  USING (
    "organizationId" = current_setting('app.organization_id', true)
    OR "userId" = current_setting('app.user_id', true)
  );
