# Webhook handler skeleton (RevenueCat → your backend)

TypeScript for a Deno / edge-function style runtime. Adapt the storage calls to your database.

```ts
// POST /revenuecat-webhook   Authorization: Bearer <WEBHOOK_SECRET>
const SECRET = Deno.env.get("RC_WEBHOOK_SECRET")!;
const ACTIVE = new Set(["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE", "NON_RENEWING_PURCHASE", "SUBSCRIPTION_EXTENDED", "TEMPORARY_ENTITLEMENT_GRANT"]);
// CANCELLATION = auto-renew turned off; access continues until expiration_at_ms.
// BILLING_ISSUE = payment failed; access continues while in grace period.
const ENDS = new Set(["EXPIRATION"]);

export async function handle(req: Request, db: Db): Promise<Response> {
  if (req.headers.get("authorization") !== `Bearer ${SECRET}`) return new Response("unauthorized", { status: 401 });
  const { event } = await req.json();
  if (!event?.id || !event?.app_user_id) return new Response("bad request", { status: 400 });

  // Idempotency: ignore events already processed.
  if (await db.eventSeen(event.id)) return new Response("dup", { status: 200 });

  const userId = event.app_user_id;            // your backend user id (set via logIn)
  if (userId.startsWith("$RCAnonymousID")) {   // purchase before sign-in: store, link later
    await db.markEvent(event.id); return new Response("anon", { status: 200 });
  }
  const at = Number(event.event_timestamp_ms);
  const expires = event.expiration_at_ms ? new Date(Number(event.expiration_at_ms)) : null;

  // Out-of-order protection: only apply if newer than what we stored.
  const current = await db.getEntitlement(userId, "premium");
  if (current && current.updated_at_ms > at) { await db.markEvent(event.id); return new Response("stale", { status: 200 }); }

  if (ACTIVE.has(event.type) || event.type === "CANCELLATION" || event.type === "BILLING_ISSUE") {
    await db.upsertEntitlement({ userId, entitlement: "premium", active: !expires || expires > new Date(), expires_at: expires, source: event.store, updated_at_ms: at });
  } else if (ENDS.has(event.type)) {
    await db.upsertEntitlement({ userId, entitlement: "premium", active: false, expires_at: expires, source: event.store, updated_at_ms: at });
  } else if (event.type === "TRANSFER") {
    // event.transferred_from / transferred_to: move the entitlement between users.
    await db.transferEntitlement(event.transferred_from, event.transferred_to, "premium", at);
  }
  await db.markEvent(event.id);
  return new Response("ok", { status: 200 });
}
```

Notes:

- Return 200 for events you ignore, or RevenueCat retries them.
- Entitlement checks on the server read `active && (expires_at is null || expires_at > now())`.
- Log every event type you do not handle; new types appear over time. Check the current event list in the RevenueCat webhook docs.
- Test with RevenueCat's "send test event" and with real sandbox purchases.
