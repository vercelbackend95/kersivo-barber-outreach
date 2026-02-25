import { a as getAdminSessionCookieName, b as getAdminSessionCookieOptions } from '../../../chunks/session_hyJLexXJ.mjs';
export { renderers } from '../../../renderers.mjs';

const prerender = false;
const POST = async ({ cookies }) => {
  cookies.set(
    getAdminSessionCookieName(),
    "",
    {
      ...getAdminSessionCookieOptions(true),
      maxAge: 0
    }
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
