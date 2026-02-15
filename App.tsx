import React, { useState, useEffect, useRef } from 'react';
import { StepWizard } from './components/StepWizard';
import { AspectRatioStep, StyleStep, VoiceStep, ToneStep, UploadStep, ScriptStep, AudioGenerationStep, PreviewStep } from './components/Steps';
import { AppState, AppStep, Slide, AspectRatio } from './types';
import { STYLE_OPTIONS, TONE_OPTIONS, VOICE_OPTIONS } from './constants';
import { generateScript, generateScriptsBatch, generateSpeech } from './services/geminiService';
import { decodeAudioPCM, getAdjustedDuration } from './utils';
import { Key, ExternalLink, ShieldCheck, Loader2 } from 'lucide-react';

const STEPS_CONFIG = [
  { title: "화면 비율 선택", desc: "영상의 용도를 선택해주세요." },
  { title: "영상 스타일", desc: "분위기에 맞는 스타일을 골라주세요." },
  { title: "목소리 선택", desc: "가장 잘 어울리는 성우를 선택하세요." },
  { title: "톤 & 매너", desc: "말하기의 느낌을 결정합니다." },
  { title: "파일 업로드", desc: "이미지(JPG, PNG) 파일을 올려주세요." },
  { title: "스크립트 편집", desc: "나레이션 대본을 작성합니다." },
  { title: "오디오 생성", desc: "나레이션 음성을 생성합니다." },
  { title: "동영상 완성", desc: "마지막으로 영상을 확인하고 만듭니다." },
];

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 6,
  baseDelay: number = 1000, 
  onInvalidKey?: () => void
): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorStr = (error.message || JSON.stringify(error)).toLowerCase();
      if (errorStr.includes('requested entity was not found')) {
        onInvalidKey?.();
        throw new Error("유효하지 않은 API 키입니다. 다시 선택해주세요.");
      }
      const isQuotaError = errorStr.includes('429') || errorStr.includes('resource_exhausted') || errorStr.includes('quota');
      if (isQuotaError && i < maxRetries - 1) {
        const delay = (baseDelay * Math.pow(2, i)) + Math.floor(Math.random() * 500);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export default function App() {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [state, setState] = useState<AppState>({
    step: AppStep.AspectRatio,
    aspectRatio: '16:9',
    styleId: 'general',
    voiceId: 'Zephyr',
    voiceSpeed: 1.0,
    toneId: 'moderate',
    slides: [],
    isGeneratingVideo: false,
  });
  
  const [videoProgress, setVideoProgress] = useState(0);
  const [audioProgress, setAudioProgress] = useState(0);
  const [isGeneratingAudioBatch, setIsGeneratingAudioBatch] = useState(false);
  const [isGeneratingScriptBatch, setIsGeneratingScriptBatch] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    // @ts-ignore
    const result = await window.aistudio.hasSelectedApiKey();
    setHasKey(result);
  };

  const handleOpenSelectKey = async () => {
    // @ts-ignore
    await window.aistudio.openSelectKey();
    setHasKey(true);
  };

  const handleInvalidKey = () => {
    setHasKey(false);
    alert("API 키에 문제가 발생했습니다. 다시 선택해주세요.");
  };

  const nextStep = () => {
    if (state.step === AppStep.Preview) {
      handleGenerateVideo();
      return;
    }
    setState(prev => ({ ...prev, step: Math.min(prev.step + 1, AppStep.Preview) }));
  };

  const prevStep = () => setState(prev => ({ ...prev, step: Math.max(prev.step - 1, 0) }));

  const generateSingleScript = async (slideId: string) => {
    const slide = state.slides.find(s => s.id === slideId);
    if (!slide) return;
    const styleOpt = STYLE_OPTIONS.find(s => s.id === state.styleId);
    const toneOpt = TONE_OPTIONS.find(t => t.id === state.toneId);

    setState(prev => ({
      ...prev,
      slides: prev.slides.map(s => s.id === slideId ? { ...s, isGeneratingScript: true } : s)
    }));

    try {
      const script = await retryWithBackoff(
        () => generateScript(slide.file, styleOpt?.prompt || '', toneOpt?.label || ''),
        5, 1000, handleInvalidKey
      );
      setState(prev => ({
        ...prev,
        slides: prev.slides.map(s => s.id === slideId ? { ...s, script, isGeneratingScript: false, audioBytes: undefined } : s)
      }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        slides: prev.slides.map(s => s.id === slideId ? { ...s, isGeneratingScript: false } : s)
      }));
    }
  };

  // ULTIMATE SPEED: Batch Processing all slides at once
  const generateAllScripts = async () => {
    if (isGeneratingScriptBatch || state.slides.length === 0) return;
    setIsGeneratingScriptBatch(true);

    const styleOpt = STYLE_OPTIONS.find(s => s.id === state.styleId);
    const toneOpt = TONE_OPTIONS.find(t => t.id === state.toneId);

    // Set all slides to loading
    setState(prev => ({
      ...prev,
      slides: prev.slides.map(s => ({ ...s, isGeneratingScript: true }))
    }));
    
    try {
      const files = state.slides.map(s => s.file);
      const scripts = await retryWithBackoff(
        () => generateScriptsBatch(files, styleOpt?.prompt || '', toneOpt?.label || ''),
        3, 1000, handleInvalidKey
      );

      setState(prev => ({
        ...prev,
        slides: prev.slides.map((s, i) => ({
          ...s,
          script: scripts[i] || s.script,
          isGeneratingScript: false,
          audioBytes: undefined
        }))
      }));
    } catch (error) {
      console.error("Batch script generation failed, falling back to sequential", error);
      // Fallback to sequential if batch fails (e.g. context too long)
      for (const slide of state.slides) {
        await generateSingleScript(slide.id);
      }
    } finally {
      setIsGeneratingScriptBatch(false);
    }
  };

  const generateAllAudios = async () => {
    if (isGeneratingAudioBatch) return;
    setIsGeneratingAudioBatch(true);
    setAudioProgress(0);
    const slidesToProcess = state.slides.filter(s => !s.audioBytes);
    let completed = state.slides.length - slidesToProcess.length;

    try {
      const CHUNK_SIZE = 3; 
      for (let i = 0; i < state.slides.length; i += CHUNK_SIZE) {
        const chunk = state.slides.slice(i, i + CHUNK_SIZE).filter(s => !s.audioBytes);
        await Promise.all(chunk.map(async (slide) => {
          setState(prev => ({
            ...prev,
            slides: prev.slides.map(s => s.id === slide.id ? { ...s, isGeneratingAudio: true } : s)
          }));
          try {
            const bytes = await retryWithBackoff(
              () => generateSpeech(slide.script, state.voiceId),
              5, 1000, handleInvalidKey
            );
            setState(prev => ({
              ...prev,
              slides: prev.slides.map(s => s.id === slide.id ? { ...s, audioBytes: bytes, isGeneratingAudio: false } : s)
            }));
            completed++;
            setAudioProgress((completed / state.slides.length) * 100);
          } catch (error) {
            setState(prev => ({
              ...prev,
              slides: prev.slides.map(s => s.id === slide.id ? { ...s, isGeneratingAudio: false } : s)
            }));
          }
        }));
      }
    } finally {
      setIsGeneratingAudioBatch(false);
    }
  };

  const handlePreviewAudio = async (slideId: string, text: string) => {
    if (!text) return;
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const bytes = await retryWithBackoff(
        () => generateSpeech(text, state.voiceId),
        3, 1000, handleInvalidKey
      );
      if (bytes) {
        setState(prev => ({
          ...prev,
          slides: prev.slides.map(s => s.id === slideId ? { ...s, audioBytes: bytes } : s)
        }));
        const audioBuffer = await decodeAudioPCM(bytes, audioContext);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.playbackRate.value = state.voiceSpeed;
        source.connect(audioContext.destination);
        source.start();
      }
    } catch (e) {}
  };

  const handleGenerateVideo = async () => {
    if (state.isGeneratingVideo) return;
    setState(prev => ({ ...prev, isGeneratingVideo: true }));
    setVideoProgress(0);
    setVideoUrl(null);

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Canvas context failed");

      // ULTRA HD 4K Resolution
      const width = 3840, height = 2160;
      canvas.width = state.aspectRatio === '16:9' ? width : height;
      canvas.height = state.aspectRatio === '16:9' ? height : width;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const streamDest = audioContext.createMediaStreamDestination();
      const canvasStream = canvas.captureStream(30);
      const combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...streamDest.stream.getAudioTracks()]);
      
      const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m)) || '';
      
      // CRITICAL: 50Mbps for 4K quality
      const mediaRecorder = new MediaRecorder(combinedStream, { 
        mimeType,
        videoBitsPerSecond: 50000000 
      });
      
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = e => e.data.size > 0 && chunks.push(e.data);
      mediaRecorder.start();

      for (let i = 0; i < state.slides.length; i++) {
        const slide = state.slides[i];
        if (!slide.audioBytes) throw new Error("오디오가 누락되었습니다.");

        const audioBuffer = await decodeAudioPCM(slide.audioBytes, audioContext);
        const img = new Image();
        img.src = slide.previewUrl;
        await new Promise(r => img.onload = r);

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const canvasRatio = canvas.width / canvas.height;
        const imgRatio = img.width / img.height;
        let dw, dh, ox, oy;

        if (imgRatio > canvasRatio) { 
          dw = canvas.width;
          dh = canvas.width / imgRatio;
          ox = 0;
          oy = (canvas.height - dh) / 2;
        } else {
          dh = canvas.height;
          dw = canvas.height * imgRatio;
          ox = (canvas.width - dw) / 2;
          oy = 0;
        }
        
        ctx.drawImage(img, ox, oy, dw, dh);

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.playbackRate.value = state.voiceSpeed;
        source.connect(streamDest);
        source.start();

        const duration = getAdjustedDuration(audioBuffer.duration, state.voiceSpeed);
        await new Promise(resolve => setTimeout(resolve, duration * 1000 + 400));
        setVideoProgress(((i + 1) / state.slides.length) * 100);
      }

      mediaRecorder.stop();
      await new Promise(r => mediaRecorder.onstop = r);
      setVideoUrl(URL.createObjectURL(new Blob(chunks, { type: 'video/webm' })));
      setState(prev => ({ ...prev, isGeneratingVideo: false }));
    } catch (e: any) {
      alert("동영상 생성 중 오류가 발생했습니다.");
      setState(prev => ({ ...prev, isGeneratingVideo: false }));
    }
  };

  if (hasKey === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (hasKey === false) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-8">
          <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
            <Key className="w-10 h-10" />
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">AI Narray 시작하기</h1>
            <p className="text-gray-500 text-lg leading-relaxed">
              안정적인 서비스를 위해 빌링(결제)이 활성화된 프로젝트의 API 키가 필요합니다.
            </p>
          </div>
          
          <button
            onClick={handleOpenSelectKey}
            className="w-full py-5 bg-blue-600 text-white rounded-2xl text-xl font-bold shadow-2xl hover:bg-blue-700 transition-all transform active:scale-[0.98] flex items-center justify-center gap-3"
          >
            <ShieldCheck className="w-6 h-6" />
            API 키 선택 및 연결
          </button>

          <div className="pt-8 border-t border-gray-100 flex flex-col gap-3">
            <a 
              href="https://ai.google.dev/gemini-api/docs/billing" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 font-medium hover:underline flex items-center justify-center gap-1.5"
            >
              빌링 가이드라인 확인하기 <ExternalLink className="w-4 h-4" />
            </a>
            <p className="text-xs text-gray-400">연결된 키는 오직 귀하의 요청 작업에만 안전하게 사용됩니다.</p>
          </div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (state.step) {
      case AppStep.AspectRatio: return <AspectRatioStep value={state.aspectRatio} onChange={v => setState(s => ({ ...s, aspectRatio: v }))} />;
      case AppStep.VideoStyle: return <StyleStep selectedId={state.styleId} onChange={v => setState(s => ({ ...s, styleId: v }))} />;
      case AppStep.Voice: return <VoiceStep voiceId={state.voiceId} speed={state.voiceSpeed} onVoiceChange={v => setState(s => ({ ...s, voiceId: v }))} onSpeedChange={v => setState(s => ({ ...s, voiceSpeed: v }))} />;
      case AppStep.Tone: return <ToneStep selectedId={state.toneId} onChange={v => setState(s => ({ ...s, toneId: v }))} />;
      case AppStep.Upload: return <UploadStep slides={state.slides} aspectRatio={state.aspectRatio} onAddSlides={f => {
        const ns = f.map(file => ({ id: Math.random().toString(36).substr(2, 9), file, previewUrl: URL.createObjectURL(file), script: '', isGeneratingScript: false, isGeneratingAudio: false }));
        setState(s => ({ ...s, slides: [...s.slides, ...ns] }));
      }} onRemoveSlide={id => setState(s => ({ ...s, slides: s.slides.filter(sl => sl.id !== id) }))} />;
      case AppStep.Script: return (
        <ScriptStep 
          slides={state.slides} 
          aspectRatio={state.aspectRatio} 
          onUpdateScript={(id, txt) => setState(s => ({ ...s, slides: s.slides.map(sl => sl.id === id ? { ...sl, script: txt, audioBytes: undefined } : sl) }))} 
          onPreviewAudio={handlePreviewAudio}
          onGenerateAll={generateAllScripts}
          onGenerateSingle={generateSingleScript}
          isGeneratingBatch={isGeneratingScriptBatch}
        />
      );
      case AppStep.Audio: return <AudioGenerationStep slides={state.slides} isGenerating={isGeneratingAudioBatch} onGenerate={generateAllAudios} progress={audioProgress} />;
      case AppStep.Preview: return <PreviewStep slides={state.slides} isGenerating={state.isGeneratingVideo} onGenerate={handleGenerateVideo} progress={videoProgress} videoUrl={videoUrl} />;
      default: return null;
    }
  };

  const canProceed = () => {
    if (state.step === AppStep.Upload) return state.slides.length > 0;
    if (state.step === AppStep.Script) return state.slides.every(s => s.script.length > 0 && !s.isGeneratingScript) && !isGeneratingScriptBatch;
    if (state.step === AppStep.Audio) return state.slides.every(s => !!s.audioBytes) && !isGeneratingAudioBatch;
    if (state.step === AppStep.Preview) return !state.isGeneratingVideo; 
    return true;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center">
      <header className="w-full bg-white border-b border-gray-200 py-4 px-6 shadow-sm flex items-center justify-between">
        <h1 className="text-2xl font-bold text-blue-600 flex items-center">
          <span className="bg-blue-600 text-white p-1 rounded mr-2 text-sm">AI</span>
          Narray
        </h1>
        <div className="flex space-x-2">
           {STEPS_CONFIG.map((_, idx) => (
             <div key={idx} className={`w-2 h-2 rounded-full ${idx === state.step ? 'bg-blue-600' : idx < state.step ? 'bg-blue-300' : 'bg-gray-200'}`} />
           ))}
        </div>
      </header>
      <main className="flex-1 w-full max-w-5xl">
        <StepWizard title={STEPS_CONFIG[state.step].title} description={STEPS_CONFIG[state.step].desc} canNext={canProceed()} canPrev={state.step > 0 && !state.isGeneratingVideo && !isGeneratingAudioBatch && !isGeneratingScriptBatch} onNext={nextStep} onPrev={prevStep} isLastStep={state.step === AppStep.Preview}>
          {renderContent()}
        </StepWizard>
      </main>
    </div>
  );
}