import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import * as pdfjsLib from 'pdfjs-dist';

const pdfjs = (pdfjsLib as any).default || pdfjsLib;

if (pdfjs.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Decodes raw 16-bit PCM data returned by Gemini TTS.
 */
export async function decodeAudioPCM(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export function getAdjustedDuration(originalDuration: number, speedFactor: number) {
  return originalDuration / speedFactor;
}

export async function convertPdfToImages(file: File): Promise<File[]> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
       pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
    }
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const images: File[] = [];
    
    // SCALE 6.0 provides enough resolution for 4K video (approx 5000px width for standard A4)
    const RENDER_SCALE = 6.0;
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) continue;
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      
      await page.render({ canvasContext: context, viewport: viewport }).promise;
      
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.98));
      if (blob) {
        const imageName = `${file.name.replace(/\.pdf$/i, '')}_page_${i}.jpg`;
        images.push(new File([blob], imageName, { type: 'image/jpeg' }));
      }
    }
    return images;
  } catch (error) {
    console.error("Error converting PDF to images:", error);
    throw new Error("PDF 파일을 이미지로 변환하는 데 실패했습니다.");
  }
}