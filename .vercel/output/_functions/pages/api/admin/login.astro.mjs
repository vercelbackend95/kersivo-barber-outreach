import { g as getSessionSecret, c as createAdminSessionToken, a as getAdminSessionCookieName, b as getAdminSessionCookieOptions } from '../../../chunks/session_hyJLexXJ.mjs';
export { renderers } from '../../../renderers.mjs';

const prerender = false;
const POST = async ({ request, cookies }) => {
  const data = await request.json();
  const adminSecret = "supersecret123";
  const sessionSecret = getSessionSecret();
  if (!sessionSecret || data?.secret !== adminSecret) {
    return new Response(JSON.stringify({ error: "Invalid secret" }), { status: 401 });
  }
  const token = createAdminSessionToken(sessionSecret);
  cookies.set(
    getAdminSessionCookieName(),
    token,
    getAdminSessionCookieOptions(true)
  );
  return new Response(JSON.stringify({ ok: true }));
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
