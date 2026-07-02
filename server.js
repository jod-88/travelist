require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// Rate Limiting (Mencegah DDoS / penyalahgunaan API)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 15, // Batasi setiap IP maksimal 15 request per windowMs
  message: { error: "Terlalu banyak permintaan dari IP Anda, silakan coba lagi setelah 15 menit." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Endpoint Generate Itinerary
app.post('/api/generate-itinerary', 
  apiLimiter,
  // Input Sanitization & Validation (Mencegah XSS & Injection)
  [
    body('destination').trim().escape().notEmpty().withMessage('Destinasi tidak boleh kosong'),
    body('days').isInt({ min: 1, max: 14 }).withMessage('Durasi harus antara 1-14 hari'),
    body('group').trim().escape().notEmpty().withMessage('Grup tidak valid'),
    body('vibe').trim().escape().notEmpty().withMessage('Gaya liburan tidak valid'),
    body('budget').trim().escape().notEmpty().withMessage('Budget tidak valid')
  ],
  async (req, res) => {
    // Cek hasil validasi
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { destination, days, group, vibe, budget } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Server tidak dikonfigurasi dengan API Key. Silakan gunakan data lokal." });
    }

    // System Prompt dengan Aturan Etis & Realistis
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

    try {
      // Menggunakan fetch bawaan Node.js 18+
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

      // Parse response dari Gemini
      const text = data.candidates[0].content.parts[0].text;
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const itineraryData = JSON.parse(jsonStr);

      res.json(itineraryData);

    } catch (error) {
      console.error("Error saat generate itinerary:", error.message);
      res.status(500).json({ error: "Gagal membuat itinerary: " + error.message });
    }
});

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
