import { r as requireAdmin } from '../../../../../chunks/auth_gRvu2ZyE.mjs';
import '../../../../../chunks/client_C4jvTHHS.mjs';
export { renderers } from '../../../../../renderers.mjs';

const prerender = false;
const POST = async (ctx) => {
  const unauthorized = requireAdmin(ctx);
  if (unauthorized) return unauthorized;
  {
    return new Response(JSON.stringify({ error: "Demo data generation is available only in DEV." }), { status: 403 });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
