
import { GoogleGenAI, Type } from "@google/genai";
import { SessionResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const evaluateSession = async (transcript: string): Promise<Omit<SessionResult, 'durationSeconds' | 'date' | 'avatarName'>> => {
  if (!transcript || transcript.trim().length < 10) {
    return {
      overallScore: 10,
      vocabularyScore: 10,
      grammarScore: 10,
      pronunciationScore: 10,
      feedback: "A sessão foi muito curta para avaliar corretamente. Continue praticando!",
      fluencyRating: 'Beginner',
      transcript: transcript
    };
  }

  try {
    // Fix: Updated model to 'gemini-3-pro-preview' for complex session evaluation/analysis
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Analyze the following English conversation transcript between a user and an AI tutor. 
      The user is learning English. 
      
      Provide a comprehensive evaluation returning a JSON object.
      
      Strict Scoring Criteria:
      1. vocabularyScore (0-100): Evaluate range of words and idiomatic usage.
      2. grammarScore (0-100): Evaluate syntax accuracy and tense consistency.
      3. pronunciationScore (0-100): Estimate based on transcript clarity (phonetic errors often appear as nonsense words in speech-to-text).
      4. overallScore (0-100): Calculate strictly as: (vocabularyScore * 0.3) + (grammarScore * 0.3) + (pronunciationScore * 0.4). Round to nearest integer.
      5. fluencyRating: "Beginner", "Intermediate", "Advanced", or "Native".
      6. feedback: A constructive paragraph (max 60 words) highlighting strengths and 1 specific area to improve. Respond in Portuguese.

      Transcript:
      ${transcript}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallScore: { type: Type.INTEGER },
            vocabularyScore: { type: Type.INTEGER },
            grammarScore: { type: Type.INTEGER },
            pronunciationScore: { type: Type.INTEGER },
            fluencyRating: { type: Type.STRING, enum: ["Beginner", "Intermediate", "Advanced", "Native"] },
            feedback: { type: Type.STRING }
          },
          required: ["overallScore", "vocabularyScore", "grammarScore", "pronunciationScore", "fluencyRating", "feedback"]
        }
      }
    });

    // Fix: Using the text property (not a method) on GenerateContentResponse
    const result = JSON.parse(response.text || "{}");
    
    // Ensure fallback values if API fails to strict schema
    const vocab = result.vocabularyScore || 0;
    const grammar = result.grammarScore || 0;
    const pronunciation = result.pronunciationScore || 0;
    // Fallback calculation if model returns 0 for overall
    const calculatedOverall = result.overallScore || Math.round((vocab * 0.3) + (grammar * 0.3) + (pronunciation * 0.4));

    return {
      overallScore: calculatedOverall,
      vocabularyScore: vocab,
      grammarScore: grammar,
      pronunciationScore: pronunciation,
      fluencyRating: result.fluencyRating || 'Beginner',
      feedback: result.feedback || "Bom esforço!",
      transcript: transcript
    };
  } catch (error) {
    console.error("Evaluation error:", error);
    return {
      overallScore: 50,
      vocabularyScore: 50,
      grammarScore: 50,
      pronunciationScore: 50,
      fluencyRating: 'Beginner',
      feedback: "Não foi possível gerar um relatório detalhado devido a um problema de conexão, mas bom trabalho na prática!",
      transcript: transcript
    };
  }
};
