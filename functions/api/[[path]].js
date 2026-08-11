// Same-origin API bridge for Cloudflare Pages. The service binding invokes the
// salaryflow-api Worker directly without exposing a cross-origin cookie flow.
export async function onRequest(context) {
  if (!context.env.API) {
    return Response.json(
      { error: "API service binding is unavailable", code: "API_UNAVAILABLE" },
      { status: 503 },
    );
  }
  try {
    return await context.env.API.fetch(context.request);
  } catch (error) {
    console.error("API service binding failed", error);
    return Response.json(
      { error: "API temporarily unavailable", code: "API_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
