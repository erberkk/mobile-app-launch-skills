// Slack incoming-webhook sender with escaping and de-duplication (Deno / edge-function style).
// Secrets: SLACK_WEBHOOK_ALERT, SLACK_WEBHOOK_GROWTH, SLACK_WEBHOOK_PREMIUM (server-side only).
type Channel = "alert" | "growth" | "premium";

const HOOKS: Record<Channel, string | undefined> = {
  alert: Deno.env.get("SLACK_WEBHOOK_ALERT"),
  growth: Deno.env.get("SLACK_WEBHOOK_GROWTH"),
  premium: Deno.env.get("SLACK_WEBHOOK_PREMIUM"),
};

// Slack mrkdwn escaping for any text that may come from users or third parties.
export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Remove obvious PII before anything leaves the server.
export const scrub = (s: string) => s
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "<email>")
  .replace(/\+\d[\d\s().-]{7,}\d/g, "<phone>")            // international format
  .replace(/\d{10,}/g, "<number>")                     // long digit runs (phones, card-like numbers)
  .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "<ip>")
  .replace(/\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{0,4}\b/gi, "<ip>")
  .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, "<jwt>");

/**
 * Posts once per `key` per `windowMinutes` (dedupe store: any KV/table with TTL).
 * `seen` should atomically set the key and return true if it already existed.
 */
export async function notify(
  channel: Channel,
  title: string,
  lines: string[],
  opts: { key?: string; windowMinutes?: number; seen?: (key: string, ttlSec: number) => Promise<boolean> } = {},
) {
  const url = HOOKS[channel];
  if (!url) return;                                   // not configured: never throw from alerting
  if (opts.key && opts.seen && (await opts.seen(`${channel}:${opts.key}`, (opts.windowMinutes ?? 60) * 60))) return;
  const text = `*${esc(scrub(title))}*\n` + lines.map((l) => "• " + esc(scrub(l))).join("\n");
  try {
    await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
  } catch (_) {
    // Swallow: alerting must not break the request that triggered it.
  }
}

// Example:
// await notify("alert", "AI daily ceiling reached", [`user ${hashId(userId)}`, `cost today $${cost.toFixed(2)}`, "action: none needed unless repeated"],
//   { key: `ceiling:${hashId(userId)}:${today}`, windowMinutes: 24 * 60, seen });
