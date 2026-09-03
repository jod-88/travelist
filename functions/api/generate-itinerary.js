export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { destination, days, group, vibe, budget } = body;

    // Input validation
    if (!destination || !days || !group || !vibe || !budget) {
      return new Response(JSON.stringify({ errors: [{ msg: "All fields are required." }] }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (days < 1 || days > 14) {
      return new Response(JSON.stringify({ errors: [{ msg: "Duration must be between 1 and 14 days." }] }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const apiKey = env.GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Server is not configured with an API Key. Please use local data." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const prompt = `You are an expert travel planner. Create a travel itinerary to ${destination} for ${days} days for a ${group} trip. Travel style: ${vibe}. Budget tier: ${budget}.
    
    IMPORTANT RULES:
    1. Determine the country of ${destination} and set "currencyCode" (e.g., USD, JPY, EUR, GBP, IDR, THB, SGD, AUD, KRW) and "currencySymbol" (e.g., $, ¥, €, £, Rp, ฿, S$, A$, ₩) matching that country.
    2. All "estimatedCost" values for places MUST be given in that local currency (e.g. for Tokyo in JPY ¥, for Paris in EUR €, for Bali in IDR Rp, for New York in USD $).
    3. Never recommend illegal, dangerous, or permanently closed locations.
    4. Routes and travel times (durationMinutes, travelTimeToNext) must be realistic, accounting for distance and potential traffic.
    5. Use varied and realistic durationMinutes for each place. Do NOT use the same duration for every place.
    6. Write all descriptions in natural, friendly English.
    7. Categories must be one of: "Culture", "Culinary", "Nature", "Adventure", "Shopping", "Relaxation".
    8. Include 3-5 practical travel tips specific to ${destination}.
    
    Output must be valid JSON (no markdown fences) with this exact structure:
    {
      "destination": "String",
      "days": Number,
      "travelStyle": "String",
      "budget": "String",
      "groupType": "String",
      "currencyCode": "String",
      "currencySymbol": "String",
      "packingList": ["String", "String"],
      "travelTips": ["String", "String", "String"],
      "generatedDays": [
        {
          "dayNumber": Number,
          "places": [
            { "id": "uuid", "name": "String", "category": "String", "description": "String", "durationMinutes": Number, "estimatedCost": Number, "travelTimeToNext": Number, "planBName": "String" }
          ]
        }
      ]
    }
    Return only valid JSON, no additional text.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Failed to call Gemini API.");
    }

    const text = data.candidates[0].content.parts[0].text;
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();

    const itineraryData = JSON.parse(jsonStr);

    return new Response(JSON.stringify(itineraryData), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error generating itinerary:", error.message);
    return new Response(JSON.stringify({ error: "Failed to create itinerary: " + error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
