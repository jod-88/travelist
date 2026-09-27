// ai.js - Handles Gemini API interaction (Cloudflare Pages Function, Direct Client Gemini API, or Smart Fallback)

const DEFAULT_GEMINI_KEY = '';

async function fetchLocalData() {
  const res = await fetch('data/data.json');
  if (!res.ok) throw new Error("Failed to fetch local data.");
  return await res.json();
}

/**
 * Safely extracts JSON from an LLM response string.
 */
function extractJsonFromText(rawText) {
  if (!rawText) return null;

  // 1. Direct parse attempt
  try {
    return JSON.parse(rawText.trim());
  } catch (e) {}

  // 2. Extract markdown code fence ```json ... ``` or ``` ... ```
  const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch && fenceMatch[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch (e) {}
  }

  // 3. Find outer braces { ... }
  const start = rawText.indexOf('{');
  const end = rawText.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(rawText.slice(start, end + 1));
    } catch (e) {}
  }

  return null;
}

/**
 * Direct Gemini API call from the client (used for Live Server or static hosting environments)
 */
async function callGeminiDirect(destination, days, group, vibe, budget) {
  const apiKey = localStorage.getItem('gemini_api_key') || DEFAULT_GEMINI_KEY;
  if (!apiKey) throw new Error("No Gemini API key available.");

  const prompt = `You are an expert travel planner. Create an authentic, realistic travel itinerary to ${destination} for ${days} days for a ${group} trip. Travel style: ${vibe}. Budget tier: ${budget}.
    
IMPORTANT RULES:
1. Determine the country and local currency of ${destination}. Set "currencyCode" (e.g., USD, JPY, EUR, GBP, IDR, THB, SGD, AUD, KRW, CHF, CAD) and "currencySymbol" (e.g., $, ¥, €, £, Rp, ฿, S$, A$, ₩, CHF, C$).
2. All "estimatedCost" values for places MUST be given in that local currency (e.g. for Tokyo in JPY ¥, for Paris or Rome in EUR €, for Bali/Jakarta in IDR Rp, for London in GBP £, for New York in USD $).
3. Recommend only real, famous, and accessible places in ${destination}.
4. Routes and travel times (durationMinutes, travelTimeToNext) must be realistic.
5. Use varied durationMinutes for each place (e.g. 60, 90, 120, 150).
6. Categories must be one of: "Culture", "Culinary", "Nature", "Adventure", "Shopping", "Relaxation".
7. Include 3-5 practical, specific travel tips for ${destination}.
8. Provide a realistic Plan B alternative for each place (e.g. indoor museum or covered cafe in case of rain).
9. Every place name across ALL days must be UNIQUE. Do NOT repeat the same attraction, restaurant, or location on different days.
    
Output must be valid JSON with this exact structure:
{
  "destination": "${destination}",
  "tagline": "String (a captivating 1-sentence highlight of what this place is famous for and its iconic vibe)",
  "days": ${days},
  "travelStyle": "${vibe}",
  "budget": "${budget}",
  "groupType": "${group}",
  "currencyCode": "String",
  "currencySymbol": "String",
  "packingList": ["String", "String", "String", "String", "String"],
  "travelTips": ["String", "String", "String"],
  "generatedDays": [
    {
      "dayNumber": 1,
      "places": [
        {
          "id": "place-1-1",
          "name": "String",
          "category": "Culture",
          "description": "String",
          "durationMinutes": 90,
          "estimatedCost": 20,
          "travelTimeToNext": 20,
          "planBName": "String"
        }
      ]
    }
  ]
}
Return only valid JSON, no conversational markdown.`;

  // Candidate models in priority order
  const candidateModels = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.8-flash'];
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

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        lastError = errJson?.error?.message || `HTTP ${resp.status} on ${model}`;
        if (resp.status === 404 || resp.status === 503) {
          continue; // Try next model
        }
        throw new Error(lastError);
      }

      const json = await resp.json();
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        lastError = `Empty response candidate from ${model}`;
        continue;
      }

      const parsed = extractJsonFromText(rawText);
      if (parsed && parsed.generatedDays && parsed.generatedDays.length > 0) {
        parsed.destination = parsed.destination || destination;
        parsed.days = parsed.days || days;
        parsed.travelStyle = parsed.travelStyle || vibe;
        parsed.budget = parsed.budget || budget;
        parsed.groupType = parsed.groupType || group;
        return parsed;
      }
    } catch (err) {
      lastError = err.message;
      if (err.message && (err.message.includes('API key') || err.message.includes('auth') || err.message.includes('PERMISSION_DENIED'))) {
        throw err;
      }
    }
  }

  throw new Error(lastError || "Could not generate itinerary with Gemini API.");
}

