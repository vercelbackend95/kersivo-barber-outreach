export const prerender = false;

import type { APIRoute } from "astro";
import { put } from "@vercel/blob";
import { requireAdmin } from "../../../../lib/admin/auth";
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;


function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
function extensionFromFile(file: File) {
  const fileName = file.name ?? "";
  const fromName = fileName.includes(".") ? fileName.split(".").pop()?.toLowerCase() : "";
  if (fromName) {
    return fromName;
  }

  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  if (file.type === "image/svg+xml") return "svg";
  return "bin";
}
export const POST: APIRoute = async (ctx) => {


  const unauthorized = requireAdmin(ctx);
  if (unauthorized) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }


  const blobToken = process.env.BLOB_READ_WRITE_TOKEN ?? import.meta.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    return jsonResponse({ error: "Missing BLOB_READ_WRITE_TOKEN in runtime." }, 500);
  }
  try {
    const contentType = ctx.request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return jsonResponse({ error: "Expected multipart/form-data." }, 400);

    }


    const form = await ctx.request.formData();
    const filePart = form.get("file") ?? form.get("image");
    if (!(filePart instanceof File) || filePart.size === 0) {
      return jsonResponse({ error: "Image file is required." }, 400);
    }


    if (!filePart.type.startsWith("image/")) {
      return jsonResponse({ error: "Only image/* files are allowed." }, 400);

    }


    if (filePart.size > MAX_IMAGE_SIZE_BYTES) {
      return jsonResponse({ error: "Image is too large. Maximum size is 5MB." }, 413);
    }

    const ext = extensionFromFile(filePart);
    const pathname = `products/${Date.now()}-${crypto.randomUUID()}.${ext}`;


    const blob = await put(pathname, filePart, {
      access: "public",
      contentType: filePart.type,

      token: blobToken,
      addRandomSuffix: false
    });

    return jsonResponse({ url: blob.url }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not upload image.";
    return jsonResponse({ error: message }, 500);


  }
};
