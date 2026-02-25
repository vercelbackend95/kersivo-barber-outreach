import { g as getSessionSecret, a as getAdminSessionCookieName, v as verifyAdminSessionToken } from './session_hyJLexXJ.mjs';

function isAdminAuthorized(context) {
  const secret = "supersecret123";
  const sessionSecret = getSessionSecret();
  const cookieToken = context.cookies.get(getAdminSessionCookieName())?.value;
  if (cookieToken && sessionSecret && verifyAdminSessionToken(cookieToken, sessionSecret)) {
    return true;
  }
  const header = context.request.headers.get("x-admin-secret");
  return header === secret;
}
function requireAdmin(context) {
  if (!isAdminAuthorized(context)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  return null;
}

export { requireAdmin as r };
