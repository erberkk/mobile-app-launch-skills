---
name: social-publishing
description: Use when setting up scheduled publishing of an app's marketing content to Instagram (Reels, carousels, Stories), Threads, X and TikTok through official APIs - self-hosting Postiz in Docker behind a Cloudflare Tunnel, creating the Meta app with the newer use-case flow (business portfolio, Facebook Page linked to the Instagram professional account, Threads tester invite), X developer pay-per-use credits and spend cap, TikTok and YouTube audit limits, safe OAuth account selection when one browser holds personal and brand accounts, resource limits, and a content calendar split into pre-launch and post-launch phases.
---

# Social publishing

## Purpose

Post the launch content on a schedule from one place, through each platform's official API, without losing a personal account to the brand or the brand to a personal account. The tool here is [Postiz](https://github.com/gitroomhq/postiz-app) (open source, self-hosted); the platform steps apply to any scheduler.

## Prerequisites

- Brand accounts already created: Instagram **professional** account, Threads profile (comes from Instagram), X account, optionally TikTok.
- A domain on Cloudflare (for the tunnel hostname), Docker Desktop, a machine that stays on at posting times (or a small VPS).
- The `console-automation` setup if consoles are driven from a browser.
- A content calendar (see "Calendar" below). Publishing tooling does not fix weak content.

## Platform reality (check again before you start; these change)

| Platform | Official route | What blocks you |
|---|---|---|
| Instagram | Meta app + Facebook Login, IG professional account **linked to a Facebook Page** | New Meta apps get the "Unified login" Instagram setup, which requires a **business portfolio**; the older Instagram-Login-only setup is "not available for newer apps". Stories publish as plain media: no poll, link or countdown stickers via API. |
| Threads | Meta app with the Threads use case | Until App Review, only accounts with the **Threads Tester** role can connect; the tester accepts in Threads › Settings › Account › Website permissions › Invites. |
| X | Developer account, pay-per-use credits (no free tier for new developers since 2026) | Needs a payment method; set a **monthly spend cap**. |
| TikTok | Content Posting API | Unaudited apps post **private only** until the audit passes (weeks). New accounts need **phone verification**, and one number can belong to only one account. |
| YouTube | Data API upload | Unverified API projects upload as **private** until a compliance audit. |

Plan around the blockers: start audits early, post TikTok/YouTube natively (TikTok Studio, YouTube Studio schedulers) until audits pass, or drop the platform.

## Procedure

### 1. Self-host Postiz (Docker)

1. Start from the official `postiz-docker-compose` file. Before `up`:
   - **Remove services you don't need** and any that bind ports already in use on the machine (the upstream file binds the Temporal UI to `127.0.0.1:8080`).
   - **Drop Elasticsearch**: set Temporal `ENABLE_ES=false` and `SKIP_ADD_CUSTOM_SEARCH_ATTRIBUTES=true` (SQL visibility). Postiz only registers two keyword attributes. If Temporal was first started with ES, its database still holds the default text attributes and Postiz fails with "cannot have more than 3 search attribute of type Text": recreate the Temporal database volume before anything is scheduled.
   - Bind Postiz to `127.0.0.1` only; set `MAIN_URL`, `FRONTEND_URL`, `NEXT_PUBLIC_BACKEND_URL` to the public HTTPS hostname.
   - Put secrets (`JWT_SECRET`, tunnel token, app keys) in a git-ignored `.env`, referenced as `${VAR}` in the compose file.
   - Add `mem_limit`/`cpus` per service. Postiz itself (frontend, backend, orchestrator in one container) needs about 1.5 GB; give it 2 GB so it doesn't hit the cap. On Windows also cap the WSL VM in `%USERPROFILE%\.wslconfig` (`memory=4GB`, `processors=4`, `autoMemoryReclaim=gradual`), then `wsl --shutdown` and restart Docker Desktop.
2. Create the first account in the browser **after the page has hydrated** (an unhydrated form submits as GET and puts the password in the URL). Then set `DISABLE_REGISTRATION=true` and restart.
3. Keep `restart: always` and enable "start Docker Desktop at sign-in"; disable sleep if the machine is the scheduler.

