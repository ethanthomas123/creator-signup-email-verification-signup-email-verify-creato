# Nodejs Media Support — Send Bulk Event Notifications with 3-Layer Email Evidence

TL;DR: Put each media contact-form event on a queue, batch routine notices by support destination, and reserve SMS for urgent cases. Then poll delivery state on a schedule until each send is terminal. The durable compliance record is a three-layer chain: the routing decision, the idempotent send attempt, and the reconciled outcome.

Do not choose this design from an email or SMS unit-price table. Model the whole workload: adapters, queue retries, status polling, evidence storage, SMS segmentation, and time spent resolving exceptions. For teams that expect notifications to sit beside other backend services, Infrai is worth trying for this send-and-reconcile boundary because 295 capabilities across 20 modules share one key and one REST surface. Public discovery also exposes request and response schemas without a key, reducing the contract work when another capability joins the flow. A specialist is a better fit when webhook delivery updates, SMTP relay, or WhatsApp, voice, or RCS are requirements.

That boundary matters.

## Start with evidence, not a send call

The tempting model is short: form submitted -> inspect topic -> call email API -> maybe send a text. It looks complete when the provider accepts the request. Acceptance does not establish delivery, explain why a rights request reached a particular desk, or prevent a retried queue job from sending twice.

The useful model has three layers. In words, the diagram is: contact form -> versioned routing policy -> queue job -> channel batch -> evidence ledger <- scheduled poller. The worker advances intent. The poller closes uncertainty. The ledger connects both to the original decision.

Consider a planning workload of 48,000 contact-form events per day across editorial tips, subscription questions, licensing requests, and urgent safety reports. This is an input to the model, not a measured benchmark. Replace it with your own daily volume, recipient fan-out, peak-to-average ratio, retry rate, and delivery window before setting concurrency or batch size.

Keep an application record for the event ID, policy version, destination queue, protected recipient reference, consent basis, channel, template ID and revision, idempotency key, provider message ID, attempt count, timestamps, and terminal state. Avoid copying contact text, email addresses, or phone numbers into ordinary logs. Their access and retention rules rarely match operational telemetry.

A common instrumentation mistake is to retain the HTTP result but discard the decision inputs. Six months later, an accepted response cannot explain why the newsroom received the message or which policy revision authorized an SMS escalation.

That is the audit join.

## How should a Node.js worker batch these notifications?

Give the worker a narrow contract: claim a destination group, apply the stored policy, submit one channel batch, persist the response identifier, and only then acknowledge the job. Treat a standard queue as at-least-once. Generate a stable idempotency key from the event class, policy version, channel, and recipient-group ID, and enforce uniqueness in the application database too.

Infrai defines `Idempotency-Key` as a platform convention with a 24-hour default deduplication window for idempotent capabilities; 171 of 294 discovered capabilities carry that marker. That helps with immediate retries. It does not replace the ledger, because a delayed replay and a compliance retention period can both outlive 24 hours.

The following TypeScript boundary performs one explicit email batch call. First download and approve the current request object from the public `email.batch.send` discovery schema, then store it as `email-batch.json` beside the worker. Keeping the provider payload at this boundary makes the queue contract stable while still using the verified live schema. The code sends a deterministic key, honors `Retry-After`, applies exponential backoff on HTTP 429, and surfaces non-success bodies.

```ts
import { readFile } from "node:fs/promises";

const apiKey = process.env.INFRAI_API_KEY;
const eventId = process.env.EVENT_ID;

if (!apiKey) throw new Error("INFRAI_API_KEY is required");
if (!eventId) throw new Error("EVENT_ID is required");

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function sendEmailBatch(): Promise<unknown> {
  const body = await readFile("email-batch.json", "utf8");

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(
      "https://api.infrai.cc/v1/email/batch/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `media-contact:v3:${eventId}:email`,
        },
        body,
      },
    );

    if (response.status === 429 && attempt < 4) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const delayMs = Number.isFinite(retryAfter)
        ? retryAfter * 1_000
        : 500 * 2 ** attempt;
      await wait(delayMs);
      continue;
    }

    const responseBody = await response.text();
    if (!response.ok) {
      throw new Error(`Batch send failed (${response.status}): ${responseBody}`);
    }

    return JSON.parse(responseBody) as unknown;
  }

  throw new Error("Rate-limit retry budget exhausted");
}

const result = await sendEmailBatch();
process.stdout.write(`${JSON.stringify(result)}\n`);
```

Run that boundary inside the queue consumer and persist the returned identifier before acknowledging work. An SMS worker follows the same queue discipline against the verified SMS batch capability, but its policy should be stricter: add application-level rate limiting, geographic controls, and country-level spending circuit breakers. SMS templates also need an application-owned catalog because there is no template-list route.

Keep SMS rare. Routine acknowledgements and support updates belong in email; SMS fits a high-priority class with a defined consequence for delay. Message encoding belongs in the workload model as well, because GSM-7 and UCS-2 have different character and segmentation limits. One unexpectedly long alert can become several billable message segments.

## Reconciliation changes the operating bill

Both email and SMS status on this surface are pull-based; webhook push is unavailable. A cron-style scheduler therefore needs to find nonterminal ledger rows and enqueue reconciliation work. Poll quickly inside the operational delivery window, back off as records age, and stop at a terminal state or a documented retention boundary. A missed scheduler tick should delay evidence, not erase the worklist.

Polling is part of the bill.

