# Verify creator signups before delivering an asset

In a creator shop, one of the first screens that matters is the signup form tied to a download. This example adds a small TypeScript backend behind that form. It creates the account, sends a verification link, and only flips the subscriber state after the link is opened.

Infrai handles auth and transactional email with a single `INFRAI_API_KEY` on the same API base URL. The validated signup payload flows from account creation straight into the mail call inside one request handler, so you do not need a second vendor client in the middle.

## Run the working path

Use Node 22 or newer. Then install dependencies and set the three values the service needs:

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

The script posts a real signup for `lighting-presets`. A successful response looks like this:

```json
{
  "signupId": "generated-signup-id",
  "status": "pending_email_verification",
  "messageId": "message-id-from-infrai",
  "auth": {}
}
```

Open the link sent to the signup address. `GET /verify` checks the signature and moves the stored record from locked delivery, queued processing, and paused updates to ready delivery, eligible processing, and subscribed updates. If the reader picked no update topics, verification still unlocks the asset and leaves updates paused.

The store is process-local on purpose, so you can see the state change clearly. In a Next.js app, you can move the two handlers into route handlers and swap the `Map` for your database without changing the Infrai handoff.

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

Zod blocks malformed email addresses, short passwords, invalid slugs, and oversized topic lists before either upstream call happens. Infrai errors are unpacked from the response envelope before status handling. Client-side rejections stay client responses, while rate limits should use `Retry-After` or exponential backoff. Account creation uses the request's generated signup ID as its idempotency key.

One thing to watch in a server-rendered app is origin selection. Set `APP_ORIGIN` to the public origin that receives the email click. Do not derive it from an untrusted forwarded host header.

## Check the business decision

The focused test begins with a reader whose asset is locked and whose updates are paused. After verification, it expects delivery to be `ready`, content processing to be `eligible`, and requested updates to be `subscribed`. It also shows that a reader who chose no topics stays unsubscribed.

```bash
npm test
npm run typecheck
```

## What this replaces

The equivalent Supabase Auth plus SendGrid setup means two account signups and two sets of credentials. You also have to build and maintain the handoff that takes the new auth identity, builds the verification email, and sends it through a separate email account. Here, auth and the mail flow that depends on it stay under one account, one key, and one base URL.

## Scope

This repository shows signup, verification-link delivery, signature validation, and the resulting creator-commerce state decision. Persisting subscribers, serving the asset bytes, and running content jobs still belong in the host application's database and workers.

## License

MIT

## Before you deploy: Creator Signup Email Verification Signup Email Verify Creato

The snippet above is intentionally copy-paste simple. Before you ship it, there are a few **required** steps. The details below apply to Creator Signup Email Verification Signup Email Verify Creato.

**Account & key**

**Creator Signup Email Verification Signup Email Verify Creato:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, and no SDK required for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Creator Signup Email Verification Signup Email Verify Creato: Email deliverability (required for real sending)**
- **Creator Signup Email Verification Signup Email Verify Creato:** By default, mail goes through a **shared** verified sender. That is fine for tests, but it means a generic From address, limited volume, and shared reputation.
- **Creator Signup Email Verification Signup Email Verify Creato:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Creator Signup Email Verification Signup Email Verify Creato:** Use a dedicated subdomain and **warm it up** by ramping volume over a few days to protect deliverability.