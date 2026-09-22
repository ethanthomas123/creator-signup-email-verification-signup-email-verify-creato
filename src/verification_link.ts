import { createHmac, timingSafeEqual } from "node:crypto";

type VerificationClaims = {
  signupId: string;
  expiresAt: number;
};

function secret(): string {
  const value = process.env.VERIFY_LINK_SECRET;
  if (!value || value.length < 16) {
    throw new Error("VERIFY_LINK_SECRET must be at least 16 characters");
  }
  return value;
}

function signature(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createVerificationToken(signupId: string, now = Date.now()): string {
  const claims: VerificationClaims = { signupId, expiresAt: now + 30 * 60 * 1_000 };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function readVerificationToken(token: string, now = Date.now()): VerificationClaims {
  const [payload, suppliedSignature] = token.split(".");
  if (!payload || !suppliedSignature) throw new Error("Invalid verification token");
  const expected = Buffer.from(signature(payload));
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    throw new Error("Invalid verification token");
  }
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as VerificationClaims;
  if (claims.expiresAt < now) throw new Error("Verification token has expired");
  return claims;
}
