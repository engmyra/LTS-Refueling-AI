
import { GoogleGenAI, Type } from "@google/genai";
import { FuelRequest } from "../types";

export const scanOdometerImage = async (base64Image: string) => {
  /* Using current API key from environment as per initialization rules */
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = "Extract the odometer reading (mileage) and the vehicle plate number from this image. Return the result in a clean JSON format with keys 'mileage' (integer) and 'plate' (string). If you cannot find one, leave it as null.";
  
  try {
    /* Fixed: contents must be an object with parts array for multimodal content */
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: "image/jpeg", data: base64Image.split(',')[1] } }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mileage: { type: Type.INTEGER, description: "The odometer reading" },
            plate: { type: Type.STRING, description: "The vehicle plate number" }
          },
          required: ["mileage", "plate"]
        }
      }
    });
    
    /* Accessing text property directly (not a function call) */
    const jsonStr = response.text?.trim() || '{}';
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("OCR Analysis Error:", error);
    return null;
  }
};

export const analyzeFuelingTrends = async (requests: FuelRequest[]) => {
  /* Fresh instance ensures use of updated API key from user selection dialog */
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const dataSummary = requests.map(r => ({
    plate: r.plateNumber,
    project: r.projectName,
    fuel: r.newRequestLiters,
    mileageDiff: Number(r.newMileage || 0) - Number(r.lastMileage || 0),
    status: r.status,
    location: r.location
  }));

  const prompt = `
    Analyze this fleet fueling data and provide a high-level industrial audit summary.
    1. Identify efficiency red flags.
    2. Identify any location anomalies (requests made far from previous coordinates).
    3. Suggest 3 actionable maintenance strategies based on fuel usage patterns.
    
    Data Source: ${JSON.stringify(dataSummary)}
    
    Respond in a professional, concise tone suitable for an executive fleet dashboard. Use Markdown for formatting.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        /* Using thinkingConfig for Gemini 3 series reasoning */
        thinkingConfig: { thinkingBudget: 4000 }
      }
    });
    
    /* Accessing text property directly */
    return response.text || "No insights generated.";
  } catch (error) {
    console.error("AI Analysis Dispatch Error:", error);
    return "Fleet Analytics Engine is currently offline. Please review the manual ledger.";
  }
};
