export async function onRequestPost(context) {
  const { request, env } = context;

  // Top-level safety net — ensures we ALWAYS return valid JSON, never an empty body
  try {
    return await handleRequest(request, env);
  } catch (unexpectedError) {
    console.error("Unexpected top-level error:", unexpectedError);
    return new Response(JSON.stringify({ error: "Unexpected server error: " + unexpectedError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

async function handleRequest(request, env) {
  // Parse request body
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid request body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

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
    return new Response(JSON.stringify({ error: "Server is not configured with an API Key." }), {
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
    9. Every place name across ALL days must be UNIQUE. Do NOT repeat the same attraction, restaurant, or location on different days.
    
    Output must be valid JSON (no markdown fences) with this exact structure:
    {
      "destination": "String",
      "tagline": "String (a captivating 1-sentence highlight of what this place is famous for and its iconic vibe)",
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

  // Candidate models in priority order
  const candidateModels = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.8-flash'];
  let geminiResponse = null;
  let geminiData = null;
  let lastError = null;

  for (const model of candidateModels) {
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        }
      );

      const rawText = await resp.text();
      if (!rawText || rawText.trim() === '') {
        lastError = `Empty response from ${model} (HTTP ${resp.status})`;
        continue;
      }

      const parsed = JSON.parse(rawText);
      if (resp.ok && parsed.candidates && parsed.candidates[0]?.content?.parts?.[0]?.text) {
        geminiResponse = resp;
        geminiData = parsed;
        break;
      } else {
        lastError = parsed?.error?.message || `HTTP ${resp.status} on ${model}`;
        // If 404 or 503, try next candidate model
        if (resp.status === 404 || resp.status === 503) {
          continue;
        }
        // Auth or bad request error: stop trying other models
        geminiResponse = resp;
        geminiData = parsed;
        break;
      }
    } catch (err) {
      lastError = err.message;
    }
  }

  if (!geminiData || !geminiData.candidates || !geminiData.candidates[0]) {
    const errMsg = geminiData?.error?.message || lastError || "Failed to reach Gemini API";
    console.error("Gemini API error after trying models:", errMsg);
    return new Response(JSON.stringify({ error: errMsg }), {
      status: geminiResponse?.status || 502,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Extract and parse the generated itinerary JSON
  try {
    const text = geminiData.candidates[0].content.parts[0].text;
    // Strip markdown code fences if present
    const jsonStr = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const itineraryData = JSON.parse(jsonStr);

    return new Response(JSON.stringify(itineraryData), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (extractError) {
    console.error("Failed to extract itinerary JSON from Gemini response:", extractError.message);
    return new Response(JSON.stringify({ error: "Gemini returned an invalid itinerary format. Please try again." }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
