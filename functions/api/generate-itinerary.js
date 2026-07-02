export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const body = await request.json();
    const { destination, days, group, vibe, budget } = body;
    
    // Validasi input
    if (!destination || !days || !group || !vibe || !budget) {
      return new Response(JSON.stringify({ errors: [{ msg: "Semua data harus diisi" }] }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (days < 1 || days > 14) {
      return new Response(JSON.stringify({ errors: [{ msg: "Durasi harus antara 1-14 hari" }] }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const apiKey = env.GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Server tidak dikonfigurasi dengan API Key. Silakan gunakan data lokal." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const prompt = `Anda adalah Expert Travel Planner AI. Buat itinerary perjalanan ke ${destination} selama ${days} hari untuk ${group}. Gaya liburan: ${vibe}. Budget: ${budget}.
    
    PENTING (Batasan Sistem):
    1. Anda tidak boleh merekomendasikan tempat yang ilegal, berbahaya, atau sudah ditutup permanen.
    2. Rute dan waktu tempuh (durationMinutes) harus realistis dengan memperhitungkan potensi jarak dan kemacetan. Jangan merekomendasikan terlalu banyak tempat dalam sehari jika lokasinya berjauhan.
    
    Output harus dalam format JSON dengan struktur yang tepat (tanpa markdown blok \`\`\`json):
    {
      "destination": "String",
      "days": Number,
      "travelStyle": "String",
      "budget": "String",
      "groupType": "String",
      "packingList": ["String", "String"],
      "generatedDays": [
        {
          "dayNumber": Number,
          "places": [
            { "id": "uuid", "name": "String", "category": "String", "description": "String", "durationMinutes": Number, "estimatedCost": Number, "planBName": "String" }
          ]
        }
      ]
    }
    Hanya kembalikan JSON valid saja, tanpa teks penjelasan tambahan.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
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
      throw new Error(data.error?.message || "Gagal memanggil API Gemini");
    }

    const text = data.candidates[0].content.parts[0].text;
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const itineraryData = JSON.parse(jsonStr);

    return new Response(JSON.stringify(itineraryData), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error saat generate itinerary:", error.message);
    return new Response(JSON.stringify({ error: "Gagal membuat itinerary: " + error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
