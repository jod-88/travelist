// ai.js - Menangani logika interaksi dengan Gemini (Mock atau Real)

async function fetchLocalData() {
  const res = await fetch('data/data.json');
  if (!res.ok) throw new Error("Gagal mengambil data statis");
  return await res.json();
}

/**
 * Generate Itinerary menggunakan Gemini atau Data Lokal.
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
      throw new Error(data.error || "Gagal memanggil API.");
    }
    
    return data;
  } catch (error) {
    console.error("API Error:", error);
    alert(error.message + " Menggunakan data lokal sebagai fallback.");
    return generateMockItinerary(destination, days, group, vibe, budget);
  }
}

async function generateMockItinerary(destination, days, group, vibe, budget) {
  const data = await fetchLocalData();
  const destKey = destination.toLowerCase().includes("tokyo") ? "tokyo" : "bali"; // Fallback sederhana
  const places = data.destinations[destKey] || data.destinations["bali"];
  
  const generatedDays = [];
  for (let i = 1; i <= days; i++) {
    // Untuk demo, kita duplikasi tempat jika hari lebih dari jumlah tempat statis
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
    packingList: ["Kacamata hitam", "Sepatu nyaman", "Kamera", "Sunblock"],
    generatedDays: generatedDays
  };
}
