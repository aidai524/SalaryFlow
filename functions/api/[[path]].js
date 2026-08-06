// Same-origin API bridge for Cloudflare Pages. The service binding invokes the
// salaryflow-api Worker directly without exposing a cross-origin cookie flow.
export function onRequest(context) {
  if (!context.env.API) {
    return new Response("API service binding is unavailable", { status: 503 });
  }
  return context.env.API.fetch(context.request);
}
