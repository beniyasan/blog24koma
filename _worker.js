// Simple forwarder for Cloudflare Pages Functions
export async function onRequest(context) {
  // Let Pages Functions handle the request
  return context.next();
}
