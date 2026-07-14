import type { APIRoute } from 'astro';
import { auth } from '@/lib/auth';

export const prerender = false;

const handle: APIRoute = async (ctx) => auth.handler(ctx.request);

export const ALL = handle;
export const GET = handle;
export const POST = handle;
