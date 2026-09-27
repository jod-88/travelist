/**
 * /api/gemini-key — Relay endpoint that exposes the server-side Gemini API key
 * to client-side callGeminiDirect() when the main /api/generate-itinerary fails.
 */
export async function onRequestGet(context) {
  const { env } = context;
  const apiKey = env.GEMINI_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "No API key configured" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ key: apiKey }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate"
    }
  });
}