### 2. Public hostname (Cloudflare Tunnel)

- Create a remotely managed tunnel (API: `POST /accounts/{id}/cfd_tunnel` with `config_src: cloudflare`, `PUT .../configurations` with the ingress rule, a proxied `CNAME` to `<tunnel-id>.cfargotunnel.com`, `GET .../token`).
- Run `cloudflared` as a service in the same compose network and point the ingress at `http://postiz:5000`, not `localhost`.
- **APPROVAL**: a tunnel exposes a local service to the internet; ask before creating it. Optionally add Cloudflare Access in front (needs Zero Trust enabled on the account; keep `/uploads` reachable for Meta's media fetch).

### 3. Meta (Instagram + Threads)

1. Create a **separate** Meta app for publishing (don't add use cases to an app that already powers an in-app feature such as Instagram Stories sharing). Use cases: "Manage messaging & content on Instagram" and "Access the Threads API".
2. Instagram:
   - Create a **business portfolio** when the use case asks for one (free; name, owner name, business email). Verification is only needed for other people's data and App Review.
   - Create a **Facebook Page** for the brand (also required for Meta ads) and link the Instagram professional account to it: Page settings › Linked accounts › Instagram › Connect. The OAuth pop-up logs in with whatever Instagram account the browser holds: **read the "Log in as …" name; if it is a personal account, switch accounts first** (connecting a personal account converts it to professional).
   - In the Instagram use case add exactly the scopes the scheduler requests (Postiz: `instagram_basic`, `pages_show_list`, `pages_read_engagement`, `business_management`, `instagram_content_publish`, `instagram_manage_comments`, `instagram_manage_insights`). Set the Facebook Login for Business redirect URI to the scheduler's callback (Postiz: `/integrations/social/instagram`).
   - App ID + secret (App settings › Basic; showing the secret asks for the Facebook password) → `FACEBOOK_APP_ID/SECRET`.
3. Threads: add `threads_basic`, `threads_content_publish`, `threads_manage_replies`, `threads_manage_insights`; set redirect (`/integrations/social/threads`) plus uninstall/delete callback URLs; take the separate **Threads app ID/secret**; add the brand profile as **Threads Tester** and accept the invite on the phone.
4. If the Threads consent URL lands on the Threads home page instead of the consent screen, the browser session lives on `threads.com` while the scheduler uses `threads.net`: open the same URL on `threads.com`.
5. If the browser is currently acting as the Page (after editing it), the Facebook consent first shows "You need to switch to <your name>"; continue as the person, not the Page.
6. During the Facebook consent, Meta defaults to "all current and future Pages/Businesses/Instagram accounts". On an account that manages other brands, choose "current only" and pick the brand's assets.

### 4. X

1. Developer Console onboarding: account name, a precise use-case description (own account only, no data resale, no automated likes/follows/DMs), accept terms.
2. Buy the smallest credit pack; **leave auto-recharge off; set Billing Cycle Cap** (e.g. $5). New accounts may also get free credits; the dashboard total can lag behind the Credits page.
3. App › User authentication settings: **Read and write**, "Web App, Automated App or Bot", callback = scheduler callback (Postiz: `/integrations/social/x`), website, terms and privacy URLs. Save shows the OAuth 2.0 client secret once.
4. Postiz uses OAuth 1.0a: regenerate the **Consumer Key** and copy key + **"Consumer Key Secret"** (that exact label) once → `X_API_KEY/X_API_SECRET`.
5. Authorizing: tick "I trust this app", confirm the screen shows the brand handle, then Authorize.

### 5. TikTok (optional)

Account:
- New accounts require phone verification and a number can sit on one account only; a web sign-up may end on "continue in the app". Options: a second number for brand accounts, or converting an existing personal account (new username and display name, profile photo, bio; archive/privatize old personal videos).
- In some regions the one-tap "Switch to Business Account" is gone; the menu offers "Become a Verified Business Account", which asks for company documents. A personal account is enough: TikTok Studio scheduling, analytics, Spark Ads and the Content Posting API all work with it. The business music library is the main loss.
- Username can change once per 30 days, display name once per 7 days. Web profile (name, bio, photo, counts) can lag the app by a day or more; trust the app.
- Account region is set at sign-up from SIM/IP and can't be changed in settings. Don't fake it (VPN/foreign SIM). Reach comes mostly from language, captions, hashtags and who engages; use ad targeting for country focus.
- Bio links on personal accounts unlock only after about 1,000 followers.

Developer app (for the scheduler):
- developers.tiktok.com sign-up shows only "Enterprise developer" (email + code + password), but when creating the app you can pick **Individual** ownership, so no company is needed to start.
- Create the app, then a **Sandbox**: basic info (icon 1024², category, description ≤120 chars, terms/privacy URLs, Web platform URL), products **Login Kit** (Web redirect URI = scheduler callback; Postiz `/integrations/social/tiktok`) and **Content Posting API** (turn on Direct Post), and **all scopes the scheduler requests**. Postiz asks for `user.info.basic`, `user.info.profile`, `user.info.stats`, `video.list`, `video.upload`, `video.publish`; a missing one shows "Something went wrong … correct the following: scope" on the consent page. Click "Apply changes" after every edit.
- Add the brand account as a Sandbox **Target user** (the login pop-up accepts a QR scan from the phone app). Use the sandbox client key/secret in the scheduler.
- Push-by-file needs no domain verification; pull-by-URL does.
- Before the audit: `UPLOAD` mode sends the video to the account's TikTok inbox as a draft (publish from the phone within 24 h; max 5 pending per 24 h). `DIRECT_POST` works but posts privately only. Submit the production app for review with a demo video for public direct posting.
- The consent step can ask "Verify it's really you" with an email code. After many account changes in one day (email, name, bio, new logins) TikTok rate-limits these codes ("Maximum number of attempts reached"): stop and retry the next day instead of hammering it.

### 6. Verify

- Scheduler channel list shows each brand account (name/handle), none disabled.
- Post one private/low-stakes test per platform, or a draft, before the calendar starts.
- Resource usage after a day: `docker stats --no-stream`.

## Calendar

- Split into phases keyed to real events, not a fixed date: **pre-launch** (no "download now", no price), **iOS launch day**, **iOS-only** (CTA says Android soon; store links route per platform), **Android launch**, **both live**. Store review dates move; re-anchor the calendar when they do.
- One video per day can go to Reels, TikTok and Shorts with platform captions; upload the clean master everywhere (never a downloaded TikTok with watermark).
- Don't mirror the same text on X and Threads; rotate themes so no message repeats more than once a week; keep claims checked against the shipped app (streaks, minimum calories, what a free account gets).
- Video bar: a hook in the first second, a cut every 1–2 s, kinetic captions, sound effects, a story (problem → twist → app), varied endings. A static screen with a voiceover underperforms.
- Stories with polls/links/countdowns are posted by hand in the app.

## Decision points needing human approval

Creating brand accounts, business portfolio, Facebook Page; exposing a local service through a tunnel; buying API credits and the spend cap; which personal accounts may never be connected; converting a personal account; deleting Docker volumes or data.

## Common pitfalls

- Connecting the personal Instagram account because the OAuth pop-up reused the browser's session.
- Assuming the old Instagram-Login setup exists on a new Meta app.
- Adding publishing use cases to the Meta app that ships inside the mobile app.
- Elasticsearch left in the stack (≈700 MB RAM) when Temporal SQL visibility is enough.
- The upstream compose file grabbing a port already used by another local service.
- X key saved from the wrong label ("Consumer Key Secret", not the dialog title).
- Calendar written as if the app were live on both stores on day 1.
- Doing all TikTok account changes and the developer connection on the same day, which trips the verification-code rate limit.
- Comment-to-DM link automation ("comment KIVO and I'll DM you the link") before there is an audience or a live store link. Add it after launch on the best-performing Reels via a Meta-approved tool; it needs the Instagram messaging permission.
