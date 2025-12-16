import { GoogleGenAI } from "@google/genai";

export const API_KEY = import.meta.env.VITE_API_KEY || '';
export const ai = new GoogleGenAI({ apiKey: API_KEY });

export const checkApiKey = () => {
  if (!API_KEY) {
    console.error("API_KEY is missing. Please set it in the environment.");
    return false;
  }
  return true;
};