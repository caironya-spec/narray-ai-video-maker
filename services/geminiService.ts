import { GoogleGenAI, Modality, Type } from "@google/genai";

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

export const generateScriptsBatch = async (
  files: File[],
  stylePrompt: string,
  toneLabel: string
): Promise<string[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Convert all files to generative parts in parallel
  const imageParts = await Promise.all(files.map(file => fileToGenerativePart(file)));
  
  const prompt = `
    당신은 전문 영상 스크립트 작가입니다. 
    제공된 모든 이미지들을 순서대로 분석하여, 전체적인 흐름이 이어지는 고품질 나레이션 스크립트를 작성하세요.
    
    [스타일 지침]
    ${stylePrompt}
    
    [톤 지침]
    ${toneLabel}
    
    [필수 제약사항]
    1. 각 이미지별로 독립적이면서도 앞뒤 내용이 자연스럽게 연결되어야 합니다.
    2. 각 페이지당 반드시 공백 포함 130글자 이내로 작성하세요.
    3. JSON 배열 형태로 각 페이지의 스크립트만 출력하세요.
    4. 한국어로 작성하세요.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [...imageParts, { text: prompt }]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            index: { type: Type.INTEGER, description: "슬라이드 번호 (0부터 시작)" },
            script: { type: Type.STRING, description: "해당 슬라이드의 나레이션 스크립트" }
          },
          required: ["index", "script"]
        }
      }
    }
  });

  try {
    const results = JSON.parse(response.text || "[]");
    // Sort by index to ensure correct order
    return results.sort((a: any, b: any) => a.index - b.index).map((item: any) => item.script);
  } catch (e) {
    console.error("Failed to parse batch scripts:", e);
    throw new Error("스크립트 배치 생성 파싱 실패");
  }
};

export const generateScript = async (
  file: File, 
  stylePrompt: string, 
  toneLabel: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const imagePart = await fileToGenerativePart(file);
  
  const prompt = `
    이미지를 분석하여 다음 지침에 따라 130자 이내의 한국어 나레이션 스크립트를 작성하세요.
    스타일: ${stylePrompt}
    톤: ${toneLabel}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [imagePart, { text: prompt }]
    }
  });

  return response.text?.trim() || "";
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
          prebuiltVoiceConfig: { voiceName },
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
  throw new Error("TTS generation failed");
};