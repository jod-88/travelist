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
async function callGeminiDirect(destination, days, group, vibe, budget, apiKey) {
  apiKey = apiKey || localStorage.getItem('gemini_api_key') || DEFAULT_GEMINI_KEY;
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

  // Candidate models in priority order (gemini-2.5-flash is best; fallback to stable ones)
  const candidateModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest'];
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
  // Step 1: Try Cloudflare Pages Function (/api/generate-itinerary)
  try {
    const response = await fetch('/api/generate-itinerary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination, days, group, vibe, budget })
    });

    const contentType = response.headers.get('content-type') || '';

    // Local dev (VS Code Live Server) — no /api endpoint exists
    if (response.status === 404 || contentType.includes('text/html')) {
      // Fall through to Step 2
    } else if (response.ok) {
      const data = await response.json();
      if (data && data.generatedDays && data.generatedDays.length > 0) {
        return data; // ✅ Primary path succeeded
      }
      // CF function returned 200 but bad/empty data — fall through
    } else {
      // CF function returned an error (e.g. Gemini API key issue, rate limit)
      const errData = await response.json().catch(() => ({}));
      const errMsg = errData?.error || errData?.errors?.[0]?.msg || `Server error ${response.status}`;
      console.warn('CF /api error:', errMsg, '— trying direct Gemini...');
      // Fall through to Step 2, but surface this error if Step 2 also fails
    }
  } catch (netErr) {
    console.warn('CF /api network error:', netErr.message);
  }

  // Step 2: Direct Gemini API call (client-side key or fallback relay)
  // On Cloudflare Pages, try fetching the key via a relay endpoint
  let clientKey = localStorage.getItem('gemini_api_key') || DEFAULT_GEMINI_KEY;
  if (!clientKey) {
    try {
      const keyResp = await fetch('/api/gemini-key');
      if (keyResp.ok) {
        const keyData = await keyResp.json();
        clientKey = keyData?.key || '';
      }
    } catch (_) {}
  }

  if (clientKey) {
    try {
      const aiData = await callGeminiDirect(destination, days, group, vibe, budget, clientKey);
      if (aiData && aiData.generatedDays && aiData.generatedDays.length > 0) {
        return aiData; // ✅ Direct Gemini succeeded
      }
    } catch (geminiErr) {
      console.warn('Direct Gemini error:', geminiErr.message);
    }
  }

  // Step 3: Offline local fallback — only when genuinely no network/API
  console.error('All AI paths failed — using local mock itinerary.');
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
  if (dest.includes('beijing') || dest.includes('shanghai') || dest.includes('china') || dest.includes('guangzhou') || dest.includes('shenzhen')) {
    return { code: 'CNY', symbol: '¥', multiplier: 7.2 };
  }
  if (dest.includes('malaysia') || dest.includes('kuala lumpur') || dest.includes('penang')) {
    return { code: 'MYR', symbol: 'RM', multiplier: 4.7 };
  }
  if (dest.includes('vietnam') || dest.includes('hanoi') || dest.includes('ho chi minh') || dest.includes('saigon') || dest.includes('da nang')) {
    return { code: 'VND', symbol: '₫', multiplier: 25000 };
  }
  if (dest.includes('india') || dest.includes('delhi') || dest.includes('mumbai') || dest.includes('goa') || dest.includes('bangalore')) {
    return { code: 'INR', symbol: '₹', multiplier: 83 };
  }
  if (dest.includes('philippines') || dest.includes('manila') || dest.includes('cebu') || dest.includes('boracay')) {
    return { code: 'PHP', symbol: '₱', multiplier: 56 };
  }
  if (dest.includes('new zealand') || dest.includes('auckland') || dest.includes('queenstown') || dest.includes('wellington')) {
    return { code: 'NZD', symbol: 'NZ$', multiplier: 1.65 };
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
    const baseCostUnit = currencyCode === 'IDR' ? 100000 : (currencyCode === 'JPY' || currencyCode === 'CNY' ? 1500 : (currencyCode === 'KRW' ? 15000 : (currencyCode === 'VND' ? 200000 : 25)));

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
  const baseCostUnit = currencyCode === 'IDR' ? 100000 : (currencyCode === 'JPY' || currencyCode === 'CNY' ? 1500 : (currencyCode === 'KRW' ? 15000 : (currencyCode === 'VND' ? 200000 : 25)));
  
  // Rich name templates for dynamic fallback generation so names are natural and varied
  const nameTemplates = {
    "Culture": [
      "Historic Old Town of {dest}", "Royal Palace & Heritage Museum in {dest}", "{dest} Ancient Temple Complex",
      "National Art Gallery of {dest}", "Traditional {dest} Village Walk", "{dest} Cultural Performance Theater",
      "The Great {dest} Monument", "{dest} Museum of Natural History"
    ],
    "Culinary": [
      "{dest} Famous Night Market", "Authentic {dest} Street Food Alley", "High-End Gastronomy in {dest}",
      "{dest} Central Farmers Market", "Hidden Local Cafes of {dest}", "{dest} Spice & Ingredient Tour",
      "Riverside Seafood Dining in {dest}", "Traditional {dest} Tea House"
    ],
    "Nature": [
      "{dest} Grand Botanical Gardens", "Panoramic Peak Viewpoint over {dest}", "{dest} National Forest Park",
      "Scenic Lake & Trails of {dest}", "{dest} Coastal Walk", "Hidden Waterfall near {dest}",
      "{dest} Wildlife Sanctuary", "Crystal Clear Lakes of {dest}"
    ],
    "Adventure": [
      "{dest} Skyline Observation Deck", "Theme Park & Thrill Rides in {dest}", "{dest} Off-Road Safari",
      "Mountain Cable Car of {dest}", "{dest} Bridge Climb Experience", "River Rafting & Kayaking in {dest}",
      "Underground Caves of {dest}", "Zip Lining Across {dest} Valleys"
    ],
    "Shopping": [
      "{dest} Grand Shopping Boulevard", "Vintage & Antiques Quarter in {dest}", "{dest} Luxury Retail District",
      "Traditional Handicraft Souk in {dest}", "{dest} Fashion & Design Hub", "The Mega Mall of {dest}",
      "{dest} Weekend Artisan Market", "Boutique Alleyways in {dest}"
    ],
    "Relaxation": [
      "{dest} Thermal Baths & Spa", "Sunset Cruise in {dest}", "{dest} Private Beach Club",
      "Rooftop Lounge & Bar in {dest}", "Tranquil Zen Gardens of {dest}", "{dest} Riverfront Promenade",
      "Secluded Hot Springs near {dest}", "Luxury Wellness Retreat in {dest}"
    ]
  };

  const categories = ["Culture", "Culinary", "Relaxation", "Nature", "Shopping", "Adventure"];

  // Ensure we have exactly totalNeeded unique places by dynamically generating them
  let catCounts = { "Culture": 0, "Culinary": 0, "Relaxation": 0, "Nature": 0, "Shopping": 0, "Adventure": 0 };
  
  while (rawPlaces.length < totalNeeded) {
    let cat = categories[rawPlaces.length % categories.length];
    let count = catCounts[cat]++;
    let templates = nameTemplates[cat];
    let template = templates[count % templates.length];
    let placeName = template.replace(/{dest}/g, destTitle);

    rawPlaces.push({
      id: `dyn-gen-${rawPlaces.length}`,
      name: placeName,
      category: cat,
      description: `Discover an amazing ${cat.toLowerCase()} experience at this renowned spot in ${destTitle}.`,
      estimatedCost: Math.round(baseCostUnit * (0.8 + (count % 3) * 0.4)),
      durationMinutes: 90 + (count % 3) * 15,
      travelTimeToNext: 15 + (count % 4) * 5,
      planBName: `${destTitle} Indoor ${cat} Pavilion`
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
