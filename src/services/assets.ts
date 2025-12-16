import { Type, GenerateContentResponse } from "@google/genai";
import { ai, checkApiKey, API_KEY } from './config';
import { retryWithBackoff, cleanJson } from './utils';
import { ANALYSIS_PROMPT_TEMPLATE, DIAGRAM_PROMPT_TEMPLATE, CHART_PROMPT_TEMPLATE, RAG_BRAIN_INSTRUCTION } from './prompts';

/**
 * INTELLIGENCE ENGINE (The "Brain")
 * Handled via stateless text requests to Gemini 2.5 Flash
 */
export const generateBrainResponse = async (
  query: string,
  documents: string[],
  history: { role: string, content: string }[]
): Promise<string> => {
  if (!checkApiKey()) return "System Error: API Key missing.";

  // Prepare Context
  const docText = documents.length > 0 
    ? documents.join('\n\n') 
    : "NO DOCUMENTS AVAILABLE. DATABASE EMPTY.";
  
  const systemPrompt = RAG_BRAIN_INSTRUCTION.replace('{{DOCUMENTS}}', docText);

  // Convert history to prompt context format (simple text append for now, or true chat structure)
  // We'll stick to a direct generation for speed and control.
  const fullPrompt = `
    ${systemPrompt}
    
    RECENT HISTORY:
    ${history.slice(-3).map(h => `${h.role.toUpperCase()}: ${h.content}`).join('\n')}
    
    CURRENT USER QUERY:
    ${query}
    
    YOUR RESPONSE (Text to be spoken):
  `;

  try {
    const res = (await retryWithBackoff(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: fullPrompt,
    }), 3, 1000, 'GenerateBrainResponse')) as GenerateContentResponse;

    return res.text || "I processed the data but received no output.";
  } catch (e: any) {
    console.error("Brain Error:", e);
    return `System Alert: Intelligence Engine failed. ${e.message}`;
  }
};


/**
 * BACKGROUND AGENT:
 * 1. Checks if the query was maritime related (for admin alerts).
 * 2. Checks if visual assets are needed.
 */
export const analyzeInteraction = async (
  query: string, 
  response: string
): Promise<{ 
  isMaritime: boolean;
  missingKnowledge: boolean;
  assetNeeded: boolean; 
  assetType: 'image' | 'video' | 'chart' | 'diagram' | 'none'; 
  assetDescription: string;
  reason: 'user_request' | 'system_suggestion' | 'none';
}> => {
  if (!checkApiKey()) return { isMaritime: true, missingKnowledge: false, assetNeeded: false, assetType: 'none', assetDescription: '', reason: 'none' };

  const prompt = ANALYSIS_PROMPT_TEMPLATE.replace('{{QUERY}}', query).replace('{{RESPONSE}}', response);

  try {
    const res = (await retryWithBackoff(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isMaritime: { type: Type.BOOLEAN },
            missingKnowledge: { type: Type.BOOLEAN },
            assetNeeded: { type: Type.BOOLEAN },
            assetType: { type: Type.STRING, enum: ['image', 'video', 'chart', 'diagram', 'none'] },
            assetDescription: { type: Type.STRING },
            reason: { type: Type.STRING, enum: ['user_request', 'system_suggestion', 'none'] }
          }
        }
      }
    }), 3, 1000, 'AnalyzeInteraction')) as GenerateContentResponse;

    // Robust parsing using cleanJson
    const text = cleanJson(res.text || '{}');
    return JSON.parse(text);
  } catch (e) {
    console.error("Analysis Error after retries:", e);
    return { isMaritime: true, missingKnowledge: false, assetNeeded: false, assetType: 'none', assetDescription: '', reason: 'none' };
  }
};

export const generateImage = async (prompt: string): Promise<string> => {
  if (!checkApiKey()) throw new Error("API Key missing");
  
  const response = (await retryWithBackoff(() => ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: prompt,
  }), 3, 1000, 'GenerateImage')) as GenerateContentResponse;

  for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
      }
  }
  throw new Error("Model generated no image data.");
};

export const generateVideo = async (prompt: string): Promise<string> => {
  if (!checkApiKey()) throw new Error("API Key missing");
  
  // Retry the initial request
  let operation: any = await retryWithBackoff(() => ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: `Cinematic maritime footage: ${prompt}`,
    config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
  }), 3, 2000, 'GenerateVideo-Init');

  // Poll with retry logic inside the loop
  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await retryWithBackoff(
      () => ai.operations.getVideosOperation({ operation }), 
      3, 
      1000, 
      'GenerateVideo-Poll'
    );
  }
  
  const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!uri) throw new Error("Video generation completed but returned no URI.");
  
  return `${uri}&key=${API_KEY}`;
};

export const generateChartData = async (description: string): Promise<any[]> => {
  if (!checkApiKey()) throw new Error("API Key missing");
  const prompt = CHART_PROMPT_TEMPLATE.replace('{{DESCRIPTION}}', description);
  
  const response = (await retryWithBackoff(() => ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { 
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            value: { type: Type.NUMBER }
          }
        }
      } 
    }
  }), 3, 1000, 'GenerateChart')) as GenerateContentResponse;

  const text = cleanJson(response.text || "[]");
  return JSON.parse(text);
};

export const generateDiagram = async (description: string): Promise<string> => {
  if (!checkApiKey()) throw new Error("API Key missing");
  
  const prompt = DIAGRAM_PROMPT_TEMPLATE.replace('{{DESCRIPTION}}', description);
  
  const response = (await retryWithBackoff(() => ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  }), 3, 1000, 'GenerateDiagram')) as GenerateContentResponse;

  let code = response.text || "";

  // 1. Remove Markdown Code Blocks (matches ```mermaid content ``` or ``` content ```)
  code = code.replace(/```mermaid/gi, '');
  code = code.replace(/```/g, '');
  
  // 2. Trim whitespace
  code = code.trim();

  // 3. Remove "mermaid" keyword if it accidentally starts the line (common artifact if user types 'mermaid graph...')
  if (code.toLowerCase().startsWith('mermaid')) {
      code = code.substring(7).trim();
  }

  // 4. Validate start and strip preamble if exists
  const validStarts = ['graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 'stateDiagram', 'erDiagram', 'gantt', 'pie', 'mindmap', 'timeline'];
  
  // Find the first occurrence of any valid start token
  let firstIndex = -1;
  for (const start of validStarts) {
      const idx = code.indexOf(start);
      if (idx !== -1) {
          if (firstIndex === -1 || idx < firstIndex) {
              firstIndex = idx;
          }
      }
  }

  if (firstIndex !== -1) {
      // Strip anything before the diagram definition
      code = code.substring(firstIndex);
  } else {
      // Fallback: If no valid start found, it might be a custom or new mermaid type, or garbage.
      // We check if it looks like code (has brackets or arrows)
      if (!code.includes('-->') && !code.includes('{') && !code.includes(';')) {
           throw new Error("Generated content does not resemble a valid Mermaid diagram structure.");
      }
  }
  
  if (!code) throw new Error("Model generated empty diagram code.");
  return code;
};
