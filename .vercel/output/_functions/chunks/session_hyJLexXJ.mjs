import { createHmac, timingSafeEqual } from 'node:crypto';

const THIRTY_DAYS_IN_SECONDS = 60 * 60 * 24 * 30;
const ADMIN_SESSION_COOKIE = "kersivo_admin_session";
function toBase64Url(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}
function fromBase64Url(value) {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return null;
  }
}
function signPayload(payload, secret) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}
function getSessionSecret() {
  return process.env.SERVER_SESSION_SECRET ?? "supersecret123" ?? process.env.ADMIN_SECRET ?? null;
}
function createAdminSessionToken(secret) {
  const exp = Math.floor(Date.now() / 1e3) + THIRTY_DAYS_IN_SECONDS;
  const payload = JSON.stringify({ exp });
  const encodedPayload = toBase64Url(payload);
  const signature = signPayload(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}
function verifyAdminSessionToken(token, secret) {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return false;
  const expectedSignature = signPayload(encodedPayload, secret);
  const providedBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  if (providedBuffer.length !== expectedBuffer.length) return false;
  if (!timingSafeEqual(providedBuffer, expectedBuffer)) return false;
  const payload = fromBase64Url(encodedPayload);
  if (!payload) return false;
  try {
    const parsed = JSON.parse(payload);
    if (!parsed.exp || typeof parsed.exp !== "number") return false;
    return parsed.exp > Math.floor(Date.now() / 1e3);
  } catch {
    return false;
  }
}
function getAdminSessionCookieOptions(isProduction) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: THIRTY_DAYS_IN_SECONDS,
    path: "/"
  };
}
function getAdminSessionCookieName() {
  return ADMIN_SESSION_COOKIE;
}

export { getAdminSessionCookieName as a, getAdminSessionCookieOptions as b, createAdminSessionToken as c, getSessionSecret as g, verifyAdminSessionToken as v };
