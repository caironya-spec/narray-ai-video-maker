export enum AppStep {
  AspectRatio = 0,
  VideoStyle = 1,
  Voice = 2,
  Tone = 3,
  Upload = 4,
  Script = 5,
  Audio = 6, // New Step for sequential audio generation
  Preview = 7,
}

export type AspectRatio = '16:9' | '9:16';

export interface VoiceOption {
  id: string;
  name: string;
  description: string;
  gender: 'Male' | 'Female';
}

export interface StyleOption {
  id: string;
  label: string;
  description: string;
  prompt: string;
}

export interface ToneOption {
  id: string;
  label: string;
  description: string;
}

export interface Slide {
  id: string;
  file: File;
  previewUrl: string;
  script: string;
  isGeneratingScript: boolean;
  isGeneratingAudio: boolean; // Tracking TTS state per slide
  audioBytes?: Uint8Array; 
}

export interface AppState {
  step: AppStep;
  aspectRatio: AspectRatio;
  styleId: string;
  voiceId: string;
  voiceSpeed: number;
  toneId: string;
  slides: Slide[];
  isGeneratingVideo: boolean;
}