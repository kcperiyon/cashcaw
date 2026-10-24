import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

type Tx = Prisma.TransactionClient;

/**
 * Every tenant-scoped query must go through withOrgScope, never a bare
 * `db.<model>.*` call for a tenant table. This is the app-level half of the
 * two-layer isolation used across the portfolio (Zeroid, Closa) — it sets
 * the Postgres session variable each RLS policy checks, inside the same
 * transaction the query runs in, so a query that forgets its own WHERE
 * clause still can't see another org's rows.
 */
export async function withOrgScope<T>(
  organizationId: string,
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.organization_id', ${organizationId}, true)`;
    return fn(tx);
  });
}

/** Looks up a membership scoped to the claimed org — returns null if the user isn't a member. */
export async function getMembership(organizationId: string, userId: string) {
  return withOrgScope(organizationId, (tx) =>
    tx.orgMembership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    })
  );
}

/**
 * Scopes a transaction to "rows this specific user is allowed to see about
 * themselves" rather than to one organization — see the OrgMembership RLS
 * policy's self-lookup clause. Only usable after identity is already
 * verified (e.g. password check passed), since it's what lets login find
 * which org(s) to offer without knowing organizationId up front.
 */
export async function withUserScope<T>(
  userId: string,
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
    return fn(tx);
  });
}

/** All orgs a user belongs to, oldest first — login defaults to the first one. */
export async function getMembershipsForUser(userId: string) {
  return withUserScope(userId, (tx) =>
    tx.orgMembership.findMany({
      where: { userId },
      include: { organization: true },
      orderBy: { createdAt: "asc" },
    })
  );
}

/**
 * Public storefront lookup: names one exact slug so the Product
 * public_storefront_lookup RLS policy exposes that single published row —
 * the only way an unauthenticated request can learn which org owns it. Use
 * it ONLY to resolve slug -> {id, organizationId}; further reads go through
 * withOrgScope.
 */
export async function withPublicSlugScope<T>(
  slug: string,
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.public_slug', ${slug}, true)`;
    return fn(tx);
  });
}

/**
 * Buyer-side access to exactly one order, named by its id (provider
 * callbacks) or its unguessable accessToken (delivery page). See the Order
 * buyer_access RLS policy; OrderLine/PaymentTransaction/Enrollment follow the order.
 */
export async function withOrderScope<T>(
  by: { id: string } | { token: string },
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  return db.$transaction(async (tx) => {
    if ("id" in by) {
      await tx.$executeRaw`SELECT set_config('app.order_id', ${by.id}, true)`;
    } else {
      await tx.$executeRaw`SELECT set_config('app.order_token', ${by.token}, true)`;
    }
    return fn(tx);
  });
}