/**
 * Main itinerary generation function.
 * Seamlessly tries:
 * 1. Cloudflare Pages Function (/api/generate-itinerary)
 * 2. Direct Gemini API call (works in VS Code Live Server / static previews)
 * 3. Smart local destination fallback (offline / completely no network)
 */
async function generateItinerary(destination, days, group, vibe, budget) {
  // Step 1: Try serverless endpoint (/api/generate-itinerary)
  let backendFailed = false;

  try {
    const response = await fetch('/api/generate-itinerary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        destination, days, group, vibe, budget
      })
    });

    const contentType = response.headers.get('content-type') || '';
    // If running on a static server like VS Code Live Server, /api returns 404 or an HTML error page
    if (response.status === 404 || contentType.includes('text/html')) {
      backendFailed = true;
    } else if (response.ok) {
      const data = await response.json();
      if (data && data.generatedDays && data.generatedDays.length > 0) {
        return data;
      }
    } else {
      console.warn("Backend /api returned non-ok status:", response.status);
      backendFailed = true;
    }
  } catch (netErr) {
    backendFailed = true;
  }

  // Step 2: Direct client-side Gemini API call
  try {
    const aiData = await callGeminiDirect(destination, days, group, vibe, budget);
    if (aiData && aiData.generatedDays && aiData.generatedDays.length > 0) {
      return aiData;
    }
  } catch (geminiErr) {
    console.warn("Direct Gemini call was not completed, using smart local fallback:", geminiErr.message);
  }

  // Step 3: Smart destination-aware local fallback
  return generateMockItinerary(destination, days, group, vibe, budget);
}

/**
 * Map destination strings to local country currency details.
 */
function getCountryCurrency(destinationStr) {
  const dest = (destinationStr || '').toLowerCase();

  if (dest.includes('tokyo') || dest.includes('japan') || dest.includes('kyoto') || dest.includes('osaka') || dest.includes('sapporo') || dest.includes('hiroshima') || dest.includes('fukuoka')) {
    return { code: 'JPY', symbol: '¥', multiplier: 150 };
  }
  if (dest.includes('paris') || dest.includes('france') || dest.includes('rome') || dest.includes('italy') || 
      dest.includes('barcelona') || dest.includes('spain') || dest.includes('madrid') || dest.includes('amsterdam') || 
      dest.includes('netherlands') || dest.includes('berlin') || dest.includes('germany') || dest.includes('munich') || 
      dest.includes('vienna') || dest.includes('austria') || dest.includes('greece') || dest.includes('santorini') || 
      dest.includes('athens') || dest.includes('florence') || dest.includes('venice') || dest.includes('milan') || 
      dest.includes('lisbon') || dest.includes('portugal') || dest.includes('porto') || dest.includes('dublin') || dest.includes('ireland')) {
    return { code: 'EUR', symbol: '€', multiplier: 0.9 };
  }
  if (dest.includes('london') || dest.includes('uk') || dest.includes('england') || dest.includes('edinburgh') || dest.includes('scotland') || dest.includes('manchester')) {
    return { code: 'GBP', symbol: '£', multiplier: 0.78 };
  }
  if (dest.includes('bali') || dest.includes('indonesia') || dest.includes('jakarta') || dest.includes('ubud') || 
      dest.includes('yogyakarta') || dest.includes('bromo') || dest.includes('bandung') || dest.includes('lombok') || 
      dest.includes('surabaya') || dest.includes('komodo') || dest.includes('labuan bajo') || dest.includes('raja ampat')) {
    return { code: 'IDR', symbol: 'Rp', multiplier: 15000 };
  }
  if (dest.includes('bangkok') || dest.includes('thailand') || dest.includes('phuket') || dest.includes('chiang mai') || dest.includes('krabi') || dest.includes('koh samui')) {
    return { code: 'THB', symbol: '฿', multiplier: 35 };
  }
  if (dest.includes('singapore')) {
    return { code: 'SGD', symbol: 'S$', multiplier: 1.35 };
  }
  if (dest.includes('sydney') || dest.includes('australia') || dest.includes('melbourne') || dest.includes('brisbane') || dest.includes('perth')) {
    return { code: 'AUD', symbol: 'A$', multiplier: 1.5 };
  }
  if (dest.includes('seoul') || dest.includes('korea') || dest.includes('busan') || dest.includes('jeju')) {
    return { code: 'KRW', symbol: '₩', multiplier: 1300 };
  }
  if (dest.includes('dubai') || dest.includes('uae') || dest.includes('abu dhabi')) {
    return { code: 'AED', symbol: 'AED', multiplier: 3.67 };
  }
  if (dest.includes('zurich') || dest.includes('switzerland') || dest.includes('interlaken') || dest.includes('lucerne') || dest.includes('geneva') || dest.includes('zermatt')) {
    return { code: 'CHF', symbol: 'CHF', multiplier: 0.88 };
  }
  if (dest.includes('toronto') || dest.includes('vancouver') || dest.includes('canada') || dest.includes('montreal')) {
    return { code: 'CAD', symbol: 'C$', multiplier: 1.36 };
  }
  
  // Default to USD
  return { code: 'USD', symbol: '$', multiplier: 1 };
}

