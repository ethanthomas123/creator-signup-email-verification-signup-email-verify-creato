import { createServer, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createCreatorSubscriber, InfraiError, sendVerificationMail } from "./infrai.ts";
import { pendingSubscriber, verifySubscriber, type SubscriberState } from "./subscriber_state.ts";
import { createVerificationToken, readVerificationToken } from "./verification_link.ts";

const signupBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
  creatorId: z.string().min(1).max(100),
  assetSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  updateTopics: z.array(z.string().min(1).max(80)).max(10).default([]),
});

const subscribers = new Map<string, SubscriberState>();

function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}

async function bodyOf(request: AsyncIterable<Uint8Array>): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", process.env.APP_ORIGIN ?? "http://localhost:3000");
    if (request.method === "POST" && url.pathname === "/signup") {
      const input = signupBody.parse(await bodyOf(request));
      const signupId = randomUUID();
      const createdAccount = {
        auth: await createCreatorSubscriber(input, signupId),
        recipient: input.email,
      };
      subscribers.set(signupId, pendingSubscriber(input));

      const token = createVerificationToken(signupId);
      const verificationUrl = new URL(`/verify?token=${encodeURIComponent(token)}`, url.origin).toString();
      const mail = await sendVerificationMail(createdAccount.recipient, verificationUrl);
      json(response, 202, {
        signupId,
        status: "pending_email_verification",
        messageId: mail.message_id,
        auth: createdAccount.auth,
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/verify") {
      const token = url.searchParams.get("token");
      if (!token) {
        json(response, 400, { error: "token is required" });
        return;
      }
      const { signupId } = readVerificationToken(token);
      const pending = subscribers.get(signupId);
      if (!pending) {
        json(response, 404, { error: "signup not found" });
        return;
      }
      const verified = verifySubscriber(pending);
      subscribers.set(signupId, verified);
      json(response, 200, { signupId, subscriber: verified });
      return;
    }

    json(response, 404, { error: "route not found" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      json(response, 400, { error: "invalid request", issues: error.issues });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      json(response, status, { error: error.code, message: error.message });
      return;
    }
    json(response, 400, { error: error instanceof Error ? error.message : "request failed" });
  }
});

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, () => console.log(`Creator signup service listening on http://localhost:${port}`));
}
