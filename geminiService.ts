import { GoogleGenAI, Modality } from "@google/genai";

const fileToGenerativePart = async (file: File) => {
  return new Promise<{ inlineData: { data: string; mimeType: string } }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      const base64Content = base64Data.split(',')[1];
      resolve({
        inlineData: {
          data: base64Content,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const generateScript = async (
  file: File, 
  stylePrompt: string, 
  toneLabel: string
): Promise<string> => {
  // Create a new instance for every call to ensure it uses the latest API key
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const imagePart = await fileToGenerativePart(file);
  
  const prompt = `
    당신은 전문 영상 스크립트 작가입니다. 
    아래 제공된 이미지를 분석하고, 다음 스타일과 톤에 맞춰 나레이션 스크립트를 작성해주세요.
    
    [스타일 지침]
    ${stylePrompt}
    
    [톤 지침]
    ${toneLabel}
    
    [필수 제약사항]
    1. 이미지를 보고 내용을 파악하여 자연스럽게 연결되도록 작성하세요.
    2. 반드시 공백 포함 130글자 이내로 작성하세요.
    3. 오직 스크립트 내용만 출력하세요 (설명이나 따옴표 제외).
    4. 한국어로 작성하세요.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [imagePart, { text: prompt }]
    }
  });

  const text = response.text;
  if (!text) throw new Error("Generated script is empty");
  return text.trim();
};

export const generateSpeech = async (
  text: string,
  voiceName: string
): Promise<Uint8Array> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { 
            voiceName: voiceName
          },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  
  if (base64Audio) {
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
  
  throw new Error("TTS generation failed: No audio data received");
};