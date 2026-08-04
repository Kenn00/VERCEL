import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const PORT = 3000;

// Initialize GoogleGenAI
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

async function startServer() {
  const app = express();

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API routes first
  app.post("/api/analyze-image", async (req: express.Request, res: express.Response) => {
    try {
      const { base64Data, mimeType } = req.body;
      if (!base64Data) {
        return res.status(400).json({ error: "Missing image base64Data" });
      }

      if (!ai) {
        return res.status(500).json({ 
          error: "Gemini API client is not initialized. Please ensure GEMINI_API_KEY is configured in the Secrets panel." 
        });
      }

      const imagePart = {
        inlineData: {
          mimeType: mimeType || "image/png",
          data: base64Data,
        },
      };

      const textPart = {
        text: "You are a precise data extraction API. Extract EVERY SINGLE DATA ROW from the calibration/QA table in the image. " +
              "Do NOT skip any rows. If a cell in the 'Box' or 'Weight' column is visually blank (merged), copy the value from the row directly above it. " +
              "For the timestamp, extract the EXACT text in the top-left cell of the table or header if visible (e.g., '7/10/2026 11:15 AM'). " +
              "Additionally, look around for any 'Camera Height' or 'Mounting Height' metrics on the dashboard (e.g. 'Camera Height: 81.5 in' or 'Camera Height: 1.5 ft') and extract it. " +
              "Check if there are explicit summary cards or tables on the spreadsheet such as 'AVERAGE PER DIMENSION' (Length, Width, Height), 'AVERAGE PER BOX' (e.g. 1st Box, 2nd Box), or 'OVERALL AVERAGE'. Extract these exact numeric percentages into summaryOverallAvg, summaryDimLength, summaryDimWidth, summaryDimHeight if visible. " +
              "For '% Error', extract exactly as written (e.g., '59.00%' becomes 59.00). " +
              "For 'Inch Diff' or variance, extract it keeping any negative signs (e.g., '-5.9'). " +
              "Ensure you capture all Length, Width, and Height rows for every Box listed."
      };

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts: [imagePart, textPart] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              timestamp: { type: Type.STRING, description: "Extracted timestamp from the table, e.g. 7/10/2026 11:15 AM" },
              cameraHeight: { type: Type.STRING, description: "Extracted camera/mounting height if visible, e.g. 24 in or 5 ft" },
              summaryOverallAvg: { type: Type.NUMBER, description: "Explicit overall average percentage if displayed on spreadsheet, e.g. 14.34" },
              summaryDimLength: { type: Type.NUMBER, description: "Explicit Length average % if displayed on spreadsheet, e.g. 15.30" },
              summaryDimWidth: { type: Type.NUMBER, description: "Explicit Width average % if displayed on spreadsheet, e.g. 7.46" },
              summaryDimHeight: { type: Type.NUMBER, description: "Explicit Height average % if displayed on spreadsheet, e.g. 20.25" },
              rows: {
                type: Type.ARRAY,
                description: "Extracted data rows from the table",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    box: { type: Type.STRING },
                    weight: { type: Type.STRING },
                    dimension: { type: Type.STRING, description: "Must be 'Length', 'Width', or 'Height'" },
                    actual: { type: Type.NUMBER },
                    app: { type: Type.NUMBER },
                    error: { type: Type.NUMBER },
                    diff: { type: Type.NUMBER }
                  },
                  required: ["box", "dimension", "actual", "app"]
                }
              }
            },
            required: ["rows"]
          }
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error("No response text from Gemini model");
      }

      const data = JSON.parse(text);
      res.json(data);
    } catch (error: any) {
      console.error("Gemini Image Analysis Error:", error);
      res.status(500).json({ error: error.message || "Failed to analyze image using Gemini API" });
    }
  });

  // Generate executive report on multiple test runs
  app.post("/api/generate-compare-report", async (req: express.Request, res: express.Response) => {
    try {
      const { selectedRuns } = req.body;
      if (!selectedRuns || !Array.isArray(selectedRuns) || selectedRuns.length === 0) {
        return res.status(400).json({ error: "Missing or invalid selectedRuns array" });
      }

      if (!ai) {
        return res.status(500).json({ 
          error: "Gemini API client is not initialized. Please ensure GEMINI_API_KEY is configured in the Secrets panel." 
        });
      }

      const promptText = 
        "You are an expert pre-production QA engineering analyst specialized in 3D camera spatial calibration, range-sensors, and dimensional volume calculation systems.\n\n" +
        "We are analyzing MULTIPLE depth measurement verification runs to assess system stability, identify skews, detect dimensional drift, and generate strategic recommendations.\n\n" +
        "Here is the structured test data for the selected calibration runs:\n" +
        JSON.stringify(selectedRuns, null, 2) + "\n\n" +
        "Please generate a comprehensive, highly professional QA Calibration Analysis & Insights Report.\n" +
        "Structure the report with the following specific sections (using markdown formatting with bolding and bullet points):\n\n" +
        "1. EXECUTIVE SUMMARY & QUALITY SCORE\n" +
        "   - Synthesize the overall quality of the calibration based on these runs (aim for < 5% error for production grade).\n" +
        "   - Define whether the system is ready for production, or requires further calibration.\n\n" +
        "2. MULTI-RUN TREND ANALYSIS & DRIFT DETECTION\n" +
        "   - Analyze the trend across the selected runs (Chronological improvements, regressions, or erratic readings).\n" +
        "   - Evaluate vertical Z-axis stability (Height error rates) and mounting height impact (e.g. how mounting heights affect accuracy).\n\n" +
        "3. SYSTEMIC BOTTLENECKS & ANOMALY DETECTION\n" +
        "   - Identify specific dimension skews (Is Length, Width, or Height consistently showing the highest error?).\n" +
        "   - Point out specific Box Types that act as outliers or major source of variance (e.g. large vs small boxes, irregular sizes).\n\n" +
        "4. STRATEGIC REMEDIATION ACTION PLAN\n" +
        "   - Provide 3-4 highly actionable engineering recommendations to minimize dimensional error and stabilize vertical mapping.\n\n" +
        "Ensure your response is detailed, professional, objective, and contains no raw developer logs or developer-jargon. Focus on real-world packaging volume optimization.";

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: promptText,
      });

      const text = response.text;
      if (!text) {
        throw new Error("No response text from Gemini model");
      }

      res.json({ report: text });
    } catch (error: any) {
      console.error("Gemini Compare Report Generation Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate comparison report using Gemini API" });
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: express.Request, res: express.Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
