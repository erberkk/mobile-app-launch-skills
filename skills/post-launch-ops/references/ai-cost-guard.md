# AI cost guard: schema and handler sketch

## Table

```sql
create table if not exists ai_usage_daily (
  user_id    uuid not null,
  day        date not null,
  requests   int not null default 0,
  cost_usd   numeric(10,5) not null default 0,
  primary key (user_id, day)
);

-- Atomic add; returns the new totals so the caller can enforce ceilings.
create or replace function ai_usage_add(p_user uuid, p_requests int, p_cost numeric)
returns table(requests int, cost_usd numeric) language sql as $$
  insert into ai_usage_daily(user_id, day, requests, cost_usd)
  values (p_user, current_date, p_requests, p_cost)
  on conflict (user_id, day) do update
    set requests = ai_usage_daily.requests + excluded.requests,
        cost_usd = ai_usage_daily.cost_usd + excluded.cost_usd
  returning ai_usage_daily.requests, ai_usage_daily.cost_usd;
$$;
```

Restrict execution of the function to the server role.

## Handler sketch (streaming)

```ts
const PRICE = { small: { in: 0, out: 0 }, large: { in: 0, out: 0 } }; // USD per token: fill from the provider's current price list

async function* handleChat(user, req) {   // async generator: yields stream events to the client
  const today = await db.usageToday(user.id);
  const limits = await planLimits(user);               // per plan: daily requests, daily cost, monthly budget
  if (today.requests >= limits.dailyRequests || today.cost >= limits.dailyCost) return yield tooMany(user, today);
  if (await monthlySpent(user) >= limits.monthlyBudget) return yield* degrade(user, req);   // cheaper model / fewer requests

  // Reserve the request up front, so parallel requests can't all pass the check.
  await db.rpc("ai_usage_add", { p_user: user.id, p_requests: 1, p_cost: 0 });

  let usage = { input: 0, output: 0 }, model = pickModel(req);
  try {
    for await (const ev of provider.stream({ model, messages: req.messages })) {
      if (ev.usage) usage = mergeUsage(usage, ev.usage);   // providers report usage at start and/or end
      yield ev;                                           // forward to client
    }
  } finally {
    // Runs on success, error AND client abort: aborted streams still cost money.
    const cost = usage.input * PRICE[model].in + usage.output * PRICE[model].out;
    await db.rpc("ai_usage_add", { p_user: user.id, p_requests: 0, p_cost: cost });
    if (model === "large") notify("alert", "Large-model escalation", [`reason ${req.escalationReason}`, `cost $${cost.toFixed(4)}`]);
  }
}
```

Notes:

- If the provider reports output tokens only at the end, estimate output tokens from streamed characters when aborted, and mark the row as estimated.
- Guests (no account): key limits by a salted hash of the IP plus install ID, with a small daily cap.
- Daily job: `sum(cost_usd)` by plan vs revenue by plan; alert when cost per paying user crosses your threshold.
