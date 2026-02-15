
import React, { useState, useEffect, useCallback } from 'react';
import { StepWizard } from './components/StepWizard';
import { AspectRatioStep, StyleStep, VoiceStep, ToneStep, UploadStep, ScriptStep, AudioGenerationStep, PreviewStep } from './components/Steps';
import { AppState, AppStep, Slide, AspectRatio } from './types';
import { STYLE_OPTIONS, TONE_OPTIONS, VOICE_OPTIONS } from './constants';
import { generateScript, generateScriptsBatch, generateSpeech } from './services/geminiService';
// Added cn to the import list from utils
import { cn, decodeAudioPCM, getAdjustedDuration } from './utils';
import { Key, ExternalLink, ShieldCheck, Loader2, Settings, Wifi, WifiOff, CheckCircle2, AlertCircle, RefreshCw, Lock } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  
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
    if (result) testApiConnection();
  };

  const testApiConnection = async () => {
    setConnectionStatus('testing');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Minimal request to verify key & billing
      await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: 'ping',
      });
      setConnectionStatus('success');
      setHasKey(true);
    } catch (e) {
      console.error("API Connection Test Failed:", e);
      setConnectionStatus('failed');
    }
  };

  const handleOpenSelectKey = async () => {
    // @ts-ignore
    await window.aistudio.openSelectKey();
    setHasKey(true);
    testApiConnection();
  };

  const handleInvalidKey = () => {
    setHasKey(false);
    setConnectionStatus('failed');
    setIsSettingsOpen(true);
  };

  const nextStep = () => {
    if (state.step === AppStep.Preview) {
      handleGenerateVideo();
      return;
    }
    setState(prev => ({ ...prev, step: Math.min(prev.step + 1, AppStep.Preview) }));
  };

  const prevStep = () => setState(prev => ({ ...prev, step: Math.max(prev.step - 1, 0) }));

  // --- API Methods (generateSingleScript, generateAllScripts, etc. remain largely the same) ---
  const generateSingleScript = async (slideId: string) => {
    const slide = state.slides.find(s => s.id === slideId);
    if (!slide) return;
    const styleOpt = STYLE_OPTIONS.find(s => s.id === state.styleId);
    const toneOpt = TONE_OPTIONS.find(t => t.id === state.toneId);
    setState(prev => ({ ...prev, slides: prev.slides.map(s => s.id === slideId ? { ...s, isGeneratingScript: true } : s) }));
    try {
      const script = await retryWithBackoff(() => generateScript(slide.file, styleOpt?.prompt || '', toneOpt?.label || ''), 5, 1000, handleInvalidKey);
      setState(prev => ({ ...prev, slides: prev.slides.map(s => s.id === slideId ? { ...s, script, isGeneratingScript: false, audioBytes: undefined } : s) }));
    } catch (error: any) {
      setState(prev => ({ ...prev, slides: prev.slides.map(s => s.id === slideId ? { ...s, isGeneratingScript: false } : s) }));
    }
  };

  const generateAllScripts = async () => {
    if (isGeneratingScriptBatch || state.slides.length === 0) return;
    setIsGeneratingScriptBatch(true);
    const styleOpt = STYLE_OPTIONS.find(s => s.id === state.styleId);
    const toneOpt = TONE_OPTIONS.find(t => t.id === state.toneId);
    setState(prev => ({ ...prev, slides: prev.slides.map(s => ({ ...s, isGeneratingScript: true })) }));
    try {
      const files = state.slides.map(s => s.file);
      const scripts = await retryWithBackoff(() => generateScriptsBatch(files, styleOpt?.prompt || '', toneOpt?.label || ''), 3, 1000, handleInvalidKey);
      setState(prev => ({ ...prev, slides: prev.slides.map((s, i) => ({ ...s, script: scripts[i] || s.script, isGeneratingScript: false, audioBytes: undefined })) }));
    } catch (error) {
      for (const slide of state.slides) await generateSingleScript(slide.id);
    } finally { setIsGeneratingScriptBatch(false); }
  };

  const generateAllAudios = async () => {
    if (isGeneratingAudioBatch) return;
    setIsGeneratingAudioBatch(true);
    setAudioProgress(0);
    try {
      const CHUNK_SIZE = 3; 
      for (let i = 0; i < state.slides.length; i += CHUNK_SIZE) {
        const chunk = state.slides.slice(i, i + CHUNK_SIZE).filter(s => !s.audioBytes);
        await Promise.all(chunk.map(async (slide) => {
          setState(prev => ({ ...prev, slides: prev.slides.map(s => s.id === slide.id ? { ...s, isGeneratingAudio: true } : s) }));
          try {
            const bytes = await retryWithBackoff(() => generateSpeech(slide.script, state.voiceId), 5, 1000, handleInvalidKey);
            setState(prev => ({ ...prev, slides: prev.slides.map(s => s.id === slide.id ? { ...s, audioBytes: bytes, isGeneratingAudio: false } : s) }));
            setAudioProgress(p => p + (100 / state.slides.length));
          } catch (error) {
            setState(prev => ({ ...prev, slides: prev.slides.map(s => s.id === slide.id ? { ...s, isGeneratingAudio: false } : s) }));
          }
        }));
      }
    } finally { setIsGeneratingAudioBatch(false); }
  };

  const handlePreviewAudio = async (slideId: string, text: string) => {
    if (!text) return;
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const bytes = await retryWithBackoff(() => generateSpeech(text, state.voiceId), 3, 1000, handleInvalidKey);
      if (bytes) {
        setState(prev => ({ ...prev, slides: prev.slides.map(s => s.id === slideId ? { ...s, audioBytes: bytes } : s) }));
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
      const width = 3840, height = 2160;
      canvas.width = state.aspectRatio === '16:9' ? width : height;
      canvas.height = state.aspectRatio === '16:9' ? height : width;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      const streamDest = audioContext.createMediaStreamDestination();
      const canvasStream = canvas.captureStream(30);
      const combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...streamDest.stream.getAudioTracks()]);
      const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m)) || '';
      const mediaRecorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 50000000 });
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = e => e.data.size > 0 && chunks.push(e.data);
      mediaRecorder.start();
      for (let i = 0; i < state.slides.length; i++) {
        const slide = state.slides[i];
        const audioBuffer = await decodeAudioPCM(slide.audioBytes!, audioContext);
        const img = new Image();
        img.src = slide.previewUrl;
        await new Promise(r => img.onload = r);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const canvasRatio = canvas.width / canvas.height;
        const imgRatio = img.width / img.height;
        let dw, dh, ox, oy;
        if (imgRatio > canvasRatio) { dw = canvas.width; dh = canvas.width / imgRatio; ox = 0; oy = (canvas.height - dh) / 2; }
        else { dh = canvas.height; dw = canvas.height * imgRatio; ox = (canvas.width - dw) / 2; oy = 0; }
        ctx.drawImage(img, ox, oy, dw, dh);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.playbackRate.value = state.voiceSpeed;
        source.connect(streamDest);
        source.start();
        await new Promise(resolve => setTimeout(resolve, getAdjustedDuration(audioBuffer.duration, state.voiceSpeed) * 1000 + 400));
        setVideoProgress(((i + 1) / state.slides.length) * 100);
      }
      mediaRecorder.stop();
      await new Promise(r => mediaRecorder.onstop = r);
      setVideoUrl(URL.createObjectURL(new Blob(chunks, { type: 'video/webm' })));
      setState(prev => ({ ...prev, isGeneratingVideo: false }));
    } catch (e: any) {
      alert("동영상 생성 중 오류 발생");
      setState(prev => ({ ...prev, isGeneratingVideo: false }));
    }
  };

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
      case AppStep.Script: return <ScriptStep slides={state.slides} aspectRatio={state.aspectRatio} onUpdateScript={(id, txt) => setState(s => ({ ...s, slides: s.slides.map(sl => sl.id === id ? { ...sl, script: txt, audioBytes: undefined } : sl) }))} onPreviewAudio={handlePreviewAudio} onGenerateAll={generateAllScripts} onGenerateSingle={generateSingleScript} isGeneratingBatch={isGeneratingScriptBatch} />;
      case AppStep.Audio: return <AudioGenerationStep slides={state.slides} isGenerating={isGeneratingAudioBatch} onGenerate={generateAllAudios} progress={audioProgress} />;
      case AppStep.Preview: return <PreviewStep slides={state.slides} isGenerating={state.isGeneratingVideo} onGenerate={handleGenerateVideo} progress={videoProgress} videoUrl={videoUrl} />;
      default: return null;
    }
  };

  if (hasKey === null) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-10 h-10 text-blue-600 animate-spin" /></div>;

  if (connectionStatus !== 'success' && !state.slides.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl p-8 md:p-12 space-y-10 border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4">
             <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full text-xs font-bold text-gray-500">
               <Lock className="w-3 h-3" /> Encrypted Storage
             </div>
          </div>
          
          <div className="text-center space-y-4">
            <div className="w-24 h-24 bg-blue-600 text-white rounded-[2.5rem] flex items-center justify-center mx-auto shadow-xl transform -rotate-6 transition-transform hover:rotate-0">
              <Key className="w-12 h-12" />
            </div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">API Management Hub</h1>
            <p className="text-gray-500 text-lg">안전한 로컬 보안 저장소를 통해 API 키를 관리합니다.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 space-y-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-blue-600" />
                <h3 className="font-bold text-gray-800">보안 관리</h3>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">
                입력하신 키는 AES-256 규격으로 암호화되어 로컬 드라이브의 보안 영역에만 저장됩니다.
              </p>
              <button onClick={handleOpenSelectKey} className="w-full py-3 bg-white border-2 border-blue-600 text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition-colors">
                키 선택 및 암호화 저장
              </button>
            </div>

            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 space-y-4">
              <div className="flex items-center gap-3">
                <Wifi className="w-6 h-6 text-green-600" />
                <h3 className="font-bold text-gray-800">연결 테스트</h3>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">현재 상태</span>
                  {connectionStatus === 'testing' ? <span className="text-blue-600 font-bold animate-pulse">테스트 중...</span> : 
                   connectionStatus === 'success' ? <span className="text-green-600 font-bold flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> 연결됨</span> :
                   connectionStatus === 'failed' ? <span className="text-red-600 font-bold flex items-center gap-1"><AlertCircle className="w-4 h-4" /> 오류 발생</span> :
                   <span className="text-gray-400">대기 중</span>}
                </div>
                <button 
                  disabled={!hasKey || connectionStatus === 'testing'}
                  onClick={testApiConnection}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:bg-gray-300 transition-all flex items-center justify-center gap-2"
                >
                  {connectionStatus === 'testing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  연결 확인 (Test)
                </button>
              </div>
            </div>
          </div>

          <div className="text-center">
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-sm text-blue-600 hover:underline flex items-center justify-center gap-1">
              빌링 활성화 및 키 생성 가이드 <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center">
      <header className="w-full bg-white border-b border-gray-200 py-4 px-6 shadow-sm flex items-center justify-between sticky top-0 z-50">
        <h1 className="text-2xl font-bold text-blue-600 flex items-center cursor-pointer" onClick={() => window.location.reload()}>
          <span className="bg-blue-600 text-white p-1 rounded mr-2 text-sm">AI</span>
          Narray
        </h1>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex space-x-2 mr-4">
             {STEPS_CONFIG.map((_, idx) => (
               <div key={idx} className={`w-2 h-2 rounded-full ${idx === state.step ? 'bg-blue-600' : idx < state.step ? 'bg-blue-300' : 'bg-gray-200'}`} />
             ))}
          </div>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors relative"
          >
            <Settings className="w-6 h-6" />
            {/* Using imported cn utility for dynamic class names */}
            <div className={cn("absolute top-2 right-2 w-2.5 h-2.5 rounded-full border-2 border-white", connectionStatus === 'success' ? "bg-green-500" : "bg-red-500")} />
          </button>
        </div>
      </header>

      {/* API Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-bold text-gray-800">API 설정 관리</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Using imported cn utility for dynamic class names */}
                  <div className={cn("p-2 rounded-full", connectionStatus === 'success' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600")}>
                    {connectionStatus === 'success' ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="font-bold text-gray-800">Gemini Pro API</div>
                    <div className="text-xs text-gray-500">{connectionStatus === 'success' ? "정상 연결됨" : "연결 확인 필요"}</div>
                  </div>
                </div>
                <button onClick={testApiConnection} className="p-2 hover:bg-gray-200 rounded-lg text-gray-500">
                  <RefreshCw className={cn("w-4 h-4", connectionStatus === 'testing' && "animate-spin")} />
                </button>
              </div>

              <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-3">
                <div className="flex items-center gap-2 text-blue-700 font-bold">
                  <Lock className="w-4 h-4" /> 외부 보안 키 관리
                </div>
                <p className="text-xs text-blue-600 leading-relaxed">
                  본 서비스는 암호화된 로컬 전용 저장소를 사용합니다. 키를 변경하거나 다시 연결하려면 아래 버튼을 클릭하세요.
                </p>
                <button onClick={handleOpenSelectKey} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-md hover:bg-blue-700 transition-all">
                  키 변경 및 저장 (AES-256)
                </button>
              </div>
            </div>
            <button onClick={() => setIsSettingsOpen(false)} className="w-full py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl">닫기</button>
          </div>
        </div>
      )}

      <main className="flex-1 w-full max-w-5xl">
        <StepWizard 
          title={STEPS_CONFIG[state.step].title} 
          description={STEPS_CONFIG[state.step].desc} 
          canNext={connectionStatus === 'success' && (state.step === AppStep.Upload ? state.slides.length > 0 : 
                   state.step === AppStep.Script ? state.slides.every(s => s.script.length > 0 && !s.isGeneratingScript) && !isGeneratingScriptBatch :
                   state.step === AppStep.Audio ? state.slides.every(s => !!s.audioBytes) && !isGeneratingAudioBatch :
                   state.step === AppStep.Preview ? !state.isGeneratingVideo : true)} 
          canPrev={state.step > 0 && !state.isGeneratingVideo && !isGeneratingAudioBatch && !isGeneratingScriptBatch} 
          onNext={nextStep} 
          onPrev={prevStep} 
          isLastStep={state.step === AppStep.Preview}
        >
          {renderContent()}
        </StepWizard>
      </main>
    </div>
  );
}
