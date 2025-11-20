import { GoogleGenAI } from "@google/genai";

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:audio/webm;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const generateNotesFromAudio = async (audioBlob: Blob): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const base64Audio = await blobToBase64(audioBlob);

    // Determine mime type from blob, default to standard web audio if missing
    const mimeType = audioBlob.type || 'audio/webm';

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Audio
            }
          },
          {
            text: `
            You are an expert academic note-taker. Listen to this classroom recording and generate a comprehensive set of notes.
            
            Please follow this structure:
            1. **Lecture Topic**: A concise title for the lecture.
            2. **Executive Summary**: A 2-3 sentence summary of the main points.
            3. **Key Concepts**: A list of the most important definitions or theories discussed.
            4. **Detailed Notes**: Use bullet points, sub-bullets, and bold text to organize the lecture content logically. Group related ideas together.
            5. **Action Items / Homework**: If any assignments or follow-up tasks were mentioned, list them. If none, omit this section.
            
            Format the output in clean Markdown.
            `
          }
        ]
      }
    });

    return response.text || "No notes could be generated.";
  } catch (error) {
    console.error("Error generating notes:", error);
    throw error;
  }
};