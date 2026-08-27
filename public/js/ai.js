// ai.js - Handles Gemini API interaction (Mock or Real)

async function fetchLocalData() {
  const res = await fetch('data/data.json');
  if (!res.ok) throw new Error("Failed to fetch local data.");
  return await res.json();
}

/**
 * Generate Itinerary using Gemini or Local Data.
 */
async function generateItinerary(destination, days, group, vibe, budget) {
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

    const data = await response.json();
    
    if (!response.ok) {
      if (data.errors) {
        throw new Error(data.errors.map(e => e.msg).join(', '));
      }
      throw new Error(data.error || "Failed to call API.");
    }
    
    return data;
  } catch (error) {
    console.error("API Error:", error);
    console.warn("Using local data as fallback.");
    return generateMockItinerary(destination, days, group, vibe, budget);
  }
}

/**
 * Map destination strings to local country currency details.
 */
function getCountryCurrency(destinationStr) {
  const dest = (destinationStr || '').toLowerCase();

  if (dest.includes('tokyo') || dest.includes('japan') || dest.includes('kyoto') || dest.includes('osaka')) {
    return { code: 'JPY', symbol: '¥', multiplier: 150 };
  }
  if (dest.includes('paris') || dest.includes('france') || dest.includes('rome') || dest.includes('italy') || 
      dest.includes('barcelona') || dest.includes('spain') || dest.includes('amsterdam') || dest.includes('berlin') || 
      dest.includes('germany') || dest.includes('vienna') || dest.includes('greece') || dest.includes('santorini') || 
      dest.includes('florence') || dest.includes('venice') || dest.includes('milan') || dest.includes('lisbon')) {
    return { code: 'EUR', symbol: '€', multiplier: 0.9 };
  }
  if (dest.includes('london') || dest.includes('uk') || dest.includes('england') || dest.includes('edinburgh') || dest.includes('dublin')) {
    return { code: 'GBP', symbol: '£', multiplier: 0.78 };
  }
  if (dest.includes('bali') || dest.includes('indonesia') || dest.includes('jakarta') || dest.includes('ubud') || 
      dest.includes('yogyakarta') || dest.includes('bromo') || dest.includes('bandung') || dest.includes('lombok') || dest.includes('surabaya')) {
    return { code: 'IDR', symbol: 'Rp', multiplier: 15000 };
  }
  if (dest.includes('bangkok') || dest.includes('thailand') || dest.includes('phuket') || dest.includes('chiang mai')) {
    return { code: 'THB', symbol: '฿', multiplier: 35 };
  }
  if (dest.includes('singapore')) {
    return { code: 'SGD', symbol: 'S$', multiplier: 1.35 };
  }
  if (dest.includes('sydney') || dest.includes('australia') || dest.includes('melbourne')) {
    return { code: 'AUD', symbol: 'A$', multiplier: 1.5 };
  }
  if (dest.includes('seoul') || dest.includes('korea')) {
    return { code: 'KRW', symbol: '₩', multiplier: 1300 };
  }
  if (dest.includes('dubai') || dest.includes('uae')) {
    return { code: 'AED', symbol: 'AED', multiplier: 3.67 };
  }
  if (dest.includes('zurich') || dest.includes('switzerland') || dest.includes('interlaken') || dest.includes('lucerne')) {
    return { code: 'CHF', symbol: 'CHF', multiplier: 0.88 };
  }
  
  // Default to USD
  return { code: 'USD', symbol: '$', multiplier: 1 };
}

async function generateMockItinerary(destination, days, group, vibe, budget) {
  const data = await fetchLocalData();
  const destKey = destination.toLowerCase().includes("tokyo") ? "tokyo" : "bali";
  const destData = data.destinations[destKey] || data.destinations["bali"];
  const rawPlaces = destData.places || destData;

  const currencyInfo = getCountryCurrency(destination);
  const currencyCode = destData.currencyCode || currencyInfo.code;
  const currencySymbol = destData.currencySymbol || currencyInfo.symbol;

  // Budget multiplier (Budget = 0.6x, Mid-Range = 1.0x, Luxury = 2.2x, Ultra Luxury = 4.0x)
  let budgetScale = 1.0;
  if (budget.includes('Budget')) budgetScale = 0.5;
  else if (budget.includes('Luxury') && !budget.includes('Ultra')) budgetScale = 2.2;
  else if (budget.includes('Ultra')) budgetScale = 4.0;

  // Adjust place costs to match currency & budget tier
  const places = rawPlaces.map(p => {
    let cost = p.estimatedCost;

    // Convert base IDR costs from template to foreign currency if needed
    if (currencyCode !== 'IDR' && destKey === 'bali') {
      cost = Math.round((cost / 15000) * currencyInfo.multiplier);
    }
    
    // Scale by budget selection
    cost = Math.round(cost * budgetScale);
    
    // Round to clean figures
    if (currencyCode === 'IDR' || currencyCode === 'KRW') {
      cost = Math.round(cost / 5000) * 5000;
    } else if (currencyCode === 'JPY') {
      cost = Math.round(cost / 100) * 100;
    } else {
      cost = Math.round(cost / 5) * 5;
    }

    return {
      ...p,
      estimatedCost: cost
    };
  });
  
  // Get travel tips
  const tips = data.travelTips[destKey] || data.travelTips["default"] || [];

  const generatedDays = [];
  for (let i = 1; i <= days; i++) {
    const dayPlaces = places.map((p, idx) => ({
      ...p,
      id: p.id + '-' + i + '-' + idx // Unique ID
    }));
    
    generatedDays.push({
      dayNumber: i,
      places: dayPlaces
    });
  }

  return {
    itineraryId: "mock-" + Date.now(),
    destination: destination,
    days: days,
    travelStyle: vibe,
    budget: budget,
    groupType: group,
    currencyCode: currencyCode,
    currencySymbol: currencySymbol,
    packingList: ["Sunglasses", "Comfortable shoes", "Local currency/cards", "Sunblock", "Universal Adapter"],
    travelTips: tips,
    generatedDays: generatedDays
  };
}
