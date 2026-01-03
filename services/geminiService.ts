
import { GoogleGenAI } from "@google/genai";
import { FuelRequest } from "../types";

export const analyzeFuelingTrends = async (requests: FuelRequest[]) => {
  // Always use a named parameter for apiKey and obtain it directly from process.env.API_KEY.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const dataSummary = requests.map(r => ({
    plate: r.plateNumber,
    project: r.projectName,
    fuel: r.newRequestLiters,
    mileageDiff: r.newMileage - r.lastMileage
  }));

  const prompt = `
    Analyze the following fuel request data and provide a concise summary for a fleet manager.
    Highlight any anomalies (e.g., high fuel consumption relative to mileage) and give a brief optimization recommendation.
    Data: ${JSON.stringify(dataSummary)}
  `;

  try {
    const response = await ai.models.generateContent({
      // Use gemini-3-pro-preview for complex reasoning and data analysis tasks.
      model: 'gemini-3-pro-preview',
      contents: prompt,
    });
    // Use the .text property directly, not as a method call.
    return response.text;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Unable to perform AI analysis at this time.";
  }
};