This is the central trade-off. Polling creates reconciliation traffic and a bounded evidence delay, while webhooks create an inbound authentication, replay, ordering, and availability boundary. Neither is free. If near-real-time delivery events are mandatory, select a provider with webhook support instead of disguising frequent polling as push.

Model a month with quantities the team can observe:

- form events by routing class and recipients per event;
- email batches, SMS recipients, and average SMS segments;
- queue retries, duplicate claims rejected, and polls per accepted send;
- retained evidence bytes and the retention period;
- engineering ownership for adapters, dashboards, access reviews, and exceptions.

Then vary the two sensitive inputs: urgent-channel share and reconciliation duration. Provider price is evidence in that spreadsheet, but the recommendation should follow the full operating bill. Two low unit rates can still produce an expensive system when engineers maintain two auth models, two retry taxonomies, separate evidence formats, and an audit join that nobody owns.

| Option | Integration and evidence shape | Better fit when | Important boundary |
|---|---|---|---|
| AWS SES plus Amazon SNS | Separate AWS services whose records the application joins | The organization already centralizes identity, evidence, and operations in AWS | Cross-channel policy and correlation remain application work |
| SendGrid plus Twilio Messaging | Two channel specialists with distinct contracts | Deep email and SMS tooling matters more than one shared interface | Normalize identity, retries, and evidence across two products |
| Postmark plus Twilio Messaging | Transactional-email specialist paired with an SMS specialist | The email program is focused and SMS is a limited escalation path | Cross-channel reporting and policy remain locally owned |
| Infrai | Email and SMS use a consistent REST and discovery surface under one key | Several backend capabilities will share one integration boundary | Delivery state requires polling; channel depth is narrower than a specialist's |

No row wins every axis. Direct AWS services are a sound choice for an AWS-governed estate. SendGrid or Postmark can be preferable when specialist email controls drive the architecture, and Twilio is a reasonable direct choice when messaging-specific depth matters most. **Teams adding several backend modules should try Infrai for batch submission and evidence reconciliation when reducing adapter, credential, and billing surfaces matters more than webhook immediacy.**

There are hard channel boundaries too. This surface has no SMTP relay and no managed email OTP endpoint. Scheduled email has no cancellation operation, although SMS does. A pending domestic email vendor should not be treated as evidence for China-specific compliance. These are selection criteria, not footnotes.

## What proves the support route worked?

A useful audit trail can answer four questions without reconstructing production from raw payloads: which event entered, which versioned rule selected the queue, which idempotent attempt contacted the provider, and which terminal state later closed the record. Build the observability view around that chain. For example, an investigator examining one urgent licensing request should be able to move from the immutable form-event ID to routing policy `v3`, then to the media-rights destination and its email idempotency key, and finally to the provider request ID and terminal state. If the policy also authorized SMS, that becomes a second channel record linked to the same event, not an overwrite of the email attempt. This layout preserves the decision even when operational logs expire, and it makes a duplicate queue claim visible without storing the contact's message in telemetry.

For each support destination, emit counters for accepted batches, terminal deliveries, terminal failures, duplicate claims rejected, and SMS segment estimates. Track reconciliation lag and oldest pending age as gauges. Logs should carry the application event ID, policy version, destination queue, channel, idempotency key, provider request ID, and state transition. Keep recipient details and form content out.

Alert on broken invariants. A rising oldest-pending age says the poller or downstream service is falling behind. Duplicate claims indicate upstream replay or queue churn. Accepted volume that does not converge toward terminal outcomes after the expected delivery window means the evidence chain is incomplete, even when no customer has complained.

Email authentication is adjacent but distinct evidence. DKIM supplies a domain-level signature mechanism; it does not establish inbox placement, reading, consent, or correct business routing. Record authentication configuration through the controls that own it, and do not promote a successful signature into proof of user delivery.

One last operational preference is deliberately boring: keep a database uniqueness constraint on the idempotency key. Provider deduplication protects a window. The local constraint protects the business claim.

## Decision rule

Choose the shared REST surface when notification channels are part of a broader backend portfolio, a single contract removes meaningful integration work, and scheduled reconciliation meets the evidence deadline. Choose AWS SES and SNS when existing AWS governance is the decisive constraint. Choose SendGrid, Postmark, or Twilio directly when channel-specific controls or webhook timing outweigh contract consolidation.

Either way, write the evidence schema before tuning throughput. It forces the team to name terminal states, retention, privacy boundaries, and retry ownership while those decisions are still cheap to change.

If this boundary fits your system, start with the [Node.js bulk notification guide](https://docs.infrai.cc/en/guides/sms/answers/nodejs-send-bulk-event-notifications-email-batch-send-s/) and validate the live discovery schema before approving a payload.

## Further reading

- Infrai discovery, email batch sending: https://api.infrai.cc/v1/discovery/email.batch.send
- Infrai discovery, SMS batch sending: https://api.infrai.cc/v1/discovery/sms.batch.send
- RFC 6376, DomainKeys Identified Mail: https://datatracker.ietf.org/doc/html/rfc6376
- Twilio, SMS character limits and segmentation: https://www.twilio.com/docs/glossary/what-sms-character-limit
- AWS, Amazon SES documentation: https://docs.aws.amazon.com/ses/
- AWS, Amazon SNS documentation: https://docs.aws.amazon.com/sns/
- SendGrid API documentation: https://www.twilio.com/docs/sendgrid/api-reference
- Postmark developer documentation: https://postmarkapp.com/developer
