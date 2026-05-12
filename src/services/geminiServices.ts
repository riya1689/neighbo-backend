import { GoogleGenerativeAI } from "@google/generative-ai"; 
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * AI connection check function
 */
export const verifyGeminiConnection = async () => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    // Send a tiny prompt to test the API Key
    await model.generateContent("Hello");
    console.log("✅ Neighbo AI Connected Successfully!");
  } catch (error: any) {
    console.error("❌ Neighbo AI Connection Failed:", error.message);
    console.error("   -> Check your GEMINI_API_KEY in .env file");
  }
};

const systemPrompt = `
You are "Neighbo AI," a specialized community assistant for the Neighbo platform. Your purpose is to help users with community-related questions, platform navigation, and general neighborly advice.

**CRITICAL RULES:**
1. You are friendly, helpful, and community-oriented.
2. If asked about personal identity, state you are an AI assistant for Neighbo.
3. Encourage positive community interaction and local engagement.
4. If a user expresses serious distress or emergency, guide them to local authorities or professional services immediately.
`;

/**
 * Split the response into bubbles for a better chat UI experience
 */
const splitResponseIntoBubbles = (text: string): string[] => {
  // 1. Split by double newlines first (common for separating paragraphs)
  let bubbles = text.split(/\n\s*\n/).filter(Boolean);

  // 2. If there's only one bubble and it's long, try splitting by sentences.
  if (bubbles.length === 1 && bubbles[0].length > 250) {
    bubbles = bubbles[0].match(/[^.!?]+[.!?]*/g) || [];
  }

  // 3. Clean up any extra whitespace from each bubble
  bubbles = bubbles.map((b) => b.trim()).filter(Boolean);

  // 4. Enforce the maximum of 5 bubbles
  if (bubbles.length > 5) {
    const firstFour = bubbles.slice(0, 4);
    const rest = bubbles.slice(4).join(" ");
    bubbles = [...firstFour, rest];
  }

  return bubbles.length > 0 ? bubbles : [text];
};

/**
 * Get AI response for text chat
 */
export const getAIResponse = async (userMessage: string, chatHistory: any[] = []) => {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: systemPrompt,
    });

    const chat = model.startChat({
      history: chatHistory.map((msg: any) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.parts[0].text }],
      })),
    });

    const result = await chat.sendMessage(userMessage);
    const response = await result.response;
    const fullText = response.text();

    return splitResponseIntoBubbles(fullText);
  } catch (error) {
    console.error("Error getting AI response:", error);
    return ["I'm having trouble connecting right now. Please try again in a moment."];
  }
};