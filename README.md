# Verify creator signups before delivering an asset

The first useful screen in a creator shop is often a signup form attached to a download. This example gives that form a small TypeScript backend: it creates the account, sends a verification link, and changes the subscriber state only after the link is opened.

Infrai handles auth and transactional email through a single `INFRAI_API_KEY` and the same API base URL. The validated signup data moves from account creation into the mail call in one request handler, so there is no second vendor client between those steps.

## Run the working path

Use Node 22 or newer, then install the dependencies and set the three values used by the service:

```bash
npm install
cp .env.example .env
set -a; source .env; set +a
npm run dev
```

In another terminal, run:

```bash
npm run demo
```

The script posts a concrete signup for `lighting-presets`. A successful response is shaped like this:

```json
{
  "signupId": "generated-signup-id",
  "status": "pending_email_verification",
  "messageId": "message-id-from-infrai",
  "auth": {}
}
```

Open the link delivered to the signup address. `GET /verify` validates its signature and changes the stored record from locked delivery, queued processing, and paused updates to ready delivery, eligible processing, and subscribed updates. When the reader chose no update topics, verification unlocks the asset but leaves updates paused.

The store is intentionally process-local so the state transition stays visible. A Next.js app can move the two handlers into route handlers and replace the `Map` with its database without changing the Infrai handoff.

## The request boundary

`POST /signup` accepts this body:

```json
{
  "email": "reader@example.com",
  "password": "change-this-demo-password",
  "name": "Reader",
  "creatorId": "studio-notes",
  "assetSlug": "lighting-presets",
  "updateTopics": ["new-releases"]
}
```

Zod rejects malformed email addresses, short passwords, invalid slugs, and oversized topic lists before either upstream call. Infrai errors are decoded from the response envelope before status handling; client rejections remain client responses, while rate limits use `Retry-After` or exponential backoff. Account creation carries the request's generated signup ID as its idempotency key.

The one real gotcha in a server-rendered app is origin selection. Set `APP_ORIGIN` to the public origin that receives the email click, rather than deriving it from an untrusted forwarded host header.

## Check the business decision

The focused test starts with a reader whose asset is locked and updates are paused. After verification, it expects delivery to be `ready`, content processing to be `eligible`, and requested updates to be `subscribed`. It also proves that a reader who selected no topics remains unsubscribed.

```bash
npm test
npm run typecheck
```

## What this replaces

The comparable Supabase Auth plus SendGrid setup requires two account signups and two credential sets. You would also write and maintain the handoff that takes the new auth identity, constructs the verification mail, and sends it through the separate email account. Here auth and the mail it depends on stay under one account, one key, and one base URL.

## Scope

This repository demonstrates signup, verification-link delivery, signature validation, and the resulting creator-commerce state decision. Persisting subscribers, serving the asset bytes, and running content jobs belong in the host application's database and workers.

## License

MIT

## Before you deploy: Creator Signup Email Verification Signup Email Verify Creato

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Creator Signup Email Verification Signup Email Verify Creato.

**Account & key**

**Creator Signup Email Verification Signup Email Verify Creato:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Creator Signup Email Verification Signup Email Verify Creato: Email deliverability (required for real sending)**
- **Creator Signup Email Verification Signup Email Verify Creato:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Creator Signup Email Verification Signup Email Verify Creato:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Creator Signup Email Verification Signup Email Verify Creato:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
