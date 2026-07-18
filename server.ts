import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Initialize the Google GenAI SDK.
// User-Agent: 'aistudio-build' is required for telemetry.
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parsing middleware
  app.use(express.json());

  // Health check API
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", geminiConfigured: !!process.env.GEMINI_API_KEY });
  });

  // Geocoding Proxy API
  app.get("/api/weather/search", async (req, res) => {
    try {
      const { name } = req.query;
      if (!name) {
        return res.status(400).json({ error: "Missing query parameter 'name'." });
      }
      const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        String(name)
      )}&count=6&language=en&format=json`;
      
      const response = await fetch(geocodeUrl);
      if (!response.ok) {
        throw new Error(`Open-Meteo Geocoding responded with status ${response.status}`);
      }
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Geocoding Proxy Error:", error);
      res.status(500).json({ error: error.message || "Failed to search location." });
    }
  });

  // Weather Forecast Proxy API
  app.get("/api/weather/forecast", async (req, res) => {
    try {
      const { latitude, longitude } = req.query;
      if (!latitude || !longitude) {
        return res.status(400).json({ error: "Missing 'latitude' or 'longitude' query parameters." });
      }
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability&timezone=auto`;
      
      const response = await fetch(weatherUrl);
      if (!response.ok) {
        throw new Error(`Open-Meteo Forecast responded with status ${response.status}`);
      }
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Forecast Proxy Error:", error);
      res.status(500).json({ error: error.message || "Failed to retrieve forecast." });
    }
  });

  // Weather Intelligence Planning Recommendation API
  app.post("/api/weather/recommendation", async (req, res) => {
    try {
      const { current, daily, city } = req.body;

      if (!current || !daily) {
        return res.status(400).json({ error: "Missing current or daily forecast data." });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({
          error: "Gemini API key is not configured. Falling back to rule-based intelligence.",
        });
      }

      const prompt = `
        Analyze the following weather data for ${city || "the requested location"} and generate a detailed daily planning recommendation.
        
        Current Weather Metrics:
        - Temperature: ${current.temp}°C
        - Feels Like: ${current.feelsLike}°C
        - Humidity: ${current.humidity}%
        - Wind Speed: ${current.windSpeed} km/h
        - Weather Code: ${current.weatherCode} (Open-Meteo standard WMO code)
        - Precipitation: ${current.precipitation} mm
        
        7-Day Forecast Overview:
        - Day Temperatures: Min ${daily.tempMin.join(", ")}°C, Max ${daily.tempMax.join(", ")}°C
        - Precipitation Probabilities: ${daily.precipitationProbability.join(", ")}%
        - Daily Weather Codes: ${daily.weatherCode.join(", ")}
        
        Please provide a cohesive, structured set of suggestions for clothing, outdoor suitability, schedule optimization, and health advice.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "You are an expert Weather Intelligence and Daily Planner. Your job is to analyze local weather forecasts, assess thermal comfort, precipitation risks, and atmospheric conditions, and output a highly personalized, practical daily scheduling and apparel recommendation.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              clothing: {
                type: Type.OBJECT,
                properties: {
                  top: { type: Type.STRING, description: "Recommended upper body apparel (e.g., breathable linen shirt, fleece jacket, heavy insulated coat)" },
                  bottom: { type: Type.STRING, description: "Recommended lower body apparel (e.g., cotton shorts, denim jeans, thermals)" },
                  footwear: { type: Type.STRING, description: "Best choice of shoes for the day (e.g., ventilated running shoes, boots, waterproof shoes)" },
                  accessories: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Crucial weather gear (e.g., high SPF sunglasses, windbreaker, umbrella, winter gloves, beanie)"
                  }
                },
                required: ["top", "bottom", "footwear", "accessories"]
              },
              outdoorSuitability: {
                type: Type.OBJECT,
                properties: {
                  status: { type: Type.STRING, description: "General rating: 'Excellent', 'Good', 'Moderate', or 'Poor'" },
                  reason: { type: Type.STRING, description: "A detailed but brief explanation of why this rating was given" },
                  activities: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Recommended outdoor or indoor activities appropriate for today's weather"
                  }
                },
                required: ["status", "reason", "activities"]
              },
              scheduleOptimization: {
                type: Type.OBJECT,
                properties: {
                  bestTimeForOutdoors: { type: Type.STRING, description: "Optimal hours for going out, or suggestion to stay indoors" },
                  precautions: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Time-specific precautions (e.g., avoid mid-day sun, secure objects due to evening wind gusts)"
                  }
                },
                required: ["bestTimeForOutdoors", "precautions"]
              },
              healthAdvice: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Direct health tips (e.g., hydration guidelines, UV shielding, joint pain warning for pressure drops, pollen/allergy notices)"
              },
              summary: {
                type: Type.STRING,
                description: "A friendly, cohesive weather planning overview summing up the atmosphere (2-3 sentences)."
              }
            },
            required: ["clothing", "outdoorSuitability", "scheduleOptimization", "healthAdvice", "summary"]
          }
        }
      });

      if (!response.text) {
        throw new Error("No response text received from Gemini.");
      }

      const recommendationData = JSON.parse(response.text.trim());
      res.json(recommendationData);
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate AI weather recommendation." });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });
}

startServer();
