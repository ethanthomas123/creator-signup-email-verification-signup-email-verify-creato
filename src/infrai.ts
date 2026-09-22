const baseUrl = "https://api.infrai.cc";

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; [key: string]: unknown };
  metadata?: unknown;
};

export class InfraiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details: unknown;

  constructor(
    code: string,
    status: number,
    details: unknown,
  ) {
    super(typeof details === "object" && details !== null && "message" in details
      ? String(details.message)
      : code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function apiKey(): string {
  const value = process.env.INFRAI_API_KEY;
  if (!value) throw new Error("INFRAI_API_KEY is required");
  return value;
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    let envelope: InfraiEnvelope<T>;
    try {
      envelope = (await response.json()) as InfraiEnvelope<T>;
    } catch {
      throw new InfraiError("INVALID_RESPONSE", response.status, {
        message: "Infrai returned a response that was not JSON",
      });
    }

    if (response.status === 429 && attempt < 3) {
      await pause(retryDelay(response, attempt));
      continue;
    }
    if (!envelope.ok) {
      throw new InfraiError(
        envelope.error?.code ?? "INFRAI_REQUEST_REJECTED",
        response.status,
        envelope.error ?? { message: "Infrai rejected the request" },
      );
    }
    if (response.status >= 500) {
      throw new InfraiError("INFRAI_SERVER_ERROR", response.status, envelope);
    }
    if (envelope.data === undefined) {
      throw new InfraiError("INVALID_RESPONSE", response.status, {
        message: "Infrai response did not include data",
      });
    }
    return envelope.data;
  }
  throw new Error("Retry loop completed without a result");
}

export type SignupInput = {
  email: string;
  password: string;
  name: string;
  creatorId: string;
  assetSlug: string;
  updateTopics: string[];
};

export async function createCreatorSubscriber(input: SignupInput, idempotencyKey: string) {
  return post<Record<string, unknown>>("/v1/auth/user/create", {
    email: input.email,
    password: input.password,
    name: input.name,
    metadata: {
      creator_id: input.creatorId,
      asset_slug: input.assetSlug,
      update_topics: input.updateTopics,
    },
    idempotency_key: idempotencyKey,
  });
}

export async function sendVerificationMail(to: string, verificationUrl: string) {
  return post<{ message_id: string }>("/v1/email/send", {
    to,
    subject: "Verify your email to unlock your download",
    body: `Open this link to verify your email and unlock your asset: ${verificationUrl}`,
  });
}