/**
 * Intelligent local fallback itinerary generator.
 * NEVER defaults to Bali for non-Bali places!
 */
async function generateMockItinerary(destination, days, group, vibe, budget) {
  let data;
  try {
    data = await fetchLocalData();
  } catch (e) {
    data = { destinations: {}, travelTips: {} };
  }

  const destLower = (destination || '').toLowerCase().trim();
  const currencyInfo = getCountryCurrency(destination);

  // Check aliases for known destinations
  const aliases = {
    'japan': 'tokyo',
    'italy': 'rome',
    'france': 'paris',
    'uk': 'london',
    'united kingdom': 'london',
    'england': 'london',
    'spain': 'barcelona',
    'germany': 'berlin',
    'netherlands': 'amsterdam',
    'holland': 'amsterdam',
    'switzerland': 'zurich',
    'korea': 'seoul',
    'south korea': 'seoul',
    'thailand': 'bangkok',
    'australia': 'sydney',
    'indonesia': 'jakarta',
    'ubud': 'bali',
    'seminyak': 'bali',
    'canggu': 'bali',
    'kuta': 'bali'
  };

  let matchedKey = null;

  // 1. Direct or alias match
  if (aliases[destLower]) {
    matchedKey = aliases[destLower];
  } else if (data.destinations && data.destinations[destLower]) {
    matchedKey = destLower;
  } else if (data.destinations) {
    // 2. Substring match
    matchedKey = Object.keys(data.destinations).find(k => destLower.includes(k) || k.includes(destLower));
  }

  // Budget multiplier (Budget = 0.5x, Mid-Range = 1.0x, Luxury = 2.2x, Ultra Luxury = 4.0x)
  let budgetScale = 1.0;
  if (budget.includes('Budget')) budgetScale = 0.5;
  else if (budget.includes('Luxury') && !budget.includes('Ultra')) budgetScale = 2.2;
  else if (budget.includes('Ultra')) budgetScale = 4.0;

  let currencyCode = currencyInfo.code;
  let currencySymbol = currencyInfo.symbol;
  let rawPlaces = [];
  let tips = [];

  if (matchedKey && data.destinations[matchedKey]) {
    // Found an exact pre-curated destination
    const destData = data.destinations[matchedKey];
    rawPlaces = destData.places || [];
    currencyCode = destData.currencyCode || currencyInfo.code;
    currencySymbol = destData.currencySymbol || currencyInfo.symbol;
    tips = (data.travelTips && data.travelTips[matchedKey]) || (data.travelTips && data.travelTips["default"]) || [];
  } else {
    // UNLISTED DESTINATION: Synthesize an authentic, destination-tailored itinerary!
    // NEVER show Bali places for non-Bali destinations!
    const destTitle = destination.charAt(0).toUpperCase() + destination.slice(1);
    
    // Scale base price to currency
    const baseCostUnit = currencyCode === 'IDR' ? 100000 : (currencyCode === 'JPY' ? 1500 : (currencyCode === 'KRW' ? 15000 : 25));

    rawPlaces = [
      {
        id: "dyn-1",
        name: `${destTitle} Historic Old Town & Heritage Square`,
        category: "Culture",
        description: `Explore the iconic historic architecture, cobblestone avenues, and cultural heritage of central ${destTitle}.`,
        estimatedCost: Math.round(baseCostUnit * 0.8),
        durationMinutes: 120,
        travelTimeToNext: 20,
        planBName: `${destTitle} Municipal History Museum (Indoor)`
      },
      {
        id: "dyn-2",
        name: `${destTitle} Famous Food Trail & Local Market`,
        category: "Culinary",
        description: `Savor authentic regional dishes, artisan street delicacies, and traditional specialties in ${destTitle}.`,
        estimatedCost: Math.round(baseCostUnit * 1.4),
        durationMinutes: 90,
        travelTimeToNext: 25,
        planBName: `Covered Gastronomy Market Hall`
      },
      {
        id: "dyn-3",
        name: `${destTitle} Scenic Waterfront & Central Promenade`,
        category: "Relaxation",
        description: `Unwind with picturesque waterfront views, vibrant public squares, and relaxing open spaces.`,
        estimatedCost: 0,
        durationMinutes: 75,
        travelTimeToNext: 20,
        planBName: `Waterfront Glasshouse Cafe`
      },
      {
        id: "dyn-4",
        name: `${destTitle} Panoramic Viewpoint & Botanical Gardens`,
        category: "Nature",
        description: `Breathtaking elevated vistas overlooking ${destTitle} alongside lush landscaped gardens and pathways.`,
        estimatedCost: Math.round(baseCostUnit * 0.5),
        durationMinutes: 90,
        travelTimeToNext: 30,
        planBName: `Conservatory & Indoor Pavilions`
      },
      {
        id: "dyn-5",
        name: `${destTitle} Arts & Boutique Quarter`,
        category: "Shopping",
        description: `Browse local artisan craft shops, independent galleries, and stylish boutiques unique to ${destTitle}.`,
        estimatedCost: Math.round(baseCostUnit * 1.2),
        durationMinutes: 100,
        travelTimeToNext: 15,
        planBName: `${destTitle} Contemporary Art Gallery`
      }
    ];

    tips = [
      `Check local transit cards and day passes for easy travel around ${destTitle}.`,
      `Carry both cash and contactless cards, as local food stalls may be cash-only.`,
      `Reserve top attractions and famous restaurants in ${destTitle} ahead of time.`,
      `Learn basic greeting phrases in the local language to connect with residents.`
    ];
  }

  // Determine places per day based on total days to keep it balanced
  let placesPerDay = 4;
  if (days >= 7) {
    placesPerDay = 2;
  } else if (days >= 4) {
    placesPerDay = 3;
  }
  
  const totalNeeded = days * placesPerDay;
  const destTitle = destination.charAt(0).toUpperCase() + destination.slice(1);
  const baseCostUnit = currencyCode === 'IDR' ? 100000 : (currencyCode === 'JPY' ? 1500 : (currencyCode === 'KRW' ? 15000 : 25));
  const categories = ["Culture", "Culinary", "Relaxation", "Nature", "Shopping", "Adventure"];

  // Ensure we have exactly totalNeeded unique places by dynamically generating more if needed
  while (rawPlaces.length < totalNeeded) {
    let idx = rawPlaces.length;
    let cat = categories[idx % categories.length];
    rawPlaces.push({
      id: `dyn-gen-${idx}`,
      name: `${destTitle} ${cat} Highlight ${idx + 1}`,
      category: cat,
      description: `Discover another wonderful ${cat.toLowerCase()} side of ${destTitle}, perfect for extending your trip.`,
      estimatedCost: Math.round(baseCostUnit * (0.8 + (idx % 3) * 0.4)),
      durationMinutes: 90 + (idx % 3) * 15,
      travelTimeToNext: 15 + (idx % 4) * 5,
      planBName: `${destTitle} Indoor ${cat} Area`
    });
  }

  // Adjust place costs to match currency & budget tier
  const places = rawPlaces.map(p => {
    let cost = Math.round(p.estimatedCost * budgetScale);
    
    // Round to clean figures based on currency
    if (currencyCode === 'IDR' || currencyCode === 'KRW') {
      cost = Math.round(cost / 5000) * 5000;
    } else if (currencyCode === 'JPY') {
      cost = Math.round(cost / 100) * 100;
    } else {
      cost = Math.max(0, Math.round(cost / 5) * 5);
    }

    return {
      ...p,
      estimatedCost: cost
    };
  });

  const generatedDays = [];
  let placeCounter = 0;

  for (let i = 1; i <= days; i++) {
    const dayPlaces = [];
    for (let j = 0; j < placesPerDay; j++) {
      if (placeCounter < places.length) {
        const p = places[placeCounter];
        dayPlaces.push({
          ...p,
          id: `${p.id}-d${i}-${j}`,
          travelTimeToNext: p.travelTimeToNext || (15 + ((j * 7) % 25))
        });
        placeCounter++;
      }
    }

    generatedDays.push({
      dayNumber: i,
      places: dayPlaces
    });
  }

  return {
    itineraryId: "itin-" + Date.now(),
    destination: destination,
    days: days,
    travelStyle: vibe,
    budget: budget,
    groupType: group,
    currencyCode: currencyCode,
    currencySymbol: currencySymbol,
    packingList: [
      "Comfortable walking shoes",
      "Universal travel adapter",
      "Local currency / contactless cards",
      "Weather-appropriate jacket",
      "Portable power bank"
    ],
    travelTips: tips,
    generatedDays: generatedDays
  };
}
